import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function resolveAuthenticatedUserId(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = verifyToken(authHeader.substring(7));
    if (payload?.userId) return payload.userId;
  }
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/zealosh_token=([^;]+)/);
  if (match) {
    const payload = verifyToken(match[1]);
    if (payload?.userId) return payload.userId;
  }
  // Optional userId query parameter for testing / admin emulation
  const url = new URL(request.url);
  const testUserId = url.searchParams.get('userId');
  if (testUserId && process.env.NODE_ENV !== 'production') {
    return testUserId;
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const userId = resolveAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const profile = await db.getProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const studentProfile = await db.getStudentProfile(userId);
    const instructorProfile = await db.getInstructorProfile(userId);
    const roles = await db.getUserRoles(userId);

    return NextResponse.json({
      success: true,
      profile,
      studentProfile,
      instructorProfile,
      roles,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve user profile' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const userId = resolveAuthenticatedUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required' }, { status: 401 });
    }

    const profile = await db.getProfile(userId);
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const body = await request.json();

    if (body.fullName !== undefined) profile.fullName = String(body.fullName).trim();
    if (body.phone !== undefined) profile.phone = String(body.phone).trim();
    if (body.avatarUrl !== undefined) profile.avatarUrl = String(body.avatarUrl).trim();

    const updatedProfile = await db.saveProfile(profile, profile.email);

    let updatedStudentProfile;
    if (body.studentDetails) {
      let sp = await db.getStudentProfile(userId);
      if (!sp) {
        sp = {
          id: `sp-${userId}`,
          userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      const mergedSp = { ...sp, ...body.studentDetails, updatedAt: new Date().toISOString() };
      updatedStudentProfile = await db.saveStudentProfile(mergedSp);
    }

    let updatedInstructorProfile;
    if (body.instructorDetails) {
      let ip = await db.getInstructorProfile(userId);
      if (!ip) {
        ip = {
          id: `ip-${userId}`,
          userId,
          specializations: [],
          credentials: [],
          maxWeeklyHours: 25,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      }
      const mergedIp = { ...ip, ...body.instructorDetails, updatedAt: new Date().toISOString() };
      updatedInstructorProfile = await db.saveInstructorProfile(mergedIp);
    }

    return NextResponse.json({
      success: true,
      profile: updatedProfile,
      studentProfile: updatedStudentProfile,
      instructorProfile: updatedInstructorProfile,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update user profile' }, { status: 500 });
  }
}

