import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { verifyToken } from '@/lib/auth/jwt';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  let token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  if (!token) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(/zealosh_token=([^;]+)/);
    if (match) token = match[1];
  }

  const payload = token ? verifyToken(token) : null;
  const blueprints = Array.from(db.examBlueprints.values());

  let userAttempts: any[] = [];
  if (payload) {
    userAttempts = Array.from(db.examAttempts.values())
      .filter((a) => a.userId === payload.userId)
      .map((a) => ({
        id: a.id,
        blueprintId: a.blueprintId,
        certificationType: a.certificationType,
        status: a.status,
        startTime: a.startTime,
        completedTime: a.completedTime,
        totalScore: a.totalScore,
        passed: a.passed,
      }));
  }

  return NextResponse.json({
    blueprints,
    attempts: userAttempts,
  });
}
