import { NextRequest, NextResponse } from 'next/server';
import { institutionalArchiveService } from '@/lib/audit/institutional-archive-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const providedContent = body.content !== undefined ? body.content : undefined;

    const outcome = await institutionalArchiveService.verifyArchiveIntegrity(id, providedContent);

    return NextResponse.json({
      success: outcome.verified,
      integrityStatus: outcome.status,
      expectedChecksum: outcome.expectedChecksum,
      calculatedChecksum: outcome.calculatedChecksum,
      error: outcome.error,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

