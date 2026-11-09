import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { Topic } from '@/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const moduleId = url.searchParams.get('moduleId') || undefined;
    const topics = await db.getTopics(moduleId);
    return NextResponse.json({ success: true, topics });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list topics' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { moduleId, title, description, orderIndex, learningObjectives, status } = body;

    if (!moduleId || !title) {
      return NextResponse.json({ error: 'moduleId and title are required' }, { status: 400 });
    }

    const mod = await db.getModuleById(moduleId);
    if (!mod) {
      return NextResponse.json({ error: `Module ${moduleId} does not exist` }, { status: 404 });
    }

    const id = body.id || `top-${moduleId}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();

    const order = typeof orderIndex === 'number' ? orderIndex : 1;
    const topic: Topic = {
      id,
      moduleId,
      title: title.trim(),
      description: description ? description.trim() : undefined,
      displayOrder: order,
      orderIndex: order,
      learningObjectives: Array.isArray(learningObjectives) ? learningObjectives : undefined,
      status: status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveTopic(topic);
    return NextResponse.json({ success: true, topic: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create topic' }, { status: 500 });
  }
}

