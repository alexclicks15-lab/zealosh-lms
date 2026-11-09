import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { DeliveryMode, DeliveryConfiguration } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || undefined;
    const studentId = searchParams.get('studentId') || undefined;

    const effectiveConfig = await db.getEffectiveDeliveryConfig(course.id, batchId, studentId);
    const rawCourseConfig = await db.getDeliveryConfig('COURSE', course.id);
    const rawBatchConfig = batchId ? await db.getDeliveryConfig('BATCH', batchId) : null;

    return NextResponse.json({
      success: true,
      effectiveConfig,
      rawConfigs: {
        course: rawCourseConfig,
        batch: rawBatchConfig,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
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

    let course = await db.getCourseBySlug(params.slug);
    if (!course) {
      course = await db.getCourseById(params.slug);
    }
    if (!course) {
      return NextResponse.json({ success: false, error: 'Course not found' }, { status: 404 });
    }

    const body = await request.json();
    const { entityType, entityId, deliveryMode, settings } = body;

    if (!entityType || !entityId || !deliveryMode) {
      return NextResponse.json(
        { success: false, error: 'entityType, entityId, and deliveryMode are required' },
        { status: 400 }
      );
    }

    const validModes: DeliveryMode[] = ['ONLINE_ONLY', 'RECORDED_ONLY', 'HYBRID', 'ALL_MODES'];
    if (!validModes.includes(deliveryMode)) {
      return NextResponse.json(
        { success: false, error: `Invalid deliveryMode. Must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    const saved = await db.saveDeliveryConfig({
      entityType,
      entityId,
      deliveryMode,
      settings: settings || {},
    });

    return NextResponse.json({
      success: true,
      config: saved,
      message: 'Delivery configuration saved successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

