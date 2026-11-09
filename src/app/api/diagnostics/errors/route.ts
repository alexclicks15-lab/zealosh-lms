import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeUser } from '@/lib/auth/admin-guard';
import { LogSeverity, BugResolutionStatus } from '@/types';

export async function GET(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin privileges required to view system error logs' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity') as LogSeverity | undefined;
    const status = searchParams.get('status') as BugResolutionStatus | undefined;
    const module = searchParams.get('module') || undefined;

    const logs = await db.getAppErrorLogs({ severity, status, module });
    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      severity,
      module,
      errorMessage,
      errorStack,
      componentStack,
      requestUrl,
      requestMethod,
      userId,
      metadata,
    } = body;

    if (!module || !errorMessage) {
      return NextResponse.json(
        { success: false, error: 'module and errorMessage are required' },
        { status: 400 }
      );
    }

    const log = await db.recordAppErrorLog({
      severity: severity || 'ERROR',
      module,
      errorMessage,
      errorStack,
      componentStack,
      requestUrl,
      requestMethod,
      userId,
      metadata,
    });

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = authorizeUser(request);
    if ('errorResponse' in auth) return auth.errorResponse;
    const { user } = auth;

    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin privileges required to update error logs' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { logId, status, resolutionNotes } = body;

    if (!logId || !status) {
      return NextResponse.json(
        { success: false, error: 'logId and status are required' },
        { status: 400 }
      );
    }

    const updated = await db.updateAppErrorLogStatus(
      logId,
      status as BugResolutionStatus,
      resolutionNotes,
      user.email
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Error log not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      log: updated,
      message: 'Error log status updated successfully',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
