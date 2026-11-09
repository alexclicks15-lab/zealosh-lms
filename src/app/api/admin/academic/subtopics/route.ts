import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { Subtopic } from '@/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const topicId = url.searchParams.get('topicId') || undefined;

    const subtopics = await db.getSubtopics(topicId);
    return NextResponse.json({ success: true, count: subtopics.length, subtopics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list subtopics' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { topicId, title, code, description, orderIndex, displayOrder, contentSummary, status } = body;

    if (!topicId) {
      return NextResponse.json({ error: 'topicId is required' }, { status: 400 });
    }

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return NextResponse.json({ error: 'Subtopic title is required' }, { status: 400 });
    }

    const topic = await db.getTopic(topicId);
    if (!topic) {
      return NextResponse.json({ error: `Parent topic not found with id: ${topicId}` }, { status: 404 });
    }

    const id = body.id || `subtop-${topicId.slice(0, 8)}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();
    const order = Number(orderIndex !== undefined ? orderIndex : displayOrder !== undefined ? displayOrder : 0);

    const subtopic: Subtopic = {
      id,
      topicId,
      title: title.trim(),
      code: code ? String(code).trim().toUpperCase() : undefined,
      description: description ? String(description).trim() : undefined,
      displayOrder: order,
      orderIndex: order,
      contentSummary: contentSummary ? String(contentSummary).trim() : undefined,
      status: status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveSubtopic(subtopic);
    return NextResponse.json({ success: true, subtopic: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create subtopic' }, { status: 500 });
  }
}
