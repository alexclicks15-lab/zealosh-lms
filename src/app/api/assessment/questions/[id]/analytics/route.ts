import { NextResponse } from 'next/server';
import { inMemoryItemAnalytics } from '@/lib/assessment/question-bank-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const versionNumber = parseInt(searchParams.get('version') || '1', 10);
    const analytics = inMemoryItemAnalytics.get(`${params.id}:${versionNumber}`);

    if (!analytics) {
      return NextResponse.json({
        success: true,
        analytics: {
          questionBankItemId: params.id,
          versionNumber,
          totalAttempts: 0,
          correctAttempts: 0,
          difficultyPValue: 0.0,
          discriminationD: 0.0,
          distractorFrequencies: {},
          sampleSizeSufficient: false,
          lastCalculatedAt: new Date().toISOString(),
        },
      });
    }

    return NextResponse.json({ success: true, analytics });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

