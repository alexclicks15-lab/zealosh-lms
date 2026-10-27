import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { hashPassword } from '@/lib/auth/jwt';
import { User, UserRole } from '@/types';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { searchParams } = new URL(request.url);
    const role = (searchParams.get('role') as UserRole) || undefined;
    const search = searchParams.get('search') || undefined;

    const users = await db.getUsers({ role, search });
    const safeUsers = users.map(({ passwordHash, ...safe }) => safe);

    return NextResponse.json({ success: true, users: safeUsers });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const body = await request.json();
    const { user, password } = body;

    if (!user || !user.name || !user.email || !user.role) {
      return NextResponse.json(
        { success: false, error: 'User name, email, and role are required' },
        { status: 400 }
      );
    }

    const existing = user.id ? await db.getUser(user.id) : await db.getUserByEmail(user.email);
    const now = new Date().toISOString();

    const passwordHash = password ? hashPassword(password) : (existing?.passwordHash || hashPassword('Zealosh@2026'));

    const toSave: User = {
      id: user.id || existing?.id || `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: user.name,
      email: user.email.toLowerCase().trim(),
      passwordHash,
      role: user.role,
      organizationId: user.organizationId || existing?.organizationId || 'org-zealosh-main',
      avatarUrl: user.avatarUrl || existing?.avatarUrl || undefined,
      externalLearningId: user.externalLearningId || existing?.externalLearningId || undefined,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    const saved = await db.saveUser(toSave, authResult.actor.email);
    const { passwordHash: _, ...safeSaved } = saved;

    return NextResponse.json({ success: true, user: safeSaved });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
