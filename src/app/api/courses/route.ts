import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const certFilter = searchParams.get('cert');
  const deliveryFilter = searchParams.get('delivery');

  let courses = Array.from(db.courses.values()).filter((c) => c.status === 'PUBLISHED');

  if (certFilter && certFilter !== 'ALL') {
    courses = courses.filter((c) => c.certificationType === certFilter);
  }

  if (deliveryFilter && deliveryFilter !== 'ALL') {
    courses = courses.filter((c) => c.deliveryModel === deliveryFilter);
  }

  // Include lead instructor summary
  const enriched = courses.map((course) => {
    const instructor = db.users.get(course.leadInstructorId);
    const batches = Array.from(db.batches.values()).filter((b) => b.courseId === course.id);
    return {
      ...course,
      leadInstructor: instructor ? { name: instructor.name, avatar: instructor.avatarUrl } : null,
      upcomingBatches: batches,
    };
  });

  return NextResponse.json({ courses: enriched });
}
