import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const topic = await db.getTopicById(id);
    if (!topic) {
      return NextResponse.json({ error: `Topic not found with id: ${id}` }, { status: 404 });
    }
    return NextResponse.json({ success: true, topic });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve topic' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.getTopicById(id);
    if (!existing) {
      return NextResponse.json({ error: `Topic not found with id: ${id}` }, { status: 404 });
    }

    if (body.moduleId && body.moduleId !== existing.moduleId) {
      const parentModule = await db.getModuleById(body.moduleId);
      if (!parentModule) {
        return NextResponse.json({ error: `Target parent module not found with id: ${body.moduleId}` }, { status: 404 });
      }
    }

    const order =
      body.orderIndex !== undefined
        ? Number(body.orderIndex)
        : body.displayOrder !== undefined
        ? Number(body.displayOrder)
        : undefined;

    const updated = await db.updateTopic(id, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      learningObjectives: Array.isArray(body.learningObjectives) ? body.learningObjectives : undefined,
      displayOrder: order,
      orderIndex: order,
      status: body.status,
      moduleId: body.moduleId,
    });

    return NextResponse.json({
      success: true,
      message: `Topic ${id} updated successfully.`,
      topic: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update topic' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.getTopicById(id);
    if (!existing) {
      return NextResponse.json({ error: `Topic not found with id: ${id}` }, { status: 404 });
    }

    // Safe archival: never physically delete referenced curriculum topics
    const archived = await db.archiveTopic(id);

    return NextResponse.json({
      success: true,
      message: `Topic ${id} archived successfully. Historical references preserved.`,
      topic: archived,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to archive topic' }, { status: 500 });
  }
}

