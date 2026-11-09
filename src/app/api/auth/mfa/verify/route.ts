import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { challengeId, code } = body;

    if (!challengeId || typeof challengeId !== 'string') {
      return NextResponse.json({ error: 'challengeId is required' }, { status: 400 });
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Verification code is required' }, { status: 400 });
    }

    const result = await db.verifyMfaChallenge(challengeId.trim(), code.trim());

    return NextResponse.json({
      success: true,
      verified: result.verified,
      assuranceLevel: result.assuranceLevel,
      message: 'MFA challenge successfully verified.',
    });
  } catch (err: any) {
    if (err.message === 'CHALLENGE_NOT_FOUND') {
      return NextResponse.json({ error: 'MFA challenge not found' }, { status: 404 });
    }
    if (err.message === 'CHALLENGE_ALREADY_VERIFIED') {
      return NextResponse.json({ error: 'MFA challenge has already been verified' }, { status: 409 });
    }
    if (err.message === 'CHALLENGE_EXPIRED') {
      return NextResponse.json({ error: 'MFA challenge has expired. Please create a new challenge.' }, { status: 410 });
    }
    if (err.message === 'INVALID_MFA_CODE') {
      return NextResponse.json({ error: 'Invalid MFA verification code. Expected 6 digits.' }, { status: 401 });
    }
    return NextResponse.json({ error: err.message || 'MFA verification failed' }, { status: 400 });
  }
}

