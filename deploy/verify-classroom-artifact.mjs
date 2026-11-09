#!/usr/bin/env node
// ==============================================================================
// Zealosh Live Classroom — Production Artifact Integrity & Safety Verifier
// ==============================================================================
// Pure Node.js verification script executed pre-activation on Server 2 (media.staging.zealosh.com).
// Verifies package SHA-256 against checksum file, validates in-memory TAR records,
// checks file-level manifests, rejects path-traversal & zip-bombs,
// and asserts complete presence of required HTML5 assets and brand configurations.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const MANDATORY_CLASSROOM_FILES = [
  'html5-client/index.html',
  'html5-client/locales/en.json',
  'html5-client/private/config/settings.yml',
  'bbb-custom/apply-branding.sh',
  'bbb-custom/settings.yml',
  'bbb-custom/custom-theme.css',
  'bbb-custom/logo.png',
  'bbb-custom/logo-round.png',
];

const STRICT_FORBIDDEN_PATTERNS = [
  /^\.env/i,
  /^secrets/i,
  /\.git/i,
  /node_modules/i,
  /\.log$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
];

export function parseTarBuffer(tarBuffer) {
  const records = [];
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const headerBlock = tarBuffer.subarray(offset, offset + 512);

    const isZeroBlock = headerBlock.every((b) => b === 0);
    if (isZeroBlock) {
      break;
    }

    const nameRaw = headerBlock.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefixRaw = headerBlock.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullPath = prefixRaw ? `${prefixRaw}/${nameRaw}` : nameRaw;

    const sizeStr = headerBlock.subarray(124, 136).toString('ascii').trim().replace(/\0.*$/, '');
    const size = parseInt(sizeStr, 8) || 0;
    const typeFlag = String.fromCharCode(headerBlock[156]);

    offset += 512;

    const content = tarBuffer.subarray(offset, offset + size);
    records.push({
      path: fullPath,
      size,
      typeFlag,
      content,
    });

    const remainder = size % 512;
    const padding = remainder > 0 ? 512 - remainder : 0;
    offset += size + padding;
  }

  return records;
}

/**
 * Comprehensive verification of a classroom deployment artifact.
 * @param {string} archivePath
 * @param {string | null} [expectedChecksum]
 */
export function verifyClassroomArtifact(archivePath, expectedChecksum = null) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Classroom artifact file not found: ${archivePath}`);
  }

  const archiveBuffer = fs.readFileSync(archivePath);
  const actualSha256 = crypto.createHash('sha256').update(archiveBuffer).digest('hex');

  // 1. Verify Checksum
  if (expectedChecksum) {
    const cleanExpected = expectedChecksum.trim().split(/\s+/)[0].toLowerCase();
    if (actualSha256.toLowerCase() !== cleanExpected) {
      throw new Error(
        `Classroom Artifact Integrity Violation: SHA-256 Checksum Mismatch!\n` +
        `  Expected: ${cleanExpected}\n` +
        `  Computed: ${actualSha256}`
      );
    }
  }

  // 2. Uncompress GZIP
  let uncompressedTar;
  try {
    uncompressedTar = zlib.gunzipSync(archiveBuffer);
  } catch (err) {
    throw new Error(`Archive Decompression Failed: Corrupted or non-gzip payload (${err.message})`);
  }

  // Tar bomb protection: Decompressed size cap (250MB)
  if (uncompressedTar.length > 250 * 1024 * 1024) {
    throw new Error(
      `Security Violation: Decompressed archive size (${uncompressedTar.length} bytes) exceeds safety threshold (250MB)`
    );
  }

  // 3. Parse TAR blocks
  const entries = parseTarBuffer(uncompressedTar);
  if (entries.length === 0) {
    throw new Error('Classroom archive is empty: Zero valid TAR records found.');
  }

  // Tar bomb protection: Entry count cap (5,000 files)
  if (entries.length > 5000) {
    throw new Error(
      `Security Violation: Archive entry count (${entries.length}) exceeds safety threshold (5000 entries)`
    );
  }

  const seenPaths = new Set();
  const entryPaths = new Set();

  // 4. Validate Path Traversal, Unsupported Types & Forbidden Files
  for (const entry of entries) {
    const p = entry.path;

    if (seenPaths.has(p)) {
      throw new Error(`Security Violation: Duplicate entry path detected in archive (shadowing attack): ${p}`);
    }
    seenPaths.add(p);
    entryPaths.add(p);

    if (
      entry.typeFlag !== '0' &&
      entry.typeFlag !== '5' &&
      entry.typeFlag !== '\0' &&
      entry.typeFlag !== ''
    ) {
      throw new Error(
        `Security Violation: Unsupported or unsafe TAR entry type ('${entry.typeFlag}') in file: ${p}`
      );
    }

    if (
      p.startsWith('/') ||
      p.startsWith('\\') ||
      p.includes('\\') ||
      p.includes('..') ||
      p.includes(':/') ||
      /^[a-zA-Z]:/.test(p)
    ) {
      throw new Error(`Security Violation: Path traversal or absolute path detected in classroom archive: ${p}`);
    }

    for (const pattern of STRICT_FORBIDDEN_PATTERNS) {
      if (pattern.test(p)) {
        throw new Error(`Security Violation: Prohibited file found inside classroom artifact: ${p}`);
      }
    }
  }

  // 5. Validate Mandatory Runtime Files
  const missingMandatory = [];
  for (const requiredFile of MANDATORY_CLASSROOM_FILES) {
    if (!entryPaths.has(requiredFile)) {
      missingMandatory.push(requiredFile);
    }
  }
  if (missingMandatory.length > 0) {
    throw new Error(
      `Classroom Validation Failed: Missing mandatory runtime files:\n  - ${missingMandatory.join('\n  - ')}`
    );
  }

  // 6. Validate Embedded Manifest
  const manifestEntry = entries.find((e) => e.path === 'classroom-manifest.json');
  if (!manifestEntry) {
    throw new Error('Classroom Validation Failed: Missing classroom-manifest.json inside package.');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.content.toString('utf8'));
  } catch (err) {
    throw new Error(`Classroom Validation Failed: Corrupted classroom-manifest.json (${err.message})`);
  }

  const entryMap = new Map(entries.map((e) => [e.path, e]));
  let verifiedFilesCount = 0;

  for (const fileRecord of manifest.files) {
    const entry = entryMap.get(fileRecord.path);
    if (!entry) {
      throw new Error(`Manifest Discrepancy: File ${fileRecord.path} declared in manifest but missing from archive.`);
    }

    if (entry.size !== fileRecord.size) {
      throw new Error(
        `Manifest Discrepancy: File ${fileRecord.path} size mismatch (Manifest: ${fileRecord.size}, Archive: ${entry.size})`
      );
    }

    const computedFileHash = crypto.createHash('sha256').update(entry.content).digest('hex');
    if (computedFileHash !== fileRecord.sha256) {
      throw new Error(`Manifest Discrepancy: File ${fileRecord.path} SHA-256 hash mismatch!`);
    }

    verifiedFilesCount++;
  }

  // Security Check: Verify that zero unmanifested files exist in archive (except manifest itself)
  const manifestPathSet = new Set(manifest.files.map((f) => f.path));
  for (const entry of entries) {
    if (entry.path === 'classroom-manifest.json') continue;
    if (!manifestPathSet.has(entry.path)) {
      throw new Error(`Security Violation: Unmanifested file detected in classroom archive: ${entry.path}`);
    }
  }

  return {
    valid: true,
    sha256: actualSha256,
    fileCount: entries.length,
    manifestFilesCount: verifiedFilesCount,
    packageName: manifest.packageName,
    customizationVersion: manifest.customizationVersion,
    baseBBBVersion: manifest.baseBBBVersion,
    sourceCommit: manifest.sourceCommit,
    totalBytes: archiveBuffer.length,
  };
}

export async function verifyClassroomArtifactCli() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node deploy/verify-classroom-artifact.mjs <archive-path> [checksum-file-or-hash]');
    process.exit(1);
  }

  const archivePath = path.resolve(args[0]);
  let expectedChecksum = null;

  if (args[1]) {
    if (fs.existsSync(args[1])) {
      const content = fs.readFileSync(args[1], 'utf8').trim();
      expectedChecksum = content.split(/\s+/)[0];
    } else {
      expectedChecksum = args[1];
    }
  }

  console.log(`=== Zealosh Live Classroom: Verifying Deployment Artifact Integrity ===`);
  console.log(`Target Archive:   ${archivePath}`);
  if (expectedChecksum) {
    console.log(`Checksum Source:  ${expectedChecksum}`);
  }

  try {
    const result = verifyClassroomArtifact(archivePath, expectedChecksum);
    console.log('Classroom Artifact Verification PASSED Successfully!');
    console.log(`  Package:          ${result.packageName} v${result.customizationVersion}`);
    console.log(`  BBB Base:         ${result.baseBBBVersion}`);
    console.log(`  Source Commit:    ${result.sourceCommit}`);
    console.log(`  Package SHA-256:  ${result.sha256}`);
    console.log(`  Archive Entries:  ${result.fileCount}`);
    console.log(`  Manifest Files:   ${result.manifestFilesCount} files verified`);
    console.log(`  Zero forbidden files, zero path traversals, zero secret leaks.`);
    process.exit(0);
  } catch (err) {
    console.error(`Classroom Artifact Verification FAILED:`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  verifyClassroomArtifactCli();
}

