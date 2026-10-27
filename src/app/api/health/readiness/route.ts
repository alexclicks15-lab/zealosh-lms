import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET() {
  const [courses, batches, users, enrollments, examQuestions] = await Promise.all([
    db.getCourses(),
    db.getBatches(),
    db.getUsers(),
    db.getEnrollments(),
    db.getExamQuestions(),
  ]);

  const isDbReady = courses.length > 0 && users.length > 0;

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
      usersCount: users.length,
      coursesCount: courses.length,
      batchesCount: batches.length,
      enrollmentsCount: enrollments.length,
      examQuestionsCount: examQuestions.length,
    },
  });
}
