// Zealosh LMS — AI Service Health Diagnostic API
// Workstream B: Returns honest unconfigured status when inference provider is not deployed

import { NextResponse } from 'next/server';
import { authorizeAdmin } from '@/lib/auth/admin-guard';
import { aiProviderAdapter } from '@/lib/ai/ai-provider-adapter';

export async function GET(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const health = await aiProviderAdapter.getServiceHealth();
    return NextResponse.json({ success: true, health });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to resolve AI provider health' },
      { status: 500 }
    );
  }
}

