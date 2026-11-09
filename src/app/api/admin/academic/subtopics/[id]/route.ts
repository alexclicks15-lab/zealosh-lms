import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const subtopic = await db.getSubtopicById(id);
    if (!subtopic) {
      return NextResponse.json({ error: `Subtopic not found with id: ${id}` }, { status: 404 });
    }
    return NextResponse.json({ success: true, subtopic });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve subtopic' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const existing = await db.getSubtopicById(id);
    if (!existing) {
      return NextResponse.json({ error: `Subtopic not found with id: ${id}` }, { status: 404 });
    }

    if (body.topicId && body.topicId !== existing.topicId) {
      const parentTopic = await db.getTopicById(body.topicId);
      if (!parentTopic) {
        return NextResponse.json({ error: `Target parent topic not found with id: ${body.topicId}` }, { status: 404 });
      }
    }

    const order =
      body.orderIndex !== undefined
        ? Number(body.orderIndex)
        : body.displayOrder !== undefined
        ? Number(body.displayOrder)
        : undefined;

    const updated = await db.updateSubtopic(id, {
      title: body.title !== undefined ? String(body.title).trim() : undefined,
      code: body.code !== undefined ? (body.code ? String(body.code).trim().toUpperCase() : undefined) : undefined,
      description: body.description !== undefined ? String(body.description).trim() : undefined,
      contentSummary: body.contentSummary !== undefined ? String(body.contentSummary).trim() : undefined,
      displayOrder: order,
      orderIndex: order,
      status: body.status,
      topicId: body.topicId,
    });

    return NextResponse.json({
      success: true,
      message: `Subtopic ${id} updated successfully.`,
      subtopic: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to update subtopic' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.getSubtopicById(id);
    if (!existing) {
      return NextResponse.json({ error: `Subtopic not found with id: ${id}` }, { status: 404 });
    }

    // Safe archival: never physically delete referenced curriculum subtopics
    const archived = await db.archiveSubtopic(id);

    return NextResponse.json({
      success: true,
      message: `Subtopic ${id} archived successfully. Historical references preserved.`,
      subtopic: archived,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to archive subtopic' }, { status: 500 });
  }
}

