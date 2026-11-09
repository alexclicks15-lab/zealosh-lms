// tests/institutional-audit-archives.test.ts
// Vitest suite for Zealosh Single-Institution Audit Archive & Integrity Verification Engine

import { describe, it, expect } from 'vitest';
import { institutionalArchiveService } from '@/lib/audit/institutional-archive-service';
import { db } from '@/lib/store/db';

describe('Zealosh Institutional Audit Archive Engine', () => {
  it('generates a deterministic JSONL archive with SHA-256 checksum and embedded manifest', async () => {
    const res = await institutionalArchiveService.generateArchive({
      archivePeriod: '2026-Q4',
      scope: 'ALL',
      format: 'JSONL',
      actorUserId: 'admin-auditor-01',
    });

    expect(res.success).toBe(true);
    expect(res.archive).toBeDefined();
    expect(res.content).toBeDefined();

    const archive = res.archive!;
    expect((archive as any).institution).toBeUndefined(); // single-institution: institution name lives in manifest
    expect(archive.manifest.institution).toBe('Zealosh Training & Consultants');
    expect(archive.format).toBe('JSONL');
    expect(archive.integrityStatus).toBe('VERIFIED');
    expect(archive.retentionStatus).toBe('RETENTION_POLICY_UNCONFIGURED');
    expect(archive.contentChecksum).toHaveLength(64); // SHA-256 hex string

    // Manifest checksum matches content checksum
    expect(archive.manifest.checksum).toBe(archive.contentChecksum);
  });

  it('generates a CSV format archive with canonical headers', async () => {
    const res = await institutionalArchiveService.generateArchive({
      archivePeriod: '2026-11',
      scope: 'FINANCIAL',
      format: 'CSV',
      actorUserId: 'admin-auditor-02',
    });

    expect(res.success).toBe(true);
    expect(res.archive?.format).toBe('CSV');
    expect(res.content).toContain('id,action,userId,resource,timestamp');
  });

  it('verifies archive integrity and detects content byte tampering', async () => {
    const res = await institutionalArchiveService.generateArchive({
      archivePeriod: '2026-Q4',
      scope: 'ALL',
      format: 'JSONL',
      actorUserId: 'admin-auditor-01',
    });
    expect(res.success).toBe(true);
    const archive = res.archive!;
    const originalContent = res.content!;

    // 1. Untampered content should verify cleanly
    const cleanCheck = await institutionalArchiveService.verifyArchiveIntegrity(
      archive.id,
      originalContent
    );
    expect(cleanCheck.verified).toBe(true);
    expect(cleanCheck.status).toBe('VERIFIED');

    // 2. Tampered content (1 byte modified) should fail verification with TAMPER_DETECTED
    const tamperedContent = originalContent + '\n{"tampered":true}';
    const tamperCheck = await institutionalArchiveService.verifyArchiveIntegrity(
      archive.id,
      tamperedContent
    );
    expect(tamperCheck.verified).toBe(false);
    expect(tamperCheck.status).toBe('TAMPER_DETECTED');
    expect(tamperCheck.error).toContain('Tamper detected');

    // Archive record in database must reflect TAMPER_DETECTED status
    const updatedRecord = await db.getInstitutionalAuditArchiveById(archive.id);
    expect(updatedRecord?.integrityStatus).toBe('TAMPER_DETECTED');
  });

  it('records download counts and tracking for authorized archive exports', async () => {
    const res = await institutionalArchiveService.generateArchive({
      archivePeriod: '2026-Q4',
      scope: 'ALL',
      format: 'JSONL',
      actorUserId: 'admin-auditor-01',
    });
    const archive = res.archive!;

    expect(archive.downloadCount).toBe(0);

    const downloadSuccess = await institutionalArchiveService.recordArchiveDownload(
      archive.id,
      'admin-auditor-03'
    );
    expect(downloadSuccess).toBe(true);

    const refreshed = await db.getInstitutionalAuditArchiveById(archive.id);
    expect(refreshed?.downloadCount).toBe(1);
    expect(refreshed?.lastDownloadedAt).toBeDefined();
  });
});
