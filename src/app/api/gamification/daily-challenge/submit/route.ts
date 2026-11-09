import { NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification/gamification-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = gamificationService.submitDailyChallenge(body);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    const statusCode = err.message.includes('already been completed') ? 409 : 400;
    return NextResponse.json({ success: false, error: err.message }, { status: statusCode });
  }
}

