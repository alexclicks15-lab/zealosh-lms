// Zealosh LMS — Unified Classroom Hub API Route
// GET  /api/classroom — Full cohort context, classwork, stream, people, calendar, materials & to-do
// POST /api/classroom — Server-enforced classroom actions (announcements, comments, assignments, grading, materials, doubts)

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { DatabasePersistenceError } from '@/lib/store/db-errors';
import { verifyToken } from '@/lib/auth/jwt';
import { Course, Batch, ClassroomAnnouncement, AssignmentSubmission, RubricScore } from '@/types';

function extractUserToken(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token) return null;
  return verifyToken(token);
}

function resolveEffectiveDeliveryMode(course: Course, batch?: Batch | null): 'LIVE' | 'RECORDED' | 'HYBRID' {
  if (batch?.mode && (batch.mode === 'LIVE' || batch.mode === 'RECORDED' || batch.mode === 'HYBRID')) {
    return batch.mode;
  }
  if (course.deliveryModel === 'LIVE' || course.deliveryModel === 'RECORDED' || course.deliveryModel === 'HYBRID') {
    return course.deliveryModel;
  }
  return 'HYBRID';
}

export async function GET(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedCourseId = searchParams.get('courseId') || undefined;
    const requestedBatchId = searchParams.get('batchId') || undefined;

    const user = await db.getUser(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User record not found' }, { status: 401 });
    }

    const courses = await db.getCourses();
    const batches = await db.getBatches();

    interface ClassroomCohort {
      courseId: string;
      courseSlug: string;
      courseTitle: string;
      batchId: string;
      batchName: string;
      deliveryModel: string;
      status: string;
      enrollmentId?: string;
    }

    let availableCohorts: ClassroomCohort[] = [];

    if (user.role === 'STUDENT') {
      const enrollments = await db.getEnrollments(user.id);
      const activeEnrollments = enrollments.filter((e) => e.status === 'ACTIVE');

      for (const enr of activeEnrollments) {
        const course = courses.find((c) => c.id === enr.courseId);
        const batch = batches.find((b) => b.id === enr.batchId);
        if (course) {
          availableCohorts.push({
            courseId: course.id,
            courseSlug: course.slug,
            courseTitle: course.title,
            batchId: batch?.id || enr.batchId || 'default-batch',
            batchName: batch?.name || 'Standard Cohort',
            deliveryModel: course.deliveryModel,
            status: enr.status,
            enrollmentId: enr.id,
          });
        }
      }
    } else if (user.role === 'INSTRUCTOR') {
      for (const course of courses) {
        const isLead = course.leadInstructorId === user.id;
        const isCo = course.coInstructorIds?.includes(user.id);
        const courseBatches = batches.filter((b) => b.courseId === course.id);

        for (const batch of courseBatches) {
          const isBatchLead = batch.leadInstructorId === user.id;
          if (isLead || isCo || isBatchLead) {
            availableCohorts.push({
              courseId: course.id,
              courseSlug: course.slug,
              courseTitle: course.title,
              batchId: batch.id,
              batchName: batch.name,
              deliveryModel: course.deliveryModel,
              status: batch.status,
            });
          }
        }
      }
    } else {
      // Admins see all active course batches
      for (const course of courses) {
        const courseBatches = batches.filter((b) => b.courseId === course.id);
        for (const batch of courseBatches) {
          availableCohorts.push({
            courseId: course.id,
            courseSlug: course.slug,
            courseTitle: course.title,
            batchId: batch.id,
            batchName: batch.name,
            deliveryModel: course.deliveryModel,
            status: batch.status,
          });
        }
      }
    }

    if (availableCohorts.length === 0 && courses.length > 0) {
      const firstCourse = courses[0];
      const firstBatch = batches.find((b) => b.courseId === firstCourse.id) || batches[0];
      availableCohorts.push({
        courseId: firstCourse.id,
        courseSlug: firstCourse.slug,
        courseTitle: firstCourse.title,
        batchId: firstBatch?.id || 'btc-asp-nov26',
        batchName: firstBatch?.name || 'Cohort A (Nov 2026)',
        deliveryModel: firstCourse.deliveryModel,
        status: 'ACTIVE',
      });
    }

    // Determine selected cohort
    let selectedCohort = availableCohorts[0];
    if (requestedCourseId) {
      const match = availableCohorts.find((c) => c.courseId === requestedCourseId || c.courseSlug === requestedCourseId);
      if (match) selectedCohort = match;
    }
    if (requestedBatchId) {
      const match = availableCohorts.find((c) => c.batchId === requestedBatchId);
      if (match) selectedCohort = match;
    }

    // Load active course & batch data
    const activeCourse = courses.find((c) => c.id === selectedCohort.courseId) || courses[0];
    const activeBatch = batches.find((b) => b.id === selectedCohort.batchId) || null;
    const effectiveDeliveryMode = resolveEffectiveDeliveryMode(activeCourse, activeBatch);

    // Fetch assignments for this course/batch
    const allAssignments = await db.getAssignments();
    const courseAssignments = allAssignments.filter(
      (a) => a.courseId === activeCourse.id && (!a.batchId || a.batchId === selectedCohort.batchId)
    );

    // Fetch student submissions
    const isStaff = user.role === 'INSTRUCTOR' || user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';
    let submissions: any[] = [];
    if (user.role === 'STUDENT') {
      submissions = await db.getSubmissions(undefined, user.id);
    } else {
      submissions = await db.getSubmissions();
    }

    const assignmentsWithSubmissions = courseAssignments.map((asg) => {
      const matchingSubmissions = submissions.filter((s) => s.assignmentId === asg.id);
      const studentSub = submissions.find(
        (s) => s.assignmentId === asg.id && (user.role === 'STUDENT' ? s.studentId === user.id : true)
      );
      return {
        ...asg,
        submission: studentSub || null,
        totalSubmissions: matchingSubmissions.length,
        gradedSubmissions: matchingSubmissions.filter((s) => s.status === 'GRADED').length,
        pendingSubmissions: matchingSubmissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'RESUBMISSION_REQUESTED').length,
      };
    });

    // Fetch live sessions
    const allSessions = await db.getAllLiveSessions();
    const liveSessions = allSessions
      .filter((s) => s.courseId === activeCourse.id && s.batchId === selectedCohort.batchId)
      .sort((a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime());

    // Fetch announcements with comments
    const allAnnouncements = await db.getAnnouncements(activeCourse.id, selectedCohort.batchId);

    // Fetch learning materials & preloaded session material packs with release condition filtering
    const allMaterials = await db.getLearningMaterials(activeCourse.id, selectedCohort.batchId);
    const nowMs = Date.now();

    const materials = allMaterials
      .filter((m) => {
        if (isStaff) return true;
        if (m.status === 'ARCHIVED' || m.status === 'DRAFT') return false;
        if (m.isReleased) return true;
        if (!m.releaseCondition || m.releaseCondition === 'PRE_CLASS') return true;
        if (m.releaseCondition === 'SCHEDULED' && m.scheduledReleaseTime) {
          return new Date(m.scheduledReleaseTime).getTime() <= nowMs;
        }
        if (m.sessionId) {
          const linkedSession = liveSessions.find((s) => s.id === m.sessionId);
          if (!linkedSession) return false;
          if (m.releaseCondition === 'CLASS_START') {
            return linkedSession.status === 'LIVE' || linkedSession.status === 'ENDED' || (linkedSession.status as any) === 'COMPLETED';
          }
          if (m.releaseCondition === 'ELAPSED_TIME') {
            const startTime = new Date(linkedSession.scheduledStartTime).getTime();
            const offsetMs = (m.releaseOffsetMinutes || 0) * 60 * 1000;
            return nowMs >= startTime + offsetMs;
          }
        }
        return false;
      })
      .map((m) => ({
        id: m.id,
        courseId: m.courseId,
        batchId: m.batchId,
        sessionId: m.sessionId,
        title: m.title,
        description: m.description,
        materialType: m.materialType,
        fileUrl: m.fileUrl || m.storagePath,
        fileSizeBytes: m.fileSizeBytes,
        allowDownload: m.allowDownload ?? true,
        allowView: m.allowView ?? true,
        status: m.status || 'PUBLISHED',
        releaseCondition: m.releaseCondition || 'PRE_CLASS',
        releaseOffsetMinutes: m.releaseOffsetMinutes,
        scheduledReleaseTime: m.scheduledReleaseTime,
        isReleased: m.isReleased ?? true,
        createdAt: m.createdAt,
      }));

    // Fetch quizzes
    const rawQuizzes = await db.getQuizzes(activeCourse.id, selectedCohort.batchId);
    const quizzes = rawQuizzes.map((q) => ({
      id: q.id,
      courseId: q.courseId,
      batchId: q.batchId,
      title: q.title,
      description: q.description,
      quizType: q.quizType,
      durationMinutes: q.durationMinutes,
      totalQuestions: q.questionsCount || 5,
      passingScorePercent: q.passingScorePercent || 70,
      status: q.status || 'PUBLISHED',
      createdAt: q.createdAt,
    }));

    // Fetch People (Teachers & Classmates)
    const instructorMap = new Map<string, { id: string; name: string; email: string; role: string; isLead: boolean }>();

    if (activeBatch?.leadInstructorId) {
      const lead = await db.getUser(activeBatch.leadInstructorId);
      if (lead) instructorMap.set(lead.id, { id: lead.id, name: lead.name, email: lead.email, role: lead.role, isLead: true });
    }
    if (activeCourse.leadInstructorId && !instructorMap.has(activeCourse.leadInstructorId)) {
      const cLead = await db.getUser(activeCourse.leadInstructorId);
      if (cLead) instructorMap.set(cLead.id, { id: cLead.id, name: cLead.name, email: cLead.email, role: cLead.role, isLead: !activeBatch?.leadInstructorId });
    }
    if (activeCourse.coInstructorIds) {
      for (const coId of activeCourse.coInstructorIds) {
        if (!instructorMap.has(coId)) {
          const co = await db.getUser(coId);
          if (co) instructorMap.set(co.id, { id: co.id, name: co.name, email: co.email, role: co.role, isLead: false });
        }
      }
    }

    const batchEnrollments = await db.getEnrollments(undefined, activeBatch?.id || selectedCohort.batchId);
    const studentsList: { id: string; name: string; email: string; status: string; progressPercent: number; enrolledAt: string }[] = [];

    for (const enr of batchEnrollments) {
      if (enr.status === 'ACTIVE' || enr.status === 'COMPLETED') {
        const stdUser = await db.getUser(enr.userId);
        if (stdUser) {
          studentsList.push({
            id: stdUser.id,
            name: stdUser.name,
            email: stdUser.email,
            status: enr.status,
            progressPercent: enr.progressPercent || 0,
            enrolledAt: enr.enrolledAt,
          });
        }
      }
    }

    const people = {
      teachers: Array.from(instructorMap.values()),
      students: studentsList,
    };

    // Construct Academic Calendar Events
    const calendarEvents: {
      id: string;
      title: string;
      type: 'LIVE_CLASS' | 'ASSIGNMENT_DUE' | 'QUIZ' | 'MATERIAL_RELEASE';
      start: string;
      durationMinutes?: number;
      status?: string;
      linkUrl: string;
    }[] = [];

    for (const s of liveSessions) {
      calendarEvents.push({
        id: `cal-live-${s.id}`,
        title: s.title,
        type: 'LIVE_CLASS',
        start: s.scheduledStartTime,
        durationMinutes: s.durationMinutes,
        status: s.status,
        linkUrl: `/live/${s.id}`,
      });
    }

    for (const asg of courseAssignments) {
      if (asg.dueDate) {
        calendarEvents.push({
          id: `cal-asg-${asg.id}`,
          title: `Assignment Due: ${asg.title}`,
          type: 'ASSIGNMENT_DUE',
          start: asg.dueDate,
          status: asg.status,
          linkUrl: `/classroom?courseId=${activeCourse.id}&tab=classwork`,
        });
      }
    }

    for (const q of quizzes) {
      if (q.createdAt) {
        calendarEvents.push({
          id: `cal-quiz-${q.id}`,
          title: `Quiz: ${q.title}`,
          type: 'QUIZ',
          start: q.createdAt,
          durationMinutes: q.durationMinutes,
          status: q.status,
          linkUrl: `/quizzes/${q.id}`,
        });
      }
    }

    // Construct To-Do (Student) / To-Review (Instructor) Tasks
    const todoTasks = {
      upcoming: [] as any[],
      overdue: [] as any[],
      completed: [] as any[],
      needsGrading: [] as any[],
      unansweredDoubts: [] as any[],
    };

    if (user.role === 'STUDENT') {
      const studentSubMap = new Map(submissions.map((s) => [s.assignmentId, s]));
      for (const asg of courseAssignments) {
        const sub = studentSubMap.get(asg.id);
        const dueTime = new Date(asg.dueDate).getTime();
        const isPastDue = dueTime < nowMs;

        if (!sub) {
          if (isPastDue) {
            todoTasks.overdue.push({
              id: asg.id,
              title: asg.title,
              type: 'ASSIGNMENT',
              dueDate: asg.dueDate,
              maxScore: asg.maxScore,
            });
          } else {
            todoTasks.upcoming.push({
              id: asg.id,
              title: asg.title,
              type: 'ASSIGNMENT',
              dueDate: asg.dueDate,
              maxScore: asg.maxScore,
            });
          }
        } else {
          todoTasks.completed.push({
            id: asg.id,
            title: asg.title,
            type: 'ASSIGNMENT',
            submittedAt: sub.submittedAt,
            status: sub.status,
            score: sub.score,
            feedback: sub.feedback,
          });
        }
      }
    } else {
      // Instructor To-Review
      for (const sub of submissions) {
        if (sub.status === 'SUBMITTED' || sub.status === 'RESUBMISSION_REQUESTED') {
          const asg = courseAssignments.find((a) => a.id === sub.assignmentId);
          todoTasks.needsGrading.push({
            id: sub.id,
            assignmentId: sub.assignmentId,
            assignmentTitle: asg?.title || 'Coursework Assignment',
            studentId: sub.studentId,
            studentName: sub.studentName || 'Candidate',
            submittedAt: sub.submittedAt,
            status: sub.status,
          });
        }
      }
    }

    // Fetch Doubts / Academic Discussion
    const allDoubts = await db.getDoubts();
    const courseDoubts = allDoubts.filter((d) => {
      const matchesCourse = (d as any).courseId === activeCourse.id || !(d as any).courseId;
      if (!matchesCourse) return false;
      if (isStaff) return true;
      return d.userId === user.id || d.isPublic;
    });

    if (isStaff) {
      for (const d of courseDoubts) {
        if (d.status === 'OPEN' || !d.status) {
          todoTasks.unansweredDoubts.push({
            id: d.id,
            question: d.question,
            askedBy: d.userName || 'Student',
            createdAt: d.createdAt,
          });
        }
      }
    }

    // Compile Curriculum & Learning Engine Modules
    const rawModules = await db.getModules(activeCourse.id);
    const rawLessons = await db.getLessons(activeCourse.id);
    const studentProgress = user.role === 'STUDENT'
      ? await db.getLearningProgress(user.id, activeCourse.id, activeBatch?.id)
      : [];
    const activeStudentEnrollment = user.role === 'STUDENT'
      ? (await db.getEnrollments(user.id)).find((e) => e.courseId === activeCourse.id && e.status === 'ACTIVE')
      : null;
    const completedLessonIds = activeStudentEnrollment?.completedLessonIds || [];

    const compiledModules = await Promise.all(
      rawModules.map(async (mod) => {
        const topics = await db.getTopics(mod.id);
        const moduleLessons = rawLessons.filter((l) => l.moduleId === mod.id);
        return {
          id: mod.id,
          title: mod.title,
          description: mod.description,
          orderIndex: mod.orderIndex,
          topics,
          lessons: moduleLessons.map((l) => {
            const isCompleted = completedLessonIds.includes(l.id);
            const prog = studentProgress.find((p) => p.lessonId === l.id);
            return {
              id: l.id,
              title: l.title,
              description: (l as any).description || l.contentHtml || '',
              duration: l.durationMinutes ? `${l.durationMinutes} mins` : ((l as any).duration || '20 mins'),
              durationMinutes: l.durationMinutes || 20,
              videoUrl: l.videoUrl,
              activityType: (l as any).activityType || 'VIDEO',
              isCompleted,
              playbackPositionSeconds: prog?.lastPlaybackPositionSeconds || 0,
              completionPercentage: prog?.completionPercentage || (isCompleted ? 100 : 0),
            };
          }),
        };
      })
    );

    let finalModules = compiledModules;
    if (finalModules.length === 0 && rawLessons.length > 0) {
      finalModules = [
        {
          id: `mod-${activeCourse.id}-core`,
          title: 'Core Curriculum & Technical HSE Blueprint',
          description: 'Official domain lessons, engineering formulas, and practical standards',
          orderIndex: 1,
          topics: [],
          lessons: rawLessons.map((l) => {
            const isCompleted = completedLessonIds.includes(l.id);
            const prog = studentProgress.find((p) => p.lessonId === l.id);
            return {
              id: l.id,
              title: l.title,
              description: (l as any).description || l.contentHtml || '',
              duration: l.durationMinutes ? `${l.durationMinutes} mins` : ((l as any).duration || '20 mins'),
              durationMinutes: l.durationMinutes || 20,
              videoUrl: l.videoUrl,
              activityType: (l as any).activityType || 'VIDEO',
              isCompleted,
              playbackPositionSeconds: prog?.lastPlaybackPositionSeconds || 0,
              completionPercentage: prog?.completionPercentage || (isCompleted ? 100 : 0),
            };
          }),
        },
      ];
    }

    // In-App Direct & Cohort Messages
    const cohortMessages = await db.getDirectMessages(user.id, activeCourse.id, activeBatch?.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      availableCohorts,
      selectedCohort,
      effectiveDeliveryMode,
      course: {
        id: activeCourse.id,
        title: activeCourse.title,
        slug: activeCourse.slug,
        headline: activeCourse.headline,
        description: activeCourse.description,
        modules: finalModules,
        deliveryModel: activeCourse.deliveryModel,
        leadInstructorId: activeCourse.leadInstructorId,
        progressPercent: activeStudentEnrollment?.progressPercent || 0,
        completedLessonIds,
      },
      batch: activeBatch,
      announcements: allAnnouncements,
      assignments: assignmentsWithSubmissions,
      liveSessions,
      materials,
      quizzes,
      people,
      calendarEvents,
      todoTasks,
      doubts: courseDoubts,
      messages: cohortMessages,
      submissions: isStaff ? submissions : undefined,
    });
  } catch (err: any) {
    if (err instanceof DatabasePersistenceError) {
      if (err.category === 'SCHEMA_MISSING') {
        return NextResponse.json(
          { error: err.message, code: 'DATABASE_SCHEMA_ERROR', category: err.category },
          { status: 503 }
        );
      }
      if (err.category === 'DATABASE_UNAVAILABLE') {
        return NextResponse.json(
          { error: err.message, code: 'DATABASE_UNAVAILABLE', category: err.category },
          { status: 503 }
        );
      }
      if (err.category === 'PERMISSION_DENIED') {
        return NextResponse.json(
          { error: err.message, code: 'PERMISSION_DENIED', category: err.category },
          { status: 403 }
        );
      }
    }
    return NextResponse.json(
      { error: err.message || 'Failed to load classroom data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const user = await db.getUser(payload.userId);
    if (!user) {
      return NextResponse.json({ error: 'User record not found' }, { status: 401 });
    }

    const body = await request.json();
    const { action } = body;
    const isStaff = user.role === 'INSTRUCTOR' || user.role === 'SUPER_ADMIN' || user.role === 'ORG_ADMIN';

    // 1. Post Class Announcement
    if (action === 'create_announcement') {
      if (!isStaff) {
        return NextResponse.json({ error: 'Instructor privileges required to post announcements' }, { status: 403 });
      }
      const { courseId, batchId, title, content, isPinned, attachments, audienceScope } = body;
      if (!courseId || !title || !content) {
        return NextResponse.json({ error: 'Missing title, content, or courseId' }, { status: 400 });
      }

      const announcement: ClassroomAnnouncement = {
        id: `anc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        courseId,
        batchId: batchId || undefined,
        audienceScope: audienceScope || (batchId ? 'BATCH_SPECIFIC' : 'COURSE_WIDE'),
        status: 'PUBLISHED',
        title,
        content,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        isPinned: Boolean(isPinned),
        attachments: attachments || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await db.saveAnnouncement(announcement, user.email);
      return NextResponse.json({ success: true, announcement: saved });
    }

    // 2. Add Announcement Comment
    if (action === 'add_comment') {
      const { announcementId, content } = body;
      if (!announcementId || !content) {
        return NextResponse.json({ error: 'Missing announcementId or content' }, { status: 400 });
      }

      const comment = await db.addAnnouncementComment(announcementId, {
        announcementId,
        authorId: user.id,
        authorName: user.name,
        authorRole: user.role,
        content,
      });

      return NextResponse.json({ success: true, comment });
    }

    // 3. Create Coursework Assignment
    if (action === 'create_assignment') {
      if (!isStaff) {
        return NextResponse.json({ error: 'Instructor privileges required to create assignments' }, { status: 403 });
      }
      const { courseId, batchId, title, description, dueDate, maxScore, rubric } = body;
      if (!courseId || !title || !dueDate) {
        return NextResponse.json({ error: 'Missing required assignment fields' }, { status: 400 });
      }

      const newAssignment = await db.saveAssignment({
        id: `asg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        courseId,
        batchId: batchId || undefined,
        title,
        description: description || '',
        dueDate,
        maxScore: Number(maxScore) || 100,
        rubric: rubric || undefined,
        status: 'PUBLISHED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }, user.email);

      return NextResponse.json({ success: true, assignment: newAssignment });
    }

    // 4. Submit Assignment Work
    if (action === 'submit_assignment') {
      const { assignmentId, submissionText, attachmentUrl, attachmentFilename } = body;
      if (!assignmentId) {
        return NextResponse.json({ error: 'assignmentId is required' }, { status: 400 });
      }

      const assignment = await db.getAssignmentById(assignmentId);
      if (!assignment) {
        return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
      }

      const submission: AssignmentSubmission = {
        id: `sub-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        assignmentId,
        courseId: assignment.courseId,
        batchId: assignment.batchId,
        userId: user.id,
        studentName: user.name,
        studentEmail: user.email,
        submissionText: submissionText || '',
        attachmentUrl: attachmentUrl || undefined,
        attachmentFilename: attachmentFilename || undefined,
        submittedAt: new Date().toISOString(),
        status: 'SUBMITTED',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const saved = await db.submitAssignment(submission, user.email);
      return NextResponse.json({ success: true, submission: saved });
    }

    // 5. Grade Assignment Submission
    if (action === 'grade_submission' || action === 'request_resubmission') {
      if (!isStaff) {
        return NextResponse.json({ error: 'Instructor privileges required to grade submissions' }, { status: 403 });
      }
      const { submissionId, score, feedback, rubricScores, status: requestedStatus, resubmissionNote } = body;
      if (!submissionId) {
        return NextResponse.json({ error: 'submissionId is required' }, { status: 400 });
      }

      const finalStatus =
        action === 'request_resubmission' || requestedStatus === 'RESUBMISSION_REQUESTED'
          ? 'RESUBMISSION_REQUESTED'
          : 'GRADED';

      const graded = await db.gradeSubmission(submissionId, {
        score: score !== undefined ? Number(score) : undefined,
        feedback: feedback || resubmissionNote || '',
        rubricScores: rubricScores as RubricScore[],
        status: finalStatus,
        gradedBy: user.id,
        actorEmail: user.email,
      });

      return NextResponse.json({ success: true, submission: graded });
    }

    // 6. Preload or Create Session Material
    if (action === 'create_material') {
      if (!isStaff) {
        return NextResponse.json({ error: 'Instructor privileges required' }, { status: 403 });
      }
      const {
        courseId,
        batchId,
        sessionId,
        title,
        displayName,
        originalFilename,
        presenterNotes,
        description,
        materialType,
        fileUrl,
        releaseCondition,
        releaseOffsetMinutes,
        scheduledReleaseTime,
        lifecycleState,
      } = body;
      if (!courseId || !title) {
        return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
      }

      const material = await db.saveLearningMaterial({
        courseId,
        batchId: batchId || undefined,
        sessionId: sessionId || undefined,
        title,
        displayName: displayName || title,
        originalFilename: originalFilename || (fileUrl ? String(fileUrl).split('/').pop() : undefined),
        presenterNotes: presenterNotes || '',
        description: description || '',
        materialType: materialType || 'PDF',
        fileUrl: fileUrl || '',
        releaseCondition: releaseCondition || 'PRE_CLASS',
        releaseOffsetMinutes: releaseOffsetMinutes ? Number(releaseOffsetMinutes) : undefined,
        scheduledReleaseTime: scheduledReleaseTime || undefined,
        lifecycleState: lifecycleState || undefined,
        status: 'PUBLISHED',
      });

      return NextResponse.json({ success: true, material });
    }

    // 7. Material In-Class Lifecycle Actions (Release, Present, Postpone, Skip, Cancel)
    if (
      action === 'release_material' ||
      action === 'present_material' ||
      action === 'postpone_material' ||
      action === 'skip_material' ||
      action === 'cancel_material'
    ) {
      if (!isStaff) {
        return NextResponse.json({ error: 'Instructor privileges required' }, { status: 403 });
      }
      const { materialId, reason, offsetMinutes, scheduledTime } = body;
      if (!materialId) {
        return NextResponse.json({ error: 'materialId is required' }, { status: 400 });
      }

      let updated: any = null;
      if (action === 'release_material') {
        updated = await db.releaseMaterialNow(materialId);
      } else if (action === 'present_material') {
        updated = await db.presentMaterial(materialId);
      } else if (action === 'postpone_material') {
        updated = await db.postponeMaterial(materialId, reason || 'Postponed by instructor', {
          offsetMinutes: offsetMinutes !== undefined ? Number(offsetMinutes) : undefined,
          scheduledTime,
        });
      } else if (action === 'skip_material') {
        updated = await db.skipMaterial(materialId);
      } else if (action === 'cancel_material') {
        updated = await db.cancelMaterial(materialId, reason || 'Cancelled by instructor');
      }

      if (!updated) {
        return NextResponse.json({ error: 'Material not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, material: updated });
    }

    // 8. Ask Academic Doubt
    if (action === 'ask_doubt') {
      const { courseId, question, isPublic, timestampSeconds } = body;
      if (!question) {
        return NextResponse.json({ error: 'question is required' }, { status: 400 });
      }

      const doubt = await db.saveRecordingDoubt({
        recordingId: courseId || 'course-general',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        question,
        isPublic: isPublic !== undefined ? Boolean(isPublic) : true,
        timestampSeconds: timestampSeconds || 0,
        status: 'OPEN',
      });

      return NextResponse.json({ success: true, doubt });
    }

    // 9. Answer Academic Doubt
    if (action === 'reply_doubt') {
      if (!isStaff) {
        return NextResponse.json({ error: 'Instructor privileges required to reply to doubts' }, { status: 403 });
      }
      const { doubtId, answerText } = body;
      if (!doubtId || !answerText) {
        return NextResponse.json({ error: 'doubtId and answerText are required' }, { status: 400 });
      }

      const answer = await db.saveRecordingDoubtAnswer({
        id: `ans-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
        doubtId,
        instructorId: user.id,
        instructorName: user.name,
        answerText,
        createdAt: new Date().toISOString(),
      });

      await db.resolveRecordingDoubt(doubtId, 'RESOLVED');
      return NextResponse.json({ success: true, answer });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    if (err instanceof DatabasePersistenceError) {
      if (err.category === 'SCHEMA_MISSING') {
        return NextResponse.json(
          { error: err.message, code: 'DATABASE_SCHEMA_ERROR', category: err.category },
          { status: 503 }
        );
      }
      if (err.category === 'DATABASE_UNAVAILABLE') {
        return NextResponse.json(
          { error: err.message, code: 'DATABASE_UNAVAILABLE', category: err.category },
          { status: 503 }
        );
      }
      if (err.category === 'PERMISSION_DENIED') {
        return NextResponse.json(
          { error: err.message, code: 'PERMISSION_DENIED', category: err.category },
          { status: 403 }
        );
      }
    }
    return NextResponse.json(
      { error: err.message || 'Failed to execute classroom action' },
      { status: 500 }
    );
  }
}
