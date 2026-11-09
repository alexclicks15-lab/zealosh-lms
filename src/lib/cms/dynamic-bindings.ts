// Zealosh LMS — Dynamic Academic Data Binding Engine
// Connects CMS Presentation Components directly to Authoritative PostgreSQL Records (Courses, Batches, Instructors)

import { db } from '@/lib/store/db';
import { Course, Batch } from '@/types';

export interface ResolvedCourseData {
  id: string;
  title: string;
  slug: string;
  headline: string;
  description: string;
  certificationType: string;
  deliveryModel: string;
  priceInr: number;
  durationWeeks: number;
  modulesCount: number;
  totalLessons: number;
  totalHours: number;
  learningObjectives: string[];
  prerequisites: string[];
  coverImage: string;
  leadInstructorId: string;
  leadInstructorName?: string;
  leadInstructorCredentials?: string;
  batches: Array<{
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    scheduleDescription: string;
    capacity: number;
    enrolledCount: number;
    seatsRemaining: number;
    status: string;
  }>;
}

/**
 * Resolves full authoritative course data including upcoming batches and instructor profile
 */
export async function resolveCourseData(courseSlugOrId: string): Promise<ResolvedCourseData | null> {
  if (!courseSlugOrId) return null;

  try {
    let course: Course | null | undefined = await db.getCourseBySlug(courseSlugOrId);
    if (!course) {
      course = await db.getCourseById(courseSlugOrId);
    }
    if (!course) return null;

    // Fetch live batches for course
    const allBatches: Batch[] = await db.getBatches();
    const courseBatches = allBatches
      .filter((b) => b.courseId === course!.id && (b.status === 'UPCOMING' || b.status === 'ACTIVE'))
      .map((b) => ({
        id: b.id,
        name: b.name,
        startDate: b.startDate,
        endDate: b.endDate,
        scheduleDescription: b.scheduleDescription,
        capacity: b.capacity,
        enrolledCount: b.enrolledCount,
        seatsRemaining: Math.max(0, b.capacity - b.enrolledCount),
        status: b.status,
      }));

    // Resolve Lead Instructor
    let instructorName = 'Vishnu Rajendran';
    let instructorCredentials = 'CSP, ASP, CRSP, CIT, NEBOSH IDip';

    if (course.leadInstructorId) {
      const instructorUser = await db.getUserById(course.leadInstructorId);
      if (instructorUser) {
        instructorName = instructorUser.name;
      }
    }

    return {
      id: course.id,
      title: course.title,
      slug: course.slug,
      headline: course.headline || '',
      description: course.description || '',
      certificationType: course.certificationType,
      deliveryModel: course.deliveryModel,
      priceInr: course.priceInr || 0,
      durationWeeks: course.durationWeeks || 8,
      modulesCount: course.modulesCount || 6,
      totalLessons: course.totalLessons || 24,
      totalHours: course.totalHours || 60,
      learningObjectives: course.learningObjectives || [],
      prerequisites: course.prerequisites || [],
      coverImage: course.coverImage || '/images/cover.jpg',
      leadInstructorId: course.leadInstructorId,
      leadInstructorName: instructorName,
      leadInstructorCredentials: instructorCredentials,
      batches: courseBatches,
    };
  } catch (error) {
    console.error(`[CMS Dynamic Bindings] Error resolving course ${courseSlugOrId}:`, error);
    return null;
  }
}

/**
 * Resolves list of accredited courses for catalog cards
 */
export async function resolveCourseList(limit: number = 6): Promise<Array<Partial<Course>>> {
  try {
    const courses = await db.getCourses();
    return (courses || []).slice(0, limit).map((c) => ({
      id: c.id,
      title: c.title,
      slug: c.slug,
      headline: c.headline,
      certificationType: c.certificationType,
      deliveryModel: c.deliveryModel,
      priceInr: c.priceInr,
      durationWeeks: c.durationWeeks,
      coverImage: c.coverImage,
    }));
  } catch (error) {
    console.error('[CMS Dynamic Bindings] Error resolving course list:', error);
    return [];
  }
}

