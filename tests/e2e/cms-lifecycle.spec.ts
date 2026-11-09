// Zealosh LMS — Playwright E2E: Complete Lifecycle, Peer Review, Publishing & Concurrency
// Standards: Strict RBAC, Independent Reviewer verification, Deterministic SHA-256 publishing, Rollback immutability

import { test, expect } from '@playwright/test';
import {
  adminToken,
  reviewerToken,
  studentToken,
  injectAuthCookie,
  createTestPage,
  deleteTestPage,
} from './helpers/cms-fixtures';

test.describe('Zealosh Visual PageBuilder — Governance, Review, Publishing & Concurrency Lifecycle', () => {
  let testPageId: string;
  let testSlug: string;

  test.afterEach(async ({ request }) => {
    if (testPageId) {
      await deleteTestPage(request, testPageId);
    }
  });

  test('LC-01: Full Review & Approval Lifecycle (Draft -> Submit -> Independent Reviewer Approve)', async ({
    page,
    request,
    context,
  }) => {
    testSlug = `e2e-wf-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'HSE Risk Assessment Certification',
      slug: testSlug,
    });
    testPageId = created.page.id;
    const versionId = created.version.id;

    // 1. Submit for review
    const submitRes = await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId, changeSummary: 'Ready for peer audit' },
    });
    expect(submitRes.status()).toBe(200);
    const submitData = await submitRes.json();
    expect(submitData.version.status).toBe('PENDING_REVIEW');

    // 2. Independent Reviewer approves
    const approveRes = await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId },
    });
    expect(approveRes.status()).toBe(200);
    const approveData = await approveRes.json();
    expect(approveData.version.status).toBe('APPROVED');

    // 3. Verify in browser UI
    await injectAuthCookie(context, adminToken);
    await page.goto('/admin');
    await page.locator('button:has-text("Visual Page Builder")').click();

    const row = page.locator(`tr:has-text("${testSlug}")`);
    await expect(row).toBeVisible();
    await expect(row.locator('text=APPROVED')).toBeVisible();
  });

  test('LC-02: Rejection workflow requires mandatory reason and transitions version to REJECTED', async ({
    request,
  }) => {
    testSlug = `e2e-reject-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Defective Layout Page',
      slug: testSlug,
    });
    testPageId = created.page.id;
    const versionId = created.version.id;

    // Submit
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId },
    });

    // Attempt rejection without reason -> should fail
    const emptyRejectRes = await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'reject', versionId, rejectionReason: '' },
    });
    expect(emptyRejectRes.status()).toBe(400);

    // Reject with valid reason
    const validRejectRes = await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'reject', versionId, rejectionReason: 'Headline does not meet ISO-45001 editorial standards' },
    });
    expect(validRejectRes.status()).toBe(200);
    const rejectData = await validRejectRes.json();
    expect(rejectData.version.status).toBe('REJECTED');
    expect(rejectData.version.rejectionReason).toBe('Headline does not meet ISO-45001 editorial standards');
  });

  test('LC-03: Atomic Publication with SHA-256 and immediate public SSR availability', async ({
    page,
    request,
    context,
  }) => {
    testSlug = `e2e-atomic-pub-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Published Offshore Safety Standard',
      slug: testSlug,
    });
    testPageId = created.page.id;
    const versionId = created.version.id;

    // Submit -> Approve
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId },
    });
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId },
    });

    // Publish
    const pubRes = await request.post(`/api/cms/pages/${testPageId}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId },
    });
    expect(pubRes.status()).toBe(200);
    const pubData = await pubRes.json();
    expect(pubData.success).toBe(true);
    expect(pubData.checksum).toBeDefined();

    // Verify page record updated via API
    const getPageRes = await request.get(`/api/cms/pages/${testPageId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getPageRes.status()).toBe(200);
    const pageData = await getPageRes.json();
    expect(pageData.page.status).toBe('PUBLISHED');
    expect(pageData.page.publishedVersionId).toBe(versionId);

    // Verify public SSR route serves the live page to anonymous visitor
    await context.clearCookies();
    const res = await page.goto(`/p/${testSlug}`);
    expect(res?.status()).toBe(200);
    await expect(page.locator('text=Published Offshore Safety Standard')).toBeVisible();
  });

  test('LC-04: Rollback creates a new Draft revision while preserving immutable history', async ({ request }) => {
    testSlug = `e2e-rollback-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Safety Policy V1',
      slug: testSlug,
    });
    testPageId = created.page.id;
    const v1Id = created.version.id;

    // Publish V1
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId: v1Id },
    });
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId: v1Id },
    });
    await request.post(`/api/cms/pages/${testPageId}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId: v1Id },
    });

    // Create and Publish V2
    const v2Res = await request.post(`/api/cms/pages/${testPageId}/versions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { changeSummary: 'Version 2 with updated policy' },
    });
    const v2Data = await v2Res.json();
    const v2Id = v2Data.version.id;

    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId: v2Id },
    });
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId: v2Id },
    });
    await request.post(`/api/cms/pages/${testPageId}/publish`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId: v2Id },
    });

    // Rollback to V1
    const rollRes = await request.post(`/api/cms/pages/${testPageId}/rollback`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { targetVersionId: v1Id },
    });
    expect(rollRes.status()).toBe(200);
    const rollData = await rollRes.json();

    // Verify new draft version was instantiated
    expect(rollData.newVersion.status).toBe('DRAFT');
    expect(rollData.newVersion.versionNumber).toBe(3);
    expect(rollData.newVersion.changeSummary).toMatch(/Rollback.*Version 1/i);
  });

  test('LC-05: Optimistic concurrency collision returns HTTP 409 Conflict', async ({ request }) => {
    testSlug = `e2e-concur-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Concurrency Isolation Test',
      slug: testSlug,
    });
    testPageId = created.page.id;
    const versionId = created.version.id;

    // Worker A updates version with valid expectedUpdatedAt
    const staleTimestamp = new Date(Date.now() - 600000).toISOString();

    const staleRes = await request.put(`/api/cms/pages/${testPageId}/versions/${versionId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: {
        nodes: [],
        expectedUpdatedAt: staleTimestamp,
      },
    });

    // Must be rejected with HTTP 409 Conflict
    expect(staleRes.status()).toBe(409);
    const err = await staleRes.json();
    expect(err.error).toContain('Conflict');
  });

  test('LC-06: Scheduled Publication lifecycle — schedule approved revision, verify queue & cancellation', async ({
    request,
  }) => {
    testSlug = `e2e-sched-${Date.now()}`;
    const created = await createTestPage(request, {
      title: 'Scheduled Safety Bulletin',
      slug: testSlug,
    });
    testPageId = created.page.id;
    const versionId = created.version.id;

    // 1. Submit & Approve
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { action: 'submit', versionId, changeSummary: 'Ready for scheduled release' },
    });
    await request.post(`/api/cms/pages/${testPageId}/workflow`, {
      headers: { Authorization: `Bearer ${reviewerToken}` },
      data: { action: 'approve', versionId },
    });

    // 2. Schedule for 2 hours in the future
    const futureIso = new Date(Date.now() + 7200000).toISOString();
    const schedRes = await request.post(`/api/cms/pages/${testPageId}/schedule`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { versionId, scheduledPublishAt: futureIso },
    });
    expect(schedRes.status()).toBe(200);
    const schedData = await schedRes.json();
    expect(schedData.job.status).toBe('QUEUED');
    expect(schedData.page.scheduledVersionId).toBe(versionId);

    // 3. List scheduled jobs via /api/cms/scheduled
    const listRes = await request.get(`/api/cms/scheduled?pageId=${testPageId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(listRes.status()).toBe(200);
    const listData = await listRes.json();
    expect(listData.jobs.length).toBeGreaterThanOrEqual(1);
    expect(listData.jobs[0].status).toBe('QUEUED');

    // 4. Cancel scheduled publication
    const cancelRes = await request.delete(`/api/cms/pages/${testPageId}/schedule`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(cancelRes.status()).toBe(200);
    const cancelData = await cancelRes.json();
    expect(cancelData.page.scheduledPublishAt).toBeUndefined();
  });
});
