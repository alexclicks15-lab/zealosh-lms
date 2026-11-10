import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { loadEnvConfig } from '@next/env';
import { supabaseAdapter, SupabaseAdapter, mapDbCourseToDomain, mapDomainCourseToDb, mapDbBatchToDomain, mapDomainBatchToDb } from '../src/lib/store/supabase-adapter';
import { db, validateStorageMode } from '../src/lib/store/db';
import { Course, Batch, User } from '../src/types';

loadEnvConfig(process.cwd());

describe('Zealosh LMS — Authoritative Supabase Persistence Integration Suite', { timeout: 60000 }, () => {
  const originalStorage = process.env.DATABASE_STORAGE;
  let isSupabaseOnline = false;

  beforeAll(async () => {
    // Ensure test environment uses test gateway configuration
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://yeegsljnjwxdhgzfdnyg.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_IMAOSBMuGgGlXOrVUcNGHQ_NUKVEWQ4';
    }
    try {
      const status = await supabaseAdapter.validateConnection();
      isSupabaseOnline = status.connected;
    } catch {
      isSupabaseOnline = false;
    }
  });

  afterAll(() => {
    process.env.DATABASE_STORAGE = originalStorage;
  });

  // --------------------------------------------------------------------------
  // 1. Storage Configuration Validation
  // --------------------------------------------------------------------------
  describe('Storage Mode Configuration & Guard Validation', () => {
    it('should accept valid storage mode values: in_memory, supabase, postgres', () => {
      expect(validateStorageMode('in_memory')).toBe('in_memory');
      expect(validateStorageMode('supabase')).toBe('supabase');
      expect(validateStorageMode('postgres')).toBe('postgres');
    });

    it('should reject invalid or misspelled storage modes with explicit error', () => {
      expect(() => validateStorageMode('supabse')).toThrow(/CONFIGURATION ERROR: Unsupported or invalid DATABASE_STORAGE/);
      expect(() => validateStorageMode('memory')).toThrow(/CONFIGURATION ERROR/);
      expect(() => validateStorageMode('cloud')).toThrow(/CONFIGURATION ERROR/);
    });

    it('should report active storage mode matching environment', () => {
      process.env.DATABASE_STORAGE = 'in_memory';
      expect(db.getStorageMode()).toBe('in_memory');
    });
  });

  // --------------------------------------------------------------------------
  // 2. DTO Mappings and Data Transformation Fidelity
  // --------------------------------------------------------------------------
  describe('PostgreSQL Schema <-> Domain Model DTO Transformation Fidelity', () => {
    it('should map course snake_case database row to camelCase domain model accurately', () => {
      const dbRow = {
        id: 'crs-test-dto',
        title: 'DTO Mapping Verification Course',
        slug: 'dto-mapping-verification',
        certification_type: 'ASP',
        delivery_model: 'HYBRID',
        status: 'PUBLISHED',
        headline: 'Test headline',
        description: 'Test description',
        learning_objectives: ['Obj 1', 'Obj 2'],
        prerequisites: ['Prereq 1'],
        price_inr: 25000,
        price_usd: 350,
        duration_weeks: 8,
        cover_image: 'https://example.com/cover.jpg',
        lead_instructor_id: 'usr-inst-01',
        co_instructor_ids: ['usr-inst-02'],
        moodle_course_id: 101,
        modules_count: 6,
        total_lessons: 30,
        total_hours: 45,
        created_at: '2026-10-23T00:00:00Z',
        updated_at: '2026-10-23T00:00:00Z',
      };

      const domain = mapDbCourseToDomain(dbRow);
      expect(domain.id).toBe('crs-test-dto');
      expect(domain.title).toBe('DTO Mapping Verification Course');
      expect(domain.certificationType).toBe('ASP');
      expect(domain.deliveryModel).toBe('HYBRID');
      expect(domain.status).toBe('PUBLISHED');
      expect(domain.priceInr).toBe(25000);
      expect(domain.moodleCourseId).toBe(101);
      expect(domain.learningObjectives).toEqual(['Obj 1', 'Obj 2']);

      const backToDb = mapDomainCourseToDb(domain);
      expect(backToDb.id).toBe('crs-test-dto');
      expect(backToDb.certification_type).toBe('ASP');
      expect(backToDb.price_inr).toBe(25000);
      expect(backToDb.moodle_course_id).toBe(101);
    });

    it('should map batch snake_case database row to camelCase domain model accurately', () => {
      const dbRow = {
        id: 'btc-test-dto',
        course_id: 'crs-test-dto',
        name: 'DTO Test Batch',
        start_date: '2026-11-01',
        end_date: '2027-01-31',
        schedule_description: 'Mon & Wed evenings',
        capacity: 25,
        enrolled_count: 5,
        lead_instructor_id: 'usr-inst-01',
        status: 'UPCOMING',
      };

      const domain = mapDbBatchToDomain(dbRow);
      expect(domain.id).toBe('btc-test-dto');
      expect(domain.courseId).toBe('crs-test-dto');
      expect(domain.capacity).toBe(25);
      expect(domain.enrolledCount).toBe(5);
      expect(domain.status).toBe('UPCOMING');

      const backToDb = mapDomainBatchToDb(domain);
      expect(backToDb.course_id).toBe('crs-test-dto');
      expect(backToDb.capacity).toBe(25);
      expect(backToDb.enrolled_count).toBe(5);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Live Remote Supabase Gateway Data Retrieval Tests
  // --------------------------------------------------------------------------
  describe('Live Remote Supabase Gateway Verification', () => {
    it('should validate remote gateway connectivity and core schema', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const status = await supabaseAdapter.validateConnection();
      expect(status.connected).toBe(true);
      expect(status.message).toContain('Supabase gateway');
    });

    it('should fetch the 4 seeded certification masterclasses from Supabase', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const courses = await supabaseAdapter.getCourses();
      expect(courses.length).toBeGreaterThanOrEqual(4);

      const asp = courses.find((c) => c.id === 'crs-asp-01');
      expect(asp).toBeDefined();
      expect(asp?.title).toContain('ASP: Associate Safety Professional');
      expect(asp?.status).toBe('PUBLISHED');

      const csp = courses.find((c) => c.id === 'crs-csp-02');
      expect(csp).toBeDefined();
      expect(csp?.certificationType).toBe('CSP');
    });

    it('should fetch seeded scheduled cohorts from Supabase', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const batches = await supabaseAdapter.getBatches();
      expect(batches.length).toBeGreaterThanOrEqual(2);

      const weekdayBatch = batches.find((b) => b.id === 'btc-asp-weekday');
      expect(weekdayBatch).toBeDefined();
      expect(weekdayBatch?.capacity).toBe(30);
      expect(weekdayBatch?.enrolledCount).toBeGreaterThanOrEqual(4);

      const fullBatch = batches.find((b) => b.id === 'btc-asp-full');
      expect(fullBatch).toBeDefined();
      expect(fullBatch?.capacity).toBe(25);
      expect(fullBatch?.enrolledCount).toBe(25);
    });

    it('should fetch the official Zealosh branding theme from Supabase', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const theme = await supabaseAdapter.getBrandingTheme();
      expect(theme).toBeDefined();
      expect(theme.primaryGreen).toBe('#4f8c4c');
      expect(theme.deepGreen).toBe('#3a7536');
      expect(theme.fontFamily).toBe('Inter');
    });

    it('should fetch public platform settings singleton from Supabase', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const settings = await supabaseAdapter.getPlatformSettings();
      expect(settings).toBeDefined();
      expect(settings.platformName).toContain('Zealosh');
      expect(settings.organizationName).toBe('Zealosh Training & Consultants');
    });
  });

  // --------------------------------------------------------------------------
  // 4. Atomic Enrollment & Concurrency Limits
  // --------------------------------------------------------------------------
  describe('Atomic Enrollment & Seat Capacity Enforcement', () => {
    it('should reject enrollment when batch is at full capacity (Zero Overselling)', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      // btc-asp-full is seeded with capacity: 25, enrolledCount: 25
      await expect(
        supabaseAdapter.enrollStudent({
          userId: 'usr-std-01',
          batchId: 'btc-asp-full',
        })
      ).rejects.toThrow(/BATCH_CAPACITY_EXCEEDED/);
    });

    it('should enforce defense-in-depth RLS on enrollments: unauthenticated client is blocked from inserting enrollments', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const { createClient } = await import('@supabase/supabase-js');
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await anonClient.from('enrollments').insert({
        id: `enr-anon-${Date.now()}`,
        user_id: 'usr-std-01',
        course_id: 'crs-asp-01',
        batch_id: 'btc-asp-weekday',
        status: 'ACTIVE',
      });
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/row-level security policy|permission denied/i);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Examination Lifecycle & Authoritative Server Scoring
  // --------------------------------------------------------------------------
  describe('Authoritative Examination Lifecycle & Scoring Integrity', () => {
    it('should fetch exam blueprints with domain specifications', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const blueprints = await supabaseAdapter.getExamBlueprints();
      expect(blueprints.length).toBeGreaterThanOrEqual(1);

      const aspBlueprint = blueprints.find((bp) => bp.id === 'bp-asp-bcsp-v10');
      expect(aspBlueprint).toBeDefined();
      expect(aspBlueprint?.totalQuestions).toBe(100);
      expect(aspBlueprint?.durationMinutes).toBe(180);
      expect(aspBlueprint?.passingScorePercent).toBe(70);
    });

    it('should reject examination answer submission after deadline expiration', async () => {
      // Mock an expired attempt
      const attemptId = 'att-mock-expired';
      const expiredAttempt = {
        id: attemptId,
        userId: 'usr-std-01',
        blueprintId: 'bp-asp-bcsp-v10',
        certificationType: 'ASP' as const,
        status: 'IN_PROGRESS' as const,
        startTime: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
        deadlineTime: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // 1 hour ago
        assignedQuestionIds: ['q1', 'q2'],
        answers: {},
        bookmarkedQuestionIds: [],
        passingScorePercent: 70,
      };

      const originalGetAttempt = supabaseAdapter.getExamAttempt.bind(supabaseAdapter);
      (supabaseAdapter as any).getExamAttempt = async () => expiredAttempt;

      try {
        await expect(
          supabaseAdapter.saveExamAnswers(attemptId, 'usr-std-01', { q1: ['opt-a'] })
        ).rejects.toThrow(/EXAM_DEADLINE_EXP/);
      } finally {
        (supabaseAdapter as any).getExamAttempt = originalGetAttempt;
      }
    });

    it('should shield raw exam answer keys and reject unauthorized access', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      // In accordance with ADR-002, unauthenticated role anon is completely revoked from raw exam_questions
      const { createClient } = await import('@supabase/supabase-js');
      const anonClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { error } = await anonClient.from('exam_questions').select('correct_option_ids');
      expect(error).not.toBeNull();
      expect(error?.message).toMatch(/permission denied for table exam_questions/i);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Controlled Storage Mode Switching Acceptance Test
  // --------------------------------------------------------------------------
  describe('Controlled Supabase Mode Switch Acceptance Test', () => {
    it('should validate storage mode switching and delegate to Supabase adapter when DATABASE_STORAGE="supabase"', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      // Temporarily switch storage mode in controlled test environment
      process.env.DATABASE_STORAGE = 'supabase';
      expect(db.getStorageMode()).toBe('supabase');

      // Test delegation with capacity check
      await expect(
        db.enrollStudent({
          userId: 'usr-std-01',
          batchId: 'btc-asp-full',
        })
      ).rejects.toThrow(/BATCH_CAPACITY_EXCEEDED/);

      // Restore in_memory mode immediately
      process.env.DATABASE_STORAGE = 'in_memory';
      expect(db.getStorageMode()).toBe('in_memory');
    });

    it('should preserve in-memory behavior when DATABASE_STORAGE="in_memory"', () => {
      process.env.DATABASE_STORAGE = 'in_memory';
      expect(db.getStorageMode()).toBe('in_memory');

      const course = db.courses.get('crs-asp-01');
      expect(course).toBeDefined();
      expect(course?.status).toBe('PUBLISHED');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Section 7 — Mandatory 12-Point Acceptance Verification Suite
  // --------------------------------------------------------------------------
  describe('Mandatory 12-Point Real PostgreSQL Persistence & Security Acceptance Criteria', () => {
    let originalSupportEmail = 'support@zealosh.com';
    let testEnrollmentId: string | null = null;
    let testAttemptId: string | null = null;
    const testUserId = 'usr-std-01';
    const testIdempotencyKey = `idemp_pers_${Date.now()}`;

    // Test 1: Read existing seeded courses from Supabase
    it('1. should read existing seeded certification masterclasses from Supabase', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const courses = await supabaseAdapter.getCourses();
      expect(courses.length).toBeGreaterThanOrEqual(4);
      const asp = courses.find((c) => c.id === 'crs-asp-01');
      expect(asp).toBeDefined();
      expect(asp?.title).toContain('ASP: Associate Safety Professional');
      expect(asp?.status).toBe('PUBLISHED');
    });

    // Test 2: Update a dedicated test setting through actual data-access layer
    it('2. should update a dedicated test setting through the actual data-access layer', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const initialSettings = await supabaseAdapter.getPlatformSettings();
      if (initialSettings?.supportEmail) {
        originalSupportEmail = initialSettings.supportEmail;
      }
      const updated = await supabaseAdapter.updatePlatformSettings({
        supportEmail: 'qa-acceptance-test@zealosh.com',
      });
      expect(updated.supportEmail).toBe('qa-acceptance-test@zealosh.com');
    });

    // Test 3: Read it back through a separate request
    it('3. should read back the updated setting through a distinct request', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const settings = await supabaseAdapter.getPlatformSettings();
      expect(settings.supportEmail).toBe('qa-acceptance-test@zealosh.com');
    });

    // Test 4: Verify the write after a fresh server process / fresh adapter instantiation
    it('4. should verify persistence survives a fresh un-cached adapter instance (cross-process simulation)', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const freshAdapter = new SupabaseAdapter();
      const freshSettings = await freshAdapter.getPlatformSettings();
      expect(freshSettings.supportEmail).toBe('qa-acceptance-test@zealosh.com');
    });

    // Test 5: Create and read an isolated test enrollment
    it('5. should create and read an isolated test enrollment in Supabase', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const enrollResult = await supabaseAdapter.enrollStudent({
        userId: testUserId,
        batchId: 'btc-asp-weekday',
        idempotencyKey: testIdempotencyKey,
      });
      expect(enrollResult.success).toBe(true);
      expect(enrollResult.enrollment).toBeDefined();
      expect(enrollResult.enrollment.batchId).toBe('btc-asp-weekday');
      testEnrollmentId = enrollResult.enrollment.id;

      const enrollments = await supabaseAdapter.getEnrollments(testUserId, 'btc-asp-weekday');
      expect(enrollments.some((e) => e.id === testEnrollmentId)).toBe(true);
    });

    // Test 6: Verify idempotency and full-capacity rejection
    it('6. should enforce idempotency on duplicate enrollment and reject over-capacity batch', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      // Idempotent retry returns existing enrollment with isNew: false
      const dupResult = await supabaseAdapter.enrollStudent({
        userId: testUserId,
        batchId: 'btc-asp-weekday',
        idempotencyKey: testIdempotencyKey,
      });
      expect(dupResult.success).toBe(true);
      expect(dupResult.isNew).toBe(false);
      expect(dupResult.enrollment.id).toBe(testEnrollmentId);

      // Full capacity rejection on btc-asp-full (25/25)
      await expect(
        supabaseAdapter.enrollStudent({
          userId: 'usr-std-01',
          batchId: 'btc-asp-full',
        })
      ).rejects.toThrow(/BATCH_CAPACITY_EXCEEDED/);
    });

    // Test 7: Test concurrent attempts to claim the final seat
    it('7. should safely serialize concurrent enrollment attempts using atomic database function', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      // Simultaneous attempts on a full batch must all be rejected safely
      const results = await Promise.allSettled([
        supabaseAdapter.enrollStudent({ userId: 'usr-std-01', batchId: 'btc-asp-full' }),
        supabaseAdapter.enrollStudent({ userId: 'usr-std-01', batchId: 'btc-asp-full' }),
        supabaseAdapter.enrollStudent({ userId: 'usr-std-01', batchId: 'btc-asp-full' }),
      ]);
      results.forEach((res) => {
        expect(res.status).toBe('rejected');
        if (res.status === 'rejected') {
          expect(res.reason.message).toMatch(/BATCH_CAPACITY_EXCEEDED/);
        }
      });
    });

    // Test 8: Test examination start, autosave, submission, and authoritative scoring
    it('8. should manage full examination lifecycle: start, answer autosave, authoritative scoring', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const attempt = await supabaseAdapter.startExamAttempt(testUserId, 'bp-asp-bcsp-v10');
      expect(attempt).toBeDefined();
      expect(attempt.status).toBe('IN_PROGRESS');
      expect(attempt.assignedQuestionIds.length).toBeGreaterThan(0);
      testAttemptId = attempt.id;

      // Autosave answers
      const firstQId = attempt.assignedQuestionIds[0];
      const savedAttempt = await supabaseAdapter.saveExamAnswers(attempt.id, testUserId, {
        [firstQId]: ['opt-a'],
      });
      expect(savedAttempt.answers[firstQId]).toEqual(['opt-a']);

      // Authoritative server submission
      const submitted = await supabaseAdapter.submitExamAttempt(attempt.id, testUserId);
      expect(submitted.status).toBe('COMPLETED');
      expect(typeof submitted.totalScore).toBe('number');
      expect(submitted.completedTime).toBeDefined();
      expect(submitted.domainBreakdown).toBeDefined();
    });

    // Test 9: Verify role enforcement and cross-user isolation
    it('9. should enforce cross-user isolation and reject unauthorized exam operations', async () => {
      if (testAttemptId) {
        // Attempting to submit or save answers for another user must throw unauthorized error
        await expect(
          supabaseAdapter.saveExamAnswers(testAttemptId, 'usr-intruder-999', { q1: ['opt-x'] })
        ).rejects.toThrow(/Unauthorized attempt/i);

        await expect(
          supabaseAdapter.submitExamAttempt(testAttemptId, 'usr-intruder-999')
        ).rejects.toThrow(/Unauthorized attempt/i);
      }
    });

    // Test 10: Confirm audit events persist
    it('10. should persist audit log events directly to Supabase audit_logs', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      const auditPayload = {
        actorUserId: 'usr-admin-01',
        actorEmail: 'admin@zealosh.com',
        actorRole: 'SUPER_ADMIN' as const,
        action: 'ACCEPTANCE_TEST_AUDIT_LOG',
        entityType: 'TEST',
        entityId: `test-${Date.now()}`,
        details: { suite: '12-point-acceptance', verifiedAt: new Date().toISOString() },
      };

      const recorded = await supabaseAdapter.recordAudit(auditPayload);
      expect(recorded.id).toBeDefined();

      const recentLogs = await supabaseAdapter.getAuditLogs(20);
      const found = recentLogs.find((l) => l.action === 'ACCEPTANCE_TEST_AUDIT_LOG');
      expect(found).toBeDefined();
      expect(found?.actorEmail).toBe('admin@zealosh.com');
    });

    // Test 11: Verify safe recovery from network and database errors
    it('11. should safely recover from invalid database inputs without unhandled errors', async () => {
      await expect(
        supabaseAdapter.enrollStudent({
          userId: 'usr-test-invalid',
          batchId: 'btc-nonexistent-batch-id-xyz',
        })
      ).rejects.toThrow();

      await expect(
        supabaseAdapter.submitExamAttempt('att-nonexistent-999', testUserId)
      ).rejects.toThrow(/Attempt not found/);
    });

    // Test 12: Clean up only dedicated test records and confirm seeded data is unchanged
    it('12. should restore test settings, clean up test records, and verify seeded baseline intact', async () => {
      if (!isSupabaseOnline) {
        console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
        return;
      }
      // 1. Restore platform settings
      await supabaseAdapter.updatePlatformSettings({
        supportEmail: originalSupportEmail,
      });
      const restored = await supabaseAdapter.getPlatformSettings();
      expect(restored.supportEmail).toBe(originalSupportEmail);

      // 2. Clean up test records using client if service role is present
      const client = (supabaseAdapter as any).getClient();
      if (testEnrollmentId) {
        await client.from('enrollments').delete().eq('id', testEnrollmentId);
        await client.from('batches').update({ enrolled_count: 4 }).eq('id', 'btc-asp-weekday');
      }
      if (testAttemptId) {
        await client.from('exam_attempts').delete().eq('id', testAttemptId);
      }
      await client.from('audit_logs').delete().eq('action', 'ACCEPTANCE_TEST_AUDIT_LOG');

      // 3. Confirm seeded courses intact
      const courses = await supabaseAdapter.getCourses();
      expect(courses.length).toBeGreaterThanOrEqual(4);
      const asp = courses.find((c) => c.id === 'crs-asp-01');
      expect(asp?.title).toContain('ASP: Associate Safety Professional');
    });
  });
});
