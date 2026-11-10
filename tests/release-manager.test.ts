// ==============================================================================
// Zealosh LMS — Release Manager & Rollback Engine Unit Test Suite
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { buildArtifactBuffer } from '../deploy/package-deployment-artifact.mjs';
import {
  deployRelease,
  rollbackRelease,
  acquireMigrationLock,
  releaseMigrationLock,
  checkPendingMigrations,
  getActiveReleasePath,
} from '../deploy/release-manager.mjs';

describe('Zealosh LMS — Release Manager & Rollback Automation', () => {
  let tempBaseDir: string;
  let artifactPath: string;
  let artifactSha256: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zealosh-release-test-'));

    // Build real verified test artifact
    const { tarGzBuffer, sha256 } = buildArtifactBuffer();
    artifactPath = path.join(tempBaseDir, 'test-package.tar.gz');
    fs.writeFileSync(artifactPath, tarGzBuffer);
    artifactSha256 = sha256;
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. should acquire and release migration lock preventing concurrent runs', () => {
    const lockFile = path.join(tempBaseDir, 'shared', 'migration.lock');

    const lock1 = acquireMigrationLock(lockFile, 60000);
    expect(lock1.acquired).toBe(true);
    expect(fs.existsSync(lockFile)).toBe(true);

    // Second acquisition attempt must fail
    const lock2 = acquireMigrationLock(lockFile, 60000);
    expect(lock2.acquired).toBe(false);
    expect(lock2.reason).toContain('Migration lock held');

    // Release lock
    const released = releaseMigrationLock(lockFile);
    expect(released).toBe(true);
    expect(fs.existsSync(lockFile)).toBe(false);

    // Re-acquire must now succeed
    const lock3 = acquireMigrationLock(lockFile, 60000);
    expect(lock3.acquired).toBe(true);
    releaseMigrationLock(lockFile);
  });

  it('2. should check pending database migrations accurately', () => {
    const migrationsDir = path.join(tempBaseDir, 'migrations');
    fs.mkdirSync(migrationsDir, { recursive: true });

    fs.writeFileSync(path.join(migrationsDir, '20261026000001_core.sql'), '-- core');
    fs.writeFileSync(path.join(migrationsDir, '20261026000002_courses.sql'), '-- courses');
    fs.writeFileSync(path.join(migrationsDir, '20261026000003_exams.sql'), '-- exams');

    const result1 = checkPendingMigrations(migrationsDir, ['20261026000001_core.sql']);
    expect(result1.total).toBe(3);
    expect(result1.pendingCount).toBe(2);
    expect(result1.pending).toEqual(['20261026000002_courses.sql', '20261026000003_exams.sql']);

    const result2 = checkPendingMigrations(migrationsDir, [
      '20261026000001_core.sql',
      '20261026000002_courses.sql',
      '20261026000003_exams.sql',
    ]);
    expect(result2.pendingCount).toBe(0);
  });

  it('3. should deploy a verified release, create release directory, and update current pointer', () => {
    const deployResult = deployRelease({
      artifactPath,
      baseDir: tempBaseDir,
      targetVersion: '1.0.0',
      expectedChecksum: artifactSha256,
      skipEnvValidation: true,
    });

    expect(deployResult.success).toBe(true);
    expect(deployResult.fileCount).toBeGreaterThan(50);
    expect(deployResult.releaseId).toContain('release-1.0.0');

    // Verify release directory contents
    expect(fs.existsSync(path.join(deployResult.releaseDir, 'package.json'))).toBe(true);
    expect(fs.existsSync(path.join(deployResult.releaseDir, 'release-metadata.json'))).toBe(true);

    // Verify current pointer points to this release
    const activePath = getActiveReleasePath(path.join(tempBaseDir, 'current'));
    expect(activePath).toBe(deployResult.releaseDir);
  });

  it('4. should deploy a second release and execute instant rollback to previous release', () => {
    // 1. Deploy Release 1.0.0
    const release1 = deployRelease({
      artifactPath,
      baseDir: tempBaseDir,
      targetVersion: '1.0.0',
      expectedChecksum: artifactSha256,
      skipEnvValidation: true,
    });

    // Small delay to ensure timestamp difference
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    return delay(100).then(() => {
      // 2. Deploy Release 1.0.1
      const release2 = deployRelease({
        artifactPath,
        baseDir: tempBaseDir,
        targetVersion: '1.0.1',
        expectedChecksum: artifactSha256,
        skipEnvValidation: true,
      });

      expect(getActiveReleasePath(path.join(tempBaseDir, 'current'))).toBe(release2.releaseDir);

      // 3. Rollback to Release 1.0.0
      const rollbackResult = rollbackRelease({ baseDir: tempBaseDir });
      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.previousRelease).toBe(path.basename(release1.releaseDir));
      expect(getActiveReleasePath(path.join(tempBaseDir, 'current'))).toBe(release1.releaseDir);

      // 4. Verify deployment history audit trail
      const historyFile = path.join(tempBaseDir, 'shared', 'deployment-history.json');
      expect(fs.existsSync(historyFile)).toBe(true);
      const history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      expect(history.length).toBe(3); // 2 deploys + 1 rollback
      expect(history[2].event).toBe('ROLLBACK_SUCCESS');
    });
  });

  it('5. should reject deployment when artifact checksum is tampered', () => {
    expect(() =>
      deployRelease({
        artifactPath,
        baseDir: tempBaseDir,
        targetVersion: '1.0.0',
        expectedChecksum: '0000000000000000000000000000000000000000000000000000000000000000',
        skipEnvValidation: true,
      })
    ).toThrow(/Checksum Mismatch|Verification Failed|Integrity Violation/i);
  });

  it('6. should clean up aborted release directory when pre-deployment validation fails', () => {
    // Create an invalid sharedEnvPath where JWT_SECRET is invalid
    const invalidEnvFile = path.join(tempBaseDir, 'invalid.env');
    fs.writeFileSync(invalidEnvFile, 'JWT_SECRET=short\nPORT=3000\n');

    expect(() =>
      deployRelease({
        artifactPath,
        baseDir: tempBaseDir,
        targetVersion: '1.0.2',
        expectedChecksum: artifactSha256,
        sharedEnvPath: invalidEnvFile,
        skipEnvValidation: false,
      })
    ).toThrow(/Pre-deployment Environment Validation Failed/i);

    // Verify releases directory has no release-1.0.2 directory remaining
    const releasesDir = path.join(tempBaseDir, 'releases');
    if (fs.existsSync(releasesDir)) {
      const remaining = fs.readdirSync(releasesDir).filter((d) => d.includes('release-1.0.2'));
      expect(remaining.length).toBe(0);
    }
  });
});

