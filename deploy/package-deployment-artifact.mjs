#!/usr/bin/env node
// ==============================================================================
// Zealosh LMS — Deterministic Production Deployment Artifact Packager
// ==============================================================================
// Pure Node.js (zero external dependencies) implementation of UStar tar.gz packaging.
// Enforces explicit inclusion and exclusion policies, generates SHA-256 checksums,
// creates an immutable artifact manifest, and validates zero secret leakage.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');

// Mandatory Inclusions (Only verified runtime code and configuration templates)
const INCLUDED_ROOT_FILES = [
  'package.json',
  'package-lock.json',
  'next.config.mjs',
  'tsconfig.json',
  'Dockerfile',
  'docker-compose.zealosh-platform.yml',
  '.env.staging.example',
];

const INCLUDED_DIRECTORIES = [
  'src',
  'public',
  'deploy',
  'moodle-custom',
  'bbb-custom',
];

// Strict Prohibited Patterns (Packing immediately aborts if any matches)
const FORBIDDEN_FILE_PATTERNS = [
  /^data\/.*\.json$/i,
  /^data\/zealosh-store\.json$/i,
  /^\.env$/i,
  /^\.env\.(?!.*example).*$/i, // Forbids .env, .env.local, .env.staging, .env.production, etc. (permits .env.*.example templates)
  /^secrets(\/.*)?$/i,
  /^\.git(\/.*)?$/i,
  /^node_modules(\/.*)?$/i,
  /^\.next(\/.*)?$/i,
  /^tests(\/.*)?$/i,
  /^scratch(\/.*)?$/i,
  /^\.agents(\/.*)?$/i,
  /\.log$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
];

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

  // File Name (0-99)
  header.write(name, 0, 100, 'utf8');

  // Mode (100-107) - octal string, 6 digits + null/space
  const modeStr = (mode & 0o7777).toString(8).padStart(6, '0') + ' \0';
  header.write(modeStr, 100, 8, 'ascii');

  // UID & GID (108-123)
  header.write('0001000 \0', 108, 8, 'ascii');
  header.write('0001000 \0', 116, 8, 'ascii');

  // Size (124-135) - 11 octal digits + null/space (0 for directories)
  const sizeVal = isDirectory ? 0 : size;
  const sizeStr = sizeVal.toString(8).padStart(11, '0') + ' ';
  header.write(sizeStr, 124, 12, 'ascii');

  // MTime (136-147) - Deterministic static timestamp (2026-10-30T00:00:00Z)
  const mtimeStr = Math.floor(1793318400).toString(8).padStart(11, '0') + ' ';
  header.write(mtimeStr, 136, 12, 'ascii');

  // Checksum field initialized to 8 spaces (148-155)
  header.write('        ', 148, 8, 'ascii');

  // Type flag (156) - '0' for normal file, '5' for directory
  header.write(isDirectory ? '5' : '0', 156, 1, 'ascii');

  // Magic & Version (257-264) - "ustar\0" + "00"
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  // Prefix (345-499)
  if (prefix) {
    header.write(prefix, 345, 155, 'utf8');
  }

  // Calculate Checksum: Unsigned sum of all 512 bytes
  let chksum = 0;
  for (let i = 0; i < 512; i++) {
    chksum += header[i];
  }

  const chksumStr = chksum.toString(8).padStart(6, '0') + '\0 ';
  header.write(chksumStr, 148, 8, 'ascii');

  return header;
}

/**
 * Validates whether a relative path violates forbidden inclusion rules.
 */
export function isForbiddenPath(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  return false;
}

/**
 * Collects all eligible files deterministically.
 */
export function collectArtifactFiles(repoRoot = REPO_ROOT) {
  const fileEntries = [];

  // 1. Root files
  for (const rootFile of INCLUDED_ROOT_FILES) {
    const absPath = path.join(repoRoot, rootFile);
    if (fs.existsSync(absPath)) {
      if (isForbiddenPath(rootFile)) {
        throw new Error(`Security Exception: Root file ${rootFile} is marked as forbidden.`);
      }
      fileEntries.push(rootFile.replace(/\\/g, '/'));
    }
  }

  // 2. Directories
  for (const dirName of INCLUDED_DIRECTORIES) {
    const dirAbs = path.join(repoRoot, dirName);
    if (!fs.existsSync(dirAbs)) continue;

    function walk(currentDir) {
      const items = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const item of items) {
        const itemAbs = path.join(currentDir, item.name);
        const itemRel = path.relative(repoRoot, itemAbs).replace(/\\/g, '/');

        if (isForbiddenPath(itemRel)) {
          continue; // Safely skip forbidden file or subfolder
        }

        if (item.isDirectory()) {
          walk(itemAbs);
        } else if (item.isFile()) {
          fileEntries.push(itemRel);
        }
      }
    }

    walk(dirAbs);
  }

  // Deterministic lexicographical sort
  return fileEntries.sort();
}

/**
 * Builds the artifact tar.gz buffer along with its manifest.
 * @param {string} [repoRoot]
 * @param {string[] | null} [fileList]
 * @param {{ deterministicTimestamp?: string }} [options]
 */
export function buildArtifactBuffer(repoRoot = REPO_ROOT, fileList = null, options = {}) {
  const files = fileList || collectArtifactFiles(repoRoot);
  const manifestFiles = [];
  const tarChunks = [];

  let totalUncompressedBytes = 0;

  for (const relPath of files) {
    if (isForbiddenPath(relPath)) {
      throw new Error(`Security Violation: Attempted to package prohibited file: ${relPath}`);
    }

    const absPath = path.join(repoRoot, relPath);
    const content = fs.readFileSync(absPath);
    const size = content.length;
    totalUncompressedBytes += size;

    const fileHash = crypto.createHash('sha256').update(content).digest('hex');

    manifestFiles.push({
      path: relPath,
      size,
      sha256: fileHash,
    });

    // TAR Header block
    const isExecutable = relPath.endsWith('.sh') || relPath.endsWith('.mjs');
    const mode = isExecutable ? 0o755 : 0o644;
    const header = createTarHeader(relPath, size, mode, false);
    tarChunks.push(header);

    // File Content block
    tarChunks.push(content);

    // Padding to 512-byte boundary
    const remainder = size % 512;
    if (remainder > 0) {
      const padBytes = 512 - remainder;
      tarChunks.push(Buffer.alloc(padBytes, 0));
    }
  }

  // Create Manifest Document
  let pkgVersion = '1.0.0';
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    pkgVersion = pkg.version || '1.0.0';
  } catch {}

  const deterministicTimestamp =
    options?.deterministicTimestamp ||
    process.env.SOURCE_DATE_EPOCH_ISO ||
    '2026-10-30T00:00:00.000Z';

  const manifest = {
    packageName: 'zealosh-lms',
    version: pkgVersion,
    createdAt: deterministicTimestamp,
    fileCount: manifestFiles.length,
    totalUncompressedBytes,
    files: manifestFiles,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBuffer = Buffer.from(manifestJson, 'utf8');

  // Append manifest.json into TAR as the final administrative file
  const manifestHeader = createTarHeader('artifact-manifest.json', manifestBuffer.length, 0o644, false);
  tarChunks.push(manifestHeader);
  tarChunks.push(manifestBuffer);
  const mRemainder = manifestBuffer.length % 512;
  if (mRemainder > 0) {
    tarChunks.push(Buffer.alloc(512 - mRemainder, 0));
  }

  // End of TAR archive: Two 512-byte zero blocks
  tarChunks.push(Buffer.alloc(1024, 0));

  const uncompressedTar = Buffer.concat(tarChunks);
  const compressedGzip = zlib.gzipSync(uncompressedTar, { level: 9 });

  const archiveSha256 = crypto.createHash('sha256').update(compressedGzip).digest('hex');

  return {
    tarGzBuffer: compressedGzip,
    sha256: archiveSha256,
    manifest,
  };
}

/**
 * CLI Entrypoint
 */
export async function packageArtifactCli(options = {}) {
  const outputDir = options.outputDir || path.join(REPO_ROOT, 'build', 'artifacts');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('=== Zealosh LMS: Building Deterministic Deployment Artifact ===');
  console.log(`Repository Root:   ${REPO_ROOT}`);
  console.log(`Output Directory:  ${outputDir}`);

  const startTime = Date.now();
  const { tarGzBuffer, sha256, manifest } = buildArtifactBuffer(REPO_ROOT);
  const durationMs = Date.now() - startTime;

  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const baseName = `zealosh-lms-staging-v${manifest.version}-${timestamp}`;

  const archivePath = path.join(outputDir, `${baseName}.tar.gz`);
  const checksumPath = path.join(outputDir, `${baseName}.tar.gz.sha256`);
  const manifestPath = path.join(outputDir, `${baseName}.manifest.json`);

  fs.writeFileSync(archivePath, tarGzBuffer);
  fs.writeFileSync(checksumPath, `${sha256}  ${path.basename(archivePath)}\n`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log('Artifact Packaging Complete!');
  console.log(`  Package File:    ${archivePath} (${(tarGzBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`  SHA-256 Digest:  ${sha256}`);
  console.log(`  Total Files:     ${manifest.fileCount}`);
  console.log(`  Uncompressed:    ${(manifest.totalUncompressedBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Packaging Time:  ${durationMs}ms`);

  return {
    archivePath,
    checksumPath,
    manifestPath,
    sha256,
    manifest,
  };
}

if (process.argv[1] && process.argv[1].endsWith('package-deployment-artifact.mjs')) {
  packageArtifactCli().catch((err) => {
    console.error('FATAL Artifact Packaging Error:', err.message);
    process.exit(1);
  });
}
