import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('PWA & Offline Resilience Invariants', () => {
  const publicDir = path.join(process.cwd(), 'public');

  it('should have a valid web app manifest with brand identity and standalone display', () => {
    const manifestPath = path.join(publicDir, 'manifest.json');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    expect(content.name).toContain('Zealosh LMS');
    expect(content.short_name).toBe('Zealosh LMS');
    expect(content.start_url).toBe('/');
    expect(content.display).toBe('standalone');
    expect(content.theme_color).toBe('#4f8c4c'); // Official Zealosh green
    expect(content.background_color).toBe('#252c41'); // Official Zealosh dark neutral
    expect(Array.isArray(content.icons)).toBe(true);
    expect(content.icons.length).toBeGreaterThan(0);
  });

  it('should have a production-grade service worker with security cache gates', () => {
    const swPath = path.join(publicDir, 'sw.js');
    expect(fs.existsSync(swPath)).toBe(true);

    const swSource = fs.readFileSync(swPath, 'utf-8');
    // Ensure precaching includes offline fallback and core shell
    expect(swSource).toContain('/offline.html');
    expect(swSource).toContain('/manifest.json');

    // Security Gate: Ensure sensitive endpoints are excluded from shared caching
    expect(swSource).toContain('SENSITIVE_URL_PATTERNS');
    expect(swSource).toContain('api\\/auth');
    expect(swSource).toContain('api\\/exams');
    expect(swSource).toContain('api\\/admin');
  });

  it('should provide a branded offline fallback screen for network-disconnected states', () => {
    const offlineHtmlPath = path.join(publicDir, 'offline.html');
    expect(fs.existsSync(offlineHtmlPath)).toBe(true);

    const html = fs.readFileSync(offlineHtmlPath, 'utf-8');
    expect(html).toContain('Offline');
    expect(html).toContain('Zealosh LMS');
    expect(html).toContain('#4f8c4c'); // Brand color
    expect(html).toContain('synchronize');
  });
});
