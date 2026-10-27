import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { db } from '@/lib/store/db';

const JWT_SECRET = process.env.JWT_SECRET || 'zealosh_super_secret_jwt_key_2026_enterprise';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Missing or malformed Authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '').trim();
    let decoded: any;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch {
      return NextResponse.json(
        { error: 'invalid_token', error_description: 'Signature verification failed or token expired' },
        { status: 401 }
      );
    }

    const userId = decoded.sub || 'usr-std-01';
    const user = (await db.getUser(userId)) || {
      id: userId,
      name: decoded.name || 'Arjun Menon',
      email: decoded.email || 'arjun.menon@example.com',
      role: decoded.role || 'STUDENT',
    };

    return NextResponse.json(
      {
        sub: user.id,
        name: user.name,
        email: user.email,
        preferred_username: user.email,
        role: user.role,
        email_verified: true,
        picture: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user.name)}`,
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('OAuth userinfo error:', error);
    return NextResponse.json(
      { error: 'server_error', error_description: 'Failed to retrieve user claims' },
      { status: 500 }
    );
  }
}
