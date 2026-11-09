import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';

export async function GET() {
  try {
    const tree = await db.getAcademicTree();
    return NextResponse.json({
      success: true,
      tree: tree.departments,
      departments: tree.departments,
      academicYears: tree.academicYears,
      academicTree: tree,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to retrieve academic hierarchy tree' }, { status: 500 });
  }
}
