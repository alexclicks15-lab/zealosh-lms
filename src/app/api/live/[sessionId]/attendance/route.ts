import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { AttendanceRecord } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'INSTRUCTOR' && payload.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Instructor or Admin privileges required' }, { status: 403 });
    }

    const [attendanceList, users] = await Promise.all([
      db.getAttendance(params.sessionId),
      db.getUsers(),
    ]);

    const enriched = attendanceList.map((rec) => {
      const user = users.find((u) => u.id === rec.userId);
      return {
        ...rec,
        userName: user?.name || 'Unknown User',
        userEmail: user?.email || 'unknown@zealosh.com',
      };
    });

    return NextResponse.json({ success: true, attendance: enriched });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch attendance' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { sessionId: string } }
) {
  try {
    const authHeader = request.headers.get('authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    if (!token) {
      const cookieHeader = request.headers.get('cookie') || '';
      const match = cookieHeader.match(/zealosh_token=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload || (payload.role !== 'INSTRUCTOR' && payload.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden: Instructor or Admin privileges required' }, { status: 403 });
    }

    const body = await request.json();
    const { userId, attended, durationMinutes } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const record: AttendanceRecord = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sessionId: params.sessionId,
      userId,
      joinedAt: new Date().toISOString(),
      durationMinutes: durationMinutes || 120,
      attended: attended !== undefined ? attended : true,
    };

    const saved = await db.recordAttendance(record);
    return NextResponse.json({ success: true, record: saved });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to record attendance' }, { status: 500 });
  }
}
