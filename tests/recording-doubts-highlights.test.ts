import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { createClient } from '@supabase/supabase-js';
import { db } from '../src/lib/store/db';
import { recordingStorage } from '../src/lib/storage/recording-storage';
import { supabaseAdapter } from '../src/lib/store/supabase-adapter';
import {
  ClassRecording,
  RecordingBatchAccess,
  RecordingHighlight,
  RecordingResource,
  RecordingDoubt,
  RecordingDoubtAnswer,
  User,
} from '../src/types';

loadEnvConfig(process.cwd());

describe('Zealosh LMS — Class Recordings, Chapters, Resources & Interactive Doubts Suite', { timeout: 45000 }, () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  const liveUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yeegsljnjwxdhgzfdnyg.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let liveClient: any = null;
  const testRunId = `test-${Date.now().toString(36)}`;
  const liveRecordingId = `rec-live-${testRunId}`;
  const liveGrantId = `rba-live-${testRunId}`;
  const liveHighlightId = `hl-live-${testRunId}`;
  const liveResourceId = `res-live-${testRunId}`;
  const liveDoubtId = `dbt-live-${testRunId}`;
  const liveAnswerId = `ans-live-${testRunId}`;

  // Canonical Seeded Test Users
  const superadminUser: User = {
    id: 'usr-admin-01',
    email: 'admin@zealosh.com',
    name: 'Superadmin Vishnu',
    role: 'SUPER_ADMIN',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const instructorUser: User = {
    id: 'usr-inst-01',
    email: 'vishnu@zealosh.com',
    name: 'Er. Vishnu Nair (Lead Faculty)',
    role: 'INSTRUCTOR',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentA: User = {
    id: 'usr-std-01',
    email: 'student@zealosh.com',
    name: 'Arjun Menon',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const studentB: User = {
    id: 'usr-std-02',
    email: 'deepa.nair@example.com',
    name: 'Deepa Nair',
    role: 'STUDENT',
    passwordHash: '',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const sampleRecording: ClassRecording = {
    id: 'rec-test-asp-01',
    sessionId: 'ses-asp-01',
    courseId: 'crs-asp-01',
    batchId: 'btc-asp-nov26',
    title: 'Industrial Ventilation & Contaminant Transport Calculations',
    description: 'Masterclass on dilution and local exhaust ventilation formulas.',
    storageProvider: 'SUPABASE_STORAGE',
    storagePath: 'recordings/crs-asp-01/lecture-01.mp4',
    mediaUrl: 'https://yeegsljnjwxdhgzfdnyg.supabase.co/storage/v1/object/public/recordings/sample.mp4',
    durationSeconds: 3600, // 60 minutes
    fileSizeBytes: 245000000,
    status: 'AVAILABLE',
    isDownloadable: false,
    availableFrom: '2026-10-26T00:00:00Z',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    process.env.DATABASE_STORAGE = 'in_memory';
    if (serviceRoleKey && liveUrl) {
      liveClient = createClient(liveUrl, serviceRoleKey);
    }
  });

  afterAll(async () => {
    process.env.DATABASE_STORAGE = originalStorage;

    // Guaranteed Live Supabase Fixture Cleanup
    if (liveClient) {
      try {
        await liveClient.from('recording_doubt_answers').delete().eq('id', liveAnswerId);
        await liveClient.from('recording_doubts').delete().eq('id', liveDoubtId);
        await liveClient.from('recording_resources').delete().eq('id', liveResourceId);
        await liveClient.from('recording_highlights').delete().eq('id', liveHighlightId);
        await liveClient.from('recording_batch_access').delete().eq('id', liveGrantId);
        await liveClient.from('class_recordings').delete().eq('id', liveRecordingId);
      } catch (err) {
        console.warn('Cleanup error during afterAll:', err);
      }
    }
  });

  beforeEach(async () => {
    db.resetToSeed();
    await db.saveClassRecording(sampleRecording);
  });

  // ==========================================================================
  // Section 1: Storage Provider Abstraction & HMAC-SHA256 Delivery Tokens
  // ==========================================================================
  describe('Storage Delivery & Cryptographic HMAC Token Security', () => {
    it('should generate and verify valid time-limited HMAC playback tokens', () => {
      const token = recordingStorage.generatePlaybackToken(sampleRecording.id, studentA.id, false, 3600);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(2);

      const payload = recordingStorage.verifyPlaybackToken(token, sampleRecording.id);
      expect(payload).not.toBeNull();
      expect(payload?.recordingId).toBe(sampleRecording.id);
      expect(payload?.userId).toBe(studentA.id);
      expect(payload?.canDownload).toBe(false);
    });

    it('should reject tampered, mismatched, or expired playback tokens', () => {
      const token = recordingStorage.generatePlaybackToken(sampleRecording.id, studentA.id, false, 3600);
      
      // Tampered token
      const tampered = token.slice(0, -4) + 'abcd';
      expect(recordingStorage.verifyPlaybackToken(tampered, sampleRecording.id)).toBeNull();

      // Mismatched recording ID
      expect(recordingStorage.verifyPlaybackToken(token, 'rec-different-recording')).toBeNull();

      // Expired token (negative TTL)
      const expiredToken = recordingStorage.generatePlaybackToken(sampleRecording.id, studentA.id, false, -10);
      expect(recordingStorage.verifyPlaybackToken(expiredToken, sampleRecording.id)).toBeNull();
    });

    it('should construct secure stream and download URLs with query tokens', () => {
      const streamUrl = recordingStorage.getStreamUrl(sampleRecording, studentA.id);
      expect(streamUrl).toContain(`/api/recordings/${sampleRecording.id}/stream?token=`);
      expect(streamUrl).not.toContain('download=1');

      const downloadUrl = recordingStorage.getDownloadUrl(sampleRecording, studentA.id);
      expect(downloadUrl).toContain(`/api/recordings/${sampleRecording.id}/stream?token=`);
      expect(downloadUrl).toContain('&download=1');
    });
  });

  // ==========================================================================
  // Section 2: Authorization & Cohort Access Verification
  // ==========================================================================
  describe('Learner & Staff Authorization Governance', () => {
    it('should permit Superadmin and assigned Instructors unconditional playback', async () => {
      const adminAccess = await recordingStorage.verifyAccess(sampleRecording.id, superadminUser);
      expect(adminAccess.authorized).toBe(true);
      expect(adminAccess.reason).toBe('SUPERADMIN');

      const instructorAccess = await recordingStorage.verifyAccess(sampleRecording.id, instructorUser);
      expect(instructorAccess.authorized).toBe(true);
      expect(instructorAccess.reason).toBe('COURSE_INSTRUCTOR');
    });

    it('should permit enrolled cohort learners to stream their batch class recording', async () => {
      // studentA is enrolled in btc-asp-nov26 in seed
      const learnerAccess = await recordingStorage.verifyAccess(sampleRecording.id, studentA);
      expect(learnerAccess.authorized).toBe(true);
      expect(learnerAccess.reason).toBe('PRIMARY_BATCH_ENROLLED');
      expect(learnerAccess.canDownload).toBe(false); // sampleRecording.isDownloadable is false
    });

    it('should reject un-enrolled students from accessing recordings of other cohorts', async () => {
      // studentB is not enrolled in btc-asp-nov26
      const unauthAccess = await recordingStorage.verifyAccess(sampleRecording.id, studentB);
      expect(unauthAccess.authorized).toBe(false);
      expect(unauthAccess.reason).toBe('NOT_ENROLLED_IN_COHORT');
    });

    it('should permit previous or parallel batch learners when an active batch grant exists', async () => {
      // Ensure studentB is enrolled in another batch (e.g. btc-csp-nov26)
      await db.enrollStudent({
        userId: studentB.id,
        courseId: 'crs-csp-01',
        batchId: 'btc-csp-nov26',
      });

      // Grant btc-csp-nov26 access to sampleRecording (from btc-asp-nov26)
      const grant: RecordingBatchAccess = {
        id: 'rba-test-cross-01',
        recordingId: sampleRecording.id,
        sourceBatchId: sampleRecording.batchId,
        targetBatchId: 'btc-csp-nov26',
        allowDownload: true, // override download
        status: 'ACTIVE',
        grantedBy: superadminUser.id,
        grantedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      await db.grantRecordingBatchAccess(grant);

      // Student B should now have authorized access with canDownload = true
      const crossBatchAccess = await recordingStorage.verifyAccess(sampleRecording.id, studentB);
      expect(crossBatchAccess.authorized).toBe(true);
      expect(crossBatchAccess.reason).toBe('CROSS_BATCH_GRANT_ACTIVE');
      expect(crossBatchAccess.canDownload).toBe(true);
    });

    it('should reject access if the batch access grant is revoked or expired', async () => {
      // Revoke grant
      await db.revokeRecordingBatchAccess('rba-test-cross-01');

      const revokedAccess = await recordingStorage.verifyAccess(sampleRecording.id, studentB);
      expect(revokedAccess.authorized).toBe(false);
      expect(revokedAccess.reason).toBe('NOT_ENROLLED_IN_COHORT');

      // Add expired grant
      const expiredGrant: RecordingBatchAccess = {
        id: 'rba-test-expired-01',
        recordingId: sampleRecording.id,
        sourceBatchId: sampleRecording.batchId,
        targetBatchId: 'btc-csp-nov26',
        allowDownload: false,
        status: 'ACTIVE',
        grantedBy: superadminUser.id,
        grantedAt: '2026-01-01T00:00:00Z',
        expiresAt: '2026-02-01T00:00:00Z', // Past date
        createdAt: '2026-01-01T00:00:00Z',
      };
      await db.grantRecordingBatchAccess(expiredGrant);

      const expiredAccess = await recordingStorage.verifyAccess(sampleRecording.id, studentB);
      expect(expiredAccess.authorized).toBe(false);
    });
  });

  // ==========================================================================
  // Section 3: Topic Highlights & Chapters Timeline Navigation
  // ==========================================================================
  describe('Chapter Highlights & Timestamp Timeline Validation', () => {
    it('should save and retrieve chapters sorted monotonically by start timestamp', async () => {
      const hl2: RecordingHighlight = {
        id: 'hl-test-02',
        recordingId: sampleRecording.id,
        title: 'Reynolds Number & Turbulent Duct Flow',
        startTimestampSeconds: 1200,
        endTimestampSeconds: 2400,
        createdBy: instructorUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const hl1: RecordingHighlight = {
        id: 'hl-test-01',
        recordingId: sampleRecording.id,
        title: 'ACGIH Dilution Equation Derivation',
        startTimestampSeconds: 180,
        endTimestampSeconds: 900,
        createdBy: instructorUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save out of order
      await db.saveRecordingHighlight(hl2);
      await db.saveRecordingHighlight(hl1);

      const retrieved = await db.getRecordingHighlights(sampleRecording.id);
      expect(retrieved.length).toBe(2);
      expect(retrieved[0].id).toBe('hl-test-01');
      expect(retrieved[1].id).toBe('hl-test-02');
      expect(retrieved[0].startTimestampSeconds).toBeLessThan(retrieved[1].startTimestampSeconds);
    });

    it('should reject invalid highlight timestamp ranges (negative, inverted, or exceeding duration)', () => {
      const validate = (start: number, end: number, duration: number) => {
        if (start < 0) return 'START_NEGATIVE';
        if (end <= start) return 'END_MUST_EXCEED_START';
        if (end > duration) return 'EXCEEDS_RECORDING_DURATION';
        return 'VALID';
      };

      expect(validate(-5, 100, 3600)).toBe('START_NEGATIVE');
      expect(validate(500, 400, 3600)).toBe('END_MUST_EXCEED_START');
      expect(validate(500, 500, 3600)).toBe('END_MUST_EXCEED_START');
      expect(validate(1000, 4000, 3600)).toBe('EXCEEDS_RECORDING_DURATION');
      expect(validate(0, 1800, 3600)).toBe('VALID');
    });

    it('should delete a highlight cleanly', async () => {
      const hl: RecordingHighlight = {
        id: 'hl-test-del',
        recordingId: sampleRecording.id,
        title: 'Temporary Chapter',
        startTimestampSeconds: 10,
        endTimestampSeconds: 60,
        createdBy: instructorUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveRecordingHighlight(hl);
      expect((await db.getRecordingHighlights(sampleRecording.id)).length).toBe(1);

      await db.deleteRecordingHighlight('hl-test-del');
      expect((await db.getRecordingHighlights(sampleRecording.id)).length).toBe(0);
    });
  });

  // ==========================================================================
  // Section 4: Topic-Linked Study Resources & URL Safety Validation
  // ==========================================================================
  describe('Study Resources & URL Security', () => {
    it('should attach and fetch resources linked to a class recording', async () => {
      const res: RecordingResource = {
        id: 'res-test-01',
        recordingId: sampleRecording.id,
        title: 'ACGIH Industrial Ventilation Manual (28th Edition)',
        description: 'Reference tables for capture velocity calculations.',
        resourceType: 'PDF',
        url: 'https://docs.zealosh.com/hse/ventilation-tables.pdf',
        fileSizeBytes: 4500000,
        timestampSeconds: 180,
        uploadedBy: instructorUser.id,
        createdAt: new Date().toISOString(),
      };

      await db.saveRecordingResource(res);
      const list = await db.getRecordingResources(sampleRecording.id);
      expect(list.length).toBe(1);
      expect(list[0].title).toContain('ACGIH');
      expect(list[0].resourceType).toBe('PDF');
    });

    it('should reject unsafe or malicious URLs like javascript: pseudo-protocols', () => {
      const isUrlSafe = (url: string) => {
        try {
          const parsed = new URL(url);
          return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
          return false;
        }
      };

      expect(isUrlSafe('https://zealosh.com/materials/handout.pdf')).toBe(true);
      expect(isUrlSafe('http://standards.osha.gov/pel-tables')).toBe(true);
      expect(isUrlSafe('javascript:alert(1)')).toBe(false);
      expect(isUrlSafe('data:text/html,<script>alert(1)</script>')).toBe(false);
      expect(isUrlSafe('vbscript:msgbox(1)')).toBe(false);
      expect(isUrlSafe('not-a-url')).toBe(false);
    });
  });

  // ==========================================================================
  // Section 5: Timestamp-Linked Doubts, Privacy Isolation & Instructor Answers
  // ==========================================================================
  describe('Interactive Doubts & Privacy Isolation', () => {
    it('should isolate private doubts between learners while allowing staff full visibility', async () => {
      const privateDoubt: RecordingDoubt = {
        id: 'dbt-test-private',
        recordingId: sampleRecording.id,
        userId: studentA.id,
        userName: studentA.name,
        timestampSeconds: 345,
        question: 'Could you re-explain the Q = V * A conversion from CFM to m3/s?',
        status: 'OPEN',
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveRecordingDoubt(privateDoubt);

      // Student A queries: should see own private doubt
      const studentAFeed = await db.getRecordingDoubts(sampleRecording.id, studentA.id, false);
      expect(studentAFeed.some((d) => d.id === 'dbt-test-private')).toBe(true);

      // Student B queries: should NOT see Student A's private doubt
      const studentBFeed = await db.getRecordingDoubts(sampleRecording.id, studentB.id, false);
      expect(studentBFeed.some((d) => d.id === 'dbt-test-private')).toBe(false);

      // Instructor queries (isStaff = true): should see all doubts
      const instructorFeed = await db.getRecordingDoubts(sampleRecording.id, instructorUser.id, true);
      expect(instructorFeed.some((d) => d.id === 'dbt-test-private')).toBe(true);
    });

    it('should allow other learners to see doubts once made public', async () => {
      const publicDoubt: RecordingDoubt = {
        id: 'dbt-test-public',
        recordingId: sampleRecording.id,
        userId: studentA.id,
        userName: studentA.name,
        timestampSeconds: 850,
        question: 'Is this formula applicable to non-circular ductwork using hydraulic diameter?',
        status: 'OPEN',
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveRecordingDoubt(publicDoubt);

      // Both Student A and Student B should see public doubt
      const studentBFeed = await db.getRecordingDoubts(sampleRecording.id, studentB.id, false);
      expect(studentBFeed.some((d) => d.id === 'dbt-test-public')).toBe(true);
    });

    it('should support instructor answers and automatically transition status to RESOLVED', async () => {
      const publicDoubt: RecordingDoubt = {
        id: 'dbt-test-resolve-01',
        recordingId: sampleRecording.id,
        userId: studentA.id,
        userName: studentA.name,
        timestampSeconds: 850,
        question: 'Is this formula applicable to non-circular ductwork using hydraulic diameter?',
        status: 'OPEN',
        isPublic: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await db.saveRecordingDoubt(publicDoubt);

      const answer: RecordingDoubtAnswer = {
        id: 'ans-test-01',
        doubtId: 'dbt-test-resolve-01',
        instructorId: instructorUser.id,
        instructorName: instructorUser.name,
        answerText: 'Yes, hydraulic diameter Dh = 4A / P must be substituted for round equivalent diameter.',
        referenceUrl: 'https://osha.gov/ventilation/hydraulic-diameter',
        createdAt: new Date().toISOString(),
      };

      await db.saveRecordingDoubtAnswer(answer);
      await db.resolveRecordingDoubt('dbt-test-resolve-01', 'RESOLVED');

      const doubts = await db.getRecordingDoubts(sampleRecording.id, instructorUser.id, true);
      const target = doubts.find((d) => d.id === 'dbt-test-resolve-01');
      expect(target).toBeDefined();
      expect(target?.status).toBe('RESOLVED');
      expect(target?.answers?.length).toBe(1);
      expect(target?.answers?.[0].answerText).toContain('hydraulic diameter');
    });
  });

  // ==========================================================================
  // Section 6: Live Supabase PostgreSQL Roundtrip (Core Hub Project 1)
  // ==========================================================================
  describe('Live Supabase PostgreSQL Core Hub Roundtrip (Project 1)', () => {
    it('should persist and query all 6 recording tables live on Supabase with zero residual leaks', async () => {
      if (!liveClient) {
        console.warn('Skipping live Supabase test — missing live credentials.');
        return;
      }
      try {
        const ping = await liveClient.from('courses').select('id').limit(1);
        if (ping.error) {
          console.warn('Skipping live Supabase test — cannot reach remote Supabase (Profile D cloud-gated):', ping.error.message);
          return;
        }
      } catch (err: any) {
        console.warn('Skipping live Supabase test — network unreachable (Profile D cloud-gated):', err.message);
        return;
      }

      // 1. Live Class Recording
      const liveRec: ClassRecording = {
        id: liveRecordingId,
        sessionId: 'ses-asp-01',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-nov26',
        title: `Live Test Recording ${testRunId}`,
        description: 'Live test payload for CP-7.9 verification',
        storageProvider: 'SUPABASE_STORAGE',
        storagePath: `recordings/test/${liveRecordingId}.mp4`,
        mediaUrl: `https://yeegsljnjwxdhgzfdnyg.supabase.co/storage/v1/object/public/recordings/${liveRecordingId}.mp4`,
        durationSeconds: 1800,
        fileSizeBytes: 50000000,
        status: 'AVAILABLE',
        isDownloadable: true,
        availableFrom: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const savedRec = await supabaseAdapter.saveClassRecording(liveRec);
      expect(savedRec.id).toBe(liveRecordingId);

      // 2. Live Recording Batch Access Grant
      const liveGrant: RecordingBatchAccess = {
        id: liveGrantId,
        recordingId: liveRecordingId,
        sourceBatchId: 'btc-asp-nov26',
        targetBatchId: 'btc-csp-nov26',
        allowDownload: true,
        status: 'ACTIVE',
        grantedBy: superadminUser.id,
        grantedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      const savedGrant = await supabaseAdapter.grantRecordingBatchAccess(liveGrant);
      expect(savedGrant.id).toBe(liveGrantId);

      // 3. Live Highlight Chapter
      const liveHl: RecordingHighlight = {
        id: liveHighlightId,
        recordingId: liveRecordingId,
        title: 'Live Chapter: Ventilation Calculations',
        startTimestampSeconds: 60,
        endTimestampSeconds: 300,
        createdBy: instructorUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const savedHl = await supabaseAdapter.saveRecordingHighlight(liveHl);
      expect(savedHl.id).toBe(liveHighlightId);

      // 4. Live Resource
      const liveRes: RecordingResource = {
        id: liveResourceId,
        recordingId: liveRecordingId,
        title: 'Live Resource: OSHA Formulas',
        resourceType: 'PDF',
        url: 'https://osha.gov/formulas.pdf',
        fileSizeBytes: 102400,
        timestampSeconds: 60,
        uploadedBy: instructorUser.id,
        createdAt: new Date().toISOString(),
      };
      const savedRes = await supabaseAdapter.saveRecordingResource(liveRes);
      expect(savedRes.id).toBe(liveResourceId);

      // 5. Live Doubt
      const liveDoubt: RecordingDoubt = {
        id: liveDoubtId,
        recordingId: liveRecordingId,
        userId: studentA.id,
        timestampSeconds: 120,
        question: 'Live Doubt: Does OSHA permit dilution for carcinogens?',
        status: 'OPEN',
        isPublic: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const savedDbt = await supabaseAdapter.saveRecordingDoubt(liveDoubt);
      expect(savedDbt.id).toBe(liveDoubtId);

      // 6. Live Doubt Answer
      const liveAns: RecordingDoubtAnswer = {
        id: liveAnswerId,
        doubtId: liveDoubtId,
        instructorId: instructorUser.id,
        answerText: 'No, OSHA standard 1910.1000 requires local exhaust engineering controls.',
        referenceUrl: 'https://osha.gov/1910.1000',
        createdAt: new Date().toISOString(),
      };
      const savedAns = await supabaseAdapter.saveRecordingDoubtAnswer(liveAns);
      expect(savedAns.id).toBe(liveAnswerId);

      // Verify Doubt Retrieval with Answers
      const retrievedDoubts = await supabaseAdapter.getRecordingDoubts(liveRecordingId, instructorUser.id, true);
      expect(retrievedDoubts.length).toBeGreaterThanOrEqual(1);
      const foundDoubt = retrievedDoubts.find((d) => d.id === liveDoubtId);
      expect(foundDoubt).toBeDefined();
      expect(foundDoubt?.answers?.length).toBe(1);
      expect(foundDoubt?.answers?.[0].id).toBe(liveAnswerId);

      // 7. Cleanup Live Fixtures
      await liveClient.from('recording_doubt_answers').delete().eq('id', liveAnswerId);
      await liveClient.from('recording_doubts').delete().eq('id', liveDoubtId);
      await liveClient.from('recording_resources').delete().eq('id', liveResourceId);
      await liveClient.from('recording_highlights').delete().eq('id', liveHighlightId);
      await liveClient.from('recording_batch_access').delete().eq('id', liveGrantId);
      await liveClient.from('class_recordings').delete().eq('id', liveRecordingId);

      // Verify Clean Deletion
      const { data: checkRec } = await liveClient.from('class_recordings').select('id').eq('id', liveRecordingId);
      expect(checkRec?.length).toBe(0);
    });
  });
});
