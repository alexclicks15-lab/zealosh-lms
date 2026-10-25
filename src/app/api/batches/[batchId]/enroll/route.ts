import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function POST(
  request: Request,
  { params }: { params: { batchId: string } }
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
      return NextResponse.json({ error: 'Authentication required to enroll' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const batch = db.batches.get(params.batchId);
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    // Call transactional enrollment method with capacity lock
    const result = await db.enrollStudent({
      userId: payload.userId,
      courseId: batch.courseId,
      batchId: batch.id,
    });

    return NextResponse.json({
      success: true,
      message: `Enrolled successfully into batch "${batch.name}"`,
      enrollment: result.enrollment,
    });
  } catch (err: any) {
    const status = err.message.includes('BATCH_CAPACITY_EXCEEDED') ? 409 : 400;
    return NextResponse.json({ error: err.message }, { status });
  }
}
