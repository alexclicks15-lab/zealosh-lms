// Zealosh LMS — Client Diagnostics & Error Ingestion API
// Path: src/app/api/diagnostics/report/route.ts
// Receives client-side crashes, frontend error boundary events, and network exceptions
// Rate-limited to protect against reporting storms

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { diagnosticsService } from '@/lib/diagnostics/diagnostics-service';
import { extractCorrelationId } from '@/lib/diagnostics/correlation';
import { DiagnosticCategory, DiagnosticSeverity } from '@/types';

// In-memory sliding window rate limiter: max 30 reports per minute per client key
const clientReportWindows = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = clientReportWindows.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    clientReportWindows.set(key, { count: 1, windowStart: now });
    return false;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return true;
  }

  entry.count += 1;
  return false;
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      request.headers.get('x-real-ip') ||
      'anonymous';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { success: false, error: 'Rate limit exceeded for diagnostic reporting' },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const correlationId = body.correlationId || extractCorrelationId(request.headers);

    const message = typeof body.message === 'string' && body.message.trim().length > 0
      ? body.message.trim()
      : 'Client Runtime Error';

    const category: DiagnosticCategory =
      body.category && typeof body.category === 'string'
        ? (body.category as DiagnosticCategory)
        : 'FRONTEND_RUNTIME';

    const severity: DiagnosticSeverity =
      body.severity && typeof body.severity === 'string'
        ? (body.severity as DiagnosticSeverity)
        : 'MEDIUM';

    const userAgent = request.headers.get('user-agent') || body.userAgent;
    const url = body.url || request.headers.get('referer');

    const result = await diagnosticsService.recordEvent({
      category,
      severity,
      source: 'FRONTEND',
      message,
      errorCode: body.errorCode || body.name,
      route: body.route || (url ? new URL(url, 'https://zealosh.com').pathname : undefined),
      stackTrace: body.stack,
      componentStack: body.componentStack,
      userId: body.userId,
      userEmail: body.userEmail,
      correlationId,
      clientInfo: {
        userAgent,
        ip,
        url,
      },
      metadata: typeof body.metadata === 'object' && body.metadata !== null ? body.metadata : {},
    });

    return NextResponse.json({
      success: true,
      correlationId: result.correlationId,
      issueId: result.issue.id,
      reopened: result.reopened,
    });
  } catch (err: any) {
    console.error('[DiagnosticsReport] Error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal reporting failure' },
      { status: 500 }
    );
  }
}

