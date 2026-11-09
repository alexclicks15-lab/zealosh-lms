import { NextResponse } from 'next/server';
import { vectorRagService } from '@/lib/ai/vector-rag-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, userRole, courseId, query, limit, minScore } = body;

    const results = await vectorRagService.searchCurriculum({
      userId,
      userRole: userRole || 'STUDENT',
      courseId,
      query,
      limit,
      minScore,
    });

    return NextResponse.json({
      success: true,
      count: results.length,
      results,
      citations: vectorRagService.toCitations(results),
    });
  } catch (err: any) {
    const statusCode = err.message.includes('AI_FORBIDDEN')
      ? 403
      : err.message.includes('AI_EXAM_LOCKOUT_ACTIVE')
      ? 423
      : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

