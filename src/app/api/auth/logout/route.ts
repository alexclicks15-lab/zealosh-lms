// Zealosh LMS — Logout API Handler
// Track 1: Foundation Hardening (ZM-IMPL-08B)

import { NextResponse } from 'next/server';
import { sessionRegistry } from '@/lib/auth/session-registry';

function extractToken(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/zealosh_token=([^;]+)/);
  if (match) return match[1];
  return null;
}

export async function POST(request: Request) {
  const token = extractToken(request);
  if (token) {
    try {
      await sessionRegistry.revokeSessionByToken(token, undefined, 'User logged out');
    } catch {
      // Continue clearing cookie even if session lookup fails
    }
  }

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  // Clear session cookie
  response.cookies.set('zealosh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });

  return response;
}

export async function GET(request: Request) {
  const token = extractToken(request);
  if (token) {
    try {
      await sessionRegistry.revokeSessionByToken(token, undefined, 'Single sign-out');
    } catch {
      // Continue
    }
  }

  // Support GET redirect for single sign-out workflows
  const response = NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'));
  response.cookies.set('zealosh_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
  return response;
}
