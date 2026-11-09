import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { Programme } from '@/types';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const departmentId = url.searchParams.get('departmentId') || undefined;
    const programmes = await db.getProgrammes(departmentId);
    return NextResponse.json({ success: true, programmes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list programmes' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { departmentId, name, code, credentialTitle, description, durationMonths, status } = body;

    if (!departmentId || !name || !code) {
      return NextResponse.json({ error: 'departmentId, name, and code are required' }, { status: 400 });
    }

    const dept = await db.getDepartmentById(departmentId);
    if (!dept) {
      return NextResponse.json({ error: `Department ${departmentId} does not exist` }, { status: 404 });
    }

    const id = body.id || `prog-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const now = new Date().toISOString();

    const programme: Programme = {
      id,
      departmentId,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      credentialTitle: credentialTitle ? credentialTitle.trim() : undefined,
      description: description ? description.trim() : undefined,
      durationMonths: Number(durationMonths) || 4,
      status: status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveProgramme(programme);
    return NextResponse.json({ success: true, programme: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create programme' }, { status: 500 });
  }
}

