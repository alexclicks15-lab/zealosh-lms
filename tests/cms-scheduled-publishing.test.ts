// Zealosh LMS — Scheduled Publishing Engine, Durable Outbox, Background Worker & API Suite (SP-01 to SP-10)
// Verifies scheduling lifecycle, lease locking, worker execution, retry backoff, API guards, and PostgreSQL integration

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { cmsService } from '@/lib/cms/cms-service';
import { CmsScheduledPublisherWorker } from '@/lib/cms/scheduled-publisher-worker';
import { signToken } from '@/lib/auth/jwt';
import { POST as schedulePageApi, DELETE as cancelScheduleApi } from '@/app/api/cms/pages/[id]/schedule/route';
import { GET as listScheduledApi, POST as triggerWorkerApi } from '@/app/api/cms/scheduled/route';
import { createIsolatedPostgres } from './helpers/isolated-postgres';

describe('Zealosh CMS — Scheduled Publishing Engine, Background Worker & Durable Outbox Suite (SP-01 to SP-10)', () => {
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
    db.setStorageModeOverride('in_memory');
    db.cmsScheduledPublications.clear();
    db.ensureCmsSeedDefaults();
  });

  it('SP-01: should schedule an approved version for future publication and enqueue a QUEUED job', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-test-01-${Date.now()}`,
        title: 'Scheduled Safety Campaign',
        pageType: 'CAMPAIGN',
      },
      'usr-admin-01'
    );

    await cmsService.submitForReview(created.page.id, created.version.id, 'Ready', 'usr-admin-01');
    await cmsService.approveVersion(created.page.id, created.version.id, 'usr-reviewer-02', 'COURSE_MANAGER');

    const futureIso = new Date(Date.now() + 3600000).toISOString();
    const res = await cmsService.schedulePagePublication(
      created.page.id,
      created.version.id,
      futureIso,
      'usr-admin-01',
      'SUPER_ADMIN'
    );

    expect(res.job.status).toBe('QUEUED');
    expect(res.job.pageId).toBe(created.page.id);
    expect(res.job.versionId).toBe(created.version.id);
    expect(res.page.scheduledPublishAt).toBe(futureIso);
    expect(res.page.scheduledVersionId).toBe(created.version.id);
  });

  it('SP-02: should reject scheduling with a past or invalid timestamp', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-past-${Date.now()}`,
        title: 'Past Schedule Test',
      },
      'usr-admin-01'
    );

    const pastIso = new Date(Date.now() - 60000).toISOString();
    await expect(
      cmsService.schedulePagePublication(created.page.id, created.version.id, pastIso, 'usr-admin-01', 'SUPER_ADMIN')
    ).rejects.toThrow(/must be a valid future ISO timestamp/);
  });

  it('SP-03: should reject scheduling an unapproved DRAFT version when actor is not SUPER_ADMIN', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-unapproved-${Date.now()}`,
        title: 'Unapproved Schedule Test',
      },
      'usr-cm-01'
    );

    const futureIso = new Date(Date.now() + 3600000).toISOString();
    await expect(
      cmsService.schedulePagePublication(created.page.id, created.version.id, futureIso, 'usr-cm-01', 'COURSE_MANAGER')
    ).rejects.toThrow(/Only APPROVED versions can be scheduled/);
  });

  it('SP-04: should cancel a pending scheduled publication and clear page pointers', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-cancel-${Date.now()}`,
        title: 'Cancel Schedule Test',
      },
      'usr-admin-01'
    );

    const futureIso = new Date(Date.now() + 3600000).toISOString();
    const scheduled = await cmsService.schedulePagePublication(
      created.page.id,
      created.version.id,
      futureIso,
      'usr-admin-01',
      'SUPER_ADMIN'
    );

    const cancelRes = await cmsService.cancelScheduledPublication(created.page.id, 'usr-admin-01');
    expect(cancelRes.success).toBe(true);
    expect(cancelRes.page.scheduledPublishAt).toBeUndefined();
    expect(cancelRes.page.scheduledVersionId).toBeUndefined();

    const job = db.cmsScheduledPublications.get(scheduled.job.id);
    expect(job?.status).toBe('CANCELLED');
  });

  it('SP-05: background worker should ignore future jobs that are not yet due', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-future-ignore-${Date.now()}`,
        title: 'Future Job Ignore Test',
      },
      'usr-admin-01'
    );

    const futureIso = new Date(Date.now() + 7200000).toISOString();
    await cmsService.schedulePagePublication(
      created.page.id,
      created.version.id,
      futureIso,
      'usr-admin-01',
      'SUPER_ADMIN'
    );

    const worker = new CmsScheduledPublisherWorker('test-worker-01');
    const tick = await worker.executeTick();
    expect(tick.processed).toBe(0);
    expect(tick.succeeded).toBe(0);

    const pageAfter = await db.getCmsPageById(created.page.id);
    expect(pageAfter?.status).toBe('DRAFT');
  });

  it('SP-06: background worker should claim due jobs, atomically publish the page, and mark job COMPLETED', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-due-exec-${Date.now()}`,
        title: 'Due Job Execution Test',
      },
      'usr-admin-01'
    );

    const futureIso = new Date(Date.now() + 5000).toISOString();
    const scheduled = await cmsService.schedulePagePublication(
      created.page.id,
      created.version.id,
      futureIso,
      'usr-admin-01',
      'SUPER_ADMIN'
    );

    // Fast-forward job scheduledAt to past so it is due now
    const job = db.cmsScheduledPublications.get(scheduled.job.id)!;
    job.scheduledAt = new Date(Date.now() - 1000).toISOString();
    db.cmsScheduledPublications.set(job.id, job);

    const worker = new CmsScheduledPublisherWorker('test-worker-02');
    const tick = await worker.executeTick();

    expect(tick.processed).toBe(1);
    expect(tick.succeeded).toBe(1);
    expect(tick.failed).toBe(0);

    const updatedJob = db.cmsScheduledPublications.get(job.id);
    expect(updatedJob?.status).toBe('COMPLETED');
    expect(updatedJob?.completedAt).toBeDefined();

    const publishedPage = await db.getCmsPageById(created.page.id);
    expect(publishedPage?.status).toBe('PUBLISHED');
    expect(publishedPage?.publishedVersionId).toBe(created.version.id);
  });

  it('SP-07: background worker should handle publication failures with retry counting and transition to FAILED after maxAttempts', async () => {
    // Enqueue a job pointing to a non-existent version to trigger failure
    const jobId = `job-fail-${Date.now()}`;
    await db.saveCmsScheduledPublication({
      id: jobId,
      pageId: 'non-existent-page',
      versionId: 'non-existent-version',
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
      scheduledBy: 'usr-admin-01',
      status: 'QUEUED',
      attemptCount: 2, // 3rd attempt will reach maxAttempts (3)
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const worker = new CmsScheduledPublisherWorker('test-worker-fail');
    const tick = await worker.executeTick();

    expect(tick.processed).toBe(1);
    expect(tick.failed).toBe(1);

    const failedJob = db.cmsScheduledPublications.get(jobId);
    expect(failedJob?.status).toBe('FAILED');
    expect(failedJob?.attemptCount).toBe(3);
    expect(failedJob?.errorMessage).toContain('Version not found');
  });

  it('SP-08: concurrency lock protection ensures a job in PROCESSING or COMPLETED is never claimed twice', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-lock-${Date.now()}`,
        title: 'Concurrency Lock Test',
      },
      'usr-admin-01'
    );

    const scheduled = await cmsService.schedulePagePublication(
      created.page.id,
      created.version.id,
      new Date(Date.now() + 5000).toISOString(),
      'usr-admin-01',
      'SUPER_ADMIN'
    );

    const job = db.cmsScheduledPublications.get(scheduled.job.id)!;
    job.scheduledAt = new Date(Date.now() - 1000).toISOString();
    db.cmsScheduledPublications.set(job.id, job);

    // First claim locks it
    const claimed1 = await db.claimDueCmsScheduledPublications('worker-A', 5);
    expect(claimed1.length).toBe(1);
    expect(claimed1[0].status).toBe('PROCESSING');
    expect(claimed1[0].lockedBy).toBe('worker-A');

    // Second claim while PROCESSING returns 0
    const claimed2 = await db.claimDueCmsScheduledPublications('worker-B', 5);
    expect(claimed2.length).toBe(0);
  });

  it('SP-09: API endpoints /api/cms/pages/[id]/schedule and /api/cms/scheduled enforce RBAC and execute end-to-end', async () => {
    const created = await cmsService.createPage(
      {
        slug: `sched-api-${Date.now()}`,
        title: 'API Schedule Test',
      },
      'usr-admin-01'
    );

    const futureIso = new Date(Date.now() + 3600000).toISOString();

    // 1. Student attempt -> 403 Forbidden
    const stdReq = new Request(`http://localhost:3000/api/cms/pages/${created.page.id}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        versionId: created.version.id,
        scheduledPublishAt: futureIso,
      }),
    });
    const stdRes = await schedulePageApi(stdReq, { params: { id: created.page.id } });
    expect(stdRes.status).toBe(403);

    // 2. Admin schedule -> 200 OK
    const admReq = new Request(`http://localhost:3000/api/cms/pages/${created.page.id}/schedule`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        versionId: created.version.id,
        scheduledPublishAt: futureIso,
      }),
    });
    const admRes = await schedulePageApi(admReq, { params: { id: created.page.id } });
    expect(admRes.status).toBe(200);
    const admData = await admRes.json();
    expect(admData.success).toBe(true);
    expect(admData.job.status).toBe('QUEUED');

    // 3. List scheduled jobs via GET /api/cms/scheduled
    const listReq = new Request(`http://localhost:3000/api/cms/scheduled?pageId=${created.page.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const listRes = await listScheduledApi(listReq);
    expect(listRes.status).toBe(200);
    const listData = await listRes.json();
    expect(listData.jobs.length).toBe(1);

    // 4. Cancel schedule via DELETE /api/cms/pages/[id]/schedule
    const delReq = new Request(`http://localhost:3000/api/cms/pages/${created.page.id}/schedule`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const delRes = await cancelScheduleApi(delReq, { params: { id: created.page.id } });
    expect(delRes.status).toBe(200);
  });

  it('SP-10: real PostgreSQL cms_scheduled_publications table enforces RLS and auto-completes on publish_cms_page_version()', async () => {
    const pgInstance = await createIsolatedPostgres();
    try {
      await pgInstance.pg.exec(`
        INSERT INTO public.cms_pages (id, slug, title, created_by, updated_by, scheduled_publish_at)
        VALUES ('pg-sched-page', 'pg-scheduled-course', 'PG Scheduled Course', 'usr-admin-01', 'usr-admin-01', NOW() + INTERVAL '1 hour');

        INSERT INTO public.cms_page_versions (id, page_id, version_number, status, created_by)
        VALUES ('pg-sched-ver', 'pg-sched-page', 1, 'APPROVED', 'usr-admin-01');

        INSERT INTO public.cms_scheduled_publications (id, page_id, version_id, scheduled_at, scheduled_by, status)
        VALUES ('pg-sched-job', 'pg-sched-page', 'pg-sched-ver', NOW() + INTERVAL '1 hour', 'usr-admin-01', 'QUEUED');
      `);

      // Verify anonymous cannot read scheduled publications (RLS blocks)
      await pgInstance.withAuthContext({ pgRole: 'anon', appRole: 'anon' }, async (pg) => {
        const anonRes = await pg.query(`SELECT * FROM public.cms_scheduled_publications;`);
        expect(anonRes.rows.length).toBe(0);
      });

      // Execute atomic publish stored function -> should automatically mark job COMPLETED and clear page scheduled_publish_at
      await pgInstance.pg.query(`
        SELECT public.publish_cms_page_version('pg-sched-page', 'pg-sched-ver', 'usr-admin-01', 'sha256-sched-check');
      `);

      const jobRes = await pgInstance.pg.query<{ status: string; completed_at: string }>(`
        SELECT status, completed_at FROM public.cms_scheduled_publications WHERE id = 'pg-sched-job';
      `);
      expect(jobRes.rows[0].status).toBe('COMPLETED');
      expect(jobRes.rows[0].completed_at).toBeTruthy();

      const pageRes = await pgInstance.pg.query<{ status: string; scheduled_publish_at: string | null }>(`
        SELECT status, scheduled_publish_at FROM public.cms_pages WHERE id = 'pg-sched-page';
      `);
      expect(pageRes.rows[0].status).toBe('PUBLISHED');
      expect(pageRes.rows[0].scheduled_publish_at).toBeNull();
    } finally {
      await pgInstance.close();
    }
  });
});

