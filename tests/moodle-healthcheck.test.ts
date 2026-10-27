import { describe, it, expect } from 'vitest';
import { execFileSync } from 'child_process';
import path from 'path';

/**
 * Synthetic Test Suite for Moodle Healthcheck Logic & Redirect-Aware Validation
 * Evaluates both the pure URL validation algorithm and actual bash healthcheck script.
 * 
 * NOTE: All tests in this file evaluate synthetic HTTP responses and mock targets.
 * STATUS: SIMULATED (Synthetic responses tested on Windows development host).
 */

// TypeScript reference implementation matching deploy/moodle/moodle-healthcheck.sh
function validateRedirectLocation(targetLoc: string, expectedDomain: string): boolean {
  if (!targetLoc || targetLoc.trim() === '') {
    return false;
  }

  // 1. Reject control characters, newlines, tabs, and protocol-relative / backslash tricks
  if (/[\r\n\t\0-\x1f\x7f]/.test(targetLoc) || targetLoc.startsWith('//') || targetLoc.startsWith('/\\') || targetLoc.startsWith('\\')) {
    return false;
  }

  const permittedPattern = /^\/(learn-engine|login|my|admin|r\.php|index\.php)(\/|\?|$)/;

  // 2. Relative path
  if (targetLoc.startsWith('/')) {
    if (targetLoc.includes('..')) {
      return false;
    }
    const pathOnly = targetLoc.split('?')[0];
    return permittedPattern.test(pathOnly);
  }

  // 3. Absolute URL
  if (!targetLoc.startsWith('https://')) {
    return false; // Scheme downgrade or non-HTTPS rejected
  }

  try {
    const parsed = new URL(targetLoc);
    if (parsed.protocol !== 'https:') {
      return false;
    }
    if (parsed.username || parsed.password) {
      return false; // Userinfo rejected
    }
    if (parsed.hostname.toLowerCase() !== expectedDomain.toLowerCase()) {
      return false; // Strict hostname match required (no substring/subdomain bypass)
    }
    if (parsed.port && parsed.port !== '443') {
      return false; // Non-standard port rejected
    }
    if (parsed.pathname.includes('..')) {
      return false;
    }
    if (parsed.pathname === '/' || permittedPattern.test(parsed.pathname)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

describe('[SIMULATED] Moodle Healthcheck — Redirect-Aware URL Validation', () => {
  const stagingDomain = 'lms.staging.zealosh.com';

  it('should accept valid relative redirects to approved Moodle endpoints', () => {
    expect(validateRedirectLocation('/learn-engine/login/index.php', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('/learn-engine/', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('/login/index.php?test=1', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('/my/', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('/r.php?route=test', stagingDomain)).toBe(true);
  });

  it('should accept valid absolute HTTPS redirects to current staging environment domain', () => {
    expect(validateRedirectLocation('https://lms.staging.zealosh.com/learn-engine/', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('https://lms.staging.zealosh.com/learn-engine/login/index.php', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('https://lms.staging.zealosh.com/', stagingDomain)).toBe(true);
    expect(validateRedirectLocation('https://lms.staging.zealosh.com:443/learn-engine/', stagingDomain)).toBe(true);
  });

  it('should strictly reject redirects to production hostname when running on staging', () => {
    expect(validateRedirectLocation('https://lms.zealosh.com/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('https://lms.zealosh.com/login/index.php', stagingDomain)).toBe(false);
  });

  it('should strictly reject scheme downgrades to insecure HTTP', () => {
    expect(validateRedirectLocation('http://lms.staging.zealosh.com/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('http://lms.staging.zealosh.com/login/index.php', stagingDomain)).toBe(false);
  });

  it('should strictly reject external hostnames and domain suffix spoofing', () => {
    expect(validateRedirectLocation('https://evil.com/login', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('https://lms.staging.zealosh.com.evil.com/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('https://attacker.com/?target=lms.staging.zealosh.com', stagingDomain)).toBe(false);
  });

  it('should strictly reject userinfo authority spoofing', () => {
    expect(validateRedirectLocation('https://lms.staging.zealosh.com@attacker.com/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('https://admin:pass@lms.staging.zealosh.com/learn-engine/', stagingDomain)).toBe(false);
  });

  it('should strictly reject protocol-relative URLs and backslash bypasses', () => {
    expect(validateRedirectLocation('//attacker.com/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('/\\attacker.com/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('\\attacker.com', stagingDomain)).toBe(false);
  });

  it('should strictly reject directory traversal and malformed paths', () => {
    expect(validateRedirectLocation('/learn-engine/../secret.php', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('https://lms.staging.zealosh.com/learn-engine/../../etc/passwd', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('not_a_valid_url', stagingDomain)).toBe(false);
  });

  it('should strictly reject non-standard port numbers', () => {
    expect(validateRedirectLocation('https://lms.staging.zealosh.com:8080/learn-engine/', stagingDomain)).toBe(false);
    expect(validateRedirectLocation('https://lms.staging.zealosh.com:80/learn-engine/', stagingDomain)).toBe(false);
  });

  it('should execute bash validate_redirect_location routine with identical verdicts', () => {
    const gitBashPath = 'C:\\Program Files\\Git\\usr\\bin\\bash.exe';
    const scriptPath = path.resolve(__dirname, '../deploy/moodle/moodle-healthcheck.sh');

    // Run test cases against the actual bash function
    const testCases = [
      { loc: '/learn-engine/login/index.php', expected: true },
      { loc: 'https://lms.staging.zealosh.com/learn-engine/', expected: true },
      { loc: 'https://lms.zealosh.com/learn-engine/', expected: false }, // Production reject
      { loc: 'http://lms.staging.zealosh.com/learn-engine/', expected: false }, // HTTP downgrade reject
      { loc: 'https://evil.com/login', expected: false }, // External host reject
      { loc: 'https://lms.staging.zealosh.com.evil.com/learn-engine/', expected: false }, // Suffix trick reject
      { loc: '//evil.com/path', expected: false }, // Protocol relative reject
    ];

    for (const tc of testCases) {
      const bashCmd = `source "${scriptPath.replace(/\\/g, '/')}"; validate_redirect_location "${tc.loc}" "lms.staging.zealosh.com"`;
      try {
        execFileSync(gitBashPath, ['-c', bashCmd], { stdio: 'pipe' });
        expect(tc.expected).toBe(true);
      } catch (err: any) {
        expect(tc.expected).toBe(false);
      }
    }
  });
});
