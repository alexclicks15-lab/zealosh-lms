import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

function getAuthUser(request: Request) {
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
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let tokenRecord = await db.getCalendarFeedTokenByUserId(user.userId);
    if (!tokenRecord) {
      tokenRecord = await db.createCalendarFeedToken(user.userId, 'ALL');
    }

    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const feedUrl = `${proto}://${host}/api/calendar/feed/${tokenRecord.token}`;
    const webcalUrl = feedUrl.replace(/^https?:/, 'webcal:');

    return NextResponse.json({
      token: tokenRecord.token,
      feedUrl,
      webcalUrl,
      scope: tokenRecord.scope,
      createdAt: tokenRecord.createdAt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to get calendar feed token' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope || 'ALL';

    const freshToken = await db.createCalendarFeedToken(user.userId, scope);
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const feedUrl = `${proto}://${host}/api/calendar/feed/${freshToken.token}`;
    const webcalUrl = feedUrl.replace(/^https?:/, 'webcal:');

    return NextResponse.json({
      token: freshToken.token,
      feedUrl,
      webcalUrl,
      scope: freshToken.scope,
      createdAt: freshToken.createdAt,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to rotate calendar feed token' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const tokenRecord = await db.getCalendarFeedTokenByUserId(user.userId);
    if (tokenRecord) {
      await db.revokeCalendarFeedToken(tokenRecord.token);
    }

    return NextResponse.json({ success: true, message: 'Calendar feed token successfully revoked' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to revoke calendar feed token' }, { status: 500 });
  }
}
