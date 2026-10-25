import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  const course = Array.from(db.courses.values()).find((c) => c.slug === params.slug);

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const instructor = db.users.get(course.leadInstructorId);
  const batches = Array.from(db.batches.values()).filter((b) => b.courseId === course.id);
  const lessons = db.lessons.get(course.id) || [];

  return NextResponse.json({
    course: {
      ...course,
      leadInstructor: instructor ? { id: instructor.id, name: instructor.name, avatar: instructor.avatarUrl } : null,
      batches,
      lessons: lessons.map((l) => ({
        id: l.id,
        title: l.title,
        moduleTitle: l.moduleTitle,
        durationMinutes: l.durationMinutes,
        isFreePreview: l.isFreePreview,
        materialsCount: l.downloadableMaterials?.length || 0,
      })),
    },
  });
}
