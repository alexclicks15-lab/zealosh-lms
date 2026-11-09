import { NextRequest, NextResponse } from 'next/server';
import { institutionalArchiveService } from '@/lib/audit/institutional-archive-service';
import { db } from '@/lib/store/db';

export async function GET() {
  try {
    const archives = await db.getInstitutionalAuditArchives();
    return NextResponse.json({
      success: true,
      count: archives.length,
      archives,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { archivePeriod, scope, includedEventTypes, format, actorUserId = 'admin' } = body;

    if (!archivePeriod) {
      return NextResponse.json({ success: false, error: 'archivePeriod is required (e.g. "2026-Q4").' }, { status: 400 });
    }

    const outcome = await institutionalArchiveService.generateArchive({
      archivePeriod,
      scope,
      includedEventTypes,
      format,
      actorUserId,
    });

    if (!outcome.success) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      archive: outcome.archive,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

