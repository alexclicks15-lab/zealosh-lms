import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;
    const resolvedParams = await params;
    const materialId = resolvedParams.id;

    const material = await db.getLearningMaterial(materialId);
    if (!material) {
      return NextResponse.json({ success: false, error: 'Learning material not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batchId') || undefined;
    const action = searchParams.get('action') || 'view'; // 'view' | 'download'

    const access = await db.checkMaterialAccess(material.id, user.userId, batchId);

    if (action === 'download' && !access.canDownload) {
      return NextResponse.json(
        {
          success: false,
          error: access.reason || 'Download permission is disabled for this material under your current delivery mode.',
          canView: access.canView,
          canDownload: false,
        },
        { status: 403 }
      );
    }

    if (!access.canView && user.role === 'STUDENT') {
      return NextResponse.json(
        {
          success: false,
          error: access.reason || 'You do not have permission to view this material.',
          canView: false,
          canDownload: false,
        },
        { status: 403 }
      );
    }

    const payloadMaterial =
      user.role === 'STUDENT'
        ? {
            ...material,
            presenterNotes: undefined, // Conceal instructor presenter notes
            fileUrl: access.canDownload ? material.fileUrl : undefined,
          }
        : material;

    return NextResponse.json({
      success: true,
      material: payloadMaterial,
      access,
      watermark: material.watermarkEnabled
        ? {
            text: `Zealosh Licensed to: ${user.name} (${user.email}) - DO NOT REDISTRIBUTE`,
            timestamp: new Date().toISOString(),
          }
        : null,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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

    const resolvedParams = await params;
    const materialId = resolvedParams.id;
    const existing = await db.getLearningMaterial(materialId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Learning material not found' }, { status: 404 });
    }

    const body = await request.json();
    const action = body.action;

    let updated: any = null;
    if (action === 'release_now') {
      updated = await db.releaseMaterialNow(materialId);
    } else if (action === 'present') {
      updated = await db.presentMaterial(materialId);
    } else if (action === 'postpone') {
      updated = await db.postponeMaterial(materialId, body.reason || 'Postponed by instructor', {
        offsetMinutes: body.offsetMinutes !== undefined ? Number(body.offsetMinutes) : undefined,
        scheduledTime: body.scheduledTime,
      });
    } else if (action === 'skip') {
      updated = await db.skipMaterial(materialId);
    } else if (action === 'cancel') {
      updated = await db.cancelMaterial(materialId, body.reason || 'Cancelled by instructor');
    } else {
      updated = await db.updateLearningMaterial(materialId, {
        displayName: body.displayName,
        title: body.title,
        description: body.description,
        presenterNotes: body.presenterNotes,
        allowDownload: body.allowDownload,
        allowView: body.allowView,
        allowPrint: body.allowPrint,
        watermarkEnabled: body.watermarkEnabled,
        sortOrder: body.sortOrder !== undefined ? Number(body.sortOrder) : undefined,
        releaseCondition: body.releaseCondition,
        releaseOffsetMinutes: body.releaseOffsetMinutes !== undefined ? Number(body.releaseOffsetMinutes) : undefined,
        scheduledReleaseTime: body.scheduledReleaseTime,
        lifecycleState: body.lifecycleState,
        status: body.status,
      });
    }

    return NextResponse.json({
      success: true,
      material: updated,
      message: `Material ${action || 'updated'} successfully`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
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

    const resolvedParams = await params;
    const materialId = resolvedParams.id;
    const deleted = await db.deleteLearningMaterial(materialId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Learning material not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Learning material deleted successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

