// ==============================================================================
// Zealosh LMS — Deployment Artifact Integrity & Security Verification Suite
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import zlib from 'node:zlib';
import {
  isForbiddenPath,
  collectArtifactFiles,
  buildArtifactBuffer,
} from '../deploy/package-deployment-artifact.mjs';
import {
  verifyArtifact,
  parseTarBuffer,
} from '../deploy/verify-deployment-artifact.mjs';

describe('Zealosh LMS — Deployment Artifact Integrity & Packaging Security', () => {
  let tempTestDir: string;

  beforeEach(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zealosh-artifact-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. should classify forbidden files and paths accurately according to zero-leakage policy', () => {
    // Strictly forbidden patterns
    expect(isForbiddenPath('data/zealosh-store.json')).toBe(true);
    expect(isForbiddenPath('data/seed.json')).toBe(true);
    expect(isForbiddenPath('.env')).toBe(true);
    expect(isForbiddenPath('.env.local')).toBe(true);
    expect(isForbiddenPath('.env.staging')).toBe(true);
    expect(isForbiddenPath('.env.production')).toBe(true);
    expect(isForbiddenPath('secrets/moodle_admin_password.txt')).toBe(true);
    expect(isForbiddenPath('.git/config')).toBe(true);
    expect(isForbiddenPath('node_modules/next/index.js')).toBe(true);
    expect(isForbiddenPath('.next/server/app.js')).toBe(true);
    expect(isForbiddenPath('tests/auth.test.ts')).toBe(true);
    expect(isForbiddenPath('scratch/temp.txt')).toBe(true);
    expect(isForbiddenPath('.agents/skills/router.md')).toBe(true);
    expect(isForbiddenPath('server.log')).toBe(true);
    expect(isForbiddenPath('cert.pem')).toBe(true);
    expect(isForbiddenPath('key.pem')).toBe(true);
    expect(isForbiddenPath('id_rsa')).toBe(true);

    // Permitted templates and runtime files
    expect(isForbiddenPath('.env.staging.example')).toBe(false);
    expect(isForbiddenPath('.env.production.example')).toBe(false);
    expect(isForbiddenPath('package.json')).toBe(false);
    expect(isForbiddenPath('src/app/page.tsx')).toBe(false);
    expect(isForbiddenPath('deploy/nginx/nginx.staging.conf')).toBe(false);
    expect(isForbiddenPath('bbb-custom/settings.yml')).toBe(false);
  });

  it('2. should build a deterministic deployment artifact and generate valid SHA-256 and manifest', () => {
    const { tarGzBuffer, sha256, manifest } = buildArtifactBuffer();

    expect(tarGzBuffer).toBeInstanceOf(Buffer);
    expect(tarGzBuffer.length).toBeGreaterThan(10000); // Has reasonable uncompressed source
    expect(sha256).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hex string

    expect(manifest.packageName).toBe('zealosh-lms');
    expect(manifest.fileCount).toBeGreaterThan(50);
    expect(manifest.totalUncompressedBytes).toBeGreaterThan(tarGzBuffer.length);
    expect(manifest.files.length).toBe(manifest.fileCount);

    // Verify all manifest file paths use normalized forward slashes
    for (const f of manifest.files) {
      expect(f.path).not.toContain('\\');
      expect(f.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(f.size).toBeGreaterThan(0);
      expect(isForbiddenPath(f.path)).toBe(false);
    }
  });

  it('3. should pass complete pre-activation verification on a generated package', () => {
    const { tarGzBuffer, sha256 } = buildArtifactBuffer();
    const testArchive = path.join(tempTestDir, 'test-release.tar.gz');
    fs.writeFileSync(testArchive, tarGzBuffer);

    const result = verifyArtifact(testArchive, sha256);

    expect(result.valid).toBe(true);
    expect(result.sha256).toBe(sha256);
    expect(result.manifestFilesCount).toBeGreaterThan(50);
  });

  it('4. should reject an artifact when SHA-256 checksum does not match', () => {
    const { tarGzBuffer } = buildArtifactBuffer();
    const testArchive = path.join(tempTestDir, 'tampered-release.tar.gz');
    fs.writeFileSync(testArchive, tarGzBuffer);

    const wrongChecksum = '0000000000000000000000000000000000000000000000000000000000000000';

    expect(() => {
      verifyArtifact(testArchive, wrongChecksum);
    }).toThrow(/SHA-256 Checksum Mismatch/i);
  });

  it('5. should reject an artifact containing forbidden files (e.g. injected .env or store)', () => {
    // Create a mock TAR with an injected prohibited .env file
    const mockRepo = path.join(tempTestDir, 'mock-repo');
    fs.mkdirSync(path.join(mockRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(mockRepo, 'package.json'), JSON.stringify({ name: 'mock', version: '1.0.0' }));
    fs.writeFileSync(path.join(mockRepo, '.env'), 'SECRET_KEY=leaked_secret_here');

    expect(() => {
      buildArtifactBuffer(mockRepo, ['package.json', '.env']);
    }).toThrow(/Security Violation: Attempted to package prohibited file: .env/i);
  });

  it('6. should reject an artifact when mandatory runtime files are missing', () => {
    const mockRepo = path.join(tempTestDir, 'mock-incomplete');
    fs.mkdirSync(mockRepo, { recursive: true });
    fs.writeFileSync(path.join(mockRepo, 'package.json'), '{}');

    const { tarGzBuffer, sha256 } = buildArtifactBuffer(mockRepo, ['package.json']);
    const testArchive = path.join(tempTestDir, 'incomplete.tar.gz');
    fs.writeFileSync(testArchive, tarGzBuffer);

    expect(() => {
      verifyArtifact(testArchive, sha256);
    }).toThrow(/Missing mandatory runtime files/i);
  });

  it('7. should reject an archive with path traversal entries (e.g. ../../etc/passwd)', () => {
    // Construct a malicious TAR header directly
    const evilHeader = Buffer.alloc(512, 0);
    evilHeader.write('../../../etc/shadow', 0, 100, 'utf8');
    evilHeader.write('0000644 \0', 100, 8, 'ascii');
    evilHeader.write('00000000010 ', 124, 12, 'ascii'); // 8 bytes
    evilHeader.write('1793318400 ', 136, 12, 'ascii');
    evilHeader.write('        ', 148, 8, 'ascii');
    evilHeader.write('0', 156, 1, 'ascii');
    evilHeader.write('ustar\0', 257, 6, 'ascii');
    evilHeader.write('00', 263, 2, 'ascii');

    let sum = 0;
    for (let i = 0; i < 512; i++) sum += evilHeader[i];
    evilHeader.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

    const payload = Buffer.concat([evilHeader, Buffer.alloc(512, 'A'), Buffer.alloc(1024, 0)]);
    const compressed = zlib.gzipSync(payload);

    const evilArchive = path.join(tempTestDir, 'evil.tar.gz');
    fs.writeFileSync(evilArchive, compressed);

    expect(() => {
      verifyArtifact(evilArchive);
    }).toThrow(/Path traversal or absolute path detected/i);
  });

  it('8. should produce byte-for-byte reproducible archives from identical inputs', () => {
    const mockRepo = path.join(tempTestDir, 'reproducible-repo');
    fs.mkdirSync(path.join(mockRepo, 'src'), { recursive: true });
    fs.writeFileSync(path.join(mockRepo, 'package.json'), JSON.stringify({ name: 'repro', version: '1.0.0' }));
    fs.writeFileSync(path.join(mockRepo, 'src/index.ts'), 'export const x = 1;');

    const run1 = buildArtifactBuffer(mockRepo, ['package.json', 'src/index.ts'], {
      deterministicTimestamp: '2026-10-30T00:00:00.000Z',
    });
    const run2 = buildArtifactBuffer(mockRepo, ['package.json', 'src/index.ts'], {
      deterministicTimestamp: '2026-10-30T00:00:00.000Z',
    });

    expect(run1.sha256).toBe(run2.sha256);
    expect(run1.tarGzBuffer.equals(run2.tarGzBuffer)).toBe(true);
  });

  it('9. should reject an archive with unsupported TAR entry type (e.g. symlink)', () => {
    // Construct a TAR header with typeFlag '2' (symlink)
    const symlinkHeader = Buffer.alloc(512, 0);
    symlinkHeader.write('symlink_test', 0, 100, 'utf8');
    symlinkHeader.write('0000777 \0', 100, 8, 'ascii');
    symlinkHeader.write('00000000000 ', 124, 12, 'ascii');
    symlinkHeader.write('1793318400 ', 136, 12, 'ascii');
    symlinkHeader.write('        ', 148, 8, 'ascii');
    symlinkHeader.write('2', 156, 1, 'ascii'); // Symlink
    symlinkHeader.write('ustar\0', 257, 6, 'ascii');
    symlinkHeader.write('00', 263, 2, 'ascii');

    let sum = 0;
    for (let i = 0; i < 512; i++) sum += symlinkHeader[i];
    symlinkHeader.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');

    const payload = Buffer.concat([symlinkHeader, Buffer.alloc(1024, 0)]);
    const compressed = zlib.gzipSync(payload);

    const symlinkArchive = path.join(tempTestDir, 'symlink.tar.gz');
    fs.writeFileSync(symlinkArchive, compressed);

    expect(() => {
      verifyArtifact(symlinkArchive);
    }).toThrow(/Unsupported or unsafe TAR entry type/i);
  });
});

