import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { factorId } = body;

    if (!factorId || typeof factorId !== 'string') {
      return NextResponse.json({ error: 'factorId is required' }, { status: 400 });
    }

    const challenge = await db.createMfaChallenge(factorId.trim());

    return NextResponse.json({
      success: true,
      challenge: {
        id: challenge.id,
        factorId: challenge.factorId,
        expiresAt: challenge.expiresAt,
        verified: challenge.verified,
        createdAt: challenge.createdAt,
      },
    });
  } catch (err: any) {
    if (err.message === 'FACTOR_NOT_FOUND') {
      return NextResponse.json({ error: 'MFA factor not found' }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'MFA challenge creation failed' }, { status: 500 });
  }
}

