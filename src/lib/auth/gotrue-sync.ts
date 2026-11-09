// Zealosh LMS — GoTrue Auth & Profile Synchronization Service
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { Profile, User, UserRole } from '@/types';
import { db } from '@/lib/store/db';
import { isSupabaseConfigured, getSupabaseAdminClient } from '@/lib/supabase';

export interface GoTrueSyncPayload {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface ProfileSyncResult {
  success: boolean;
  profile: Profile;
  user: User;
  isNewUser: boolean;
  assignedRole: UserRole;
  warnings?: string[];
}

/**
 * Validates that untrusted client metadata cannot assign elevated administrative
 * or instructor roles during user synchronization.
 */
export function sanitizeRequestedRole(requestedRole?: string): UserRole {
  if (!requestedRole) return 'STUDENT';
  const normalized = requestedRole.toUpperCase().trim();
  // Only STUDENT is self-assignable via public registration or metadata sync
  if (normalized === 'STUDENT') {
    return 'STUDENT';
  }
  // Any attempt to set INSTRUCTOR, ORG_ADMIN, SUPER_ADMIN via metadata defaults to STUDENT
  return 'STUDENT';
}

/**
 * Idempotently synchronizes a Supabase GoTrue Auth user to the authoritative
 * application profile and domain user store.
 */
export async function syncGoTrueUserToProfile(
  payload: GoTrueSyncPayload,
  explicitRole?: UserRole
): Promise<ProfileSyncResult> {
  const { id, email, user_metadata = {} } = payload;
  const warnings: string[] = [];

  if (!id || !email) {
    throw new Error('GoTrue user synchronization requires valid user ID and email');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rawMetaRole = user_metadata.role || user_metadata.user_role;
  const metaName = user_metadata.name || user_metadata.full_name;

  if (rawMetaRole && rawMetaRole.toUpperCase() !== 'STUDENT' && !explicitRole) {
    warnings.push(
      `Untrusted metadata role '${rawMetaRole}' was rejected and defaulted to 'STUDENT' for user ${id}.`
    );
  }

  const effectiveRole: UserRole = explicitRole || sanitizeRequestedRole(rawMetaRole);

  const fullName =
    typeof metaName === 'string' && metaName.trim().length > 0
      ? metaName.trim()
      : normalizedEmail.split('@')[0];

  const now = new Date().toISOString();

  // Check if profile already exists
  let existingProfile = await db.getProfile(id);
  if (!existingProfile) {
    existingProfile = await db.getProfile(normalizedEmail);
  }

  // Check if domain user exists
  let existingUser = await db.getUser(id);
  if (!existingUser) {
    existingUser = await db.getUserByEmail(normalizedEmail);
  }

  const isNew = !existingProfile && !existingUser;

  // Preserve existing established roles if already set in the database
  const finalRole: UserRole = existingUser?.role || existingProfile?.role || effectiveRole;

  const profile: Profile = {
    id,
    email: normalizedEmail,
    fullName: existingProfile?.fullName || fullName,
    phone: user_metadata.phone || existingProfile?.phone,
    avatarUrl: user_metadata.avatar_url || existingProfile?.avatarUrl,
    status: existingProfile?.status || 'ACTIVE',
    failedLoginCount: existingProfile?.failedLoginCount ?? 0,
    lockedUntil: existingProfile?.lockedUntil,
    mfaEnabled: Boolean(existingProfile?.mfaEnabled || user_metadata.mfa_enabled),
    role: finalRole,
    createdAt: existingProfile?.createdAt || payload.created_at || now,
    updatedAt: now,
  };

  const domainUser: User = {
    id,
    name: profile.fullName,
    email: profile.email,
    passwordHash: existingUser?.passwordHash || '',
    role: finalRole,
    organizationId: existingUser?.organizationId || 'org-zealosh-main',
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt,
    updatedAt: now,
  };

  // Persist to database store
  await db.saveProfile(profile);
  await db.saveUser(domainUser);

  // If in Supabase mode and admin client available, ensure public.profiles row is saved
  if (isSupabaseConfigured() && process.env.DATABASE_STORAGE === 'supabase') {
    const admin = getSupabaseAdminClient();
    if (admin) {
      await admin.from('profiles').upsert({
        id,
        email: normalizedEmail,
        full_name: profile.fullName,
        phone: profile.phone || null,
        avatar_url: profile.avatarUrl || null,
        status: profile.status,
        failed_login_count: profile.failedLoginCount,
        locked_until: profile.lockedUntil || null,
        mfa_enabled: profile.mfaEnabled,
        updated_at: now,
      });

      await admin.from('user_roles').upsert({
        id: `role-${id}-${finalRole.toLowerCase()}`,
        user_id: id,
        role: finalRole,
        is_primary: true,
        assigned_at: now,
        assigned_by: 'system-gotrue-sync',
      });
    }
  }

  return {
    success: true,
    profile,
    user: domainUser,
    isNewUser: isNew,
    assignedRole: finalRole,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

