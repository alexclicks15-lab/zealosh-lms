import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const moduleItem = await db.getModuleById(id);
    if (!moduleItem) {
      return NextResponse.json({ error: `Module not found with id: ${id}` }, { status: 404 });
    }
    return NextResponse.json({ success: true, module: moduleItem });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve module' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.getModuleById(id);
    if (!existing) {
      return NextResponse.json({ error: `Module not found with id: ${id}` }, { status: 404 });
    }

    if (body.courseId && body.courseId !== existing.courseId) {
      const course = await db.getCourseById(body.courseId);
      if (!course) {
        return NextResponse.json({ error: `Target course not found with id: ${body.courseId}` }, { status: 404 });
      }
    }

    const order =
      body.orderIndex !== undefined
        ? Number(body.orderIndex)
        : body.displayOrder !== undefined
        ? Number(body.displayOrder)
        : undefined;

    const updated = await db.updateModule(id, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      code: body.code !== undefined ? (body.code ? String(body.code).trim().toUpperCase() : undefined) : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      deliveryMode: body.deliveryMode,
      displayOrder: order,
      orderIndex: order,
      status: body.status,
      courseId: body.courseId,
    });

    return NextResponse.json({
      success: true,
      message: `Module ${id} updated successfully.`,
      module: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update module' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.getModuleById(id);
    if (!existing) {
      return NextResponse.json({ error: `Module not found with id: ${id}` }, { status: 404 });
    }

    // Safe archival: never physically delete referenced curriculum modules
    const archived = await db.archiveModule(id);

    return NextResponse.json({
      success: true,
      message: `Module ${id} archived successfully. Historical references preserved.`,
      module: archived,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to archive module' }, { status: 500 });
  }
}

