import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET() {
  const isDbReady = db.courses.size > 0 && db.users.size > 0;

  if (!isDbReady) {
    return NextResponse.json(
      { status: 'DEGRADED', reason: 'Database seed not initialized' },
      { status: 503 }
    );
  }

  return NextResponse.json({
    status: 'READY',
    timestamp: new Date().toISOString(),
    metrics: {
      usersCount: db.users.size,
      coursesCount: db.courses.size,
      batchesCount: db.batches.size,
      enrollmentsCount: db.enrollments.size,
      examQuestionsCount: db.examQuestions.size,
    },
  });
}
