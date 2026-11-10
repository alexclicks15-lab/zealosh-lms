// Zealosh LMS — Website Studio WS-01: API Endpoints Integration Test Suite
// Verifies /api/cms/studio/overview, /api/cms/studio/page-types, and /api/cms/templates filtering

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getStudioOverview } from '@/app/api/cms/studio/overview/route';
import { GET as getStudioPageTypes } from '@/app/api/cms/studio/page-types/route';
import { GET as getTemplates, POST as createTemplate } from '@/app/api/cms/templates/route';

describe('Zealosh Website Studio — API Endpoint Integration Suite', () => {
  const adminToken = signToken({
    userId: 'usr-admin-ws',
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Website Studio Admin',
  });

  const studentToken = signToken({
    userId: 'usr-student-ws',
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Student User',
  });

  beforeEach(() => {
    db.ensureCmsSeedDefaults();
  });

  it('1. should protect /api/cms/studio/overview against unauthenticated and unauthorized callers', async () => {
    // Unauthenticated
    const unauthReq = new Request('http://localhost:3000/api/cms/studio/overview');
    const unauthRes = await getStudioOverview(unauthReq);
    expect(unauthRes.status).toBe(401);

    // Student (Forbidden)
    const studentReq = new Request('http://localhost:3000/api/cms/studio/overview', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentRes = await getStudioOverview(studentReq);
    expect(studentRes.status).toBe(403);
  });

  it('2. should return authoritative metrics from /api/cms/studio/overview for administrators', async () => {
    const adminReq = new Request('http://localhost:3000/api/cms/studio/overview', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const res = await getStudioOverview(adminReq);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.metrics).toBeDefined();
    expect(data.metrics.systemTemplatesCount).toBeGreaterThanOrEqual(17);
    expect(data.metrics.totalPages).toBeGreaterThanOrEqual(1);
    expect(data.distribution.byCategory).toBeDefined();
    expect(data.distribution.byPageType).toBeDefined();
    expect(data.pageTypes).toBeDefined();
    expect(Array.isArray(data.pageTypes)).toBe(true);
  });

  it('3. should return canonical page type metadata from /api/cms/studio/page-types', async () => {
    const req = new Request('http://localhost:3000/api/cms/studio/page-types');
    const res = await getStudioPageTypes(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.canonicalPageTypes).toHaveLength(17);
    expect(data.allPageTypes.length).toBeGreaterThanOrEqual(17);
    expect(data.categories).toContain('MARKETING');
    expect(data.categories).toContain('INFORMATIONAL');
    expect(data.categories).toContain('ACADEMIC');
    expect(data.categories).toContain('COMMUNITY');
    expect(data.categories).toContain('LEGAL');
  });

  it('4. should retrieve system templates filtered by pageType and category from /api/cms/templates', async () => {
    // Filter by pageType=HOMEPAGE
    const homeReq = new Request('http://localhost:3000/api/cms/templates?pageType=HOMEPAGE');
    const homeRes = await getTemplates(homeReq);
    expect(homeRes.status).toBe(200);
    const homeData = await homeRes.json();
    expect(homeData.templates.length).toBeGreaterThanOrEqual(1);
    expect(homeData.templates.every((t: any) => t.pageType === 'HOMEPAGE')).toBe(true);

    // Filter by system=true
    const sysReq = new Request('http://localhost:3000/api/cms/templates?system=true');
    const sysRes = await getTemplates(sysReq);
    expect(sysRes.status).toBe(200);
    const sysData = await sysRes.json();
    expect(sysData.templates.length).toBeGreaterThanOrEqual(17);
    expect(sysData.templates.every((t: any) => t.isSystem === true)).toBe(true);
  });

  it('5. should reject unauthorized custom template creation and allow admin creation', async () => {
    // Student rejection
    const studentReq = new Request('http://localhost:3000/api/cms/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        name: 'Custom Marketing Layout',
        pageType: 'CAMPAIGN',
        nodesSnapshot: [],
      }),
    });
    const studentRes = await createTemplate(studentReq);
    expect(studentRes.status).toBe(403);

    // Admin creation
    const adminReq = new Request('http://localhost:3000/api/cms/templates', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Custom HSE Special Cohort Template',
        description: 'Bespoke layout for cohort announcements',
        category: 'CUSTOM',
        pageType: 'COURSE_DETAILS',
        nodesSnapshot: [
          {
            id: 'node-sec-custom-01',
            nodeType: 'SECTION',
            componentType: 'section',
            parentId: null,
            position: 0,
            props: {},
            styles: {},
            pageVersionId: 'seed',
            enabled: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    });
    const adminRes = await createTemplate(adminReq);
    expect(adminRes.status).toBe(201);
    const adminData = await adminRes.json();
    expect(adminData.success).toBe(true);
    expect(adminData.template.name).toBe('Custom HSE Special Cohort Template');
    expect(adminData.template.isSystem).toBe(false);
    expect(adminData.template.pageType).toBe('COURSE_DETAILS');
  });
});
