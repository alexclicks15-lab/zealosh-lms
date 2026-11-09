// Zealosh LMS — Recording Storage & Delivery Service
// Architecture: ADR-002 (Server-Side Authoritative & Defense-in-Depth)
// Encapsulates durable object-storage signed URLs, access policy verification, and streaming tokens

import crypto from 'crypto';
import { getSupabaseAdminClient } from '@/lib/supabase';
import { ClassRecording, User } from '@/types';
import { db } from '@/lib/store/db';

const MEDIA_SECRET = process.env.MEDIA_SIGNING_SECRET || process.env.JWT_SECRET || 'zealosh_media_stream_signing_key_2026';

export interface PlaybackAccessResult {
  allowed: boolean;
  authorized: boolean;
  reason?: string;
  canDownload: boolean;
  recording?: ClassRecording;
  streamUrl?: string;
  downloadUrl?: string;
  expiresInSeconds?: number;
}

export interface StreamTokenPayload {
  recordingId: string;
  userId: string;
  action: 'stream' | 'download';
  exp: number;
}

export class RecordingStorageService {
  /**
   * Generates a tamper-proof HMAC-SHA256 token for video streaming or downloading.
   */
  public generateToken(recordingId: string, userId: string, action: 'stream' | 'download' = 'stream', expiresInSeconds: number = 7200): string {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const data = `${recordingId}:${userId}:${action}:${exp}`;
    const sig = crypto.createHmac('sha256', MEDIA_SECRET).update(data).digest('base64url');
    const payload = Buffer.from(JSON.stringify({ recordingId, userId, action, exp })).toString('base64url');
    return `${payload}.${sig}`;
  }

  public generatePlaybackToken(recordingId: string, userId: string, canDownload: boolean = false, expiresInSeconds: number = 7200): string {
    return this.generateToken(recordingId, userId, canDownload ? 'download' : 'stream', expiresInSeconds);
  }

  public verifyPlaybackToken(token: string, expectedRecordingId?: string): { recordingId: string; userId: string; canDownload: boolean } | null {
    const res = this.verifyToken(token);
    if (!res.valid || !res.payload) return null;
    if (expectedRecordingId && res.payload.recordingId !== expectedRecordingId) return null;
    return {
      recordingId: res.payload.recordingId,
      userId: res.payload.userId,
      canDownload: res.payload.action === 'download',
    };
  }

  public getStreamUrl(recording: ClassRecording, userId: string): string {
    const token = this.generateToken(recording.id, userId, 'stream');
    return `/api/recordings/${recording.id}/stream?token=${token}`;
  }

  public getDownloadUrl(recording: ClassRecording, userId: string): string {
    const token = this.generateToken(recording.id, userId, 'download');
    return `/api/recordings/${recording.id}/stream?token=${token}&download=1`;
  }

  /**
   * Verifies a tamper-proof streaming token using timing-safe comparison.
   */
  public verifyToken(token: string): { valid: boolean; payload?: StreamTokenPayload; error?: string } {
    try {
      const parts = token.split('.');
      if (parts.length !== 2) {
        return { valid: false, error: 'Malformed stream token' };
      }
      const [payloadB64, sig] = parts;
      const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
      const payload: StreamTokenPayload = JSON.parse(jsonStr);

      if (Date.now() / 1000 > payload.exp) {
        return { valid: false, error: 'Stream token expired' };
      }

      const expectedData = `${payload.recordingId}:${payload.userId}:${payload.action}:${payload.exp}`;
      const expectedSig = crypto.createHmac('sha256', MEDIA_SECRET).update(expectedData).digest('base64url');

      const sigBuf = Buffer.from(sig);
      const expectedBuf = Buffer.from(expectedSig);
      if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
        return { valid: false, error: 'Invalid stream token signature' };
      }

      return { valid: true, payload };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Token verification failed' };
    }
  }

  /**
   * Authoritative server-side policy check for whether a user can stream or download a recording.
   * Enforces:
   * 1. Admin (SUPER_ADMIN / ORG_ADMIN) -> Full access (stream + download)
   * 2. Course/Batch Lead Instructor -> Full access
   * 3. Learner:
   *    - Recording must be AVAILABLE and not expired
   *    - Must be actively enrolled in recording.batchId OR have an active recording_batch_access grant
   *    - If action is 'download', is_downloadable and batch grant must permit download
   */
  public async verifyAccess(
    recordingId: string,
    user: { userId?: string; id?: string; role: string; email?: string; organizationId?: string },
    action: 'stream' | 'download' = 'stream'
  ): Promise<PlaybackAccessResult> {
    const userId = user.userId || user.id || '';
    const recording = await db.getClassRecording(recordingId);
    if (!recording) {
      return { allowed: false, authorized: false, reason: 'RECORDING_NOT_FOUND', canDownload: false };
    }

    // Verify organization / tenant isolation
    const storedUser = userId ? await db.getUser(userId) : undefined;
    const effectiveOrgId = user.organizationId || storedUser?.organizationId;
    if (
      effectiveOrgId &&
      effectiveOrgId !== 'org-zealosh-main' &&
      effectiveOrgId !== 'org-zealosh'
    ) {
      return {
        allowed: false,
        authorized: false,
        reason: 'TENANT_ORGANIZATION_MISMATCH',
        canDownload: false,
      };
    }
    if (
      user.organizationId &&
      storedUser?.organizationId &&
      user.organizationId !== storedUser.organizationId
    ) {
      return {
        allowed: false,
        authorized: false,
        reason: 'TENANT_ORGANIZATION_MISMATCH',
        canDownload: false,
      };
    }

    // Admins have unrestricted access
    if (user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN') {
      return {
        allowed: true,
        authorized: true,
        reason: 'SUPERADMIN',
        canDownload: true,
        recording,
      };
    }

    // Instructors assigned to the course/batch
    if (user.role === 'INSTRUCTOR') {
      const course = await db.getCourseById(recording.courseId);
      const isLead = course?.leadInstructorId === userId;
      const isCo = course?.coInstructorIds?.includes(userId);
      if (isLead || isCo) {
        return {
          allowed: true,
          authorized: true,
          reason: 'COURSE_INSTRUCTOR',
          canDownload: true,
          recording,
        };
      }
    }

    // Learner verification
    if (recording.status !== 'AVAILABLE') {
      return {
        allowed: false,
        authorized: false,
        reason: `RECORDING_${recording.status}`,
        canDownload: false,
        recording,
      };
    }

    const now = new Date();
    if (recording.availableFrom && new Date(recording.availableFrom) > now) {
      return {
        allowed: false,
        authorized: false,
        reason: 'RECORDING_NOT_YET_AVAILABLE',
        canDownload: false,
        recording,
      };
    }

    if (recording.expiresAt && new Date(recording.expiresAt) <= now) {
      return {
        allowed: false,
        authorized: false,
        reason: 'RECORDING_EXPIRED',
        canDownload: false,
        recording,
      };
    }

    const recordingBatch = await db.getBatch(recording.batchId);
    if (recordingBatch && recordingBatch.status === 'CANCELLED') {
      return {
        allowed: false,
        authorized: false,
        reason: 'BATCH_CANCELLED',
        canDownload: false,
        recording,
      };
    }

    // Check user active, non-expired enrollments
    const enrollments = await db.getUserEnrollments(userId);
    const activeEnrollments = enrollments.filter(
      (e) => e.status === 'ACTIVE' && (!e.expiresAt || new Date(e.expiresAt) > now)
    );

    // Case A: Enrolled in the direct cohort batch where recording occurred
    const directEnrollment = activeEnrollments.find(
      (e) => e.batchId === recording.batchId && (!e.courseId || e.courseId === recording.courseId)
    );

    // Case B: Cross-batch / previous-batch access grant
    const batchGrants = await db.getRecordingBatchAccess(recording.id);
    const validGrant = batchGrants.find((grant) => {
      if (grant.status !== 'ACTIVE') return false;
      if (grant.expiresAt && new Date(grant.expiresAt) <= now) return false;
      return activeEnrollments.some((e) => e.batchId === grant.targetBatchId);
    });

    if (!directEnrollment && !validGrant) {
      return {
        allowed: false,
        authorized: false,
        reason: 'NOT_ENROLLED_IN_COHORT',
        canDownload: false,
        recording,
      };
    }

    // Determine download permission
    let canDownload = recording.isDownloadable ?? recording.allowDownload ?? false;
    if (validGrant && !directEnrollment) {
      // Prior-batch access policy explicitly determines whether download is permitted
      canDownload = Boolean(validGrant.allowDownload);
    }

    if (action === 'download' && !canDownload) {
      return {
        allowed: false,
        authorized: false,
        reason: 'RECORDING_DOWNLOAD_DISABLED',
        canDownload: false,
        recording,
      };
    }

    return {
      allowed: true,
      authorized: true,
      reason: directEnrollment ? 'PRIMARY_BATCH_ENROLLED' : 'CROSS_BATCH_GRANT_ACTIVE',
      canDownload,
      recording,
    };
  }

  /**
   * Generates durable signed streaming and download URLs.
   */
  public async getPlaybackUrls(
    recording: ClassRecording,
    user: { userId: string; role: string },
    canDownload: boolean
  ): Promise<{ streamUrl: string; downloadUrl?: string; expiresInSeconds: number }> {
    const expiresInSeconds = 7200; // 2 hours

    // Generate authenticated streaming token for our streaming route
    const streamToken = this.generateToken(recording.id, user.userId, 'stream', expiresInSeconds);
    const streamUrl = `/api/recordings/${recording.id}/stream?token=${streamToken}`;

    let downloadUrl: string | undefined = undefined;
    if (canDownload) {
      const downloadToken = this.generateToken(recording.id, user.userId, 'download', expiresInSeconds);
      downloadUrl = `/api/recordings/${recording.id}/stream?token=${downloadToken}&download=1`;
    }

    // If Supabase Storage is configured, also attempt to sign the remote object URL
    if (recording.storageProvider === 'SUPABASE_STORAGE' && recording.storagePath) {
      try {
        const client = getSupabaseAdminClient();
        if (client) {
          const { data } = await client.storage.from('recordings').createSignedUrl(recording.storagePath, expiresInSeconds, {
            download: false,
          });
          if (data?.signedUrl) {
            // Keep secure tokenized proxy as streamUrl for telemetry, or direct signed url
          }
        }
      } catch {
        // Fall back to tokenized stream URL
      }
    }

    return {
      streamUrl,
      downloadUrl,
      expiresInSeconds,
    };
  }
}

export const recordingStorage = new RecordingStorageService();
