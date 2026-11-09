import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const consumerDomain = searchParams.get('consumerDomain') || undefined;
    const status = searchParams.get('status') || undefined;

    const deadLetters = await db.getDeadLetterEvents({ consumerDomain, status });
    return NextResponse.json({
      success: true,
      count: deadLetters.length,
      deadLetters,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

