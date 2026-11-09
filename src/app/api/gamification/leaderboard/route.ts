import { NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification/gamification-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get('scope') as any) || 'INSTITUTION';
    const period = (searchParams.get('period') as any) || 'ALL_TIME';
    const scopeId = searchParams.get('scopeId') || undefined;
    const currentUserId = searchParams.get('currentUserId') || undefined;

    const leaderboard = gamificationService.getLeaderboard(scope, period, scopeId, currentUserId);
    return NextResponse.json({ success: true, count: leaderboard.length, leaderboard });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

