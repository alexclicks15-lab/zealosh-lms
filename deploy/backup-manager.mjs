#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Backup & Disaster Recovery Automation Engine
// Milestone: ZM-IMPL-09 (Stage B-Prep)
// Handles deterministic backup creation, SHA-256 manifest generation,
// AES-256-GCM encryption, restore verification, and retention pruning.
// STRICT INVARIANT: Never overwrites or touches data/zealosh-store.json.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates a standard 512-byte UStar TAR header block.
 */
function createTarHeader(filePath, size, mode = 0o644, isDirectory = false) {
  const header = Buffer.alloc(512, 0);
  let name = filePath.replace(/\\/g, '/');
  let prefix = '';

  if (isDirectory && !name.endsWith('/')) {
    name += '/';
  }

  if (name.length > 100) {
    const lastSlash = name.lastIndexOf('/', 155);
    if (lastSlash !== -1 && lastSlash <= 155) {
      prefix = name.substring(0, lastSlash);
      name = name.substring(lastSlash + 1);
    } else {
      throw new Error(`File path exceeds TAR header limits (255 chars): ${filePath}`);
    }
  }

  header.write(name, 0, 100, 'utf8');
  header.write((mode & 0o7777).toString(8).padStart(6, '0') + ' \0', 100, 8, 'ascii');
  header.write('0001000 \0', 108, 8, 'ascii');
  header.write('0001000 \0', 116, 8, 'ascii');
  header.write((isDirectory ? 0 : size).toString(8).padStart(11, '0') + ' ', 124, 12, 'ascii');
  header.write(Math.floor(1793318400).toString(8).padStart(11, '0') + ' ', 136, 12, 'ascii');
  header.write('        ', 148, 8, 'ascii');
  header.write(isDirectory ? '5' : '0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');
  header.write('zealosh', 265, 32, 'ascii');
  header.write('zealosh', 297, 32, 'ascii');
  if (prefix) header.write(prefix, 345, 155, 'utf8');

  let checksum = 0;
  for (let i = 0; i < 512; i++) checksum += header[i];
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

  return header;
}

/**
 * Parses in-memory TAR buffer into entries.
 */
function parseTarBuffer(tarBuffer) {
  const entries = [];
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const headerBlock = tarBuffer.subarray(offset, offset + 512);
    if (headerBlock.every((b) => b === 0)) break;

    const nameRaw = headerBlock.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefixRaw = headerBlock.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullPath = prefixRaw ? `${prefixRaw}/${nameRaw}` : nameRaw;
    const size = parseInt(headerBlock.subarray(124, 136).toString('ascii').trim().replace(/\0.*$/, ''), 8) || 0;
    const typeFlag = String.fromCharCode(headerBlock[156]);

    offset += 512;
    const content = tarBuffer.subarray(offset, offset + size);
    entries.push({ path: fullPath, size, typeFlag, content });

    const remainder = size % 512;
    offset += size + (remainder > 0 ? 512 - remainder : 0);
  }

  return entries;
}

/**
 * Encrypts buffer with AES-256-GCM.
 */
function encryptBuffer(buffer, secretKey) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');

  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([
    Buffer.from('ZGCM1'), // 5-byte header
    salt,               // 16 bytes
    iv,                 // 12 bytes
    authTag,            // 16 bytes
    encrypted,
  ]);
}

/**
 * Decrypts AES-256-GCM buffer.
 */
function decryptBuffer(encryptedBuffer, secretKey) {
  const header = encryptedBuffer.subarray(0, 5).toString('ascii');
  if (header !== 'ZGCM1') {
    throw new Error('Encryption Error: Invalid or unrecognized encrypted backup header.');
  }

  const salt = encryptedBuffer.subarray(5, 21);
  const iv = encryptedBuffer.subarray(21, 33);
  const authTag = encryptedBuffer.subarray(33, 49);
  const data = encryptedBuffer.subarray(49);

  const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Creates a verified backup archive from specified files or directories.
 * @param {Object} options
 * @param {Array<{ sourcePath: string, archivePath: string }>} [options.sourceFiles]
 * @param {string} options.backupDir
 * @param {string} [options.label]
 * @param {string|null} [options.encryptKey]
 * @param {Record<string, any>} [options.metadata]
 */
export function createBackupArchive({
  sourceFiles = [],
  backupDir,
  label = 'operational',
  encryptKey = null,
  metadata = {},
}) {
  const startTime = Date.now();
  fs.mkdirSync(backupDir, { recursive: true });

  const tarBlocks = [];
  const manifestFiles = [];

  for (const item of sourceFiles) {
    if (!fs.existsSync(item.sourcePath)) continue;

    const stat = fs.statSync(item.sourcePath);
    if (stat.isFile()) {
      const content = fs.readFileSync(item.sourcePath);
      const sha256 = crypto.createHash('sha256').update(content).digest('hex');
      const normalizedPath = item.archivePath.replace(/\\/g, '/');

      manifestFiles.push({
        path: normalizedPath,
        size: content.length,
        sha256,
      });

      tarBlocks.push(createTarHeader(normalizedPath, content.length));
      tarBlocks.push(content);
      const remainder = content.length % 512;
      if (remainder > 0) tarBlocks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  // Add manifest.json into the archive
  const manifest = {
    backupLabel: label,
    createdAt: new Date().toISOString(),
    fileCount: manifestFiles.length,
    metadata,
    files: manifestFiles,
  };
  const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  tarBlocks.push(createTarHeader('backup-manifest.json', manifestBuffer.length));
  tarBlocks.push(manifestBuffer);
  const mRemainder = manifestBuffer.length % 512;
  if (mRemainder > 0) tarBlocks.push(Buffer.alloc(512 - mRemainder, 0));

  // Two 512-byte zero blocks at end of TAR
  tarBlocks.push(Buffer.alloc(1024, 0));

  const uncompressedTar = Buffer.concat(tarBlocks);
  const gzipBuffer = zlib.gzipSync(uncompressedTar, { level: 9 });

  const isEncrypted = Boolean(encryptKey);
  const finalPayload = isEncrypted ? encryptBuffer(gzipBuffer, encryptKey) : gzipBuffer;
  const finalSha256 = crypto.createHash('sha256').update(finalPayload).digest('hex');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const ext = isEncrypted ? 'tar.gz.enc' : 'tar.gz';
  const filename = `backup-${label}-${timestamp}.${ext}`;
  const archivePath = path.join(backupDir, filename);

  fs.writeFileSync(archivePath, finalPayload);

  // Write sidecar metadata file
  const sidecar = {
    filename,
    archivePath,
    sha256: finalSha256,
    isEncrypted,
    fileCount: manifestFiles.length,
    sizeBytes: finalPayload.length,
    createdAt: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
  fs.writeFileSync(`${archivePath}.meta.json`, JSON.stringify(sidecar, null, 2), 'utf8');

  return sidecar;
}

/**
 * Verifies an existing backup archive without restoring.
 * @param {Object} options
 * @param {string} options.archivePath
 * @param {string|null} [options.decryptKey]
 * @param {string|null} [options.expectedChecksum]
 */
export function verifyBackupArchive({ archivePath, decryptKey = null, expectedChecksum = null }) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Backup file not found: ${archivePath}`);
  }

  const fileBuffer = fs.readFileSync(archivePath);
  const actualSha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');

  if (expectedChecksum && actualSha256.toLowerCase() !== expectedChecksum.toLowerCase()) {
    throw new Error(`Backup Checksum Mismatch: expected ${expectedChecksum}, got ${actualSha256}`);
  }

  let uncompressedTar;
  const isEncrypted = archivePath.endsWith('.enc');

  if (isEncrypted) {
    if (!decryptKey) {
      throw new Error('Verification Failed: Backup is encrypted but no decryptKey was provided.');
    }
    const decryptedGzip = decryptBuffer(fileBuffer, decryptKey);
    uncompressedTar = zlib.gunzipSync(decryptedGzip);
  } else {
    uncompressedTar = zlib.gunzipSync(fileBuffer);
  }

  const entries = parseTarBuffer(uncompressedTar);
  const manifestEntry = entries.find((e) => e.path === 'backup-manifest.json');
  if (!manifestEntry) {
    throw new Error('Verification Failed: Backup archive is missing backup-manifest.json.');
  }

  const manifest = JSON.parse(manifestEntry.content.toString('utf8'));

  // Validate each file in manifest matches archive content
  for (const expectedFile of manifest.files) {
    const entry = entries.find((e) => e.path === expectedFile.path);
    if (!entry) {
      throw new Error(`Verification Failed: File ${expectedFile.path} listed in manifest is missing from archive.`);
    }

    const entrySha256 = crypto.createHash('sha256').update(entry.content).digest('hex');
    if (entrySha256 !== expectedFile.sha256) {
      throw new Error(
        `Verification Failed: File ${expectedFile.path} checksum mismatch (expected ${expectedFile.sha256}, got ${entrySha256})`
      );
    }
  }

  return {
    valid: true,
    fileCount: manifest.files.length,
    sha256: actualSha256,
    isEncrypted,
    manifest,
  };
}

/**
 * Safely restores backup archive to target directory using two-stage atomic staging.
 * STRICT INVARIANT: Refuses to overwrite or touch data/zealosh-store.json.
 * @param {Object} options
 * @param {string} options.archivePath
 * @param {string} options.restoreTargetDir
 * @param {string|null} [options.decryptKey]
 * @param {boolean} [options.allowOverwrite]
 */
export function restoreBackupArchive({
  archivePath,
  restoreTargetDir,
  decryptKey = null,
  allowOverwrite = true,
}) {
  const verifyResult = verifyBackupArchive({ archivePath, decryptKey });
  if (!verifyResult.valid) {
    throw new Error('Restore Aborted: Archive failed integrity verification.');
  }

  const projectRoot = path.resolve(__dirname, '..');
  const protectedStorePath = path.resolve(projectRoot, 'data', 'zealosh-store.json');
  const resolvedTarget = path.resolve(restoreTargetDir);

  // Staging folder for atomic restoration
  const stagingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zealosh-restore-staging-'));

  try {
    const fileBuffer = fs.readFileSync(archivePath);
    let uncompressedTar;
    if (archivePath.endsWith('.enc')) {
      const decrypted = decryptBuffer(fileBuffer, decryptKey);
      uncompressedTar = zlib.gunzipSync(decrypted);
    } else {
      uncompressedTar = zlib.gunzipSync(fileBuffer);
    }

    const entries = parseTarBuffer(uncompressedTar);
    const restoredFiles = [];

    // Stage 1: Validate and unpack into staging directory
    for (const entry of entries) {
      if (entry.path === 'backup-manifest.json') continue;

      const normalizedRelative = path.normalize(entry.path).replace(/^(\.\.[\/\\])+/, '');
      if (
        normalizedRelative.startsWith('..') ||
        path.isAbsolute(normalizedRelative) ||
        /^[a-zA-Z]:/.test(normalizedRelative)
      ) {
        throw new Error(`Security Violation: Path traversal in backup archive (${entry.path})`);
      }

      const stagingDest = path.resolve(stagingDir, normalizedRelative);
      if (!stagingDest.startsWith(stagingDir)) {
        throw new Error(`Security Violation: Path escaping staging sandbox (${entry.path})`);
      }

      // STRICT INVARIANT: Protect historical store
      const finalDest = path.resolve(resolvedTarget, normalizedRelative);
      if (
        entry.path.includes('zealosh-store.json') ||
        normalizedRelative.includes('zealosh-store.json') ||
        finalDest.toLowerCase() === protectedStorePath.toLowerCase()
      ) {
        throw new Error('Security Violation: Restoration attempted to overwrite protected store (zealosh-store.json)!');
      }

      fs.mkdirSync(path.dirname(stagingDest), { recursive: true });
      fs.writeFileSync(stagingDest, entry.content);
      restoredFiles.push(normalizedRelative);
    }

    // Stage 2: Atomically copy staged files to destination target
    fs.mkdirSync(resolvedTarget, { recursive: true });
    for (const relPath of restoredFiles) {
      const srcFile = path.join(stagingDir, relPath);
      const destFile = path.join(resolvedTarget, relPath);

      if (fs.existsSync(destFile) && !allowOverwrite) {
        throw new Error(`Restore Aborted: Existing file collision at ${destFile}`);
      }

      fs.mkdirSync(path.dirname(destFile), { recursive: true });
      fs.copyFileSync(srcFile, destFile);
    }

    // Stage 3: Record recovery evidence
    const recoveryEvidence = {
      restoredAt: new Date().toISOString(),
      archivePath: path.resolve(archivePath),
      archiveSha256: verifyResult.sha256,
      fileCount: restoredFiles.length,
      restoredFiles,
      status: 'RESTORE_VERIFIED',
    };

    const evidencePath = path.join(resolvedTarget, 'recovery-audit.json');
    fs.writeFileSync(evidencePath, JSON.stringify(recoveryEvidence, null, 2), 'utf8');

    return {
      success: true,
      restoredFilesCount: restoredFiles.length,
      restoredFiles,
      restoreTargetDir: resolvedTarget,
      evidence: recoveryEvidence,
    };
  } finally {
    try {
      if (fs.existsSync(stagingDir)) {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      }
    } catch {}
  }
}

/**
 * Enforces retention policy by pruning old backups.
 */
export function pruneOldBackups({ backupDir, retainDays = 30, minKeepCount = 3 }) {
  if (!fs.existsSync(backupDir)) return { prunedCount: 0, remainingCount: 0 };

  const files = fs
    .readdirSync(backupDir)
    .filter((f) => f.startsWith('backup-') && (f.endsWith('.tar.gz') || f.endsWith('.tar.gz.enc')))
    .sort()
    .reverse();

  if (files.length <= minKeepCount) {
    return { prunedCount: 0, remainingCount: files.length };
  }

  const cutoffMs = Date.now() - retainDays * 24 * 60 * 60 * 1000;
  let prunedCount = 0;

  for (let i = minKeepCount; i < files.length; i++) {
    const filePath = path.join(backupDir, files[i]);
    const stat = fs.statSync(filePath);
    if (stat.mtimeMs < cutoffMs) {
      fs.unlinkSync(filePath);
      const metaPath = `${filePath}.meta.json`;
      if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
      prunedCount++;
    }
  }

  return {
    prunedCount,
    remainingCount: files.length - prunedCount,
  };
}

