import { NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification/gamification-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const studentId = searchParams.get('studentId');
    if (!studentId) {
      return NextResponse.json({ success: false, error: 'studentId required' }, { status: 400 });
    }

    const totalPoints = gamificationService.getStudentTotalPoints(studentId);
    const streak = gamificationService.getStudentStreak(studentId);
    const badges = gamificationService.getStudentBadges(studentId);
    const recentLedger = gamificationService.getStudentPointsLedger(studentId).slice(0, 10);

    return NextResponse.json({
      success: true,
      summary: {
        studentId,
        totalPoints,
        streak,
        badges,
        recentLedger,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

