import { NextResponse } from 'next/server';
import { maintenanceService } from '@/lib/maintenance/maintenance-service';

export async function GET() {
  try {
    const config = await maintenanceService.getEffectiveConfig();

    return NextResponse.json({
      success: true,
      enabled: config.enabled,
      mode: config.mode,
      maintenanceMessage: config.maintenanceMessage,
      publicExplanation: config.publicExplanation,
      scheduledEndTime: config.scheduledEndTime,
      affectedScope: config.affectedScope,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

