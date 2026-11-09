import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const application = await db.getAdmissionApplicationById(id);

    if (!application) {
      return NextResponse.json({ error: 'Admission application not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      application,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve application details' }, { status: 500 });
  }
}

