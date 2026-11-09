import { NextResponse } from 'next/server';
import { gamificationService } from '@/lib/gamification/gamification-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = gamificationService.recordActivityPoints(body);
    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

