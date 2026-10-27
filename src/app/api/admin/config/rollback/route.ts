import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const { auditId } = await request.json();
    if (!auditId) {
      return NextResponse.json({ success: false, error: 'auditId required for rollback' }, { status: 400 });
    }

    const success = await db.rollbackConfig(auditId, actor.email);
    if (!success) {
      return NextResponse.json({ success: false, error: 'Audit version not found or ineligible for rollback' }, { status: 404 });
    }

    const [platformSettings, brandingTheme, navigationConfig, featureFlags] = await Promise.all([
      db.getPlatformSettings(),
      db.getBrandingTheme(),
      db.getNavigationConfig(),
      db.getFeatureFlags(),
    ]);

    return NextResponse.json({
      success: true,
      message: `Successfully rolled back configuration version ${auditId}`,
      currentConfig: {
        platformSettings,
        brandingTheme,
        navigationConfig,
        featureFlags,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
