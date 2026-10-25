import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function PUT(
  request: Request,
  { params }: { params: { examId: string } }
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
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const { attemptId, answers, bookmarks } = await request.json();

    if (!attemptId) {
      return NextResponse.json({ error: 'Attempt ID is required' }, { status: 400 });
    }

    // Persist answers with server deadline enforcement
    const updated = db.saveExamAnswers(attemptId, payload.userId, answers || {}, bookmarks);

    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString(),
      answeredCount: Object.keys(updated.answers).length,
    });
  } catch (err: any) {
    const isExpired = err.message.includes('EXAM_DEADLINE_EXPIRED');
    return NextResponse.json({ error: err.message }, { status: isExpired ? 408 : 400 });
  }
}
