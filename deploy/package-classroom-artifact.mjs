#!/usr/bin/env node
// ==============================================================================
// Zealosh Live Classroom — BigBlueButton 4.0 Frontend Deployment Packager
// ==============================================================================
// Pure Node.js deterministic packager for Server 2 (media.staging.zealosh.com).
// Packages customized HTML5 client build artifacts, brand configuration,
// and deployment scripts into a verified, reproducible release archive.
// ==============================================================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const CLASSROOM_DIST_DEFAULT = path.resolve(REPO_ROOT, '../zealosh-classroom/bigbluebutton-html5/dist');
const BBB_CUSTOM_DEFAULT = path.resolve(REPO_ROOT, 'bbb-custom');
const ARTIFACTS_DIR = path.resolve(REPO_ROOT, 'build/artifacts');

const FORBIDDEN_FILE_PATTERNS = [
  /^\.env/i,
  /^secrets/i,
  /\.git/i,
  /node_modules/i,
  /\.log$/i,
  /\.pem$/i,
  /\.key$/i,
  /id_rsa/i,
];

function createTarHeader(filePath, size, mode = 0o644, isDirectory = false) {
  const header = Buffer.alloc(512, 0);
  const normalizedPath = filePath.replace(/\\/g, '/');

  let name = normalizedPath;
  let prefix = '';

  if (Buffer.byteLength(name, 'utf8') > 100) {
    const slashIdx = name.lastIndexOf('/');
    if (slashIdx !== -1) {
      prefix = name.substring(0, slashIdx);
      name = name.substring(slashIdx + 1);
    }
  }

  header.write(name, 0, 100, 'utf8');
  const modeStr = (mode & 0o7777).toString(8).padStart(6, '0') + ' \0';
  header.write(modeStr, 100, 8, 'ascii');
  header.write('0001000 \0', 108, 8, 'ascii');
  header.write('0001000 \0', 116, 8, 'ascii');

  const sizeVal = isDirectory ? 0 : size;
  const sizeStr = sizeVal.toString(8).padStart(11, '0') + ' ';
  header.write(sizeStr, 124, 12, 'ascii');

  const mtimeStr = Math.floor(1793318400).toString(8).padStart(11, '0') + ' ';
  header.write(mtimeStr, 136, 12, 'ascii');
  header.write('        ', 148, 8, 'ascii');
  header.write(isDirectory ? '5' : '0', 156, 1, 'ascii');
  header.write('ustar\0', 257, 6, 'ascii');
  header.write('00', 263, 2, 'ascii');

  if (prefix) {
    header.write(prefix, 345, 155, 'utf8');
  }

  let chksum = 0;
  for (let i = 0; i < 512; i++) {
    chksum += header[i];
  }
  const chksumStr = chksum.toString(8).padStart(6, '0') + '\0 ';
  header.write(chksumStr, 148, 8, 'ascii');

  return header;
}

export function isForbiddenPath(relPath) {
  const normalized = relPath.replace(/\\/g, '/').replace(/^\.\//, '');
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }
  return false;
}

export function collectClassroomFiles(distDir = CLASSROOM_DIST_DEFAULT, customDir = BBB_CUSTOM_DEFAULT) {
  const files = [];

  function walk(baseDir, prefix = '') {
    if (!fs.existsSync(baseDir)) return;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(baseDir, entry.name);
      const tarRelPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, tarRelPath);
      } else if (entry.isFile()) {
        if (!isForbiddenPath(tarRelPath)) {
          files.push({
            absPath: fullPath,
            archivePath: tarRelPath,
          });
        }
      }
    }
  }

  // 1. Walk HTML5 client compiled dist directory into html5-client/
  walk(distDir, 'html5-client');

  // 2. Walk BBB custom branding directory into bbb-custom/
  walk(customDir, 'bbb-custom');

  return files.sort((a, b) => a.archivePath.localeCompare(b.archivePath));
}

/**
 * Builds the deterministic classroom deployment artifact tar.gz buffer.
 * @param {string} [distDir]
 * @param {string} [customDir]
 * @param {{ deterministicTimestamp?: string }} [options]
 */
export function buildClassroomArtifactBuffer(
  distDir = CLASSROOM_DIST_DEFAULT,
  customDir = BBB_CUSTOM_DEFAULT,
  options = {}
) {
  const fileEntries = collectClassroomFiles(distDir, customDir);
  const manifestFiles = [];
  const tarChunks = [];
  let totalUncompressedBytes = 0;

  for (const item of fileEntries) {
    const content = fs.readFileSync(item.absPath);
    const size = content.length;
    totalUncompressedBytes += size;

    const fileHash = crypto.createHash('sha256').update(content).digest('hex');
    manifestFiles.push({
      path: item.archivePath,
      size,
      sha256: fileHash,
    });

    const isExecutable = item.archivePath.endsWith('.sh') || item.archivePath.endsWith('.mjs');
    const mode = isExecutable ? 0o755 : 0o644;
    const header = createTarHeader(item.archivePath, size, mode, false);
    tarChunks.push(header);
    tarChunks.push(content);

    const remainder = size % 512;
    if (remainder > 0) {
      tarChunks.push(Buffer.alloc(512 - remainder, 0));
    }
  }

  const deterministicTimestamp =
    options?.deterministicTimestamp ||
    process.env.SOURCE_DATE_EPOCH_ISO ||
    '2026-10-30T00:00:00.000Z';

  const manifest = {
    packageName: 'zealosh-classroom',
    productIdentity: 'Zealosh Live Classroom',
    baseBBBVersion: '4.0.0-noble',
    customizationVersion: '1.0.0',
    sourceCommit: 'c16a170d01',
    createdAt: deterministicTimestamp,
    branding: {
      brandName: 'Live Classroom',
      primaryColor: '#4f8c4c',
      headerColor: '#252c41',
    },
    fileCount: manifestFiles.length,
    totalUncompressedBytes,
    files: manifestFiles,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestBuffer = Buffer.from(manifestJson, 'utf8');

  const manifestHeader = createTarHeader('classroom-manifest.json', manifestBuffer.length, 0o644, false);
  tarChunks.push(manifestHeader);
  tarChunks.push(manifestBuffer);

  const mRemainder = manifestBuffer.length % 512;
  if (mRemainder > 0) {
    tarChunks.push(Buffer.alloc(512 - mRemainder, 0));
  }

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

export async function packageClassroomArtifactCli() {
  console.log('=== Zealosh Live Classroom: Generating Production Deployment Artifact ===');
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const { tarGzBuffer, sha256, manifest } = buildClassroomArtifactBuffer();
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const archiveFilename = `zealosh-classroom-staging-v${manifest.customizationVersion}-${timestamp}.tar.gz`;
  const archivePath = path.join(ARTIFACTS_DIR, archiveFilename);
  const checksumPath = `${archivePath}.sha256`;
  const manifestPath = path.join(ARTIFACTS_DIR, `${archiveFilename.replace('.tar.gz', '')}.manifest.json`);

  fs.writeFileSync(archivePath, tarGzBuffer);
  fs.writeFileSync(checksumPath, `${sha256}  ${archiveFilename}\n`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Classroom Artifact Created Successfully!`);
  console.log(`  Package:          ${manifest.packageName} v${manifest.customizationVersion}`);
  console.log(`  Source Commit:    ${manifest.sourceCommit}`);
  console.log(`  BBB Base:         ${manifest.baseBBBVersion}`);
  console.log(`  Files:            ${manifest.fileCount} packaged`);
  console.log(`  Archive Size:     ${(tarGzBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  SHA-256 Checksum: ${sha256}`);
  console.log(`  Location:         ${archivePath}`);

  return { archivePath, checksumPath, sha256, manifest };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  packageClassroomArtifactCli().catch((err) => {
    console.error(`Packaging Failed:`, err);
    process.exit(1);
  });
}

