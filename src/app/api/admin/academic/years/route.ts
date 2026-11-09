import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { AcademicYear } from '@/types';

export async function GET() {
  try {
    const years = await db.getAcademicYears();
    return NextResponse.json({ success: true, years });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list academic years' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, startDate, endDate, isCurrent, status } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Academic year name is required' }, { status: 400 });
    }

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return NextResponse.json({ error: 'Start date must precede end date' }, { status: 400 });
    }

    const id = body.id || `ay-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();

    const academicYear: AcademicYear = {
      id,
      name: name.trim(),
      code: code ? code.trim() : undefined,
      startDate,
      endDate,
      isCurrent: Boolean(isCurrent),
      status: status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveAcademicYear(academicYear);
    return NextResponse.json({ success: true, academicYear: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create academic year' }, { status: 500 });
  }
}

