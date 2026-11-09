// Zealosh LMS — Phase 5B User Email Notification Preferences API
// GET /api/users/preferences/email — Reads authenticated user's notification preferences
// PATCH /api/users/preferences/email — Updates preferences (SECURITY category immutable)

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function extractUserToken(request: Request) {
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

export async function GET(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const preferences = await db.getUserNotificationPreferences(payload.userId);
    const emailPrefs = preferences.filter((p) => p.channel === 'EMAIL');

    return NextResponse.json({
      success: true,
      preferences: emailPrefs,
    });
  } catch (err: any) {
    console.error('[UserEmailPreferences] GET error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { category, isEnabled } = body;

    if (!category || typeof isEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'category and boolean isEnabled are required' },
        { status: 400 }
      );
    }

    const upperCategory = String(category).toUpperCase();

    // Security notifications cannot be disabled by policy
    if (upperCategory === 'SECURITY') {
      return NextResponse.json(
        { error: 'Security and verification notifications cannot be disabled' },
        { status: 400 }
      );
    }

    const updated = await db.updateUserNotificationPreference(
      payload.userId,
      upperCategory,
      'EMAIL',
      isEnabled
    );

    return NextResponse.json({
      success: true,
      preference: updated,
    });
  } catch (err: any) {
    console.error('[UserEmailPreferences] PATCH error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
