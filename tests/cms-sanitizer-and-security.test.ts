// Zealosh LMS — CMS Sanitizer & Security Defense Tests
// Standards: OWASP Top 10 A03 (Injection), Open Redirects, Route Namespace Protection

import { describe, it, expect } from 'vitest';
import {
  sanitizeUrl,
  sanitizeHtml,
  isReservedSlug,
  normalizeSlug,
  RESERVED_APPLICATION_SLUGS,
} from '@/lib/cms/sanitizer';

describe('Zealosh CMS — Sanitizer & Security Defenses Suite', () => {
  it('1. should accept safe relative routes and valid https/http URLs', () => {
    expect(sanitizeUrl('/courses')).toBe('/courses');
    expect(sanitizeUrl('/courses/asp-examination-preparation')).toBe('/courses/asp-examination-preparation');
    expect(sanitizeUrl('#curriculum')).toBe('#curriculum');
    expect(sanitizeUrl('https://www.zealosh.com/exams')).toBe('https://www.zealosh.com/exams');
    expect(sanitizeUrl('mailto:contact@zealosh.com')).toBe('mailto:contact@zealosh.com');
    expect(sanitizeUrl('tel:+919496000000')).toBe('tel:+919496000000');
  });

  it('2. should strictly reject javascript:, data:, and vbscript: execution vectors', () => {
    expect(sanitizeUrl('javascript:alert(document.cookie)')).toBe('#');
    expect(sanitizeUrl('JAVASCRIPT:maliciousCode()')).toBe('#');
    expect(sanitizeUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==')).toBe('#');
    expect(sanitizeUrl('vbscript:msgbox("pwnd")')).toBe('#');
  });

  it('3. should neutralize protocol-relative URL open redirect attempts (//evil.com)', () => {
    expect(sanitizeUrl('//evil-phishing-site.com/login')).toBe('#');
  });

  it('4. should sanitize rich HTML by stripping script tags, iframes, and inline event handlers', () => {
    const maliciousHtml = `
      <p>Legitimate paragraph content.</p>
      <script>alert("XSS Attack");</script>
      <img src="/logo.png" onload="alert('XSS on load')" />
      <a href="javascript:stealTokens()">Click here</a>
      <iframe src="https://evil.com"></iframe>
    `;

    const cleaned = sanitizeHtml(maliciousHtml);

    expect(cleaned).toContain('<p>Legitimate paragraph content.</p>');
    expect(cleaned).not.toContain('<script>');
    expect(cleaned).not.toContain('alert(');
    expect(cleaned).not.toContain('onload');
    expect(cleaned).not.toContain('javascript:');
    expect(cleaned).not.toContain('<iframe');
  });

  it('5. should identify and protect all reserved core LMS application routes from CMS slug collision', () => {
    const reservedRoutes = [
      'admin',
      'api',
      'auth',
      'login',
      'logout',
      'classroom',
      'vc',
      'courses',
      'exams',
      'student',
      'instructor',
      'support',
      'p',
    ];

    reservedRoutes.forEach((route) => {
      expect(isReservedSlug(route)).toBe(true);
      expect(isReservedSlug(`/${route}`)).toBe(true);
      expect(isReservedSlug(`${route}/nested/subpath`)).toBe(true);
    });

    // Valid non-reserved CMS custom slugs
    expect(isReservedSlug('about-us')).toBe(false);
    expect(isReservedSlug('hse-corporate-consulting')).toBe(false);
    expect(isReservedSlug('accreditation-standards')).toBe(false);
    expect(isReservedSlug('campaigns/spring-2027')).toBe(false);
  });

  it('6. should normalize slugs to lowercase kebab-case with trimmed slashes', () => {
    expect(normalizeSlug('  /About Us/  ')).toBe('about-us');
    expect(normalizeSlug('HSE_Training & Consultants!')).toBe('hse-training-consultants-');
    expect(normalizeSlug('courses/CRSP Masterclass')).toBe('courses/crsp-masterclass');
  });
});

