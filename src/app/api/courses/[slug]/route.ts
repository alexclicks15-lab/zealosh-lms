import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  let course = await db.getCourseBySlug(params.slug);
  if (!course) {
    course = await db.getCourseById(params.slug);
  }

  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  const [instructor, allBatches, lessons] = await Promise.all([
    course.leadInstructorId ? db.getUser(course.leadInstructorId) : Promise.resolve(null),
    db.getBatches(),
    db.getLessons(course.id),
  ]);

  const batches = allBatches.filter((b) => b.courseId === course.id);

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
