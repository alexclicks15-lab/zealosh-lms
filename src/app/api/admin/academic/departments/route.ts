import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { Department } from '@/types';

export async function GET() {
  try {
    const departments = await db.getDepartments();
    return NextResponse.json({ success: true, departments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to list departments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, code, description, headInstructorId, status } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      return NextResponse.json({ error: 'Department code is required' }, { status: 400 });
    }

    const id = body.id || `dept-${code.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    const now = new Date().toISOString();

    const department: Department = {
      id,
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description ? description.trim() : undefined,
      headInstructorId,
      status: status || 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const saved = await db.saveDepartment(department);
    return NextResponse.json({ success: true, department: saved }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to create department' }, { status: 500 });
  }
}

