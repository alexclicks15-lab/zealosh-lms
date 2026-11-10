import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';
import { SyllabusVersion } from '@/types';

function getAuthUser(request: Request) {
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

export async function GET(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');
    if (!courseId) {
      return NextResponse.json({ error: 'courseId query parameter is required' }, { status: 400 });
    }

    const versions = await db.getSyllabusVersions(courseId);
    return NextResponse.json({ courseId, versions });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to list syllabus versions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN' && user.role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const body = await request.json();
    const { courseId, title, changelog } = body;
    if (!courseId || !title) {
      return NextResponse.json({ error: 'courseId and title are required' }, { status: 400 });
    }

    const course = await db.getCourseById(courseId);
    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Assemble current modules, topics, and subtopics snapshot
    const modules = await db.getModules(courseId);
    const treeSnapshot: any[] = [];
    for (const mod of modules) {
      const topics = await db.getTopics(mod.id);
      const modTopics: any[] = [];
      for (const top of topics) {
        const subtopics = await db.getSubtopics(top.id);
        modTopics.push({
          ...top,
          subtopics,
        });
      }
      treeSnapshot.push({
        ...mod,
        topics: modTopics,
      });
    }

    const existingVersions = await db.getSyllabusVersions(courseId);
    const nextVersionNumber = existingVersions.length > 0
      ? Math.max(...existingVersions.map((v) => v.versionNumber)) + 1
      : 1;

    const newVersion: SyllabusVersion = {
      id: `syl-v${nextVersionNumber}-${courseId}`,
      courseId,
      versionNumber: nextVersionNumber,
      title,
      changelog: changelog || `Curriculum snapshot version ${nextVersionNumber}`,
      treeSnapshot,
      status: 'DRAFT',
      createdBy: user.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await db.saveSyllabusVersion(newVersion);
    return NextResponse.json(saved, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create syllabus version' }, { status: 500 });
  }
}
