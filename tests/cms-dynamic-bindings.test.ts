// Zealosh LMS — CMS Dynamic Academic Data Binding Tests
// Standards: Authoritative PostgreSQL data projections without duplication

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { resolveCourseData, resolveCourseList } from '@/lib/cms/dynamic-bindings';

describe('Zealosh CMS — Dynamic Academic Bindings Suite', () => {
  beforeEach(() => {
    db.resetToSeed();
    db.ensureCmsSeedDefaults();
  });

  it('1. should resolve live authoritative course details by course slug', async () => {
    const courseData = await resolveCourseData('asp-examination-prep');
    expect(courseData).toBeDefined();
    expect(courseData?.title).toContain('ASP');
    expect(courseData?.certificationType).toBe('ASP');
    expect(courseData?.priceInr).toBeGreaterThan(0);
    expect(courseData?.durationWeeks).toBeGreaterThan(0);
  });

  it('2. should bind upcoming active batches and calculate remaining seats accurately', async () => {
    const courseData = await resolveCourseData('asp-examination-prep');
    expect(courseData).toBeDefined();
    expect(Array.isArray(courseData?.batches)).toBe(true);

    if (courseData && courseData.batches.length > 0) {
      const batch = courseData.batches[0];
      expect(batch.name).toBeDefined();
      expect(batch.capacity).toBeGreaterThan(0);
      expect(batch.seatsRemaining).toBe(Math.max(0, batch.capacity - batch.enrolledCount));
    }
  });

  it('3. should resolve the lead instructor profile name and credentials', async () => {
    const courseData = await resolveCourseData('asp-examination-prep');
    expect(courseData).toBeDefined();
    expect(courseData?.leadInstructorName).toBeDefined();
    expect(courseData?.leadInstructorCredentials).toContain('CSP');
  });

  it('4. should gracefully return null for non-existent courses without throwing unhandled exceptions', async () => {
    const result = await resolveCourseData('non-existent-course-slug-12345');
    expect(result).toBeNull();
  });

  it('5. should resolve the accredited course list for catalog presentation', async () => {
    const list = await resolveCourseList(4);
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].title).toBeDefined();
    expect(list[0].slug).toBeDefined();
  });
});

