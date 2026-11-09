// Zealosh LMS — Public Health Check Endpoint
// Route: GET /api/health
// Exposes unprivileged, public-safe operational telemetry for load balancers & uptime monitors.
// Strictly scrubbed: Zero secrets, zero stack traces, zero internal IPs or infrastructure strings.

import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { checkSupabaseHealth } from '@/lib/diagnostics/health-checker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const timestamp = new Date().toISOString();
    let dbStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN' = 'HEALTHY';

    // 1. Storage check (Supabase probe or in-memory operational check)
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

    const overallStatus = dbStatus === 'DOWN' ? 'DOWN' : dbStatus === 'DEGRADED' ? 'DEGRADED' : 'HEALTHY';
    const httpStatus = overallStatus === 'DOWN' ? 503 : 200;

    return NextResponse.json(
      {
        status: overallStatus,
        timestamp,
        services: {
          application: 'HEALTHY',
          database: dbStatus,
        },
      },
      {
        status: httpStatus,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch {
    return NextResponse.json(
      {
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        services: {
          application: 'DEGRADED',
          database: 'DOWN',
        },
      },
      { status: 503 }
    );
  }
}
