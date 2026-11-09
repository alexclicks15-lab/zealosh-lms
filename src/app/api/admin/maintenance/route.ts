import { NextRequest, NextResponse } from 'next/server';
import { maintenanceService } from '@/lib/maintenance/maintenance-service';
import { db } from '@/lib/store/db';

export async function GET() {
  try {
    const config = await maintenanceService.getEffectiveConfig();
    const history = await db.getMaintenanceHistory();

    return NextResponse.json({
      success: true,
      config,
      history,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const actorUserId = body.actorUserId || 'admin';

    const updated = await maintenanceService.updateConfig(body, actorUserId);

    return NextResponse.json({
      success: true,
      config: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

