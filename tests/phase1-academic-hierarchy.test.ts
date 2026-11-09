import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { GET as getTreeHandler } from '@/app/api/admin/academic/tree/route';
import { POST as createYearHandler } from '@/app/api/admin/academic/years/route';
import { POST as createDeptHandler } from '@/app/api/admin/academic/departments/route';
import { POST as createProgHandler } from '@/app/api/admin/academic/programmes/route';
import { POST as createModuleHandler } from '@/app/api/admin/academic/modules/route';
import { POST as createTopicHandler } from '@/app/api/admin/academic/topics/route';
import { POST as migrateModulesHandler } from '@/app/api/admin/academic/migrate-modules/route';

describe('Zealosh LMS — Phase 1 Workstream 2: Academic Hierarchy', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  it('1. should validate academic year date ranges and ensure only one isCurrent', async () => {
    // Valid creation
    const req1 = new Request('http://localhost:3000/api/admin/academic/years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Academic Year 2027-2028',
        code: 'AY27-28',
        startDate: '2027-04-01T00:00:00Z',
        endDate: '2028-03-31T23:59:59Z',
        isCurrent: true,
      }),
    });
    const res1 = await createYearHandler(req1);
    expect(res1.status).toBe(201);
    const body1 = await res1.json();
    expect(body1.academicYear.isCurrent).toBe(true);

    // Prior academic year should now have isCurrent = false
    const priorYear = await db.getAcademicYearById('ay-2026-2027');
    expect(priorYear?.isCurrent).toBe(false);

    // Invalid date range (start after end)
    const reqInvalid = new Request('http://localhost:3000/api/admin/academic/years', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Year',
        startDate: '2028-04-01T00:00:00Z',
        endDate: '2027-03-31T23:59:59Z',
      }),
    });
    const resInvalid = await createYearHandler(reqInvalid);
    expect(resInvalid.status).toBe(400);
  });

  it('2. should create department and enforce uppercase code', async () => {
    const req = new Request('http://localhost:3000/api/admin/academic/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Department of Process Safety',
        code: 'dps',
        description: 'Focus on chemical and offshore process risk prevention',
      }),
    });
    const res = await createDeptHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.department.code).toBe('DPS');
  });

  it('3. should create programme and reject non-existent departmentId', async () => {
    // Failure on unknown department
    const reqBad = new Request('http://localhost:3000/api/admin/academic/programmes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentId: 'dept-unknown-99',
        name: 'Unknown Diploma',
        code: 'UNK',
      }),
    });
    const resBad = await createProgHandler(reqBad);
    expect(resBad.status).toBe(404);

    // Success on valid department
    const reqGood = new Request('http://localhost:3000/api/admin/academic/programmes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        departmentId: 'dept-hse',
        name: 'Certified Safety Executive Diploma',
        code: 'CSE-DIP',
        durationMonths: 6,
      }),
    });
    const resGood = await createProgHandler(reqGood);
    expect(resGood.status).toBe(201);
  });

  it('4. should create module and topic linked hierarchically', async () => {
    // Module
    const reqMod = new Request('http://localhost:3000/api/admin/academic/modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: 'crs-asp-01',
        title: 'Emergency Management & Fire Protection Systems',
        code: 'MOD-ASP-03',
        orderIndex: 3,
      }),
    });
    const resMod = await createModuleHandler(reqMod);
    expect(resMod.status).toBe(201);
    const bodyMod = await resMod.json();
    const moduleId = bodyMod.module.id;

    // Topic
    const reqTopic = new Request('http://localhost:3000/api/admin/academic/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        moduleId,
        title: 'NFPA 101 Life Safety Code Compliance',
        orderIndex: 1,
        learningObjectives: ['Determine egress capacity', 'Calculate occupant load factors'],
      }),
    });
    const resTopic = await createTopicHandler(reqTopic);
    expect(resTopic.status).toBe(201);
  });

  it('5. should assemble complete academic hierarchy tree via /api/admin/academic/tree', async () => {
    const res = await getTreeHandler();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.tree)).toBe(true);
    expect(body.tree.length).toBeGreaterThanOrEqual(1);

    const hseDept = body.tree.find((d: any) => d.id === 'dept-hse');
    expect(hseDept).toBeDefined();
    expect(hseDept.programmes.length).toBeGreaterThanOrEqual(1);
  });

  it('6. should migrate legacy lesson moduleTitle to relational modules without data loss', async () => {
    // Verify initial state: lessons have moduleTitle but no moduleId
    const lessons = db.lessons.get('crs-asp-01') || [];
    expect(lessons.length).toBeGreaterThanOrEqual(2);
    expect(lessons[0].moduleTitle).toBeDefined();

    // Trigger migration
    const req = new Request('http://localhost:3000/api/admin/academic/migrate-modules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: 'crs-asp-01' }),
    });
    const res = await migrateModulesHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.migratedCount).toBeGreaterThanOrEqual(1);

    // Verify all lessons now carry a valid moduleId
    const updatedLessons = db.lessons.get('crs-asp-01') || [];
    for (const lsn of updatedLessons) {
      expect(lsn.moduleId).toBeDefined();
      expect(typeof lsn.moduleId).toBe('string');
      // Ensure the referenced module exists in db.modules
      const mod = db.modules.get(lsn.moduleId!);
      expect(mod).toBeDefined();
      expect(mod?.title).toBe(lsn.moduleTitle);
    }
  });
});

