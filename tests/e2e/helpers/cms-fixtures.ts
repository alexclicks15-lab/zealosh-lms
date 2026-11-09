// Zealosh LMS — E2E Test Fixtures & Utilities
// Standards: Real Browser Execution, wj-page-builder compliance, deterministic test lifecycle

import { BrowserContext, APIRequestContext } from '@playwright/test';
import { signToken } from '@/lib/auth/jwt';
import { UserRole } from '@/types';

export const ADMIN_USER = {
  userId: 'usr-admin-01',
  email: 'admin@zealosh.com',
  role: 'SUPER_ADMIN' as UserRole,
  name: 'Super Administrator',
};

export const REVIEWER_USER = {
  userId: 'usr-admin-reviewer-02',
  email: 'reviewer@zealosh.com',
  role: 'SUPER_ADMIN' as UserRole,
  name: 'Independent Reviewer',
};

export const STUDENT_USER = {
  userId: 'usr-std-01',
  email: 'student@zealosh.com',
  role: 'STUDENT' as UserRole,
  name: 'Arjun Menon',
};

export const INSTRUCTOR_USER = {
  userId: 'usr-inst-01',
  email: 'vishnu@zealosh.com',
  role: 'INSTRUCTOR' as UserRole,
  name: 'Vishnu Rajendran, CSP, CRSP',
};

export const adminToken = signToken(ADMIN_USER);
export const reviewerToken = signToken(REVIEWER_USER);
export const studentToken = signToken(STUDENT_USER);
export const instructorToken = signToken(INSTRUCTOR_USER);

/**
 * Injects authenticated JWT session cookie into browser context using standard url
 */
export async function injectAuthCookie(context: BrowserContext, token: string = adminToken) {
  await context.addCookies([
    {
      name: 'zealosh_token',
      value: token,
      url: 'http://127.0.0.1:3022',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Creates an isolated synthetic CMS test page via API
 */
export async function createTestPage(
  request: APIRequestContext,
  options: {
    title: string;
    slug: string;
    pageType?: 'STANDARD' | 'COURSE_LANDING' | 'HOMEPAGE' | 'ADMISSIONS' | 'CAMPAIGN';
    token?: string;
  }
) {
  const res = await request.post('/api/cms/pages', {
    headers: { Authorization: `Bearer ${options.token || adminToken}` },
    data: {
      title: options.title,
      slug: options.slug,
      pageType: options.pageType || 'STANDARD',
    },
  });

  if (!res.ok()) {
    const text = await res.text();
    throw new Error(`Failed to create test page: ${res.status()} ${text}`);
  }

  const data = await res.json();
  return {
    page: data.page,
    version: data.version,
  };
}

/**
 * Cleans up a test-created page
 */
export async function deleteTestPage(request: APIRequestContext, pageId: string, token: string = adminToken) {
  try {
    await request.delete(`/api/cms/pages/${pageId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    // Ignore cleanup errors for non-existent pages
  }
}
