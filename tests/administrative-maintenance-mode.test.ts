// tests/administrative-maintenance-mode.test.ts
// Vitest suite for Zealosh Administrative Maintenance Mode & Write-Protection Engine

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { maintenanceService } from '@/lib/maintenance/maintenance-service';
import { db } from '@/lib/store/db';

describe('Zealosh Administrative Maintenance Mode Engine', () => {
  beforeEach(async () => {
    // Reset maintenance config and history to default clean state
    (db as any).maintenanceHistory = [];
    await db.updateMaintenanceConfig({
      mode: 'NORMAL',
      enabled: false,
      maintenanceMessage: 'System operational',
      publicExplanation: 'All systems operational',
      affectedScope: 'ALL',
      reason: 'Reset to normal',
      updatedBy: 'system',
      version: 1,
      scheduledStartTime: undefined,
      scheduledEndTime: undefined,
    });
  });

  afterEach(async () => {
    (db as any).maintenanceHistory = [];
    await db.updateMaintenanceConfig({
      mode: 'NORMAL',
      enabled: false,
      maintenanceMessage: 'System operational',
      publicExplanation: 'All systems operational',
      affectedScope: 'ALL',
      reason: 'Reset to normal',
      updatedBy: 'system',
      version: 1,
      scheduledStartTime: undefined,
      scheduledEndTime: undefined,
    });
  });

  it('permits all read and write traffic under NORMAL operational mode', async () => {
    const getCheck = await maintenanceService.assertWritePermitted({
      method: 'GET',
      pathname: '/api/courses',
      userRole: 'STUDENT',
    });
    expect(getCheck.allowed).toBe(true);

    const postCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/submissions',
      userRole: 'STUDENT',
    });
    expect(postCheck.allowed).toBe(true);
  });

  it('rejects state mutations with HTTP 503 in READ_ONLY mode while allowing GET reads', async () => {
    await maintenanceService.updateConfig(
      {
        enabled: true,
        mode: 'READ_ONLY',
        maintenanceMessage: 'Routine database index maintenance in progress.',
      },
      'admin-usr-01'
    );

    // GET requests should succeed
    const readCheck = await maintenanceService.assertWritePermitted({
      method: 'GET',
      pathname: '/api/courses/safety-intro',
      userRole: 'STUDENT',
    });
    expect(readCheck.allowed).toBe(true);

    // POST, PUT, DELETE should be blocked with 503
    const postCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/enrollments',
      userRole: 'STUDENT',
    });
    expect(postCheck.allowed).toBe(false);
    expect(postCheck.status).toBe(503);
    expect(postCheck.mode).toBe('READ_ONLY');
    expect(postCheck.error).toContain('Routine database index maintenance in progress');

    const deleteCheck = await maintenanceService.assertWritePermitted({
      method: 'DELETE',
      pathname: '/api/cart/item-123',
      userRole: 'STUDENT',
    });
    expect(deleteCheck.allowed).toBe(false);
    expect(deleteCheck.status).toBe(503);
  });

  it('rejects both reads and mutations for non-exempt traffic in FULL_MAINTENANCE mode', async () => {
    await maintenanceService.updateConfig(
      {
        enabled: true,
        mode: 'FULL_MAINTENANCE',
        maintenanceMessage: 'Emergency system infrastructure upgrade.',
      },
      'admin-usr-01'
    );

    const readCheck = await maintenanceService.assertWritePermitted({
      method: 'GET',
      pathname: '/api/catalog',
      userRole: 'STUDENT',
    });
    expect(readCheck.allowed).toBe(false);
    expect(readCheck.status).toBe(503);
    expect(readCheck.mode).toBe('FULL_MAINTENANCE');

    const writeCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/orders',
      userRole: 'STUDENT',
    });
    expect(writeCheck.allowed).toBe(false);
    expect(writeCheck.status).toBe(503);
  });

  it('exempts critical operational, health, and auth endpoints from maintenance blocks', async () => {
    await maintenanceService.updateConfig(
      {
        enabled: true,
        mode: 'FULL_MAINTENANCE',
        maintenanceMessage: 'Emergency maintenance.',
      },
      'admin-usr-01'
    );

    // Health probes
    const livenessCheck = await maintenanceService.assertWritePermitted({
      method: 'GET',
      pathname: '/api/health/liveness',
    });
    expect(livenessCheck.allowed).toBe(true);

    const readinessCheck = await maintenanceService.assertWritePermitted({
      method: 'GET',
      pathname: '/api/health/readiness',
    });
    expect(readinessCheck.allowed).toBe(true);

    // Maintenance public status
    const statusCheck = await maintenanceService.assertWritePermitted({
      method: 'GET',
      pathname: '/api/maintenance/status',
    });
    expect(statusCheck.allowed).toBe(true);

    // Admin maintenance controls
    const adminMaintCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/admin/maintenance',
      userRole: 'SUPER_ADMIN',
    });
    expect(adminMaintCheck.allowed).toBe(true);
  });

  it('permits SUPER_ADMIN and ORG_ADMIN emergency write bypass during maintenance', async () => {
    await maintenanceService.updateConfig(
      {
        enabled: true,
        mode: 'FULL_MAINTENANCE',
        maintenanceMessage: 'Platform upgrade',
      },
      'admin-usr-01'
    );

    const superAdminCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/admin/system/emergency-patch',
      userRole: 'SUPER_ADMIN',
    });
    expect(superAdminCheck.allowed).toBe(true);

    const orgAdminCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/admin/courses/remediate',
      userRole: 'ORG_ADMIN',
    });
    expect(orgAdminCheck.allowed).toBe(true);

    // Non-admin roles remain blocked
    const studentCheck = await maintenanceService.assertWritePermitted({
      method: 'POST',
      pathname: '/api/admin/courses/remediate',
      userRole: 'STUDENT',
    });
    expect(studentCheck.allowed).toBe(false);
  });

  it('automatically transitions scheduled windows when window starts and elapses', async () => {
    const pastStart = new Date(Date.now() - 60000).toISOString();
    const futureEnd = new Date(Date.now() + 60000).toISOString();

    // Set a scheduled window that is currently active (now is between start and end)
    await db.updateMaintenanceConfig({
      mode: 'NORMAL',
      enabled: false,
      scheduledStartTime: pastStart,
      scheduledEndTime: futureEnd,
      maintenanceMessage: 'Scheduled maintenance active',
      publicExplanation: 'Scheduled window active',
      affectedScope: 'ALL',
      reason: 'Scheduled maintenance testing',
      updatedBy: 'system',
      version: 1,
    });

    const activeConfig = await maintenanceService.getEffectiveConfig();
    expect(activeConfig.enabled).toBe(true);
    expect(activeConfig.mode).toBe('READ_ONLY');

    // Set a scheduled window that has already elapsed (end time in the past)
    const wayPastStart = new Date(Date.now() - 120000).toISOString();
    const wayPastEnd = new Date(Date.now() - 30000).toISOString();

    await db.updateMaintenanceConfig({
      mode: 'READ_ONLY',
      enabled: true,
      scheduledStartTime: wayPastStart,
      scheduledEndTime: wayPastEnd,
      maintenanceMessage: 'Scheduled maintenance active',
      publicExplanation: 'Scheduled window active',
      affectedScope: 'ALL',
      reason: 'Scheduled maintenance testing',
      updatedBy: 'system',
      version: 2,
    });

    const completedConfig = await maintenanceService.getEffectiveConfig();
    expect(completedConfig.enabled).toBe(false);
    expect(completedConfig.mode).toBe('NORMAL');
  });

  it('records audit history for maintenance mode transitions', async () => {
    await maintenanceService.updateConfig(
      {
        enabled: true,
        mode: 'READ_ONLY',
        reason: 'Pre-migration database backup lock',
      },
      'admin-usr-99'
    );

    const history = await db.getMaintenanceHistory();
    expect(history.length).toBeGreaterThan(0);
    const latest = history[0];
    expect(latest.mode).toBe('READ_ONLY');
    expect(latest.action).toBe('ACTIVATED');
    expect(latest.reason).toBe('Pre-migration database backup lock');
    expect(latest.actor).toBe('admin-usr-99');
  });
});
