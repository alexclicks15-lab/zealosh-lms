// ==============================================================================
// Zealosh LMS — Backup & Disaster Recovery Automation Unit Test Suite
// ==============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createBackupArchive,
  verifyBackupArchive,
  restoreBackupArchive,
  pruneOldBackups,
} from '../deploy/backup-manager.mjs';

describe('Zealosh LMS — Backup & Disaster Recovery Automation', () => {
  let tempBaseDir: string;
  let sourceDir: string;
  let backupDir: string;
  let restoreDir: string;

  beforeEach(() => {
    tempBaseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zealosh-backup-test-'));
    sourceDir = path.join(tempBaseDir, 'source');
    backupDir = path.join(tempBaseDir, 'backups');
    restoreDir = path.join(tempBaseDir, 'restores');

    fs.mkdirSync(sourceDir, { recursive: true });
    fs.mkdirSync(backupDir, { recursive: true });
    fs.mkdirSync(restoreDir, { recursive: true });

    // Create test files to back up
    fs.writeFileSync(path.join(sourceDir, 'config.json'), JSON.stringify({ app: 'zealosh' }));
    fs.writeFileSync(path.join(sourceDir, 'audit.log'), '2026-11-09 INFO User login usr-admin-01\n');
  });

  afterEach(() => {
    try {
      fs.rmSync(tempBaseDir, { recursive: true, force: true });
    } catch {}
  });

  it('1. should create and verify an unencrypted backup archive with manifest', () => {
    const backupResult = createBackupArchive({
      sourceFiles: [
        { sourcePath: path.join(sourceDir, 'config.json'), archivePath: 'config.json' },
        { sourcePath: path.join(sourceDir, 'audit.log'), archivePath: 'logs/audit.log' },
      ],
      backupDir,
      label: 'operational',
    });

    expect(backupResult.filename).toContain('backup-operational');
    expect(fs.existsSync(backupResult.archivePath)).toBe(true);
    expect(fs.existsSync(`${backupResult.archivePath}.meta.json`)).toBe(true);

    const verify = verifyBackupArchive({
      archivePath: backupResult.archivePath,
      expectedChecksum: backupResult.sha256,
    });

    expect(verify.valid).toBe(true);
    expect(verify.fileCount).toBe(2);
    expect(verify.manifest.files.some((f: any) => f.path === 'logs/audit.log')).toBe(true);
  });

  it('2. should create, verify, and decrypt an AES-256-GCM encrypted backup archive', () => {
    const encryptionKey = 'super_secure_offline_gpg_key_32bytes_long';

    const backupResult = createBackupArchive({
      sourceFiles: [
        { sourcePath: path.join(sourceDir, 'config.json'), archivePath: 'config.json' },
      ],
      backupDir,
      label: 'secure-secrets',
      encryptKey: encryptionKey,
    });

    expect(backupResult.isEncrypted).toBe(true);
    expect(backupResult.filename).toContain('.enc');

    // Verification with correct key succeeds
    const verify = verifyBackupArchive({
      archivePath: backupResult.archivePath,
      decryptKey: encryptionKey,
    });
    expect(verify.valid).toBe(true);

    // Verification without key fails
    expect(() =>
      verifyBackupArchive({
        archivePath: backupResult.archivePath,
        decryptKey: null,
      })
    ).toThrow(/no decryptKey was provided/i);

    // Verification with wrong key fails
    expect(() =>
      verifyBackupArchive({
        archivePath: backupResult.archivePath,
        decryptKey: 'wrong_password_key',
      })
    ).toThrow();
  });

  it('3. should restore an archive into target directory and preserve byte contents', () => {
    const backupResult = createBackupArchive({
      sourceFiles: [
        { sourcePath: path.join(sourceDir, 'config.json'), archivePath: 'etc/config.json' },
        { sourcePath: path.join(sourceDir, 'audit.log'), archivePath: 'var/audit.log' },
      ],
      backupDir,
      label: 'restore-test',
    });

    const restoreResult = restoreBackupArchive({
      archivePath: backupResult.archivePath,
      restoreTargetDir: restoreDir,
    });

    expect(restoreResult.success).toBe(true);
    expect(restoreResult.restoredFilesCount).toBe(2);
    expect(restoreResult.evidence).toBeDefined();
    expect(restoreResult.evidence.status).toBe('RESTORE_VERIFIED');
    expect(fs.existsSync(path.join(restoreDir, 'recovery-audit.json'))).toBe(true);

    // Check restored file contents
    const restoredConfig = fs.readFileSync(path.join(restoreDir, 'etc/config.json'), 'utf8');
    expect(JSON.parse(restoredConfig)).toEqual({ app: 'zealosh' });

    const restoredAudit = fs.readFileSync(path.join(restoreDir, 'var/audit.log'), 'utf8');
    expect(restoredAudit).toContain('User login usr-admin-01');
  });

  it('4. should reject archive restoration if it contains protected zealosh-store.json', () => {
    // Create a fake archive containing zealosh-store.json
    fs.writeFileSync(path.join(sourceDir, 'fake-store.json'), '{"protected": true}');
    const backupResult = createBackupArchive({
      sourceFiles: [
        { sourcePath: path.join(sourceDir, 'fake-store.json'), archivePath: 'data/zealosh-store.json' },
      ],
      backupDir,
      label: 'dangerous',
    });

    expect(() =>
      restoreBackupArchive({
        archivePath: backupResult.archivePath,
        restoreTargetDir: restoreDir,
      })
    ).toThrow(/Security Violation: Restoration attempted to overwrite protected store/i);
  });

  it('5. should prune old backups respecting retention rules', () => {
    // Create 4 dummy backup files
    for (let i = 1; i <= 4; i++) {
      createBackupArchive({
        sourceFiles: [{ sourcePath: path.join(sourceDir, 'config.json'), archivePath: 'config.json' }],
        backupDir,
        label: `retention-${i}`,
      });
    }

    // Prune with minKeepCount = 2
    const prune = pruneOldBackups({
      backupDir,
      retainDays: 0, // Immediately eligible if older
      minKeepCount: 2,
    });

    expect(prune.remainingCount).toBeGreaterThanOrEqual(2);
  });

  it('6. should reject restoration of a corrupted encrypted archive leaving restore target clean', () => {
    const key = 'test_encryption_key_32bytes_sec';
    const backupResult = createBackupArchive({
      sourceFiles: [{ sourcePath: path.join(sourceDir, 'config.json'), archivePath: 'config.json' }],
      backupDir,
      label: 'corrupt-test',
      encryptKey: key,
    });

    // Tamper with encrypted bytes
    const buf = fs.readFileSync(backupResult.archivePath);
    buf[buf.length - 5] ^= 0xff; // Flip bits in ciphertext
    const corruptPath = path.join(backupDir, 'corrupt-backup.tar.gz.enc');
    fs.writeFileSync(corruptPath, buf);

    const cleanTargetDir = path.join(tempBaseDir, 'clean-restore-target');

    expect(() =>
      restoreBackupArchive({
        archivePath: corruptPath,
        restoreTargetDir: cleanTargetDir,
        decryptKey: key,
      })
    ).toThrow();

    // Verify target directory has no partial files written
    if (fs.existsSync(cleanTargetDir)) {
      expect(fs.readdirSync(cleanTargetDir).length).toBe(0);
    }
  });
});

