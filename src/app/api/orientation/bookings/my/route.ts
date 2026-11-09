// Zealosh LMS — Student Personal Orientation Bookings API
// GET /api/orientation/bookings/my — List current user's orientation bookings
// File: src/app/api/orientation/bookings/my/route.ts

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

export async function GET(request: Request) {
  try {
    const payload = extractUserToken(request);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const bookings = await OrientationService.getUserBookings(payload.userId);
    return NextResponse.json({ success: true, count: bookings.length, bookings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to list user orientation bookings' },
      { status: 500 }
    );
  }
}

