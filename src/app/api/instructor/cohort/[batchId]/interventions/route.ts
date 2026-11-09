// Zealosh LMS — Cohort Academic Interventions API
// Workstream A & B: At-risk student identification, faculty advisory intervention, and multi-channel alerts

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { CreateInterventionInput } from '@/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> | { batchId: string } }
) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Faculty or administrative credentials required' },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const batchId = resolvedParams.batchId;

    if (!batchId) {
      return NextResponse.json({ success: false, error: 'batchId is required' }, { status: 400 });
    }

    const overview = await db.getCohortInterventions(batchId, user.userId);
    return NextResponse.json({ success: true, overview });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to retrieve cohort interventions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> | { batchId: string } }
) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Faculty or administrative credentials required' },
        { status: 403 }
      );
    }

    const resolvedParams = await Promise.resolve(params);
    const batchId = resolvedParams.batchId;

    const body = await request.json();
    const { courseId, studentId, notes } = body;
    const reason = body.reason || body.riskFactor;
    const interventionType = body.interventionType || body.suggestedAction || 'ACADEMIC_ADVISORY';

    if (!courseId || !studentId || !reason) {
      return NextResponse.json(
        { success: false, error: 'Missing required intervention fields (courseId, studentId, reason/riskFactor)' },
        { status: 400 }
      );
    }

    const input: CreateInterventionInput = {
      batchId,
      courseId,
      studentId,
      reason,
      interventionType,
      notes,
    };

    const intervention = await db.createAcademicIntervention(input, user.userId);
    return NextResponse.json({ success: true, intervention }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to dispatch academic intervention' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> | { batchId: string } }
) {
  try {
    const authResult = authorizeUser(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { user } = authResult;

    if (!['INSTRUCTOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Faculty or administrative credentials required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { interventionId, actionTaken } = body;

    if (!interventionId || !actionTaken) {
      return NextResponse.json(
        { success: false, error: 'interventionId and actionTaken are required to resolve an intervention' },
        { status: 400 }
      );
    }

    const resolved = await db.resolveAcademicIntervention(interventionId, actionTaken, user.userId);
    return NextResponse.json({ success: true, intervention: resolved });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to resolve academic intervention' },
      { status: 500 }
    );
  }
}
