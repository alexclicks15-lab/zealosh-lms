import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { ZealoshDatabase, DatabaseOperationalError } from '@/lib/store/db';
import { supabaseAdapter, SupabaseAdapter } from '@/lib/store/supabase-adapter';
import { ClassRecording, Course } from '@/types';

describe('Zealosh LMS — Database Outage & Zero Local Fallback Verification Suite', () => {
  const protectedStorePath = path.join(process.cwd(), 'data', 'zealosh-store.json');
  const EXPECTED_HASH = 'F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10';
  const EXPECTED_LENGTH = 45005;

  function verifyProtectedFileIntegrity(): boolean {
    if (!fs.existsSync(protectedStorePath)) return false;
    const content = fs.readFileSync(protectedStorePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
    return hash === EXPECTED_HASH && content.length === EXPECTED_LENGTH;
  }

  beforeAll(() => {
    expect(verifyProtectedFileIntegrity()).toBe(true);
  });

  afterAll(() => {
    expect(verifyProtectedFileIntegrity()).toBe(true);
    vi.restoreAllMocks();
  });

  it('1. should fail safely with DatabaseOperationalError when fetching recordings during an outage', async () => {
    const db = new ZealoshDatabase();
    vi.spyOn(db, 'getStorageMode').mockReturnValue('supabase');
    vi.spyOn(supabaseAdapter, 'getClassRecordings').mockRejectedValue(
      new Error('ECONNREFUSED: Database connection unreachable')
    );

    await expect(db.getClassRecordings()).rejects.toThrow(DatabaseOperationalError);
    await expect(db.getClassRecordings()).rejects.toThrow(/Database error fetching class recordings/);

    // Verify it did not fall back to populating or reading from disk
    expect(verifyProtectedFileIntegrity()).toBe(true);
  });

  it('2. should fail safely and not persist to disk or memory when saving recording fails during an outage', async () => {
    const db = new ZealoshDatabase();
    vi.spyOn(db, 'getStorageMode').mockReturnValue('supabase');
    vi.spyOn(supabaseAdapter, 'saveClassRecording').mockRejectedValue(
      new Error('ETIMEDOUT: Connection pool exhausted')
    );

    const recordingPayload: ClassRecording = {
      id: 'rec-outage-test-999',
      sessionId: 'ses-outage-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-weekday',
      title: 'Outage Scenario Recording',
      description: 'Testing zero in-memory fallback',
      storageProvider: 'BIGBLUEBUTTON',
      storagePath: 'recordings/test/video.mp4',
      mediaUrl: 'https://media.zealosh.com/test.mp4',
      durationSeconds: 3600,
      fileSizeBytes: 500000000,
      status: 'AVAILABLE',
      isDownloadable: false,
      allowDownload: false,
      availableFrom: '2026-11-01T00:00:00Z',
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    };

    await expect(db.saveClassRecording(recordingPayload)).rejects.toThrow(DatabaseOperationalError);

    // Verify the uncommitted recording was NOT retained in in-memory map
    expect(db.classRecordings.has('rec-outage-test-999')).toBe(false);

    // Verify data/zealosh-store.json is completely untouched
    expect(verifyProtectedFileIntegrity()).toBe(true);
  });

  it('3. should throw DatabaseOperationalError when certificate verification experiences a database outage', async () => {
    const db = new ZealoshDatabase();
    vi.spyOn(db, 'getStorageMode').mockReturnValue('supabase');
    vi.spyOn(supabaseAdapter, 'verifyCertificate').mockRejectedValue(
      new Error('Supabase 503: Service Unavailable')
    );

    await expect(db.verifyCertificate('ZEI/EXAM/2026/999999')).rejects.toThrow(DatabaseOperationalError);
    await expect(db.verifyCertificate('ZEI/EXAM/2026/999999')).rejects.toThrow(/Database error verifying certificate/);

    expect(verifyProtectedFileIntegrity()).toBe(true);
  });

  it('4. should throw DatabaseOperationalError when saving blueprint fails during an outage', async () => {
    const db = new ZealoshDatabase();
    vi.spyOn(db, 'getStorageMode').mockReturnValue('supabase');
    vi.spyOn(supabaseAdapter, 'saveExamBlueprint').mockRejectedValue(
      new Error('PostgreSQL deadlock / timeout error')
    );

    await expect(
      db.createExamBlueprint({
        id: 'bp-outage-test',
        certificationType: 'ASP',
        title: 'Outage Test Blueprint',
      })
    ).rejects.toThrow(DatabaseOperationalError);

    // Verify the uncommitted blueprint was NOT retained in in-memory map
    expect(db.examBlueprints.has('bp-outage-test')).toBe(false);

    expect(verifyProtectedFileIntegrity()).toBe(true);
  });

  it('5. should reject write operations with typed error when an adapter is pointed to an unreachable host', async () => {
    const badAdapter = new SupabaseAdapter();
    vi.spyOn(badAdapter, 'getClient').mockReturnValue({
      from: () => ({
        select: () => ({
          order: () => Promise.resolve({ data: null, error: { message: 'getaddrinfo ENOTFOUND invalid-zealosh-db' } }),
          or: () => ({
            limit: () => ({
              single: () => Promise.resolve({ data: null, error: { message: 'getaddrinfo ENOTFOUND invalid-zealosh-db' } }),
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'getaddrinfo ENOTFOUND invalid-zealosh-db' } }),
          }),
        }),
      }),
    } as any);

    await expect(badAdapter.getCourses()).rejects.toThrow(/getaddrinfo ENOTFOUND/);
    await expect(
      badAdapter.addCourse({
        id: 'crs-fail-01',
        title: 'Fail Course',
        slug: 'fail-course',
        certificationType: 'ASP',
        deliveryModel: 'HYBRID',
        status: 'PUBLISHED',
        priceInr: 1000,
        priceUsd: 20,
        durationWeeks: 4,
        leadInstructorId: 'usr-inst-01',
        modulesCount: 1,
        totalLessons: 4,
        totalHours: 8,
      } as any)
    ).rejects.toThrow(/getaddrinfo ENOTFOUND/);
    await expect(badAdapter.getCourseById('crs-asp-01')).resolves.toBeNull();

    // Verify zero local disk mutation
    expect(verifyProtectedFileIntegrity()).toBe(true);
  });
});
