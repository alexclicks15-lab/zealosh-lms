import { verifyToken } from './jwt';
import { NextResponse } from 'next/server';

export interface AdminActor {
  userId: string;
  email: string;
  role: string;
}

export function authorizeAdmin(request: Request): { actor: AdminActor } | { errorResponse: NextResponse } {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }

  if (token) {
    const payload = verifyToken(token);
    if (!payload) {
      return {
        errorResponse: NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid or expired session token' },
          { status: 401 }
        ),
      };
    }

    if (payload.role !== 'SUPER_ADMIN' && payload.role !== 'ORG_ADMIN') {
      return {
        errorResponse: NextResponse.json(
          { success: false, error: 'Forbidden: Administrative privileges required' },
          { status: 403 }
        ),
      };
    }

    return {
      actor: {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
      },
    };
  }

  // In development mode, allow unauthenticated local preview if no token is sent
  if (process.env.NODE_ENV === 'development') {
    return {
      actor: {
        userId: 'usr-admin-01',
        email: 'admin@zealosh.com',
        role: 'SUPER_ADMIN',
      },
    };
  }

  return {
    errorResponse: NextResponse.json(
      { success: false, error: 'Unauthorized: Authentication required' },
      { status: 401 }
    ),
  };
}
