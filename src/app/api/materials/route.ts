import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { LearningMaterial, MaterialType } from '@/types';

export async function GET(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    const batchId = searchParams.get('batchId') || undefined;
    const sessionId = searchParams.get('sessionId') || undefined;

    if (!courseId && !sessionId) {
      return NextResponse.json({ success: false, error: 'courseId or sessionId query parameter is required' }, { status: 400 });
    }

    let materials: LearningMaterial[] = [];

    if (sessionId) {
      // Reconcile scheduled and elapsed-time materials anchored to this live session
      await db.reconcileScheduledMaterials(sessionId);
      materials = await db.getSessionMaterials(sessionId);
    } else if (courseId) {
      let course = await db.getCourseById(courseId);
      if (!course) {
        course = await db.getCourseBySlug(courseId);
      }
      if (!course) {
        return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
      }
      materials = await db.getLearningMaterials(course.id, batchId);
    }

    // If student, calculate effective access permissions per material
    if (user.role === 'STUDENT') {
      const sanitized = await Promise.all(
        materials.map(async (m) => {
          const access = await db.checkMaterialAccess(m.id, user.userId, batchId);
          return {
            ...m,
            // Hide presenter notes from learners
            presenterNotes: undefined,
            canView: access.canView,
            canDownload: access.canDownload,
            accessReason: access.reason,
            // If download or view not allowed, protect direct file URL
            fileUrl: access.canDownload ? m.fileUrl : undefined,
          };
        })
      );
      // Filter out materials student has no permission to view at all
      const visibleToStudent = sanitized.filter((m) => m.canView);
      return NextResponse.json({ success: true, materials: visibleToStudent });
    }

    return NextResponse.json({ success: true, materials });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Instructor or Admin privileges required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      courseId,
      batchId,
      lessonId,
      sessionId,
      title,
      displayName,
      originalFilename,
      description,
      presenterNotes,
      materialType,
      fileUrl,
      fileSizeBytes,
      fileFormat,
      allowView,
      allowDownload,
      allowPrint,
      watermarkEnabled,
      sortOrder,
      releaseCondition,
      releaseOffsetMinutes,
      scheduledReleaseTime,
      lifecycleState,
      status,
    } = body;

    if (!courseId || !title || !materialType) {
      return NextResponse.json(
        { success: false, error: 'courseId, title, and materialType are required' },
        { status: 400 }
      );
    }

    const saved = await db.saveLearningMaterial({
      courseId,
      batchId: batchId || undefined,
      lessonId: lessonId || undefined,
      sessionId: sessionId || undefined,
      title,
      displayName: displayName || title,
      originalFilename: originalFilename || (fileUrl ? String(fileUrl).split('/').pop() : undefined),
      description: description || '',
      presenterNotes: presenterNotes || '',
      materialType: materialType as MaterialType,
      fileUrl: fileUrl || '',
      fileSizeBytes: fileSizeBytes || 0,
      fileFormat: fileFormat || 'pdf',
      allowView: allowView !== undefined ? Boolean(allowView) : true,
      allowDownload: allowDownload !== undefined ? Boolean(allowDownload) : true,
      allowPrint: allowPrint !== undefined ? Boolean(allowPrint) : false,
      watermarkEnabled: watermarkEnabled !== undefined ? Boolean(watermarkEnabled) : true,
      sortOrder: sortOrder || 0,
      releaseCondition: releaseCondition || 'PRE_CLASS',
      releaseOffsetMinutes: releaseOffsetMinutes !== undefined ? Number(releaseOffsetMinutes) : undefined,
      scheduledReleaseTime: scheduledReleaseTime || undefined,
      lifecycleState: lifecycleState || undefined,
      status: status || 'PUBLISHED',
      uploadedBy: user.userId,
    });

    return NextResponse.json({
      success: true,
      material: saved,
      message: 'Learning material created successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

