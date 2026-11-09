import { NextRequest, NextResponse } from 'next/server';
import { institutionalArchiveService } from '@/lib/audit/institutional-archive-service';
import { db } from '@/lib/store/db';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const actorUserId = searchParams.get('actorUserId') || 'admin';

    const archive = await db.getInstitutionalAuditArchiveById(id);
    if (!archive) {
      return NextResponse.json({ success: false, error: 'Archive not found.' }, { status: 404 });
    }

    await institutionalArchiveService.recordArchiveDownload(id, actorUserId);

    return NextResponse.json({
      success: true,
      archiveId: archive.id,
      archivePeriod: archive.archivePeriod,
      format: archive.format,
      contentChecksum: archive.contentChecksum,
      manifest: archive.manifest,
      downloadCount: (archive.downloadCount || 0) + 1,
    }, {
      headers: {
        'x-content-sha256': archive.contentChecksum,
        'Content-Disposition': `attachment; filename="zealosh-audit-${archive.archivePeriod}.${archive.format.toLowerCase()}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

