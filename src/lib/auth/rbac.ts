// Zealosh LMS — Centralized Role-Based Access Control (RBAC) Authority
// Standards: Defense-in-depth, fail-closed server authorization, single-institution governance

import { NextResponse } from 'next/server';
import { UserRole } from '@/types';
import { verifyToken, TokenPayload } from './jwt';

export type CmsPermission =
  | 'cms:view_studio'
  | 'cms:create_page'
  | 'cms:edit_content'
  | 'cms:submit_review'
  | 'cms:publish'
  | 'cms:schedule'
  | 'cms:rollback'
  | 'cms:delete_page'
  | 'cms:manage_templates'
  | 'cms:manage_themes'
  | 'cms:manage_seo'
  | 'cms:audit_logs';

export type AppPermission =
  | CmsPermission
  | 'admin:workspace'
  | 'academic:manage'
  | 'academic:view'
  | 'exams:manage'
  | 'exams:evaluate'
  | 'certificates:issue'
  | 'certificates:revoke'
  | 'finance:manage'
  | 'support:manage';

/**
 * Authoritative role-to-permission mapping for Zealosh LMS
 */
export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: [
    '*', // Full system access
    'cms:view_studio',
    'cms:create_page',
    'cms:edit_content',
    'cms:submit_review',
    'cms:publish',
    'cms:schedule',
    'cms:rollback',
    'cms:delete_page',
    'cms:manage_templates',
    'cms:manage_themes',
    'cms:manage_seo',
    'cms:audit_logs',
    'admin:workspace',
    'academic:manage',
    'exams:manage',
    'certificates:issue',
    'certificates:revoke',
    'finance:manage',
    'support:manage',
  ],

  ADMIN: [
    'cms:view_studio',
    'cms:create_page',
    'cms:edit_content',
    'cms:submit_review',
    'cms:publish',
    'cms:schedule',
    'cms:rollback',
    'cms:delete_page',
    'cms:manage_templates',
    'cms:manage_seo',
    'cms:audit_logs',
    'admin:workspace',
    'academic:manage',
    'exams:manage',
    'certificates:issue',
    'certificates:revoke',
    'finance:manage',
    'support:manage',
  ],

  ORG_ADMIN: [
    // Institutional administrator alias
    'cms:view_studio',
    'cms:create_page',
    'cms:edit_content',
    'cms:submit_review',
    'cms:publish',
    'cms:schedule',
    'cms:rollback',
    'cms:delete_page',
    'cms:manage_templates',
    'cms:manage_seo',
    'cms:audit_logs',
    'admin:workspace',
    'academic:manage',
    'exams:manage',
    'certificates:issue',
    'certificates:revoke',
    'finance:manage',
    'support:manage',
  ],

  COURSE_MANAGER: [
    // Content and course authoring staff
    'cms:view_studio',
    'cms:create_page',
    'cms:edit_content',
    'cms:submit_review',
    'academic:manage',
    'exams:manage',
  ],

  INSTRUCTOR: [
    'academic:manage',
    'exams:evaluate',
  ],

  SUPPORT_STAFF: [
    'support:manage',
    'academic:view',
  ],

  STUDENT: [
    'academic:view',
  ],
};

export interface AuthSuccess {
  authorized: true;
  actor: TokenPayload;
  user: TokenPayload;
}

export interface AuthFailure {
  authorized: false;
  errorResponse: NextResponse;
  response: NextResponse;
}

export type AuthResult = AuthSuccess | AuthFailure;

/**
 * Evaluates whether a role holds a specific permission, resolving common aliases
 */
export function hasPermission(role: string, permission: string): boolean {
  if (!role) return false;
  const permissions = ROLE_PERMISSIONS[role] || [];
  if (permissions.includes('*')) return true;

  // Resolve common CMS permission aliases
  const normalized =
    permission === 'cms:create'
      ? 'cms:create_page'
      : permission === 'cms:edit'
      ? 'cms:edit_content'
      : permission === 'cms:delete'
      ? 'cms:delete_page'
      : permission === 'cms:view_drafts'
      ? 'cms:view_studio'
      : permission === 'cms:approve'
      ? 'cms:publish'
      : permission;

  return permissions.includes(normalized) || permissions.includes(permission);
}

/**
 * Returns all assigned permissions for a given role
 */
export function getRolePermissions(role: string): string[] {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Extracts and verifies authentication token from request
 */
export function extractAuthToken(request: Request): TokenPayload | null {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Server-side authorization guard enforcing a specific permission.
 * Returns verified actor payload or a 401/403 NextResponse.
 */
export function authorizePermission(
  request: Request,
  permission: AppPermission | string
): AuthResult {
  const actor = extractAuthToken(request);
  if (!actor || !actor.userId) {
    const errorResponse = NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    );
    return {
      authorized: false,
      errorResponse,
      response: errorResponse,
    };
  }

  if (!hasPermission(actor.role, permission)) {
    const errorMsg =
      permission === 'cms:publish'
        ? 'Forbidden: Insufficient publishing privileges'
        : `Forbidden: Insufficient privileges (Missing required permission "${permission}")`;

    const errorResponse = NextResponse.json(
      {
        success: false,
        error: errorMsg,
      },
      { status: 403 }
    );

    return {
      authorized: false,
      errorResponse,
      response: errorResponse,
    };
  }

  return {
    authorized: true,
    actor,
    user: actor,
  };
}

/**
 * Maps high-level CMS operations to granular permissions
 */
export function authorizeCmsOperation(
  request: Request,
  operation:
    | 'VIEW'
    | 'CREATE'
    | 'EDIT'
    | 'SUBMIT_REVIEW'
    | 'PUBLISH'
    | 'SCHEDULE'
    | 'ROLLBACK'
    | 'DELETE'
    | 'MANAGE_TEMPLATES'
    | 'MANAGE_THEMES'
    | 'MANAGE_SEO'
): AuthResult {
  const opMap: Record<string, CmsPermission> = {
    VIEW: 'cms:view_studio',
    CREATE: 'cms:create_page',
    EDIT: 'cms:edit_content',
    SUBMIT_REVIEW: 'cms:submit_review',
    PUBLISH: 'cms:publish',
    SCHEDULE: 'cms:schedule',
    ROLLBACK: 'cms:rollback',
    DELETE: 'cms:delete_page',
    MANAGE_TEMPLATES: 'cms:manage_templates',
    MANAGE_THEMES: 'cms:manage_themes',
    MANAGE_SEO: 'cms:manage_seo',
  };

  const permission = opMap[operation] || 'cms:view_studio';
  return authorizePermission(request, permission);
}
