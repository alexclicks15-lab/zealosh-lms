import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../src/lib/store/db';

describe('Superadmin Central Control & Governance Invariants', { timeout: 30000 }, () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  afterAll(async () => {
    if (db.getStorageMode() === 'supabase') {
      await db.updatePlatformSettings(
        { platformName: 'Zealosh LMS — Enterprise HSE Learning Platform' },
        'admin@zealosh.com'
      );
    }
  });

  it('should update platform settings and record an immutable audit entry', async () => {
    const updated = await db.updatePlatformSettings(
      { platformName: 'Zealosh Global Safety Academy' },
      'admin@zealosh.com',
      'usr-admin-01',
      'Rebranding for North America expansion'
    );

    expect(updated.platformName).toBe('Zealosh Global Safety Academy');
    expect(db.platformSettings.platformName).toBe('Zealosh Global Safety Academy');

    // Audit verification
    expect(db.configAudits.length).toBeGreaterThan(0);
    const latestConfigAudit = db.configAudits[0];
    expect(latestConfigAudit.section).toBe('GENERAL_SETTINGS');
    expect(latestConfigAudit.changeReason).toBe('Rebranding for North America expansion');
  });

  it('should update visual branding tokens and allow one-click reset to official brand', async () => {
    // 1. Custom branding
    await db.updateBrandingTheme({ primaryGreen: '#1b5e20' }, 'admin@zealosh.com');
    expect(db.brandingTheme.primaryGreen).toBe('#1b5e20');

    // 2. Reset to official brand
    const reset = await db.resetToOfficialBrand('admin@zealosh.com');
    expect(reset.primaryGreen).toBe('#4f8c4c');
    expect(reset.deepGreen).toBe('#3a7536');
    expect(reset.logoUrl).toBe('/logo.png');
    expect(reset.faviconUrl).toBe('/logo-round.png');
    expect(db.brandingTheme.primaryGreen).toBe('#4f8c4c');
    expect(db.brandingTheme.logoUrl).toBe('/logo.png');
    expect(db.brandingTheme.faviconUrl).toBe('/logo-round.png');
  });

  it('should toggle modular feature flags and persist state', async () => {
    const initialLive = db.featureFlags.liveClassrooms;
    const updated = await db.updateFeatureFlags({ liveClassrooms: !initialLive });
    expect(updated.liveClassrooms).toBe(!initialLive);
    expect(db.featureFlags.liveClassrooms).toBe(!initialLive);
  });

  it('should create custom roles and reject deletion of protected system roles', async () => {
    // 1. Create custom role
    const newRole = await db.createRole(
      {
        name: 'Academic Moderator',
        description: 'Moderates live classrooms and reviews assignments',
        permissions: ['cohorts.manage', 'students.read'],
        isSystem: false,
      },
      'admin@zealosh.com'
    );

    expect(db.roles.has(newRole.id)).toBe(true);

    // 2. Reject deletion of system role
    await expect(
      db.deleteRole('role-super-admin', 'admin@zealosh.com')
    ).rejects.toThrow('System roles cannot be deleted');

    // 3. Allow deletion of custom role
    const deleted = await db.deleteRole(newRole.id, 'admin@zealosh.com');
    expect(deleted).toBe(true);
    expect(db.roles.has(newRole.id)).toBe(false);
  });

  it('should safely roll back configuration to a previous snapshot', async () => {
    // Change 1: Update platform name
    const initialName = db.platformSettings.platformName;
    await db.updatePlatformSettings({ platformName: 'Temporary Name 1' }, 'admin@zealosh.com');
    const firstAuditId = db.configAudits[0].id;

    // Change 2: Update platform name again
    await db.updatePlatformSettings({ platformName: 'Temporary Name 2' }, 'admin@zealosh.com');
    expect(db.platformSettings.platformName).toBe('Temporary Name 2');

    // Rollback to first change state
    const success = await db.rollbackConfig(firstAuditId, 'admin@zealosh.com');
    expect(success).toBe(true);
    expect(db.platformSettings.platformName).toBe(initialName);
  });

  it('should issue, verify, and revoke academic credentials', async () => {
    // 1. Issue certificate
    const cert = await db.issueCertificate('usr-std-01', 'crs-asp-01', 95);
    expect(cert).toBeDefined();
    expect(cert.status).toBe('ISSUED');
    expect(cert.certificateCode).toContain('ZEALOSH-ASP-');

    // 2. Verify
    const verified = await db.verifyCertificate(cert.certificateCode);
    expect(verified).not.toBeNull();
    expect(verified?.userName).toBe('Arjun Menon');

    // 3. Revoke
    const revoked = await db.revokeCertificate(cert.certificateCode, 'Curriculum audit discrepancy');
    expect(revoked.status).toBe('REVOKED');

    const checkRevoked = await db.verifyCertificate(cert.certificateCode);
    expect(checkRevoked?.status).toBe('REVOKED');
  });

  it('should compute real platform operational metrics', () => {
    const metrics = db.getPlatformMetrics();
    expect(metrics).toBeDefined();
    expect(metrics.totalUsers).toBeGreaterThan(0);
    expect(metrics.publishedCourses).toBeGreaterThan(0);
    expect(metrics.activeBatches).toBeGreaterThan(0);
    expect(metrics.passRate).toBeGreaterThanOrEqual(0);
    expect(metrics.uptime).toBe('99.98%');
  });
});
