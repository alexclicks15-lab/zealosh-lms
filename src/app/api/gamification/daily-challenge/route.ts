import { NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification/gamification-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;
    const studentId = searchParams.get('studentId') || undefined;

    const challenge = gamificationService.getDailyChallenge(date, studentId);
    return NextResponse.json({ success: true, challenge });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

