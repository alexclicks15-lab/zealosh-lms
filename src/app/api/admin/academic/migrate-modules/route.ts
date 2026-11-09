import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request) {
  try {
    let courseId: string | undefined;
    try {
      const body = await request.json();
      courseId = body.courseId;
    } catch {
      // Body is optional
    }

    const result = await db.migrateLegacyLessonModules(courseId);
    return NextResponse.json({
      success: true,
      ...result,
      message: `Migrated ${result.migratedCount} lessons and generated ${result.modulesCreated} relational modules.`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to migrate legacy lesson modules' }, { status: 500 });
  }
}

