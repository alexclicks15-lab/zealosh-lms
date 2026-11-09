import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { supabaseAdapter, SupabaseAdapter } from '@/lib/store/supabase-adapter';
import { db, ZealoshDatabase } from '@/lib/store/db';
import { Course } from '@/types';

describe('Zealosh LMS — Authoritative Database Durability & Cross-Process Persistence Suite', () => {
  const protectedStorePath = path.join(process.cwd(), 'data', 'zealosh-store.json');
  const EXPECTED_HASH = 'F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10';
  const EXPECTED_LENGTH = 45005;

  const testCourseId = `crs-durability-${Date.now()}`;
  const testCourse: Course = {
    id: testCourseId,
    title: 'HSE Process Safety & Risk Mitigation — Durability Test',
    slug: `hse-process-safety-durability-${Date.now()}`,
    certificationType: 'ASP',
    deliveryModel: 'HYBRID',
    status: 'PUBLISHED',
    headline: 'High-reliability industrial safety engineering',
    description: 'Verifies PostgreSQL database persistence across separate process invocations.',
    learningObjectives: ['Verify persistence', 'Verify ACID commit', 'Verify zero local file fallback'],
    prerequisites: ['Basic safety engineering'],
    priceInr: 29999,
    priceUsd: 399,
    durationWeeks: 8,
    coverImage: '/courses/asp-durability.jpg',
    leadInstructorId: 'usr-inst-01',
    coInstructorIds: [],
    modulesCount: 6,
    totalLessons: 24,
    totalHours: 48,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  function verifyProtectedFileIntegrity(): boolean {
    if (!fs.existsSync(protectedStorePath)) return false;
    const content = fs.readFileSync(protectedStorePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex').toUpperCase();
    return hash === EXPECTED_HASH && content.length === EXPECTED_LENGTH;
  }

  let isSupabaseOnline = false;

  beforeAll(async () => {
    expect(verifyProtectedFileIntegrity()).toBe(true);
    try {
      const ping = await supabaseAdapter.getClient().from('courses').select('id').limit(1);
      if (!ping.error) {
        isSupabaseOnline = true;
      }
    } catch {
      isSupabaseOnline = false;
    }
    if (isSupabaseOnline) {
      try {
        await supabaseAdapter.deleteCourse(testCourseId);
      } catch {
        // Non-blocking pre-clean
      }
    }
  });

  afterAll(async () => {
    if (isSupabaseOnline) {
      try {
        await supabaseAdapter.deleteCourse(testCourseId);
      } catch {
        // Non-blocking cleanup
      }
    }
    expect(verifyProtectedFileIntegrity()).toBe(true);
  });

  it('1. should commit a new course record directly to Supabase PostgreSQL', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const saved = await supabaseAdapter.saveCourse(testCourse);
    expect(saved).toBeDefined();
    expect(saved.id).toBe(testCourse.id);
    expect(saved.title).toBe(testCourse.title);
    expect(saved.slug).toBe(testCourse.slug);
    expect(saved.priceInr).toBe(29999);
  });

  it('2. should verify durability across a completely fresh, un-cached SupabaseAdapter instance', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    // Simulate process termination and cold start by creating a brand-new adapter
    const freshAdapter = new SupabaseAdapter();
    const fetched = await freshAdapter.getCourseById(testCourseId);

    expect(fetched).not.toBeNull();
    expect(fetched?.id).toBe(testCourse.id);
    expect(fetched?.title).toBe(testCourse.title);
    expect(fetched?.slug).toBe(testCourse.slug);
    expect(fetched?.priceInr).toBe(29999);
    expect(fetched?.modulesCount).toBe(6);
  });

  it('3. should persist record mutations in PostgreSQL and survive another fresh instance', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const freshAdapter1 = new SupabaseAdapter();
    const updatedPayload: Course = {
      ...testCourse,
      title: 'HSE Process Safety & Risk Mitigation — Updated Title',
      priceInr: 34999,
      updatedAt: new Date().toISOString(),
    };
    await freshAdapter1.saveCourse(updatedPayload);

    // Read back through a third distinct adapter instance
    const freshAdapter2 = new SupabaseAdapter();
    const reFetched = await freshAdapter2.getCourseById(testCourseId);

    expect(reFetched).not.toBeNull();
    expect(reFetched?.title).toBe('HSE Process Safety & Risk Mitigation — Updated Title');
    expect(reFetched?.priceInr).toBe(34999);
  });

  it('4. should delete the record from PostgreSQL and confirm non-existence across fresh instances', async () => {
    if (!isSupabaseOnline) {
      console.warn('Skipping remote Supabase test (Profile D cloud-gated): network offline');
      return;
    }
    const freshAdapter1 = new SupabaseAdapter();
    await freshAdapter1.deleteCourse(testCourseId);

    // Verify deletion directly in fresh instance
    const freshAdapter2 = new SupabaseAdapter();
    const deleted = await freshAdapter2.getCourseById(testCourseId);
    expect(deleted).toBeNull();
  });

  it('5. should confirm data/zealosh-store.json remained 100% untouched throughout all operations', () => {
    expect(verifyProtectedFileIntegrity()).toBe(true);
  });
});
