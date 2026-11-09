// Zealosh LMS — BigBlueButton Recording Ingestion & Idempotent Reconciliation Service
// Manages the ingestion of external BigBlueButton recordings into authoritative
// ClassRecording and LiveSession collections, enforcing server-side authentication,
// strict idempotency, anti-downgrade state transitions, relation preservation,
// and bounded reconciliation sweeps.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/store/db';
import { bbbAdapter, BBBRecordingItem } from '@/lib/adapters/bbb-adapter';
import { ClassroomProvider, classroomProvider, ClassroomRecordingMetadata } from '@/lib/classroom';
import { isAuthorizedPlatformTenant } from '@/lib/store/live-session-resolver';
import { ClassRecording, LiveSession, RecordingStatus, UserRole } from '@/types';

export interface IngestRecordingPayload {
  recordId?: string;
  recordID?: string;
  id?: string;
  meetingId?: string;
  meetingID?: string;
  externalMeetingId?: string;
  sessionId?: string;
  state?: 'published' | 'processing' | 'unpublished' | 'deleted' | string;
  published?: boolean;
  name?: string;
  description?: string;
  startTime?: string | number;
  endTime?: string | number;
  durationSeconds?: number;
  length?: number;
  playbackLength?: number;
  playbackUrl?: string;
  url?: string;
  fileSizeBytes?: number;
  size?: number;
  sizeBytes?: number;
  isDownloadable?: boolean;
  courseId?: string;
  batchId?: string;
  organizationId?: string;
  metadata?: {
    sessionId?: string;
    courseId?: string;
    batchId?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export type IngestionResultStatus =
  | 'SUCCESS'
  | 'IGNORED_DUPLICATE'
  | 'REJECTED'
  | 'FAILED';

export type IngestionAction = 'CREATED' | 'UPDATED' | 'SKIPPED';

export interface IngestRecordingResult {
  success: boolean;
  status: IngestionResultStatus;
  action?: IngestionAction;
  recordingId?: string;
  sessionId?: string;
  courseId?: string;
  batchId?: string;
  recordingStatus?: RecordingStatus;
  reason?: string;
  message?: string;
  error?: string;
  statusCode?: number;
}

export interface ReconciliationFailure {
  sessionId: string;
  meetingId?: string;
  recordId?: string;
  error: string;
}

export interface ReconciliationReport {
  success: boolean;
  scannedSessions: number;
  recordingsDiscovered: number;
  recordingsCreated: number;
  recordingsUpdated: number;
  recordingsIgnored: number;
  failures: ReconciliationFailure[];
  durationMs: number;
  // Aliases for backwards compatibility:
  totalSessionsScanned?: number;
  totalRecordingsFound?: number;
  created?: number;
  updated?: number;
  unchanged?: number;
  failed?: number;
  errors?: ReconciliationFailure[];
}

function sanitizeText(input?: string): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/javascript:/gi, '')
    .trim();
}

/**
 * Normalizes varied BigBlueButton callback payloads into standard IngestRecordingPayload.
 * Handles:
 * 1. Native bbb-webhooks array payloads: [ { data: { type: 'event', id: 'rap-publish-ended', attributes: ... } } ]
 * 2. Native bbb-webhooks single event payloads: { data: { id: ..., attributes: { meeting, recording } } }
 * 3. Flat API gateway/proxy payloads: { recordID, meetingID, state, playbackUrl, ... }
 */
export function extractBBBRecordingFields(payload: any): IngestRecordingPayload {
  if (!payload || typeof payload !== 'object') return payload;

  // Case 1: Array of events from bbb-webhooks
  let eventObj = payload;
  if (Array.isArray(payload)) {
    eventObj =
      payload.find(
        (e: any) =>
          e?.data?.attributes?.recording ||
          e?.data?.id === 'rap-publish-ended' ||
          e?.data?.id === 'rap-post-publish-ended' ||
          e?.data?.id?.startsWith('rap-') ||
          e?.event === 'recording_published' ||
          e?.recordID ||
          e?.recordId
      ) || payload[0];
  }

  // Case 2: Standard bbb-webhooks event structure: { data: { id: ..., attributes: { meeting, recording } } }
  if (eventObj?.data?.attributes?.recording || eventObj?.data?.attributes?.meeting) {
    const rec = eventObj.data.attributes.recording || {};
    const meeting = eventObj.data.attributes.meeting || {};
    const eventId = eventObj.data.id || '';

    const recordId = rec['record-id'] || rec.recordID || rec.recordId || rec.id;
    const meetingId = rec['meeting-id'] || meeting['external-meeting-id'] || meeting.meetingID || meeting.meetingId;
    const name = rec.name || meeting.name;
    const isPublished = rec.published === true || eventId === 'rap-publish-ended' || eventId === 'rap-post-publish-ended';
    const state = rec.state || (isPublished ? 'published' : 'processing');
    const playbackUrl =
      rec.playback?.link ||
      rec.playback?.format?.[0]?.url ||
      (Array.isArray(rec.playback?.format) ? rec.playback.format[0]?.url : undefined) ||
      rec.playbackUrl;
    const startTime = rec['start-time'] || rec.startTime;
    const endTime = rec['end-time'] || rec.endTime;
    const durationSeconds =
      typeof rec['step-time'] === 'number'
        ? Math.round(rec['step-time'] / 1000)
        : typeof rec.length === 'number'
          ? (rec.length > 300 ? rec.length : rec.length * 60)
          : undefined;
    const fileSizeBytes = rec.size || rec['raw-size'];
    const metadata = rec.metadata || {};

    return {
      recordId,
      recordID: recordId,
      meetingId,
      meetingID: meetingId,
      sessionId: metadata.sessionId,
      courseId: metadata.courseId,
      batchId: metadata.batchId,
      name,
      state,
      published: isPublished,
      playbackUrl,
      startTime,
      endTime,
      durationSeconds,
      fileSizeBytes,
      metadata,
    };
  }

  // Case 3: Flat or custom gateway payload
  return payload;
}

export class RecordingIngestionService {
  private webhookSecret?: string;
  private salt?: string;
  private inFlightIngestions: Map<string, Promise<IngestRecordingResult>> = new Map();
  private classroomProvider: ClassroomProvider = classroomProvider;

  constructor() {
    this.reloadSecrets();
  }

  public setClassroomProvider(provider: ClassroomProvider) {
    this.classroomProvider = provider;
  }

  public reloadSecrets() {
    this.webhookSecret =
      process.env.BBB_WEBHOOK_SECRET ||
      process.env.BIGBLUEBUTTON_WEBHOOK_SECRET ||
      process.env.BIGBLUEBUTTON_SECRET ||
      process.env.BBB_SECURITY_SALT;
    this.salt =
      process.env.BBB_SECURITY_SALT ||
      process.env.BIGBLUEBUTTON_SECRET ||
      process.env.BIGBLUEBUTTON_SALT;
  }

  /**
   * Verifies the cryptographic authenticity of an incoming BigBlueButton webhook or callback.
   *
   * Formally supports three distinct, mutually verified mechanisms:
   * 1. Native BigBlueButton Webhooks (bbb-webhooks):
   *    Query parameter ?checksum=<hash>
   *    Signing contract: HASH(callbackURLWithoutQuery + rawBody + salt)
   *    Supported hash algorithms: SHA-256 (standard in BBB 4.0/3.x) and SHA-1 (fallback)
   *
   * 2. Gateway / Proxy Header Authentication:
   *    - Header: Authorization: Bearer <secret>
   *    - Header: X-BBB-Signature: sha256=<hmac> or X-Zealosh-Signature: sha256=<hmac>
   *
   * Hardened Security Invariants:
   * - In production/staging, development fallback salts are strictly disabled.
   * - If no secret is configured, authentication fails immediately (no unauthenticated bypass).
   * - Constant-time comparison (crypto.timingSafeEqual) used on all hash and token comparisons.
   * - Conflicting credentials (e.g. valid Bearer + invalid HMAC or invalid Checksum) are strictly rejected.
   */
  public verifyWebhookAuth(
    headers: Headers | Record<string, string | null | undefined>,
    rawBody?: string,
    urlSearchParams?: URLSearchParams,
    requestUrl?: string
  ): { authenticated: boolean; error?: string } {
    this.reloadSecrets();

    const getHeader = (name: string): string | undefined => {
      if (typeof (headers as any).get === 'function') {
        return (headers as Headers).get(name) || undefined;
      }
      const record = headers as Record<string, string | null | undefined>;
      const lower = name.toLowerCase();
      for (const key of Object.keys(record)) {
        if (key.toLowerCase() === lower) {
          return record[key] || undefined;
        }
      }
      return undefined;
    };

    const isProductionEnv =
      process.env.NODE_ENV === 'production' ||
      process.env.ZEALOSH_ENVIRONMENT === 'staging' ||
      process.env.ZEALOSH_ENVIRONMENT === 'production';

    const configuredSecrets = [
      process.env.BBB_WEBHOOK_SECRET,
      process.env.BIGBLUEBUTTON_WEBHOOK_SECRET,
      process.env.BIGBLUEBUTTON_SECRET,
      process.env.BBB_SECURITY_SALT,
      process.env.BIGBLUEBUTTON_SALT,
      this.webhookSecret,
      this.salt,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    const validSecrets = Array.from(new Set(configuredSecrets));

    // In local development / isolated test environments, permit development salts if no environment variable is present
    if (!isProductionEnv && validSecrets.length === 0) {
      validSecrets.push('dev-bbb-secret', 'zealosh_bbb_shared_salt_2026');
    }

    if (validSecrets.length === 0) {
      return {
        authenticated: false,
        error: 'Unauthorized: BigBlueButton webhook secret is not configured on server',
      };
    }

    // Inspect presented authentication mechanisms
    const authHeader = getHeader('authorization');
    const hasBearer = Boolean(authHeader?.startsWith('Bearer '));

    const sigHeader = getHeader('x-bbb-signature') || getHeader('x-zealosh-signature');
    const hasHmac = Boolean(sigHeader);

    const incomingChecksum = urlSearchParams?.get('checksum')?.trim().toLowerCase();
    const hasChecksum = Boolean(incomingChecksum);

    if (!hasBearer && !hasHmac && !hasChecksum) {
      return {
        authenticated: false,
        error: 'Unauthorized: Missing BigBlueButton authentication credentials (checksum, HMAC signature, or bearer token required)',
      };
    }

    // Mechanism 1: Bearer Token Verification
    if (hasBearer) {
      const token = authHeader!.substring(7).trim();
      let bearerValid = false;
      if (token.length > 0) {
        for (const secret of validSecrets) {
          if (
            token.length === secret.length &&
            crypto.timingSafeEqual(Buffer.from(token, 'utf-8'), Buffer.from(secret, 'utf-8'))
          ) {
            bearerValid = true;
            break;
          }
        }
      }
      if (!bearerValid) {
        return { authenticated: false, error: 'Unauthorized: Invalid bearer token' };
      }
    }

    // Mechanism 2: HMAC Header Verification
    if (hasHmac) {
      if (!rawBody) {
        return { authenticated: false, error: 'Unauthorized: Missing request body for HMAC verification' };
      }
      const cleanSig = sigHeader!.startsWith('sha256=')
        ? sigHeader!.substring(7).trim().toLowerCase()
        : sigHeader!.trim().toLowerCase();

      let hmacValid = false;
      for (const secret of validSecrets) {
        const expectedSig = crypto
          .createHmac('sha256', secret)
          .update(rawBody)
          .digest('hex')
          .toLowerCase();

        if (
          cleanSig.length === expectedSig.length &&
          crypto.timingSafeEqual(Buffer.from(cleanSig, 'utf-8'), Buffer.from(expectedSig, 'utf-8'))
        ) {
          hmacValid = true;
          break;
        }
      }
      if (!hmacValid) {
        return { authenticated: false, error: 'Unauthorized: Invalid HMAC signature' };
      }
    }

    // Mechanism 3: Native BigBlueButton Webhook Callback Checksum
    // Formally validated against BBB 4.0 / 3.x bbb-webhooks specification:
    // CHECKSUM = HASH(callbackURLWithoutChecksum + rawBody + salt)
    if (hasChecksum) {
      let checksumValid = false;

      // Helper to strip ONLY the checksum parameter while preserving any static query parameters
      // e.g. https://.../recording?tenant=main&checksum=abc -> https://.../recording?tenant=main
      const stripChecksumParam = (urlStr: string): string => {
        try {
          const url = new URL(urlStr);
          url.searchParams.delete('checksum');
          const remainingQuery = url.searchParams.toString();
          const basePath = `${url.origin}${url.pathname}`;
          return remainingQuery ? `${basePath}?${remainingQuery}` : basePath;
        } catch {
          return urlStr.replace(/[?&]checksum=[^&]*/i, '').replace(/\?$/, '');
        }
      };

      // Establish trusted candidate callback URLs (excluding checksum parameter, preserving static params)
      const candidateUrls = new Set<string>();
      if (process.env.BBB_WEBHOOK_CALLBACK_URL) {
        candidateUrls.add(stripChecksumParam(process.env.BBB_WEBHOOK_CALLBACK_URL));
      }
      if (requestUrl) {
        candidateUrls.add(stripChecksumParam(requestUrl));
        try {
          const parsed = new URL(requestUrl);
          const trustedBase =
            process.env.BBB_WEBHOOK_CALLBACK_URL ||
            process.env.APP_BASE_URL ||
            process.env.NEXT_PUBLIC_APP_URL;
          if (trustedBase) {
            try {
              const baseParsed = new URL(trustedBase);
              const trustedCanonical = stripChecksumParam(`${baseParsed.origin}${parsed.pathname}${parsed.search}`);
              candidateUrls.add(trustedCanonical);
            } catch {}
          }
        } catch {}
      }
      const baseAppUrl = process.env.APP_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
      if (baseAppUrl) {
        candidateUrls.add(stripChecksumParam(`${baseAppUrl.replace(/\/$/, '')}/api/webhooks/bbb/recording`));
      }

      for (const candidateUrl of candidateUrls) {
        for (const secret of validSecrets) {
          for (const algo of ['sha256', 'sha1']) {
            const stringToHash = `${candidateUrl}${rawBody || ''}${secret}`;
            const expectedChecksum = crypto
              .createHash(algo)
              .update(stringToHash)
              .digest('hex')
              .toLowerCase();

            if (
              incomingChecksum!.length === expectedChecksum.length &&
              crypto.timingSafeEqual(
                Buffer.from(incomingChecksum!, 'utf-8'),
                Buffer.from(expectedChecksum, 'utf-8')
              )
            ) {
              checksumValid = true;
              break;
            }
          }
          if (checksumValid) break;
        }
        if (checksumValid) break;
      }

      if (!checksumValid) {
        return { authenticated: false, error: 'Unauthorized: Invalid BigBlueButton callback checksum' };
      }
    }

    return { authenticated: true };
  }

  /**
   * Verifies the cryptographic authenticity of a BigBlueButton meta_bbb-recording-ready-url callback.
   * Specification: HS256 JWT in form-encoded field `signed_parameters`.
   * Payload contains meeting_id and record_id.
   * Secret is the originating BigBlueButton shared secret.
   */
  public verifyRecordingReadyJwt(
    signedParametersToken: string,
    overrideSecrets?: string[]
  ): {
    valid: boolean;
    payload?: { meeting_id: string; record_id: string; [key: string]: any };
    error?: string;
    statusCode?: number;
  } {
    this.reloadSecrets();

    if (!signedParametersToken || typeof signedParametersToken !== 'string') {
      return {
        valid: false,
        error: 'Missing or empty signed_parameters JWT token',
        statusCode: 400,
      };
    }

    const trimmedToken = signedParametersToken.trim();
    const parts = trimmedToken.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        error: 'Malformed signed_parameters JWT token structure',
        statusCode: 401,
      };
    }

    // Inspect header for algorithm substitution (strictly HS256 required)
    try {
      const headerRaw = Buffer.from(parts[0], 'base64').toString('utf-8');
      const header = JSON.parse(headerRaw);
      if (!header || typeof header !== 'object' || header.alg !== 'HS256') {
        return {
          valid: false,
          error: `Unauthorized: Unsupported JWT algorithm '${header?.alg || 'none'}'; HS256 is strictly required`,
          statusCode: 401,
        };
      }
    } catch {
      return {
        valid: false,
        error: 'Unauthorized: Malformed JWT header in signed_parameters',
        statusCode: 401,
      };
    }

    const isProductionEnv =
      process.env.NODE_ENV === 'production' ||
      process.env.ZEALOSH_ENVIRONMENT === 'staging' ||
      process.env.ZEALOSH_ENVIRONMENT === 'production';

    const configuredSecrets = [
      ...(overrideSecrets || []),
      process.env.BBB_SECURITY_SALT,
      process.env.BIGBLUEBUTTON_SALT,
      process.env.BBB_WEBHOOK_SECRET,
      process.env.BIGBLUEBUTTON_WEBHOOK_SECRET,
      process.env.BIGBLUEBUTTON_SECRET,
      this.salt,
      this.webhookSecret,
    ].filter((s): s is string => typeof s === 'string' && s.trim().length > 0);

    const validSecrets = Array.from(new Set(configuredSecrets));

    if (!isProductionEnv && validSecrets.length === 0) {
      validSecrets.push('dev-bbb-secret', 'zealosh_bbb_shared_salt_2026');
    }

    if (validSecrets.length === 0) {
      return {
        valid: false,
        error: 'Unauthorized: BigBlueButton shared secret is not configured on server',
        statusCode: 401,
      };
    }

    let decodedPayload: any = null;
    let verified = false;

    for (const secret of validSecrets) {
      try {
        const decoded = jwt.verify(trimmedToken, secret, { algorithms: ['HS256'] });
        decodedPayload = decoded;
        verified = true;
        break;
      } catch (err: any) {
        // Continue checking other valid secrets
      }
    }

    if (!verified || !decodedPayload) {
      return {
        valid: false,
        error: 'Unauthorized: Invalid signed_parameters JWT signature',
        statusCode: 401,
      };
    }

    const meetingId = decodedPayload.meeting_id || decodedPayload.meetingID;
    const recordId = decodedPayload.record_id || decodedPayload.recordID;

    if (!meetingId || !recordId || typeof meetingId !== 'string' || typeof recordId !== 'string') {
      return {
        valid: false,
        error: 'Missing required meeting_id or record_id in signed_parameters JWT payload',
        statusCode: 400,
      };
    }

    return {
      valid: true,
      payload: {
        ...decodedPayload,
        meeting_id: meetingId,
        record_id: recordId,
      },
    };
  }

  /**
   * Normalizes upstream BigBlueButton state into authoritative Zealosh RecordingStatus
   */
  public mapUpstreamStateToRecordingStatus(
    upstreamState?: string,
    published?: boolean,
    playbackUrl?: string
  ): RecordingStatus {
    const state = (upstreamState || '').toLowerCase().trim();

    if (state === 'deleted' || state === 'unpublished') {
      return 'ARCHIVED';
    }

    if (state === 'processing') {
      return 'PROCESSING';
    }

    if (state === 'failed' || state === 'error') {
      return 'ARCHIVED';
    }

    // Published state
    if (state === 'published' || published === true) {
      // Must have ready playable state
      if (playbackUrl && playbackUrl.length > 5) {
        return 'AVAILABLE';
      }
      return 'PROCESSING';
    }

    return 'PROCESSING';
  }

  /**
   * Authoritatively ingests a BigBlueButton recording event.
   * Guarantees single-process concurrency locking, idempotency, relation preservation,
   * anti-downgrade state guards, and session/course/batch integrity.
   */
  public async ingestRecording(
    payload: IngestRecordingPayload,
    options?: {
      actorUserId?: string;
      actorEmail?: string;
      source?: string;
    }
  ): Promise<IngestRecordingResult> {
    const normalized = extractBBBRecordingFields(payload);
    const rawRecordId = sanitizeText(normalized?.recordId || normalized?.recordID || normalized?.id);
    const canonicalRecordingId = rawRecordId
      ? rawRecordId.startsWith('rec-')
        ? rawRecordId
        : `rec-bbb-${rawRecordId}`
      : '';

    // Concurrency Lock: If an ingestion for this recording is currently in flight, await it safely
    if (canonicalRecordingId && this.inFlightIngestions.has(canonicalRecordingId)) {
      try {
        await this.inFlightIngestions.get(canonicalRecordingId);
      } catch {
        // If the first concurrent execution threw an exception, fall through so this delivery can execute safely
      }

      // Check authoritative database state after the first delivery concludes
      const existing = await db.getClassRecording(canonicalRecordingId);
      if (existing) {
        const targetStatus = this.mapUpstreamStateToRecordingStatus(
          normalized?.state,
          normalized?.published,
          normalized?.playbackUrl
        );

        // Anti-downgrade / redundant duplicate check:
        const isRedundant =
          (existing.status === 'AVAILABLE' && targetStatus === 'PROCESSING') ||
          (existing.status === targetStatus && existing.mediaUrl === (normalized?.playbackUrl || '')) ||
          (existing.status === 'AVAILABLE' && Boolean(existing.mediaUrl) && !normalized?.playbackUrl);

        if (isRedundant) {
          return {
            success: true,
            status: 'IGNORED_DUPLICATE',
            action: 'SKIPPED',
            recordingId: existing.id,
            sessionId: existing.sessionId,
            courseId: existing.courseId,
            batchId: existing.batchId,
            recordingStatus: existing.status,
            reason: 'CONCURRENT_DUPLICATE_DEDUPLICATED',
            message: `Identical recording already ingested for session ${existing.sessionId}`,
          };
        }
        // If not redundant (e.g. state transition from PROCESSING to AVAILABLE), proceed to execute update!
      } else {
        // The first delivery failed, was rejected, or encountered a storage error.
        // Fall through so this request can execute its own attempt and return its authoritative result!
      }
    }

    const executionPromise = this.executeIngestRecording(normalized, options);
    if (canonicalRecordingId) {
      this.inFlightIngestions.set(canonicalRecordingId, executionPromise);
    }

    try {
      return await executionPromise;
    } finally {
      if (canonicalRecordingId) {
        this.inFlightIngestions.delete(canonicalRecordingId);
      }
    }
  }

  private async executeIngestRecording(
    payload: IngestRecordingPayload,
    options?: {
      actorUserId?: string;
      actorEmail?: string;
      source?: string;
    }
  ): Promise<IngestRecordingResult> {
    // 1. Validate Required Fields
    if (!payload || typeof payload !== 'object') {
      return {
        success: false,
        status: 'REJECTED',
        action: 'SKIPPED',
        reason: 'EMPTY_PAYLOAD',
        error: 'Payload must be a non-empty object',
        message: 'Payload must be a non-empty object',
        statusCode: 400,
      };
    }

    const rawRecordId = sanitizeText(payload.recordId || payload.recordID || payload.id);
    const rawMeetingId = sanitizeText(payload.meetingId || payload.meetingID || payload.externalMeetingId);
    const explicitSessionId = sanitizeText(payload.sessionId || payload.metadata?.sessionId);

    if (!rawRecordId) {
      return {
        success: false,
        status: 'REJECTED',
        action: 'SKIPPED',
        reason: 'MISSING_RECORD_ID',
        error: 'BigBlueButton recordId is required',
        message: 'BigBlueButton recordId is required',
        statusCode: 400,
      };
    }

    if (!rawMeetingId && !explicitSessionId) {
      return {
        success: false,
        status: 'REJECTED',
        action: 'SKIPPED',
        reason: 'MISSING_MEETING_IDENTIFIER',
        error: 'Either meetingId or sessionId is required',
        message: 'Either meetingId or sessionId is required',
        statusCode: 400,
      };
    }

    // 2. Resolve Internal LiveSession
    let session: LiveSession | undefined;
    if (explicitSessionId) {
      session = await db.getLiveSession(explicitSessionId);
    }
    if (!session && rawMeetingId) {
      session = await db.getLiveSessionByMeetingId(rawMeetingId);
    }

    if (!session) {
      return {
        success: false,
        status: 'FAILED',
        action: 'SKIPPED',
        reason: 'UNKNOWN_SESSION',
        error: `No internal LiveSession found for meetingId "${rawMeetingId}" or sessionId "${explicitSessionId}"`,
        message: `No internal LiveSession found for meetingId "${rawMeetingId}" or sessionId "${explicitSessionId}"`,
        statusCode: 404,
      };
    }

    // 3. Resolve and Verify Authoritative Relationships from Trusted Session
    const [course, batch] = await Promise.all([
      db.getCourseById(session.courseId),
      db.getBatch(session.batchId),
    ]);

    if (!course || !batch) {
      return {
        success: false,
        status: 'FAILED',
        action: 'SKIPPED',
        reason: 'INVALID_SESSION_ASSOCIATION',
        error: `Associated course (${session.courseId}) or batch (${session.batchId}) not found`,
        message: `Associated course (${session.courseId}) or batch (${session.batchId}) not found`,
        statusCode: 400,
      };
    }

    // 4. Verify Tenant Boundary Isolation
    const leadInstructor = course.leadInstructorId ? await db.getUser(course.leadInstructorId) : null;
    if (leadInstructor?.organizationId && !isAuthorizedPlatformTenant(leadInstructor.organizationId)) {
      return {
        success: false,
        status: 'FAILED',
        action: 'SKIPPED',
        reason: 'TENANT_MISMATCH',
        error: 'Forbidden: Session belongs to an unauthorized tenant organization',
        message: 'Forbidden: Session belongs to an unauthorized tenant organization',
        statusCode: 403,
      };
    }

    // 5. Establish Stable Idempotency Key
    const canonicalRecordingId = rawRecordId.startsWith('rec-') ? rawRecordId : `rec-bbb-${rawRecordId}`;

    // 6. Check for Existing Recording
    let existingRecording = await db.getClassRecording(canonicalRecordingId);
    if (!existingRecording) {
      const sessionRecordings = await db.getClassRecordings({ sessionId: session.id });
      existingRecording = sessionRecordings.find(
        (r) => r.id === canonicalRecordingId || r.storagePath.includes(rawRecordId)
      );
    }

    // 7. Sanitize and Normalize Metadata
    const title = sanitizeText(payload.name) || session.title;
    const description = sanitizeText(payload.description) || session.title;
    const playbackUrl = payload.playbackUrl
      ? payload.playbackUrl.trim()
      : payload.url
        ? payload.url.trim()
        : '';

    // Calculate duration in seconds
    let durationSeconds = 0;
    const lengthVal = payload.durationSeconds || payload.length || payload.playbackLength;
    if (typeof lengthVal === 'number' && lengthVal > 0) {
      durationSeconds = Math.min(86400, Math.round(lengthVal));
    } else if (payload.startTime && payload.endTime) {
      const startMs = typeof payload.startTime === 'number' ? payload.startTime : Date.parse(payload.startTime);
      const endMs = typeof payload.endTime === 'number' ? payload.endTime : Date.parse(payload.endTime);
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs > startMs) {
        durationSeconds = Math.min(86400, Math.round((endMs - startMs) / 1000));
      }
    }
    if (durationSeconds <= 0) {
      durationSeconds = (session.durationMinutes || 60) * 60;
    }

    const targetStatus = this.mapUpstreamStateToRecordingStatus(
      payload.state,
      payload.published,
      playbackUrl
    );

    // 8. Apply Idempotency & State Transition Rules
    if (existingRecording) {
      // Rule A: Anti-Downgrade Guard (A confirmed AVAILABLE recording cannot be downgraded by a stale PROCESSING notification)
      if (existingRecording.status === 'AVAILABLE' && targetStatus === 'PROCESSING') {
        return {
          success: true,
          status: 'IGNORED_DUPLICATE',
          action: 'SKIPPED',
          recordingId: existingRecording.id,
          sessionId: session.id,
          courseId: session.courseId,
          batchId: session.batchId,
          recordingStatus: 'AVAILABLE',
          reason: 'STALE_PROCESSING_EVENT_IGNORED',
          message: `Refusing downgrade: Recording ${existingRecording.id} is already AVAILABLE`,
        };
      }

      // Rule B: Idempotent Duplicate Detection (Identical status, URL, and duration)
      const isIdentical =
        existingRecording.status === targetStatus &&
        existingRecording.mediaUrl === (playbackUrl || existingRecording.mediaUrl) &&
        existingRecording.durationSeconds === durationSeconds;

      if (isIdentical) {
        return {
          success: true,
          status: 'IGNORED_DUPLICATE',
          action: 'SKIPPED',
          recordingId: existingRecording.id,
          sessionId: session.id,
          courseId: session.courseId,
          batchId: session.batchId,
          recordingStatus: existingRecording.status,
          reason: 'IDEMPOTENT_DUPLICATE_NO_OP',
          message: `Identical recording already ingested for session ${session.id}`,
        };
      }

      // Rule C: Legitimate State or Metadata Transition
      existingRecording.status = targetStatus;
      if (playbackUrl) existingRecording.mediaUrl = playbackUrl;
      if (durationSeconds > 0) existingRecording.durationSeconds = durationSeconds;
      if (payload.name) existingRecording.title = title;
      if (payload.description) existingRecording.description = description;
      const sizeVal = payload.fileSizeBytes || payload.size || payload.sizeBytes;
      if (typeof sizeVal === 'number' && sizeVal > 0) {
        existingRecording.fileSizeBytes = sizeVal;
      }
      if (targetStatus === 'ARCHIVED') {
        existingRecording.isDownloadable = false;
      }
      existingRecording.updatedAt = new Date().toISOString();

      // Persist update while preserving all relations (highlights, resources, doubts, grants)
      try {
        await db.saveClassRecording(existingRecording);
      } catch (err: any) {
        return {
          success: false,
          status: 'FAILED',
          action: 'SKIPPED',
          recordingId: existingRecording.id,
          error: `Database persistence failed: ${err.message}`,
          message: `Database persistence failed: ${err.message}`,
          statusCode: 500,
        };
      }

      // If recording is now ready, update the associated live session
      if (targetStatus === 'AVAILABLE') {
        session.status = 'RECORDING_READY';
        session.recordingUrl = `/recordings/${existingRecording.id}`;
        session.recordingDurationMinutes = Math.round(existingRecording.durationSeconds / 60);
        await db.saveLiveSession(session);
      }

      // Audit Log
      await db.recordAudit({
        actorUserId: options?.actorUserId || session.instructorId || 'system-bbb-ingest',
        actorEmail: options?.actorEmail || 'bbb-ingestion@zealosh.com',
        actorRole: 'SUPER_ADMIN' as UserRole,
        action: 'RECORDING_UPDATED',
        entityType: 'RECORDING',
        entityId: existingRecording.id,
        details: {
          sessionId: session.id,
          courseId: session.courseId,
          batchId: session.batchId,
          status: targetStatus,
          previousStatus: existingRecording.status,
          recordId: rawRecordId,
        },
      });

      return {
        success: true,
        status: 'SUCCESS',
        action: 'UPDATED',
        recordingId: existingRecording.id,
        sessionId: session.id,
        courseId: session.courseId,
        batchId: session.batchId,
        recordingStatus: targetStatus,
      };
    }

    // 9. Re-check durable database state to guard against concurrent worker race conditions across processes
    const preInsertExisting = await db.getClassRecording(canonicalRecordingId);
    if (preInsertExisting) {
      const isRedundant =
        (preInsertExisting.status === 'AVAILABLE' && targetStatus === 'PROCESSING') ||
        (preInsertExisting.status === targetStatus && preInsertExisting.mediaUrl === (playbackUrl || preInsertExisting.mediaUrl));
      if (isRedundant) {
        return {
          success: true,
          status: 'IGNORED_DUPLICATE',
          action: 'SKIPPED',
          recordingId: preInsertExisting.id,
          sessionId: session.id,
          courseId: session.courseId,
          batchId: session.batchId,
          recordingStatus: preInsertExisting.status,
          reason: 'DATABASE_BACKED_DUPLICATE_DEDUPLICATED',
          message: `Identical recording already exists in database for session ${session.id}`,
        };
      }
    }

    // 10. Create New Recording Record
    const initialDownloadable =
      payload.isDownloadable !== undefined
        ? Boolean(payload.isDownloadable)
        : targetStatus === 'AVAILABLE';

    const newRecording: ClassRecording = {
      id: canonicalRecordingId,
      sessionId: session.id,
      courseId: session.courseId,
      batchId: session.batchId,
      title,
      description,
      storageProvider: 'BIGBLUEBUTTON',
      storagePath: `bbb-recordings/${session.courseId}/${canonicalRecordingId}.mp4`,
      mediaUrl: playbackUrl || (targetStatus === 'AVAILABLE' ? `/recordings/${canonicalRecordingId}` : ''),
      durationSeconds,
      fileSizeBytes: payload.fileSizeBytes || payload.size || payload.sizeBytes || 500_000_000,
      status: targetStatus,
      isDownloadable: initialDownloadable,
      availableFrom: new Date().toISOString(),
      createdBy: options?.actorUserId || session.instructorId || 'system-bbb-ingest',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await db.saveClassRecording(newRecording);
    } catch (err: any) {
      return {
        success: false,
        status: 'FAILED',
        action: 'SKIPPED',
        recordingId: newRecording.id,
        error: `Failed to persist new class recording: ${err.message}`,
        message: `Failed to persist new class recording: ${err.message}`,
        statusCode: 500,
      };
    }

    // Update session status if recording is available
    if (targetStatus === 'AVAILABLE') {
      session.status = 'RECORDING_READY';
      session.recordingUrl = `/recordings/${newRecording.id}`;
      session.recordingDurationMinutes = Math.round(newRecording.durationSeconds / 60);
      await db.saveLiveSession(session);
    }

    // Audit Log
    await db.recordAudit({
      actorUserId: options?.actorUserId || session.instructorId || 'system-bbb-ingest',
      actorEmail: options?.actorEmail || 'bbb-ingestion@zealosh.com',
      actorRole: 'SUPER_ADMIN' as UserRole,
      action: 'RECORDING_INGESTED',
      entityType: 'RECORDING',
      entityId: newRecording.id,
      details: {
        sessionId: session.id,
        courseId: session.courseId,
        batchId: session.batchId,
        status: targetStatus,
        recordId: rawRecordId,
      },
    });

    return {
      success: true,
      status: 'SUCCESS',
      action: 'CREATED',
      recordingId: newRecording.id,
      sessionId: session.id,
      courseId: session.courseId,
      batchId: session.batchId,
      recordingStatus: targetStatus,
    };
  }

  /**
   * Performs an authoritative, bounded reconciliation sweep across completed live sessions.
   * Queries classroom provider (/getRecordings) and executes idempotent ingestion.
   */
  public async reconcileSessionRecordings(options?: {
    sessionId?: string;
    batchId?: string;
    courseId?: string;
    maxScanLimit?: number;
    actorUserId?: string;
    actorEmail?: string;
    provider?: ClassroomProvider;
  }): Promise<ReconciliationReport> {
    const startTime = Date.now();
    const maxLimit = Math.max(1, Math.min(options?.maxScanLimit || 50, 100)); // Bound between 1 and 100

    let targetSessions: LiveSession[] = [];

    if (options?.sessionId) {
      const single = await db.getLiveSession(options.sessionId);
      if (single) targetSessions = [single];
    } else {
      const allSessions = await db.getAllLiveSessions();
      targetSessions = allSessions.filter((s) => {
        if (s.status !== 'ENDED' && s.status !== 'RECORDING_READY') return false;
        if (options?.batchId && s.batchId !== options.batchId) return false;
        if (options?.courseId && s.courseId !== options.courseId) return false;
        return true;
      });
    }

    targetSessions = targetSessions.slice(0, maxLimit);

    let totalRecordingsFound = 0;
    let createdCount = 0;
    let updatedCount = 0;
    let unchangedCount = 0;
    const failures: ReconciliationFailure[] = [];
    const provider = options?.provider || this.classroomProvider || classroomProvider;

    for (const session of targetSessions) {
      if (!session.meetingId) continue;

      let recordings: ClassroomRecordingMetadata[] = [];
      try {
        recordings = await provider.getRecordings({ meetingId: session.meetingId });
      } catch (err: any) {
        failures.push({
          sessionId: session.id,
          meetingId: session.meetingId,
          error: `Failed to query recordings: ${err.message}`,
        });
        continue; // Non-fatal for the rest of the batch
      }

      totalRecordingsFound += recordings.length;

      for (const rec of recordings) {
        try {
          const recId = rec.recordId || (rec as any).recordID;
          const mtgId = rec.meetingId || (rec as any).meetingID;
          const res = await this.ingestRecording(
            {
              recordId: recId,
              meetingId: mtgId,
              sessionId: session.id,
              state: rec.state,
              published: rec.published,
              name: rec.name,
              playbackUrl: rec.playbackUrl,
              durationSeconds:
                rec.durationSeconds ||
                (rec.lengthMinutes ? rec.lengthMinutes * 60 : undefined),
            },
            {
              actorUserId: options?.actorUserId || 'system-reconciliation',
              actorEmail: options?.actorEmail || 'reconcile@zealosh.com',
              source: 'RECONCILIATION_SWEEP',
            }
          );

          if (res.action === 'CREATED') {
            createdCount++;
          } else if (res.action === 'UPDATED') {
            updatedCount++;
          } else if (res.status === 'IGNORED_DUPLICATE') {
            unchangedCount++;
          } else {
            failures.push({
              sessionId: session.id,
              meetingId: session.meetingId,
              recordId: recId,
              error: res.error || res.message || res.reason || 'Ingestion rejected',
            });
          }
        } catch (err: any) {
          failures.push({
            sessionId: session.id,
            meetingId: session.meetingId,
            recordId: rec.recordId || (rec as any).recordID,
            error: err.message || 'Unexpected ingestion failure',
          });
        }
      }
    }

    return {
      success: failures.length === 0,
      scannedSessions: targetSessions.length,
      recordingsDiscovered: totalRecordingsFound,
      recordingsCreated: createdCount,
      recordingsUpdated: updatedCount,
      recordingsIgnored: unchangedCount,
      failures,
      durationMs: Date.now() - startTime,
      // Backwards compatible aliases:
      totalSessionsScanned: targetSessions.length,
      totalRecordingsFound,
      created: createdCount,
      updated: updatedCount,
      unchanged: unchangedCount,
      failed: failures.length,
      errors: failures,
    };
  }
}

export const recordingIngestionService = new RecordingIngestionService();
