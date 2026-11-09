import { NextResponse } from 'next/server';
import { DomainRegistryService } from '@/lib/events/domain-registry';

export async function GET() {
  try {
    const domains = DomainRegistryService.getRegisteredDomains();
    return NextResponse.json({
      success: true,
      count: domains.length,
      domains,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

