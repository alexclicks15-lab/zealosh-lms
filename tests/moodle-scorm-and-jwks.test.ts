import { describe, it, expect } from 'vitest';
import { moodleAdapter } from '@/lib/adapters/moodle-adapter';

describe('Moodle SCORM Headless Runtime & OIDC JWKS Verification Suite', () => {
  it('SCORM-01: should generate secure headless SCORM launch context', async () => {
    const launchContext = await moodleAdapter.getScormLaunchContext(105, 'usr-std-01');

    expect(launchContext).toBeDefined();
    expect(launchContext.cmid).toBe(105);
    expect(launchContext.userId).toBe('usr-std-01');
    expect(launchContext.isHeadless).toBe(true);
    expect(launchContext.launchUrl).toContain('/learn-engine/mod/scorm/player.php');
    expect(launchContext.launchUrl).toContain('id=105');
    expect(launchContext.launchUrl).toContain('seamless=1');
    expect(launchContext.expiresAt).toBeDefined();
    expect(new Date(launchContext.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('SCORM-02: should retrieve SCORM attempt CMI runtime tracking data', async () => {
    const tracking = await moodleAdapter.getScormTracking(105, 1);

    expect(tracking).toBeDefined();
    expect(tracking.cmiStatus).toBe('completed');
    expect(tracking.scoreRaw).toBe(85);
    expect(tracking.totalTime).toBe('00:45:20');
    expect(tracking.suspendData).toContain('lesson_bookmark');
  });

  it('JWKS-01: should return RFC 7517 compliant JSON Web Key Set with HTTP 200', async () => {
    const { GET } = await import('@/app/api/oauth/jwks/route');
    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toContain('public');

    const data = await res.json();
    expect(data).toHaveProperty('keys');
    expect(Array.isArray(data.keys)).toBe(true);
  });
});

