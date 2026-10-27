import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const certFilter = searchParams.get('cert');
  const deliveryFilter = searchParams.get('delivery');

  const allCourses = await db.getCourses();
  let courses = allCourses.filter((c) => c.status === 'PUBLISHED');

  if (certFilter && certFilter !== 'ALL') {
    courses = courses.filter((c) => c.certificationType === certFilter);
  }

  if (deliveryFilter && deliveryFilter !== 'ALL') {
    courses = courses.filter((c) => c.deliveryModel === deliveryFilter);
  }

  const allBatches = await db.getBatches();

  // Include lead instructor summary
  const enriched = await Promise.all(
    courses.map(async (course) => {
      const instructor = course.leadInstructorId ? await db.getUser(course.leadInstructorId) : null;
      const batches = allBatches.filter((b) => b.courseId === course.id);
      return {
        ...course,
        leadInstructor: instructor ? { name: instructor.name, avatar: instructor.avatarUrl } : null,
        upcomingBatches: batches,
      };
    })
  );

  return NextResponse.json({ courses: enriched });
}
