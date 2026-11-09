import { permanentRedirect } from 'next/navigation';
import { db } from '@/lib/store/db';

interface LegacyCourseClassroomPageProps {
  params: { slug: string };
  searchParams?: { batchId?: string };
}

export default async function LegacyCourseClassroomPage({
  params,
  searchParams,
}: LegacyCourseClassroomPageProps) {
  const { slug } = params;
  const batchId = searchParams?.batchId;

  // Resolve slug to canonical course ID where available
  let canonicalCourseId = slug;
  try {
    const course = (await db.getCourseBySlug(slug)) || (await db.getCourseById(slug));
    if (course) {
      canonicalCourseId = course.id;
    }
  } catch {
    canonicalCourseId = slug;
  }

  const query = new URLSearchParams();
  query.set('courseId', canonicalCourseId);
  if (batchId) {
    query.set('batchId', batchId);
  }

  permanentRedirect(`/classroom?${query.toString()}`);
}
