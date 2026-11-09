// Zealosh LMS — Playwright Real-Browser End-to-End Test Suite
// Task: ZM-IMPL-08G — Track 6: Enterprise Operations, PWA Mobile Engine & Event Outbox Synchronization
// File: tests/e2e/enterprise-operations-pwa.spec.ts

import { test, expect } from '@playwright/test';
import { injectAuthCookie, adminToken } from './helpers/cms-fixtures';

test.describe('Zealosh ZM-IMPL-08G: Enterprise Operations, PWA & Event Outbox Synchronization', () => {
  // --------------------------------------------------------------------------
  // TEST 1: PWA Web App Manifest, Service Worker & Push Readiness
  // --------------------------------------------------------------------------
  test('EOP-01: should serve valid PWA manifest, branded offline shell, and honest push status', async ({
    request,
  }) => {
    // 1. Validate /manifest.json
    const manifestRes = await request.get('/manifest.json');
    expect(manifestRes.ok()).toBe(true);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe('Zealosh LMS — Enterprise HSE Learning Platform');
    expect(manifest.short_name).toBe('Zealosh LMS');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#4f8c4c');
    expect(manifest.background_color).toBe('#252c41');
    expect(manifest.icons.length).toBeGreaterThan(0);

    // 2. Validate branded offline shell /offline.html
    const offlineRes = await request.get('/offline.html');
    expect(offlineRes.ok()).toBe(true);
    const offlineHtml = await offlineRes.text();
    expect(offlineHtml).toContain('Offline Mode Active');
    expect(offlineHtml).toContain('Zealosh LMS');
    expect(offlineHtml).toContain('Check Reconnection');

    // 3. Validate honest push status API
    const pushStatusRes = await request.get('/api/pwa/push/status');
    expect(pushStatusRes.ok()).toBe(true);
    const pushData = await pushStatusRes.json();
    expect(pushData.success).toBe(true);
    expect(pushData.readiness).toBeDefined();
    expect(pushData.readiness.status).toBe('UNCONFIGURED');
    expect(pushData.readiness.configured).toBe(false);
    expect(pushData.readiness.inAppFallbackActive).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Operations & Synchronization Control Centre UI (/admin/operations)
  // --------------------------------------------------------------------------
  test('EOP-02: should render Operations & Synchronization Control Centre with real KPI cards and tabs', async ({
    page,
    context,
  }) => {
    // 1. Authenticate as Superadmin
    await injectAuthCookie(context, adminToken);

    // 2. Navigate to /admin/operations
    await page.goto('/admin/operations', { waitUntil: 'domcontentloaded' });

    // 3. Verify Page Title and Header
    await expect(page.locator('h1')).toContainText('Central Operations & Synchronization Control Centre');
    await expect(page.getByText('Track 6 Enterprise Operations')).toBeVisible();

    // 4. Verify Live Operational KPI Cards
    await expect(page.getByText('Registered Domains')).toBeVisible();
    await expect(page.getByText('Outbox Backlog')).toBeVisible();
    await expect(page.getByText('Dead-Letter Queue')).toBeVisible();
    await expect(page.getByText('State Drift')).toBeVisible();
    await expect(page.getByText('Maintenance Mode')).toBeVisible();
    await expect(page.getByText('Audit Archives')).toBeVisible();

    // 5. Verify Navigation Tabs (matching exact tab labels)
    await expect(page.getByRole('button', { name: 'Operations Overview', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Domain Registry', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Event Outbox', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Dead Letters/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reconciliation', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Maintenance Mode', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Audit Archives', exact: true })).toBeVisible();

    // 6. Inspect Domain Registry Tab
    await page.getByRole('button', { name: 'Domain Registry', exact: true }).click();
    await expect(page.getByText('Authoritative Service & Domain Registry')).toBeVisible();
    await expect(page.getByText('20 modular single-institution domains')).toBeVisible();
    await expect(page.getByText('IDENTITY', { exact: true })).toBeVisible();
    await expect(page.getByText('COMMERCE', { exact: true })).toBeVisible();
    await expect(page.getByText('ACADEMIC', { exact: true })).toBeVisible();
    await expect(page.getByText('ASSESSMENT', { exact: true })).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Health Liveness Probe & Public Maintenance Status
  // --------------------------------------------------------------------------
  test('EOP-03: should serve health probes and public maintenance status reliably', async ({
    request,
  }) => {
    // 1. Test liveness probe
    const liveRes = await request.get('/api/health/liveness');
    expect(liveRes.ok()).toBe(true);
    const liveData = await liveRes.json();
    expect(liveData.status).toBe('UP');
    expect(typeof liveData.uptimeSeconds).toBe('number');

    // 2. Test readiness probe
    const readyRes = await request.get('/api/health/readiness');
    expect(readyRes.ok()).toBe(true);
    const readyData = await readyRes.json();
    expect(readyData.status).toBe('READY');
    expect(readyData.metrics.coursesCount).toBeGreaterThanOrEqual(4);

    // 3. Test public maintenance status
    const maintRes = await request.get('/api/maintenance/status');
    expect(maintRes.ok()).toBe(true);
    const maintData = await maintRes.json();
    expect(maintData.mode).toBeDefined();
    expect(typeof maintData.enabled).toBe('boolean');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Institutional Audit Archive Generation & Cryptographic Verification API
  // --------------------------------------------------------------------------
  test('EOP-04: should generate audit archive and verify SHA-256 cryptographic integrity', async ({
    request,
  }) => {
    // 1. Generate an institutional audit archive
    const genRes = await request.post('/api/admin/audit/archives', {
      headers: {
        Cookie: `auth_token=${adminToken}`,
      },
      data: {
        archivePeriod: '2026-Q4',
        scope: 'ALL',
        format: 'JSONL',
      },
    });

    expect(genRes.ok()).toBe(true);
    const genData = await genRes.json();
    expect(genData.success).toBe(true);
    expect(genData.archive).toBeDefined();

    const archive = genData.archive;
    expect(archive.contentChecksum).toHaveLength(64);
    expect(archive.manifest.institution).toBe('Zealosh Training & Consultants');
    expect(archive.retentionStatus).toBe('RETENTION_POLICY_UNCONFIGURED');

    // 2. Verify archive integrity
    const verifyRes = await request.post(`/api/admin/audit/archives/${archive.id}/verify`, {
      headers: {
        Cookie: `auth_token=${adminToken}`,
      },
    });

    expect(verifyRes.ok()).toBe(true);
    const verifyData = await verifyRes.json();
    expect(verifyData.success).toBe(true);
    expect(verifyData.integrityStatus).toBe('VERIFIED');
  });
});
