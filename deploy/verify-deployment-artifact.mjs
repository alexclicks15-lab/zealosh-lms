#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Production Deployment Artifact Integrity & Safety Verifier
// ==============================================================================
// Pure Node.js verification script executed pre-activation on staging/production hosts.
// Verifies package SHA-256 against checksum file, validates uncompressed content,
// checks file-level manifests, rejects path-traversal & symlink escapes,
// and strictly asserts ZERO leakage of .env, secrets, or protected data.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const MANDATORY_RUNTIME_FILES = [
  'package.json',
  'Dockerfile',
  'docker-compose.zealosh-platform.yml',
  'deploy/nginx/nginx.staging.conf',
  'deploy/staging-bootstrap.sh',
  'deploy/bbb-staging-setup.sh',
  'moodle-custom/theme_zealosh/config.php',
  'bbb-custom/settings.yml',
];

const STRICT_FORBIDDEN_PATTERNS = [
  /^data\/.*\.json$/i,
  /^data\/zealosh-store\.json$/i,
  /^\.env$/i,
  /^\.env\.(?!.*example).*$/i,
  /^secrets(\/.*)?$/i,
  /^\.git(\/.*)?$/i,
  /^node_modules(\/.*)?$/i,
  /^\.next(\/.*)?$/i,
  /^tests(\/.*)?$/i,
  /^scratch(\/.*)?$/i,
  /\.log$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
];

/**
 * Parses an in-memory uncompressed TAR buffer into file records.
 */
export function parseTarBuffer(tarBuffer) {
  const records = [];
  let offset = 0;

  while (offset + 512 <= tarBuffer.length) {
    const headerBlock = tarBuffer.subarray(offset, offset + 512);

    // Check for empty block (end of archive)
    const isZeroBlock = headerBlock.every((b) => b === 0);
    if (isZeroBlock) {
      break;
    }

    // Parse Name & Prefix
    const nameRaw = headerBlock.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
    const prefixRaw = headerBlock.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
    const fullPath = prefixRaw ? `${prefixRaw}/${nameRaw}` : nameRaw;

    // Parse Size (124-135) - octal string
    const sizeStr = headerBlock.subarray(124, 136).toString('ascii').trim().replace(/\0.*$/, '');
    const size = parseInt(sizeStr, 8) || 0;

    // Type Flag
    const typeFlag = String.fromCharCode(headerBlock[156]);

    offset += 512;

    const content = tarBuffer.subarray(offset, offset + size);
    records.push({
      path: fullPath,
      size,
      typeFlag,
      content,
    });

    // Advance offset to next 512-byte boundary
    const remainder = size % 512;
    const padding = remainder > 0 ? 512 - remainder : 0;
    offset += size + padding;
  }

  return records;
}

/**
 * Comprehensive verification of an artifact bundle.
 * @param {string} archivePath
 * @param {string | null} [expectedChecksum]
 */
export function verifyArtifact(archivePath, expectedChecksum = null) {
  if (!fs.existsSync(archivePath)) {
    throw new Error(`Deployment artifact file not found: ${archivePath}`);
  }

  const archiveBuffer = fs.readFileSync(archivePath);
  const actualSha256 = crypto.createHash('sha256').update(archiveBuffer).digest('hex');

  // 1. Verify Archive Checksum
  if (expectedChecksum) {
    const cleanExpected = expectedChecksum.trim().split(/\s+/)[0].toLowerCase();
    if (actualSha256.toLowerCase() !== cleanExpected) {
      throw new Error(
        `Artifact Integrity Violation: SHA-256 Checksum Mismatch!\n` +
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
    throw new Error('Archive is empty: Zero valid TAR records found.');
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

    // Check Duplicate Entries (Tar shadowing attack)
    if (seenPaths.has(p)) {
      throw new Error(`Security Violation: Duplicate entry path detected in archive (shadowing attack): ${p}`);
    }
    seenPaths.add(p);
    entryPaths.add(p);

    // Check Safe Entry Types (Only regular files '0', directories '5', or null byte allowed)
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

    // Check Path Traversal & Windows Drive / Backslash Escapes
    if (
      p.startsWith('/') ||
      p.startsWith('\\') ||
      p.includes('\\') ||
      p.split('/').some((segment) => segment === '..' || segment === '.') ||
      p.includes(':/') ||
      /^[a-zA-Z]:/.test(p)
    ) {
      throw new Error(`Security Violation: Path traversal or absolute path detected in archive: ${p}`);
    }

    // Check Forbidden File Patterns
    for (const pattern of STRICT_FORBIDDEN_PATTERNS) {
      if (pattern.test(p)) {
        throw new Error(`Security Violation: Prohibited file found inside deployment artifact: ${p}`);
      }
    }
  }

  // 5. Validate Mandatory Runtime Files
  const missingMandatory = [];
  for (const requiredFile of MANDATORY_RUNTIME_FILES) {
    if (!entryPaths.has(requiredFile)) {
      missingMandatory.push(requiredFile);
    }
  }
  if (missingMandatory.length > 0) {
    throw new Error(
      `Artifact Validation Failed: Missing mandatory runtime files:\n  - ${missingMandatory.join('\n  - ')}`
    );
  }

  // 6. Validate Embedded Manifest
  const manifestEntry = entries.find((e) => e.path === 'artifact-manifest.json');
  if (!manifestEntry) {
    throw new Error('Artifact Validation Failed: Missing administrative artifact-manifest.json inside package.');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.content.toString('utf8'));
  } catch (err) {
    throw new Error(`Artifact Validation Failed: Corrupted artifact-manifest.json (${err.message})`);
  }

  // Verify all files declared in manifest exist and match individual SHA-256
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
      throw new Error(
        `Manifest Discrepancy: File ${fileRecord.path} SHA-256 hash mismatch!`
      );
    }

    verifiedFilesCount++;
  }

  // Security Check: Verify that zero unmanifested files exist in archive (except the manifest itself)
  const manifestPathSet = new Set(manifest.files.map((f) => f.path));
  for (const entry of entries) {
    if (entry.path === 'artifact-manifest.json') continue;
    if (!manifestPathSet.has(entry.path)) {
      throw new Error(`Security Violation: Unmanifested file detected in archive: ${entry.path}`);
    }
  }

  return {
    valid: true,
    sha256: actualSha256,
    fileCount: entries.length,
    manifestFilesCount: verifiedFilesCount,
    packageName: manifest.packageName,
    version: manifest.version,
    createdAt: manifest.createdAt,
    totalBytes: archiveBuffer.length,
  };
}

/**
 * CLI Entrypoint
 */
export async function verifyArtifactCli() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node deploy/verify-deployment-artifact.mjs <archive.tar.gz> [<checksum.sha256>]');
    process.exit(1);
  }

  const archivePath = path.resolve(args[0]);
  let expectedChecksum = null;

  if (args[1]) {
    const checksumPath = path.resolve(args[1]);
    if (fs.existsSync(checksumPath)) {
      expectedChecksum = fs.readFileSync(checksumPath, 'utf8');
    } else {
      expectedChecksum = args[1]; // passed as direct hash string
    }
  } else {
    const autoChecksumPath = `${archivePath}.sha256`;
    if (fs.existsSync(autoChecksumPath)) {
      expectedChecksum = fs.readFileSync(autoChecksumPath, 'utf8');
    }
  }

  console.log('=== Zealosh LMS: Verifying Deployment Artifact Integrity ===');
  console.log(`Target Archive:   ${archivePath}`);
  if (expectedChecksum) {
    console.log(`Checksum Source:  ${expectedChecksum.trim().split(/\s+/)[0]}`);
  }

  try {
    const result = verifyArtifact(archivePath, expectedChecksum);
    console.log('Artifact Verification PASSED Successfully!');
    console.log(`  Package:          ${result.packageName} v${result.version}`);
    console.log(`  Package SHA-256:  ${result.sha256}`);
    console.log(`  Archive Entries:  ${result.fileCount}`);
    console.log(`  Manifest Files:   ${result.manifestFilesCount} files verified`);
    console.log(`  Zero forbidden files, zero path traversals, zero secret leaks.`);
    process.exit(0);
  } catch (err) {
    console.error('FATAL Verification Failure:', err.message);
    process.exit(1);
  }
}

if (process.argv[1] && process.argv[1].endsWith('verify-deployment-artifact.mjs')) {
  verifyArtifactCli();
}

