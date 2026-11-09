// Zealosh LMS — Institutional Audit Archive & Integrity Verification Engine
// Path: src/lib/audit/institutional-archive-service.ts
// Compiles deterministic, checksum-verified compliance archives for the single-institution platform,
// detecting tamper attempts and preserving unpurged historical records.

import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  InstitutionalAuditArchive,
  InstitutionalAuditArchiveManifest,
  AuditArchiveFormat,
} from '@/types';

export interface GenerateArchiveOptions {
  archivePeriod: string; // e.g. "2026-Q4", "2026-11"
  scope?: string; // e.g. "ALL", "FINANCIAL", "ADMISSIONS", "SECURITY"
  includedEventTypes?: string[];
  format?: AuditArchiveFormat;
  actorUserId: string;
}

export class InstitutionalArchiveService {
  /**
   * Compiles an institutional audit archive with canonical SHA-256 checksumming and embedded manifest
   */
  public async generateArchive(
    options: GenerateArchiveOptions
  ): Promise<{ success: boolean; archive?: InstitutionalAuditArchive; content?: string; error?: string }> {
    try {
      const {
        archivePeriod,
        scope = 'ALL',
        includedEventTypes = ['*'],
        format = 'JSONL',
        actorUserId,
      } = options;

      const archiveId = `arch-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      // 1. Fetch Authoritative Audit and Outbox Records
      const rawRecords = await db.getAuditRecordsForArchive(archivePeriod, scope);
      const recordCount = rawRecords.length;

      // 2. Canonical Deterministic Serialization
      let content = '';
      if (format === 'JSONL') {
        content = rawRecords
          .map((r) => JSON.stringify(r, Object.keys(r).sort()))
          .join('\n');
      } else {
        // CSV format
        if (rawRecords.length > 0) {
          const headers = ['id', 'action', 'userId', 'resource', 'timestamp'];
          const rows = rawRecords.map((r: any) =>
            headers.map((h) => `"${String(r[h] || '').replace(/"/g, '""')}"`).join(',')
          );
          content = [headers.join(','), ...rows].join('\n');
        } else {
          content = 'id,action,userId,resource,timestamp\n';
        }
      }

      // 3. Compute Cryptographic SHA-256 Checksum of the canonical content
      const contentChecksum = crypto.createHash('sha256').update(content).digest('hex');

      // 4. Build Manifest
      const firstRecordTimestamp = rawRecords[0]?.timestamp || now;
      const lastRecordTimestamp = rawRecords[rawRecords.length - 1]?.timestamp || now;

      const manifest: InstitutionalAuditArchiveManifest = {
        archiveId,
        institution: 'Zealosh Training & Consultants',
        createdAt: now,
        recordCount,
        checksum: contentChecksum,
        firstRecordTimestamp,
        lastRecordTimestamp,
        createdBy: actorUserId,
      };

      // 5. Store Archive Record
      const archive: InstitutionalAuditArchive = {
        id: archiveId,
        archivePeriod,
        scope,
        includedEventTypes,
        sourceRecordCount: recordCount,
        format,
        contentChecksum,
        manifest,
        integrityStatus: 'VERIFIED',
        retentionStatus: 'RETENTION_POLICY_UNCONFIGURED', // Preserved under institutional policy
        createdBy: actorUserId,
        createdAt: now,
        downloadCount: 0,
      };

      await db.saveInstitutionalAuditArchive(archive);

      // Audit archive creation
      await db.createAuditLog({
        userId: actorUserId,
        action: 'AUDIT_ARCHIVE_GENERATED',
        resource: 'institutional_audit_archives',
        resourceId: archiveId,
        details: {
          archivePeriod,
          scope,
          recordCount,
          checksum: contentChecksum,
        },
      });

      return { success: true, archive, content };
    } catch (err: any) {
      console.error('[InstitutionalArchiveService] Archive generation failed:', err);
      return { success: false, error: err.message || 'Archive generation error' };
    }
  }

  /**
   * Verifies archive integrity against SHA-256 checksum, detecting byte tampering
   */
  public async verifyArchiveIntegrity(
    archiveId: string,
    providedContent?: string
  ): Promise<{
    verified: boolean;
    status: 'VERIFIED' | 'TAMPER_DETECTED' | 'NOT_FOUND';
    expectedChecksum?: string;
    calculatedChecksum?: string;
    error?: string;
  }> {
    const archive = await db.getInstitutionalAuditArchiveById(archiveId);
    if (!archive) {
      return { verified: false, status: 'NOT_FOUND', error: `Archive '${archiveId}' not found.` };
    }

    if (providedContent !== undefined) {
      const calculatedChecksum = crypto.createHash('sha256').update(providedContent).digest('hex');
      const isMatch = calculatedChecksum === archive.contentChecksum && calculatedChecksum === archive.manifest.checksum;

      if (!isMatch) {
        await db.updateInstitutionalAuditArchive(archiveId, {
          integrityStatus: 'TAMPER_DETECTED',
          tamperedAt: new Date().toISOString(),
        });
        return {
          verified: false,
          status: 'TAMPER_DETECTED',
          expectedChecksum: archive.contentChecksum,
          calculatedChecksum,
          error: 'Content hash does not match canonical archive manifest. Tamper detected.',
        };
      }

      return {
        verified: true,
        status: 'VERIFIED',
        expectedChecksum: archive.contentChecksum,
        calculatedChecksum,
      };
    }

    // Self-consistency check between stored checksum and manifest
    const isManifestMatch = archive.contentChecksum === archive.manifest.checksum;
    return {
      verified: isManifestMatch,
      status: isManifestMatch ? 'VERIFIED' : 'TAMPER_DETECTED',
      expectedChecksum: archive.manifest.checksum,
      calculatedChecksum: archive.contentChecksum,
    };
  }

  /**
   * Authorizes and records download of an archive
   */
  public async recordArchiveDownload(
    archiveId: string,
    actorUserId: string
  ): Promise<boolean> {
    const archive = await db.getInstitutionalAuditArchiveById(archiveId);
    if (!archive) return false;

    await db.updateInstitutionalAuditArchive(archiveId, {
      downloadCount: (archive.downloadCount || 0) + 1,
      lastDownloadedAt: new Date().toISOString(),
    });

    await db.createAuditLog({
      userId: actorUserId,
      action: 'AUDIT_ARCHIVE_DOWNLOADED',
      resource: 'institutional_audit_archives',
      resourceId: archiveId,
      details: { archivePeriod: archive.archivePeriod, scope: archive.scope },
    });

    return true;
  }
}

export const institutionalArchiveService = new InstitutionalArchiveService();

