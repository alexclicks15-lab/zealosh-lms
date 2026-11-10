// Zealosh LMS — Website Studio WS-01: Canonical RBAC & CMS Permissions Unit Test Suite
// Verifies fine-grained role capabilities, permission checking, and authorization barriers

import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  authorizePermission,
  authorizeCmsOperation,
  ROLE_PERMISSIONS,
} from '@/lib/auth/rbac';
import { signToken } from '@/lib/auth/jwt';

describe('Zealosh Website Studio — Canonical RBAC & Permissions Authority', () => {
  it('1. should verify SUPER_ADMIN and ADMIN have full CMS governance permissions', () => {
    const cmsPermissions = [
      'cms:view_drafts',
      'cms:create',
      'cms:edit',
      'cms:delete',
      'cms:publish',
      'cms:manage_templates',
      'cms:rollback',
      'cms:approve',
    ] as const;

    cmsPermissions.forEach((perm) => {
      expect(hasPermission('SUPER_ADMIN', perm)).toBe(true);
      expect(hasPermission('ADMIN', perm)).toBe(true);
    });
  });

  it('2. should verify COURSE_MANAGER has draft creation and editing rights, but cannot publish or delete', () => {
    expect(hasPermission('COURSE_MANAGER', 'cms:view_drafts')).toBe(true);
    expect(hasPermission('COURSE_MANAGER', 'cms:create')).toBe(true);
    expect(hasPermission('COURSE_MANAGER', 'cms:edit')).toBe(true);

    // Publishing and deletion require administrative privileges
    expect(hasPermission('COURSE_MANAGER', 'cms:publish')).toBe(false);
    expect(hasPermission('COURSE_MANAGER', 'cms:delete')).toBe(false);
    expect(hasPermission('COURSE_MANAGER', 'cms:manage_templates')).toBe(false);
  });

  it('3. should verify INSTRUCTOR and STUDENT cannot mutate CMS pages or publish', () => {
    expect(hasPermission('INSTRUCTOR', 'cms:edit')).toBe(false);
    expect(hasPermission('INSTRUCTOR', 'cms:publish')).toBe(false);
    expect(hasPermission('INSTRUCTOR', 'cms:manage_templates')).toBe(false);

    expect(hasPermission('STUDENT', 'cms:view_drafts')).toBe(false);
    expect(hasPermission('STUDENT', 'cms:create')).toBe(false);
    expect(hasPermission('STUDENT', 'cms:edit')).toBe(false);
    expect(hasPermission('STUDENT', 'cms:publish')).toBe(false);
    expect(hasPermission('STUDENT', 'cms:delete')).toBe(false);
    expect(hasPermission('STUDENT', 'cms:manage_templates')).toBe(false);
  });

  it('4. should correctly authorize request tokens for administrative actions', async () => {
    const adminToken = signToken({
      userId: 'usr-admin-01',
      email: 'admin@zealosh.com',
      role: 'SUPER_ADMIN',
      name: 'System Admin',
    });

    const adminReq = new Request('http://localhost:3000/api/cms/pages', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const authRes = await authorizePermission(adminReq, 'cms:create');
    expect(authRes.authorized).toBe(true);
    if (authRes.authorized) {
      expect(authRes.user.role).toBe('SUPER_ADMIN');
    }
  });

  it('5. should reject unauthorized requests with 401 or 403', async () => {
    // Unauthenticated
    const noAuthReq = new Request('http://localhost:3000/api/cms/pages');
    const noAuthRes = await authorizePermission(noAuthReq, 'cms:create');
    expect(noAuthRes.authorized).toBe(false);
    if (!noAuthRes.authorized) {
      expect(noAuthRes.response.status).toBe(401);
    }

    // Student attempting to create page
    const studentToken = signToken({
      userId: 'usr-student-01',
      email: 'student@zealosh.com',
      role: 'STUDENT',
      name: 'Student Learner',
    });

    const studentReq = new Request('http://localhost:3000/api/cms/pages', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const studentAuthRes = await authorizePermission(studentReq, 'cms:create');
    expect(studentAuthRes.authorized).toBe(false);
    if (!studentAuthRes.authorized) {
      expect(studentAuthRes.response.status).toBe(403);
    }
  });

  it('6. should correctly enforce authorizeCmsOperation across operations', async () => {
    const adminToken = signToken({
      userId: 'usr-admin-01',
      email: 'admin@zealosh.com',
      role: 'SUPER_ADMIN',
      name: 'Admin',
    });

    const adminReq = new Request('http://localhost:3000/api/cms/templates', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const templateAuth = await authorizeCmsOperation(adminReq, 'MANAGE_TEMPLATES');
    expect(templateAuth.authorized).toBe(true);

    const studentToken = signToken({
      userId: 'usr-std-01',
      email: 'student@zealosh.com',
      role: 'STUDENT',
      name: 'Student',
    });

    const studentReq = new Request('http://localhost:3000/api/cms/templates', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const studentTemplateAuth = await authorizeCmsOperation(studentReq, 'MANAGE_TEMPLATES');
    expect(studentTemplateAuth.authorized).toBe(false);
    if (!studentTemplateAuth.authorized) {
      expect(studentTemplateAuth.response.status).toBe(403);
    }
  });
});
