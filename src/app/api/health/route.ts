// Zealosh LMS — Public Health Check Endpoint
// Route: GET /api/health
// Exposes unprivileged, public-safe operational telemetry for load balancers & uptime monitors.
// Supports:
//   - GET /api/health (Standard overview)
//   - GET /api/health?type=liveness (Fast HTTP 200 ping)
//   - GET /api/health?type=readiness (Deep database readiness check)
// Strictly scrubbed: Zero secrets, zero stack traces, zero internal IPs or infrastructure strings.

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/store/db';
import { checkSupabaseHealth } from '@/lib/diagnostics/health-checker';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse>;
export async function GET(): Promise<NextResponse>;
export async function GET(request?: NextRequest): Promise<NextResponse> {
  const correlationId = `corr-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const searchParams = request?.nextUrl?.searchParams;
  const probeType = searchParams?.get('type') || 'standard';

  // 1. Fast Liveness Probe
  if (probeType === 'liveness') {
    return NextResponse.json(
      {
        status: 'UP',
        timestamp,
        correlationId,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'x-correlation-id': correlationId,
        },
      }
    );
  }

  // 2. Standard / Readiness Probe
  try {
    let dbStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';

    const storageMode = db.getStorageMode();
    if (storageMode === 'supabase' || storageMode === 'postgres') {
      const sbHealth = await checkSupabaseHealth();
      if (sbHealth.status === 'DOWN') {
        dbStatus = 'DOWN';
      } else if (sbHealth.status === 'DEGRADED') {
        dbStatus = 'DEGRADED';
      }
    } else {
      // In-memory mode: verify basic store accessibility
      try {
        const userCount = db.users.size;
        dbStatus = userCount >= 0 ? 'HEALTHY' : 'DEGRADED';
      } catch {
        dbStatus = 'DOWN';
      }
    }

    let outboxStatus: 'HEALTHY' | 'DEGRADED' = 'HEALTHY';
    let pendingJobs = 0;
    if (probeType === 'readiness') {
      try {
        const { jobs } = await db.getEmailOutboxJobs({ status: 'QUEUED', limit: 100 });
        pendingJobs = jobs.length;
        if (pendingJobs > 500) {
          outboxStatus = 'DEGRADED';
        }
      } catch {
        outboxStatus = 'DEGRADED';
      }
    }

    const overallStatus =
      dbStatus === 'DOWN'
        ? 'DOWN'
        : dbStatus === 'DEGRADED' || outboxStatus === 'DEGRADED'
          ? 'DEGRADED'
          : 'HEALTHY';
    const httpStatus = overallStatus === 'DOWN' ? 503 : 200;

    return NextResponse.json(
      {
        status: overallStatus,
        probeType,
        timestamp,
        correlationId,
        services: {
          application: 'HEALTHY',
          database: dbStatus,
          ...(probeType === 'readiness' ? { outbox: outboxStatus, queueDepth: pendingJobs } : {}),
        },
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'x-correlation-id': correlationId,
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'DOWN',
        probeType,
        timestamp,
        correlationId,
        services: {
          application: 'DEGRADED',
          database: 'DOWN',
        },
      },
      {
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'x-correlation-id': correlationId,
        },
      }
    );
  }
}
