// ==============================================================================
// Zealosh Live Classroom — Deployment Artifact Integrity & Packaging Test Suite
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import zlib from 'node:zlib';
import {
  isForbiddenPath,
  collectClassroomFiles,
  buildClassroomArtifactBuffer,
} from '../deploy/package-classroom-artifact.mjs';
import {
  verifyClassroomArtifact,
  parseTarBuffer,
} from '../deploy/verify-classroom-artifact.mjs';

describe('Zealosh Live Classroom — Deployment Artifact Integrity & Packaging Security', () => {
  let tempTestDir: string;

  beforeEach(() => {
    tempTestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zealosh-classroom-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempTestDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. should classify forbidden files accurately according to zero-leakage policy', () => {
    expect(isForbiddenPath('.env')).toBe(true);
    expect(isForbiddenPath('.env.staging')).toBe(true);
    expect(isForbiddenPath('secrets/private.key')).toBe(true);
    expect(isForbiddenPath('.git/HEAD')).toBe(true);
    expect(isForbiddenPath('node_modules/webpack/index.js')).toBe(true);
    expect(isForbiddenPath('server.log')).toBe(true);

    expect(isForbiddenPath('html5-client/index.html')).toBe(false);
    expect(isForbiddenPath('html5-client/locales/en.json')).toBe(false);
    expect(isForbiddenPath('bbb-custom/settings.yml')).toBe(false);
  });

  it('2. should build a deterministic classroom artifact and verify manifest hashes', () => {
    const mockDist = path.join(tempTestDir, 'dist');
    const mockCustom = path.join(tempTestDir, 'bbb-custom');
    fs.mkdirSync(mockDist, { recursive: true });
    fs.mkdirSync(path.join(mockDist, 'locales'), { recursive: true });
    fs.mkdirSync(path.join(mockDist, 'private/config'), { recursive: true });
    fs.mkdirSync(mockCustom, { recursive: true });

    fs.writeFileSync(path.join(mockDist, 'index.html'), '<html><title>Live Classroom</title></html>');
    fs.writeFileSync(path.join(mockDist, 'locales/en.json'), '{"app.title": "Live Classroom"}');
    fs.writeFileSync(path.join(mockDist, 'private/config/settings.yml'), 'public:\n  clientTitle: Live Classroom\n');
    fs.writeFileSync(path.join(mockCustom, 'apply-branding.sh'), '#!/bin/bash\necho "branded"');
    fs.writeFileSync(path.join(mockCustom, 'settings.yml'), 'public:\n  app:\n    branding: true\n');
    fs.writeFileSync(path.join(mockCustom, 'custom-theme.css'), ':root { --color-primary: #4f8c4c; }');
    fs.writeFileSync(path.join(mockCustom, 'logo.png'), 'fake-png-content');
    fs.writeFileSync(path.join(mockCustom, 'logo-round.png'), 'fake-png-round');

    const { tarGzBuffer, sha256, manifest } = buildClassroomArtifactBuffer(mockDist, mockCustom, {
      deterministicTimestamp: '2026-10-30T00:00:00.000Z',
    });

    expect(tarGzBuffer.length).toBeGreaterThan(0);
    expect(sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(manifest.packageName).toBe('zealosh-classroom');
    expect(manifest.baseBBBVersion).toBe('4.0.0-noble');
    expect(manifest.files.length).toBe(8);

    const testArchive = path.join(tempTestDir, 'test-classroom.tar.gz');
    fs.writeFileSync(testArchive, tarGzBuffer);

    const result = verifyClassroomArtifact(testArchive, sha256);
    expect(result.valid).toBe(true);
    expect(result.manifestFilesCount).toBe(8);
  });

  it('3. should be byte-for-byte reproducible across repeated packaging runs with same inputs', () => {
    const mockDist = path.join(tempTestDir, 'dist');
    const mockCustom = path.join(tempTestDir, 'bbb-custom');
    fs.mkdirSync(mockDist, { recursive: true });
    fs.mkdirSync(path.join(mockDist, 'locales'), { recursive: true });
    fs.mkdirSync(path.join(mockDist, 'private/config'), { recursive: true });
    fs.mkdirSync(mockCustom, { recursive: true });

    fs.writeFileSync(path.join(mockDist, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(mockDist, 'locales/en.json'), '{}');
    fs.writeFileSync(path.join(mockDist, 'private/config/settings.yml'), 'key: val');
    fs.writeFileSync(path.join(mockCustom, 'apply-branding.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(mockCustom, 'settings.yml'), 'key: val');
    fs.writeFileSync(path.join(mockCustom, 'custom-theme.css'), 'css');
    fs.writeFileSync(path.join(mockCustom, 'logo.png'), 'logo');
    fs.writeFileSync(path.join(mockCustom, 'logo-round.png'), 'round');

    const run1 = buildClassroomArtifactBuffer(mockDist, mockCustom, {
      deterministicTimestamp: '2026-10-30T00:00:00.000Z',
    });
    const run2 = buildClassroomArtifactBuffer(mockDist, mockCustom, {
      deterministicTimestamp: '2026-10-30T00:00:00.000Z',
    });

    expect(run1.sha256).toBe(run2.sha256);
    expect(run1.tarGzBuffer.equals(run2.tarGzBuffer)).toBe(true);
  });

  it('4. should reject an artifact when checksum does not match', () => {
    const mockDist = path.join(tempTestDir, 'dist');
    const mockCustom = path.join(tempTestDir, 'bbb-custom');
    fs.mkdirSync(mockDist, { recursive: true });
    fs.mkdirSync(path.join(mockDist, 'locales'), { recursive: true });
    fs.mkdirSync(path.join(mockDist, 'private/config'), { recursive: true });
    fs.mkdirSync(mockCustom, { recursive: true });

    fs.writeFileSync(path.join(mockDist, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(mockDist, 'locales/en.json'), '{}');
    fs.writeFileSync(path.join(mockDist, 'private/config/settings.yml'), 'key: val');
    fs.writeFileSync(path.join(mockCustom, 'apply-branding.sh'), '#!/bin/bash');
    fs.writeFileSync(path.join(mockCustom, 'settings.yml'), 'key: val');
    fs.writeFileSync(path.join(mockCustom, 'custom-theme.css'), 'css');
    fs.writeFileSync(path.join(mockCustom, 'logo.png'), 'logo');
    fs.writeFileSync(path.join(mockCustom, 'logo-round.png'), 'round');

    const { tarGzBuffer } = buildClassroomArtifactBuffer(mockDist, mockCustom);
    const testArchive = path.join(tempTestDir, 'test-tampered.tar.gz');
    fs.writeFileSync(testArchive, tarGzBuffer);

    expect(() => {
      verifyClassroomArtifact(testArchive, '0000000000000000000000000000000000000000000000000000000000000000');
    }).toThrow(/Checksum Mismatch/i);
  });

  it('5. should reject an artifact missing mandatory runtime files', () => {
    const mockDist = path.join(tempTestDir, 'dist');
    const mockCustom = path.join(tempTestDir, 'bbb-custom');
    fs.mkdirSync(mockDist, { recursive: true });
    fs.mkdirSync(mockCustom, { recursive: true });

    // Missing index.html and settings.yml
    fs.writeFileSync(path.join(mockDist, 'other.html'), '<html></html>');
    fs.writeFileSync(path.join(mockCustom, 'other.sh'), '#!/bin/bash');

    const { tarGzBuffer, sha256 } = buildClassroomArtifactBuffer(mockDist, mockCustom);
    const testArchive = path.join(tempTestDir, 'incomplete.tar.gz');
    fs.writeFileSync(testArchive, tarGzBuffer);

    expect(() => {
      verifyClassroomArtifact(testArchive, sha256);
    }).toThrow(/Missing mandatory runtime files/i);
  });
});

