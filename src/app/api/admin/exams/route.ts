import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { blueprint, question } = await request.json();

    if (blueprint) {
      if (!blueprint.id) blueprint.id = `bp-${Date.now().toString(36)}`;
      const saved = await db.saveExamBlueprint(blueprint);
      return NextResponse.json({ success: true, blueprint: saved });
    }

    if (question) {
      if (!question.id) question.id = `q-${Date.now().toString(36)}`;
      const saved = await db.saveExamQuestion(question);
      return NextResponse.json({ success: true, question: saved });
    }

    return NextResponse.json({ success: false, error: 'Blueprint or question payload required' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
