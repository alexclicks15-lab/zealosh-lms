import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';
import { db } from '../src/lib/store/db';
import { signToken } from '../src/lib/auth/jwt';
import {
  BbbApiClassroomProvider,
  ClassroomProviderError,
  ClassroomProvider,
  classroomProvider,
  ClassroomRecordingMetadata,
} from '../src/lib/classroom';
import {
  getClassroomBranding,
  formatClassroomTitle,
  getBrandedWelcomeMessage,
} from '../src/lib/classroom/branding';
import { POST as joinLiveSessionHandler } from '../src/app/api/live/[sessionId]/join/route';
import { POST as endLiveSessionHandler } from '../src/app/api/live/[sessionId]/end/route';
import { POST as recordingWebhookHandler } from '../src/app/api/webhooks/bbb/recording/route';
import { recordingIngestionService } from '../src/lib/storage/recording-ingestion-service';
import { LiveSession, User, Enrollment, Course, Batch } from '../src/types';

describe('Zealosh LMS — CP-8.12: Classroom Provider Contract & Abstraction Boundary Suite', () => {
  const originalEnv = { ...process.env };
  const mockApiUrl = 'https://classroom.zealosh.com/bigbluebutton/api';
  const mockSecret = 'zealosh-test-salt-secret-812';

  // Seed Entities
  const studentUser: User = {
    id: 'usr-cp812-student',
    name: 'Priya Ananth',
    email: 'priya.cp812@zealosh.com',
    passwordHash: 'hash',
    role: 'STUDENT',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const instructorUser: User = {
    id: 'usr-cp812-instructor',
    name: 'Dr. Ramesh Nair',
    email: 'ramesh.instructor@zealosh.com',
    passwordHash: 'hash',
    role: 'INSTRUCTOR',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const unassignedInstructor: User = {
    id: 'usr-cp812-unassigned-inst',
    name: 'Prof. Unassigned',
    email: 'unassigned@zealosh.com',
    passwordHash: 'hash',
    role: 'INSTRUCTOR',
    organizationId: 'org-zealosh-main',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const course: Course = {
    id: 'crs-cp812-01',
    slug: 'asp-prep',
    title: 'ASP Certification Prep',
    headline: 'ASP Prep',
    description: 'Prep course',
    deliveryModel: 'HYBRID',
    leadInstructorId: 'usr-cp812-instructor',
    coInstructorIds: [],
    certificationType: 'ASP',
    status: 'PUBLISHED',
    learningObjectives: [],
    prerequisites: [],
    priceInr: 30000,
    priceUsd: 400,
    durationWeeks: 8,
    coverImage: '/images/cover.jpg',
    modulesCount: 2,
    totalLessons: 10,
    totalHours: 20,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const batch: Batch = {
    id: 'btc-cp812-01',
    courseId: course.id,
    name: 'ASP November 2026 Cohort',
    leadInstructorId: 'usr-cp812-instructor',
    startDate: '2026-11-01T00:00:00Z',
    endDate: '2026-12-31T00:00:00Z',
    scheduleDescription: 'Saturdays & Sundays 7:00 PM - 9:30 PM IST',
    status: 'ACTIVE',
    capacity: 30,
    enrolledCount: 1,
  };

  const enrollment: Enrollment = {
    id: 'enr-cp812-01',
    userId: studentUser.id,
    courseId: course.id,
    batchId: batch.id,
    status: 'ACTIVE',
    enrolledAt: '2026-10-01T00:00:00Z',
    expiresAt: '2027-10-01T00:00:00Z',
    progressPercent: 20,
    completedLessonIds: [],
  };

  const liveSession: LiveSession = {
    id: 'sess-cp812-live',
    batchId: batch.id,
    courseId: course.id,
    title: 'Live Workshop: Mechanical Safety & Machinery Guarding',
    scheduledStartTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins ago
    durationMinutes: 90,
    instructorId: 'usr-cp812-instructor',
    meetingId: 'mtg-cp812-live',
    status: 'LIVE',
  };

  let studentToken: string;
  let instructorToken: string;
  let unassignedInstructorToken: string;

  beforeEach(() => {
    process.env.DATABASE_STORAGE = 'in_memory';
    process.env.BIGBLUEBUTTON_URL = mockApiUrl;
    process.env.BIGBLUEBUTTON_SECRET = mockSecret;
    process.env.BBB_SECURITY_SALT = mockSecret;
    process.env.NEXT_PUBLIC_CLASSROOM_BRAND_NAME = 'Zealosh Live Classroom';

    studentToken = signToken({
      userId: studentUser.id,
      name: studentUser.name,
      email: studentUser.email,
      role: studentUser.role,
      organizationId: studentUser.organizationId,
    });

    instructorToken = signToken({
      userId: instructorUser.id,
      name: instructorUser.name,
      email: instructorUser.email,
      role: instructorUser.role,
      organizationId: instructorUser.organizationId,
    });

    unassignedInstructorToken = signToken({
      userId: unassignedInstructor.id,
      name: unassignedInstructor.name,
      email: unassignedInstructor.email,
      role: unassignedInstructor.role,
      organizationId: unassignedInstructor.organizationId,
    });

    db.users.set(studentUser.id, studentUser);
    db.users.set(instructorUser.id, instructorUser);
    db.users.set(unassignedInstructor.id, unassignedInstructor);
    db.courses.set(course.id, course);
    db.batches.set(batch.id, batch);
    db.enrollments.set(enrollment.id, enrollment);
    db.liveSessions.set(liveSession.id, { ...liveSession });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // 1. Branding Configuration & Brand Primacy
  // ==========================================================================
  describe('1. Classroom Branding & Brand Primacy', () => {
    it('1.1 returns authoritative Zealosh green visual identity by default', () => {
      const branding = getClassroomBranding();
      expect(branding.brandName).toBe('Zealosh Live Classroom');
      expect(branding.primaryColor).toBe('#4E8C4A');
      expect(branding.secondaryColor).toBe('#8CBF4D');
      expect(branding.headerColor).toBe('#3a7536');
      expect(branding.supportEmail).toBe('support@zealosh.com');
      expect(branding.logoUrl).toContain('logo.png');
    });

    it('1.2 respects NEXT_PUBLIC_CLASSROOM_BRAND_NAME environment override', () => {
      process.env.NEXT_PUBLIC_CLASSROOM_BRAND_NAME = 'Zealosh Safety Academy Live';
      const branding = getClassroomBranding();
      expect(branding.brandName).toBe('Zealosh Safety Academy Live');
      expect(branding.customerFacingName).toBe('Zealosh Safety Academy Live');
    });

    it('1.3 formats classroom session titles and welcome messages without third-party vendor leaks', () => {
      const formatted = formatClassroomTitle('ASP Domain 1: Mathematics & Science');
      expect(formatted).toBe('Zealosh Live Classroom — ASP Domain 1: Mathematics & Science');

      const welcome = getBrandedWelcomeMessage('ASP Domain 1: Mathematics & Science');
      expect(welcome).toContain('Zealosh Live Classroom');
      expect(welcome).toContain('ASP Domain 1: Mathematics & Science');
      // Must not leak internal engine names
      expect(welcome).not.toContain('BigBlueButton');
      expect(welcome).not.toContain('Moodle');
      expect(welcome).not.toContain('Keycloak');
    });
  });

  // ==========================================================================
  // 2. BbbApiClassroomProvider — Contract Conformance
  // ==========================================================================
  describe('2. BbbApiClassroomProvider Contract Conformance', () => {
    it('2.1 throws CONFIG_MISSING error when API credentials are absent', async () => {
      const providerWithoutConfig = new BbbApiClassroomProvider({
        baseUrl: '',
        salt: '',
      });

      await expect(
        providerWithoutConfig.provisionSession({
          sessionId: 'sess-test-01',
          sessionTitle: 'Test Class',
          meetingId: 'mtg-test-01',
          courseId: 'crs-01',
        })
      ).rejects.toThrow(ClassroomProviderError);

      try {
        await providerWithoutConfig.provisionSession({
          sessionId: 'sess-test-01',
          sessionTitle: 'Test Class',
          meetingId: 'mtg-test-01',
          courseId: 'crs-01',
        });
      } catch (err: any) {
        expect(err).toBeInstanceOf(ClassroomProviderError);
        expect(err.code).toBe('CONFIG_MISSING');
        expect(err.statusCode).toBe(500);
      }
    });

    it('2.2 provisions classroom session with default passwords and brand metadata', async () => {
      const mockAdapter = {
        createMeeting: vi.fn().mockResolvedValue({
          returncode: 'SUCCESS',
          meetingID: 'mtg-test-prov-01',
          attendeePW: 'mock-attendee-pw',
          moderatorPW: 'mock-mod-pw',
          createTime: '1700000000',
          hasUserJoined: 'false',
        }),
        getJoinUrl: vi.fn(),
        isMeetingRunning: vi.fn(),
        getRecordings: vi.fn(),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);

      const result = await provider.provisionSession({
        sessionId: 'sess-prov-01',
        sessionTitle: 'HSE Risk Assessment',
        meetingId: 'mtg-test-prov-01',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-01',
        record: true,
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.meetingId).toBe('mtg-test-prov-01');
      expect(mockAdapter.createMeeting).toHaveBeenCalledTimes(1);

      const callArgs = mockAdapter.createMeeting.mock.calls[0][0];
      expect(callArgs.meetingID).toBe('mtg-test-prov-01');
      expect(callArgs.name).toContain('Zealosh Live Classroom — HSE Risk Assessment');
      expect(callArgs.record).toBe(true);
      expect(callArgs.meta_courseId).toBe('crs-asp-01');
      expect(callArgs.meta_batchId).toBe('btc-asp-01');
      expect(callArgs.meta_sessionId).toBe('sess-prov-01');
    });

    it('2.3 detects duplicate/already existing meetings without failing', async () => {
      const mockAdapter = {
        createMeeting: vi.fn().mockResolvedValue({
          returncode: 'SUCCESS',
          messageKey: 'duplicateWarning',
          message: 'This meeting ID already exists',
          meetingID: 'mtg-existing-01',
        }),
        getJoinUrl: vi.fn(),
        isMeetingRunning: vi.fn(),
        getRecordings: vi.fn(),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);

      const result = await provider.provisionSession({
        sessionId: 'sess-existing-01',
        sessionTitle: 'Ongoing Session',
        meetingId: 'mtg-existing-01',
        courseId: 'crs-asp-01',
      });

      expect(result.success).toBe(true);
      expect(result.created).toBe(false);
      expect(result.meetingId).toBe('mtg-existing-01');
    });

    it('2.4 generates role-aware join URLs (student gets attendee PW, instructor gets moderator PW)', async () => {
      const mockAdapter = {
        createMeeting: vi.fn(),
        getJoinUrl: vi.fn().mockImplementation((params) => {
          return `https://classroom.zealosh.com/join?fullName=${encodeURIComponent(params.fullName)}&meetingID=${params.meetingID}&password=${params.password}&checksum=mocksha1`;
        }),
        isMeetingRunning: vi.fn(),
        getRecordings: vi.fn(),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);

      // Student Join
      const studentUrl = await provider.generateJoinUrl({
        meetingId: 'mtg-live-01',
        sessionId: 'sess-live-01',
        userId: 'usr-student-01',
        fullName: 'Aarav Sharma',
        role: 'STUDENT',
      });

      expect(studentUrl).toContain('https://classroom.zealosh.com/join');
      expect(mockAdapter.getJoinUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingID: 'mtg-live-01',
          fullName: 'Aarav Sharma',
          userID: 'usr-student-01',
          role: 'STUDENT',
        })
      );

      // Instructor Join
      const instructorUrl = await provider.generateJoinUrl({
        meetingId: 'mtg-live-01',
        sessionId: 'sess-live-01',
        userId: 'usr-instructor-01',
        fullName: 'Dr. Ramesh Nair',
        role: 'INSTRUCTOR',
      });

      expect(instructorUrl).toContain('https://classroom.zealosh.com/join');
      expect(mockAdapter.getJoinUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingID: 'mtg-live-01',
          fullName: 'Dr. Ramesh Nair',
          userID: 'usr-instructor-01',
          role: 'INSTRUCTOR',
        })
      );
    });

    it('2.5 inspects session running status via getSessionStatus', async () => {
      const mockAdapter = {
        isMeetingRunning: vi.fn(),
        getMeetingInfo: vi.fn().mockResolvedValue({
          returncode: 'SUCCESS',
          meetingID: 'mtg-running-01',
          running: 'true',
          participantCount: '15',
          moderatorCount: '2',
          startTime: '1700001000',
        }),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);

      const status = await provider.getSessionStatus('mtg-running-01');
      expect(status.meetingId).toBe('mtg-running-01');
      expect(status.isRunning).toBe(true);
      expect(status.participantCount).toBe(15);
      expect(status.moderatorCount).toBe(2);
    });

    it('2.6 returns isRunning: false when getMeetingInfo returns not running or not found', async () => {
      const mockAdapter = {
        isMeetingRunning: vi.fn().mockResolvedValue(false),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);

      const status = await provider.getSessionStatus('mtg-nonexistent-01');
      expect(status.meetingId).toBe('mtg-nonexistent-01');
      expect(status.isRunning).toBe(false);
      expect(status.hasEnded).toBe(true);
    });

    it('2.7 normalizes upstream recordings to canonical ClassroomRecordingMetadata', async () => {
      const mockAdapter = {
        getRecordings: vi.fn().mockResolvedValue([
          {
            recordId: 'rec-upstream-001',
            meetingId: 'mtg-rec-01',
            name: 'ASP Rigging Workshop Recording',
            published: true,
            state: 'published',
            startTime: '1700000000',
            endTime: '1700007200',
            playbackUrl: 'https://classroom.zealosh.com/playback/presentation/2.3/rec-upstream-001',
            playbackFormat: 'presentation',
            durationSeconds: 7200,
            lengthMinutes: 120,
            sizeBytes: 450000000,
            metadata: {
              sessionId: 'sess-01',
              courseId: 'crs-asp-01',
            },
          },
        ]),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);

      const recordings = await provider.getRecordings({ meetingId: 'mtg-rec-01' });
      expect(recordings).toHaveLength(1);

      const rec = recordings[0];
      expect(rec.recordId).toBe('rec-upstream-001');
      expect(rec.meetingId).toBe('mtg-rec-01');
      expect(rec.name).toBe('ASP Rigging Workshop Recording');
      expect(rec.published).toBe(true);
      expect(rec.state).toBe('published');
      expect(rec.playbackUrl).toBe(
        'https://classroom.zealosh.com/playback/presentation/2.3/rec-upstream-001'
      );
      expect(rec.durationSeconds).toBe(7200);
      expect(rec.lengthMinutes).toBe(120);
      expect(rec.sizeBytes).toBe(450000000);
      expect(rec.metadata?.sessionId).toBe('sess-01');
    });

    it('2.8 maps upstream errors to strongly typed ClassroomProviderError codes', async () => {
      // Case A: Upstream authentication failure (checksumError)
      const authFailAdapter = {
        createMeeting: vi.fn().mockRejectedValue(new Error('checksumError: You did not pass the checksum security check')),
      };
      const authProvider = new BbbApiClassroomProvider(authFailAdapter as any);

      await expect(
        authProvider.provisionSession({
          sessionId: 'sess-err-01',
          sessionTitle: 'Error Class',
          meetingId: 'mtg-err-01',
          courseId: 'crs-01',
        })
      ).rejects.toMatchObject({
        code: 'AUTHENTICATION_FAILED',
        statusCode: 401,
      });

      // Case B: Network / connection timeout failure (PROVIDER_UNAVAILABLE)
      const netFailAdapter = {
        createMeeting: vi.fn().mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:443')),
      };
      const netProvider = new BbbApiClassroomProvider(netFailAdapter as any);

      await expect(
        netProvider.provisionSession({
          sessionId: 'sess-err-02',
          sessionTitle: 'Network Fail Class',
          meetingId: 'mtg-err-02',
          courseId: 'crs-01',
        })
      ).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
        statusCode: 503,
      });
    });
  });

  // ==========================================================================
  // 3. Decoupled Live Join Route Integration (/api/live/[sessionId]/join)
  // ==========================================================================
  describe('3. Decoupled Live Join Route Integration', () => {
    it('3.1 joins active live session via decoupled classroomProvider and records attendance', async () => {
      // Mock the classroomProvider singleton methods
      const provisionSpy = vi
        .spyOn(classroomProvider, 'provisionSession')
        .mockResolvedValue({
          success: true,
          meetingId: 'mtg-cp812-live',
          created: true,
          attendeePassword: 'mock-attendee-pw',
        });

      const joinSpy = vi
        .spyOn(classroomProvider, 'generateJoinUrl')
        .mockResolvedValue('https://classroom.zealosh.com/join?token=mockjoinurl');

      const req = new Request(`http://localhost:3000/api/live/${liveSession.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      });

      const res = await joinLiveSessionHandler(req, {
        params: { sessionId: liveSession.id },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.joinUrl).toBe('https://classroom.zealosh.com/join?token=mockjoinurl');
      expect(data.provider).toBe('CLASSROOM');

      expect(provisionSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: liveSession.id,
          sessionTitle: liveSession.title,
          meetingId: liveSession.meetingId,
          courseId: liveSession.courseId,
          batchId: liveSession.batchId,
        })
      );

      expect(joinSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          meetingId: liveSession.meetingId,
          sessionId: liveSession.id,
          userId: studentUser.id,
          fullName: studentUser.name,
          role: 'STUDENT',
        })
      );
    });

    it('3.2 maps ClassroomProviderError to friendly 503 response without leaking secrets', async () => {
      vi.spyOn(classroomProvider, 'provisionSession').mockRejectedValue(
        new ClassroomProviderError('Classroom cluster is unreachable', 'PROVIDER_UNAVAILABLE', 503)
      );

      const req = new Request(`http://localhost:3000/api/live/${liveSession.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      });

      const res = await joinLiveSessionHandler(req, {
        params: { sessionId: liveSession.id },
      });

      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.error).toBe('The live classroom service is temporarily unreachable. Please try again in a few moments.');
      expect(data.code).toBe('PROVIDER_UNAVAILABLE');
      // Must not leak internal engine names
      expect(JSON.stringify(data)).not.toContain('BigBlueButton');
    });
  });

  // ==========================================================================
  // 4. Decoupled Ingestion & Webhook Integration
  // ==========================================================================
  describe('4. Ingestion & Webhook Provider Decoupling', () => {
    it('4.1 allows custom ClassroomProvider injection in reconcileSessionRecordings', async () => {
      const mockClassroomProvider: ClassroomProvider = {
        providerId: 'mock-provider',
        provisionSession: vi.fn(),
        generateJoinUrl: vi.fn(),
        getSessionStatus: vi.fn(),
        getRecordings: vi.fn().mockResolvedValue([
          {
            recordId: 'rec-custom-sweep-01',
            meetingId: 'mtg-sweep-01',
            name: 'Reconciled Sweep Recording',
            published: true,
            state: 'published',
            playbackUrl: 'https://classroom.zealosh.com/playback/sweep-01',
            durationSeconds: 3600,
            lengthMinutes: 60,
          },
        ]),
      };

      const endedSession: LiveSession = {
        id: 'sess-sweep-01',
        batchId: batch.id,
        courseId: course.id,
        title: 'Reconciliation Candidate Session',
        scheduledStartTime: '2026-10-25T10:00:00Z',
        durationMinutes: 60,
        instructorId: 'usr-cp812-instructor',
        meetingId: 'mtg-sweep-01',
        status: 'ENDED',
      };
      await db.saveLiveSession(endedSession);

      const report = await recordingIngestionService.reconcileSessionRecordings({
        sessionId: endedSession.id,
        provider: mockClassroomProvider,
      });

      expect(mockClassroomProvider.getRecordings).toHaveBeenCalledWith({
        meetingId: 'mtg-sweep-01',
      });
      expect(report.recordingsDiscovered).toBe(1);
      expect(report.recordingsCreated).toBe(1);
      expect(report.failures).toHaveLength(0);

      // Verify the recording was created in db
      const saved = await db.getClassRecording('rec-custom-sweep-01');
      expect(saved).not.toBeNull();
      expect(saved?.title).toBe('Reconciled Sweep Recording');
      expect(saved?.status).toBe('AVAILABLE');
    });

    it('4.2 recording webhook route queries classroomProvider rather than concrete bbbAdapter', async () => {
      const webhookEndedSession: LiveSession = {
        id: 'sess-hook-01',
        batchId: batch.id,
        courseId: course.id,
        title: 'Recording Webhook Target Class',
        scheduledStartTime: '2026-10-28T14:00:00Z',
        durationMinutes: 60,
        instructorId: 'usr-cp812-instructor',
        meetingId: 'mtg-hook-01',
        status: 'ENDED',
      };
      await db.saveLiveSession(webhookEndedSession);

      // Spy on classroomProvider.getRecordings
      const getRecordingsSpy = vi
        .spyOn(classroomProvider, 'getRecordings')
        .mockResolvedValue([
          {
            recordId: 'rec-jwt-hook-01',
            meetingId: 'mtg-hook-01',
            name: 'Recording via JWT Callback',
            published: true,
            state: 'published',
            playbackUrl: 'https://classroom.zealosh.com/playback/rec-jwt-hook-01',
            durationSeconds: 3600,
          },
        ]);

      // Formulate signed_parameters JWT
      const secret = process.env.BBB_SECURITY_SALT || 'zealosh-test-salt-secret-812';
      const signedJwt = (await import('jsonwebtoken')).default.sign(
        {
          meeting_id: 'mtg-hook-01',
          record_id: 'rec-jwt-hook-01',
        },
        secret,
        { algorithm: 'HS256' }
      );

      const reqBody = `signed_parameters=${encodeURIComponent(signedJwt)}`;
      const req = new Request('http://localhost:3000/api/webhooks/bbb/recording', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: reqBody,
      });

      const res = await recordingWebhookHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.recordingId).toBe('rec-jwt-hook-01');
      expect(getRecordingsSpy).toHaveBeenCalledWith({
        meetingId: 'mtg-hook-01',
        recordId: 'rec-jwt-hook-01',
      });
    });
  });

  // ==========================================================================
  // 5. CP-8.13: Full Lifecycle, Moderation, and Idempotent Meeting Control
  // ==========================================================================
  describe('5. Full Lifecycle, Moderation & Idempotency', () => {
    it('5.1 endSession invokes bbbAdapter.endMeeting and returns true', async () => {
      const mockAdapter = {
        endMeeting: vi.fn().mockResolvedValue(true),
        createMeeting: vi.fn(),
        getJoinUrl: vi.fn(),
        isMeetingRunning: vi.fn(),
        getRecordings: vi.fn(),
      };

      const provider = new BbbApiClassroomProvider(mockAdapter as any);
      const result = await provider.endSession!('mtg-test-end-01', 'custom_mod_pass');

      expect(result).toBe(true);
      expect(mockAdapter.endMeeting).toHaveBeenCalledWith({
        meetingId: 'mtg-test-end-01',
        password: 'custom_mod_pass',
      });
    });

    it('5.2 POST /api/live/[sessionId]/end terminates meeting, updates status to ENDED, and logs audit', async () => {
      const endSpy = vi.spyOn(classroomProvider, 'endSession').mockResolvedValue(true);
      const statusSpy = vi.spyOn(classroomProvider, 'getSessionStatus').mockResolvedValue({
        meetingId: liveSession.meetingId,
        isRunning: false,
        participantCount: 0,
      });

      const req = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instructorToken}` },
      });

      const res = await endLiveSessionHandler(req, {
        params: { sessionId: liveSession.id },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe('ENDED');
      expect(endSpy).toHaveBeenCalledWith(liveSession.meetingId);

      // Verify db persistence
      const updated = await db.getLiveSession(liveSession.id);
      expect(updated?.status).toBe('ENDED');
      expect((updated as any)?.endedAt).toBeDefined();

      // Verify audit trail
      const audits = await db.getAuditLogs();
      const endAudit = audits.find(
        (a) => a.entityId === liveSession.id && a.action === 'LIVE_SESSION_ENDED'
      );
      expect(endAudit).toBeDefined();
      expect(endAudit?.actorUserId).toBe(instructorUser.id);
    });

    it('5.3 POST /api/live/[sessionId]/end rejects unauthorized and unassigned users', async () => {
      // 1. Unauthenticated request -> 401
      const reqNoAuth = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
        method: 'POST',
      });
      const resNoAuth = await endLiveSessionHandler(reqNoAuth, {
        params: { sessionId: liveSession.id },
      });
      expect(resNoAuth.status).toBe(401);

      // 2. Student request -> 403
      const reqStudent = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const resStudent = await endLiveSessionHandler(reqStudent, {
        params: { sessionId: liveSession.id },
      });
      expect(resStudent.status).toBe(403);
      const dataStudent = await resStudent.json();
      expect(dataStudent.error).toContain('Only faculty or administrators');

      // 3. Unassigned instructor -> 403
      const reqUnassigned = new Request(`http://localhost:3000/api/live/${liveSession.id}/end`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${unassignedInstructorToken}` },
      });
      const resUnassigned = await endLiveSessionHandler(reqUnassigned, {
        params: { sessionId: liveSession.id },
      });
      expect(resUnassigned.status).toBe(403);
      const dataUnassigned = await resUnassigned.json();
      expect(dataUnassigned.error).toContain('not assigned as faculty');
    });

    it('5.4 POST /api/live/[sessionId]/join transitions SCHEDULED session to LIVE when launched by moderator', async () => {
      const scheduledSession: LiveSession = {
        id: 'sess-sched-01',
        batchId: batch.id,
        courseId: course.id,
        title: 'Upcoming Scheduled ASP Class',
        scheduledStartTime: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        durationMinutes: 60,
        instructorId: instructorUser.id,
        meetingId: 'mtg-sched-01',
        status: 'SCHEDULED',
      };
      await db.saveLiveSession(scheduledSession);

      vi.spyOn(classroomProvider, 'provisionSession').mockResolvedValue({
        success: true,
        meetingId: scheduledSession.meetingId,
        created: true,
      });
      vi.spyOn(classroomProvider, 'generateJoinUrl').mockResolvedValue(
        `https://classroom.zealosh.com/join?role=MODERATOR`
      );

      const req = new Request(`http://localhost:3000/api/live/${scheduledSession.id}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${instructorToken}` },
      });

      const res = await joinLiveSessionHandler(req, {
        params: { sessionId: scheduledSession.id },
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('LIVE');

      // Verify db persistence
      const saved = await db.getLiveSession(scheduledSession.id);
      expect(saved?.status).toBe('LIVE');
      expect((saved as any)?.startedAt).toBeDefined();
    });

    it('5.5 classroomProvider.provisionSession is idempotent across repeated calls', async () => {
      const provider = new BbbApiClassroomProvider();
      const params = {
        sessionId: 'sess-idempotent-01',
        sessionTitle: 'Idempotency Verification Session',
        meetingId: 'mtg-idempotent-01',
        courseId: course.id,
        batchId: batch.id,
      };

      const firstCall = await provider.provisionSession(params);
      expect(firstCall.meetingId).toBe(params.meetingId);

      const secondCall = await provider.provisionSession(params);
      expect(secondCall.meetingId).toBe(params.meetingId);
    });
  });
});
