import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const { role } = await request.json();
    if (!role || !role.name || !Array.isArray(role.permissions)) {
      return NextResponse.json({ success: false, error: 'Valid role specification required' }, { status: 400 });
    }

    const existing = role.id ? await db.getRole(role.id) : null;
    if (existing) {
      const updated = await db.updateRolePermissions(role.id, role.permissions, actor.email);
      return NextResponse.json({ success: true, role: updated });
    } else {
      const created = await db.createRole(role, actor.email);
      return NextResponse.json({ success: true, role: created });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }
    const { actor } = authResult;

    const { roleId } = await request.json();
    if (!roleId) {
      return NextResponse.json({ success: false, error: 'roleId required' }, { status: 400 });
    }

    const success = await db.deleteRole(roleId, actor.email);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
