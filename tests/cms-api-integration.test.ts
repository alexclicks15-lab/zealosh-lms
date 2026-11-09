// Zealosh LMS — CMS API Integration & Endpoint Security Tests
// Tests HTTP route handlers directly with role verification and error responses

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import { GET as getPages, POST as createPage } from '@/app/api/cms/pages/route';
import { GET as getPage, PUT as updatePage, DELETE as deletePage } from '@/app/api/cms/pages/[id]/route';
import { GET as getVersions, POST as createVersion } from '@/app/api/cms/pages/[id]/versions/route';
import { GET as getVersionNodes, PUT as saveDraftNodes } from '@/app/api/cms/pages/[id]/versions/[versionId]/route';
import { POST as publishPage } from '@/app/api/cms/pages/[id]/publish/route';
import { POST as workflowTransition } from '@/app/api/cms/pages/[id]/workflow/route';
import { POST as rollbackVersion } from '@/app/api/cms/pages/[id]/rollback/route';
import { GET as validateSlug } from '@/app/api/cms/validate-slug/route';

describe('Zealosh CMS — API Endpoint Integration Suite', () => {
  const adminToken = signToken({
    userId: 'usr-admin-01',
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
  });

  const studentToken = signToken({
    userId: 'usr-std-01',
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Student User',
  });

  beforeEach(() => {
    db.ensureCmsSeedDefaults();
  });

  it('1. should allow anonymous users to list published pages, but reject unauthenticated requests for all drafts', async () => {
    // Anonymous published pages request -> should succeed
    const pubReq = new Request('http://localhost:3000/api/cms/pages?published=true');
    const pubRes = await getPages(pubReq);
    expect(pubRes.status).toBe(200);
    const pubData = await pubRes.json();
    expect(pubData.success).toBe(true);
    expect(Array.isArray(pubData.pages)).toBe(true);

    // Anonymous all pages request -> should be rejected with 401
    const unauthReq = new Request('http://localhost:3000/api/cms/pages');
    const unauthRes = await getPages(unauthReq);
    expect(unauthRes.status).toBe(401);
  });

  it('2. should reject page creation attempts by non-administrative users (403 Forbidden)', async () => {
    const req = new Request('http://localhost:3000/api/cms/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        title: 'Unauthorized Student Page',
        slug: 'student-page',
      }),
    });

    const res = await createPage(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Insufficient privileges');
  });

  it('3. should allow authorized administrators to create, update, and manage pages via API', async () => {
    const slug = `api-test-cert-${Date.now()}`;
    const req = new Request('http://localhost:3000/api/cms/pages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Safety Leadership & Risk Management',
        slug,
        pageType: 'STANDARD',
      }),
    });

    const res = await createPage(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.page.slug).toBe(slug);
    expect(data.version.versionNumber).toBe(1);

    const pageId = data.page.id;

    // Update metadata
    const updateReq = new Request(`http://localhost:3000/api/cms/pages/${pageId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: 'Safety Leadership & Risk Management (Updated)',
      }),
    });
    const updateRes = await updatePage(updateReq, { params: { id: pageId } });
    expect(updateRes.status).toBe(200);
    const updateData = await updateRes.json();
    expect(updateData.page.title).toContain('(Updated)');
  });

  it('4. should save draft nodes via autosave endpoint and persist tree changes', async () => {
    const page = await db.getCmsPageBySlug('home');
    expect(page).toBeDefined();

    // Create a new draft version for editing
    const verReq = new Request(
      `http://localhost:3000/api/cms/pages/${page!.id}/versions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          sourceVersionId: page!.publishedVersionId,
          changeSummary: 'New draft version for autosave test',
        }),
      }
    );
    const verRes = await createVersion(verReq, { params: { id: page!.id } });
    expect(verRes.status).toBe(201);
    const verData = await verRes.json();
    const versionId = verData.version.id;

    const nodes = await db.getCmsPageNodes(versionId);
    expect(nodes.length).toBeGreaterThan(0);

    const saveReq = new Request(
      `http://localhost:3000/api/cms/pages/${page!.id}/versions/${versionId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ nodes }),
      }
    );

    const saveRes = await saveDraftNodes(saveReq, {
      params: { id: page!.id, versionId },
    });
    const saveData = await saveRes.json();
    if (saveRes.status !== 200) {
      console.log('SaveDraftNodes Error:', saveData);
    }
    expect(saveRes.status).toBe(200);
    expect(saveData.success).toBe(true);
    expect(saveData.savedAt).toBeDefined();
  });

  it('5. should validate slug availability and reject reserved routes via /api/cms/validate-slug', async () => {
    // Reserved slug
    const resReserved = await validateSlug(
      new Request('http://localhost:3000/api/cms/validate-slug?slug=admin')
    );
    const dataReserved = await resReserved.json();
    expect(dataReserved.valid).toBe(false);
    expect(dataReserved.reason).toContain('reserved');

    // Available slug
    const resAvail = await validateSlug(
      new Request(`http://localhost:3000/api/cms/validate-slug?slug=avail-${Date.now()}`)
    );
    const dataAvail = await resAvail.json();
    expect(dataAvail.valid).toBe(true);
  });

  it('6. should reject publishing attempts by non-privileged instructor accounts (403 Forbidden)', async () => {
    const instructorToken = signToken({
      userId: 'usr-inst-01',
      email: 'instructor@zealosh.com',
      role: 'INSTRUCTOR',
      name: 'Instructor User',
    });

    const page = await db.getCmsPageBySlug('home');
    const req = new Request(`http://localhost:3000/api/cms/pages/${page!.id}/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${instructorToken}`,
      },
      body: JSON.stringify({ versionId: page!.publishedVersionId }),
    });

    const res = await publishPage(req, { params: { id: page!.id } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Insufficient publishing privileges');
  });

  it('7. should return HTTP 409 Conflict when saving draft with a stale expectedUpdatedAt timestamp', async () => {
    const page = await db.getCmsPageBySlug('home');
    const versionId = page!.currentDraftVersionId || page!.publishedVersionId!;
    const nodes = await db.getCmsPageNodes(versionId);

    const staleReq = new Request(
      `http://localhost:3000/api/cms/pages/${page!.id}/versions/${versionId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          nodes,
          expectedUpdatedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        }),
      }
    );

    const res = await saveDraftNodes(staleReq, { params: { id: page!.id, versionId } });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('Conflict:');
  });

  it('8. should execute approval workflow transitions via /api/cms/pages/[id]/workflow', async () => {
    const page = await db.getCmsPageBySlug('home');
    const versionId = page!.currentDraftVersionId || page!.publishedVersionId!;

    // Submit for review
    const submitReq = new Request(`http://localhost:3000/api/cms/pages/${page!.id}/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'submit',
        versionId,
        changeSummary: 'API workflow submit test',
      }),
    });
    const submitRes = await workflowTransition(submitReq, { params: { id: page!.id } });
    expect(submitRes.status).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.version.status).toBe('PENDING_REVIEW');

    // Reject without reason must fail (400)
    const rejectNoReasonReq = new Request(`http://localhost:3000/api/cms/pages/${page!.id}/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'reject',
        versionId,
      }),
    });
    const rejectNoReasonRes = await workflowTransition(rejectNoReasonReq, { params: { id: page!.id } });
    expect(rejectNoReasonRes.status).toBe(400);

    // Reject with reason
    const rejectReq = new Request(`http://localhost:3000/api/cms/pages/${page!.id}/workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        action: 'reject',
        versionId,
        rejectionReason: 'Missing requisite section layout',
      }),
    });
    const rejectRes = await workflowTransition(rejectReq, { params: { id: page!.id } });
    expect(rejectRes.status).toBe(200);
    const rejectData = await rejectRes.json();
    expect(rejectData.version.status).toBe('REJECTED');
  });

  it('9. should map DATABASE_UNAVAILABLE errors to HTTP 503 with retryable=true', async () => {
    db.setStorageModeOverride('supabase');
    const { supabaseAdapter } = await import('@/lib/store/supabase-adapter');
    const spy = vi.spyOn(supabaseAdapter, 'getCmsPages').mockRejectedValue(
      new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:5432')
    );

    const req = new Request('http://localhost:3000/api/cms/pages?published=true');
    const res = await getPages(req);
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.category).toBe('DATABASE_UNAVAILABLE');
    expect(data.retryable).toBe(true);

    spy.mockRestore();
    db.setStorageModeOverride(undefined);
  });

  it('10. should map optimistic concurrency conflicts to HTTP 409 Conflict', async () => {
    const page = await db.getCmsPageBySlug('home');
    const req = new Request(`http://localhost:3000/api/cms/pages/${page!.id}/versions/${page!.currentDraftVersionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        nodes: [],
        expectedUpdatedAt: '1970-01-01T00:00:00.000Z', // Stale timestamp to trigger conflict
      }),
    });

    const res = await saveDraftNodes(req, {
      params: { id: page!.id, versionId: page!.currentDraftVersionId! },
    });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain('Conflict:');
  });
});
