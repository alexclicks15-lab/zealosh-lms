// Zealosh LMS — Student Orientation Booking Cancellation API
// POST /api/orientation/sessions/[id]/cancel — Cancels an orientation booking
// File: src/app/api/orientation/sessions/[id]/cancel/route.ts

import { NextResponse } from 'next/server';
import { OrientationService } from '@/lib/orientation/orientation-service';
import { verifyToken } from '@/lib/auth/jwt';

function extractUserToken(request: Request) {
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

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { bookingId } = body;

    if (!bookingId) {
      return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });
    }

    const result = await OrientationService.cancelBooking(bookingId, payload.userId);

    return NextResponse.json({
      success: true,
      booking: result.booking,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to cancel orientation booking' },
      { status: 400 }
    );
  }
}

