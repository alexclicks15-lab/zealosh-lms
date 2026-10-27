import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import { authorizeAdmin } from '@/lib/auth/admin-guard';

export async function POST(request: Request) {
  try {
    const authResult = authorizeAdmin(request);
    if ('errorResponse' in authResult) {
      return authResult.errorResponse;
    }

    const { workflow } = await request.json();
    if (!workflow || !workflow.title || !workflow.trigger) {
      return NextResponse.json({ success: false, error: 'Valid workflow payload required' }, { status: 400 });
    }
    if (!workflow.id) workflow.id = `wf-${Date.now().toString(36)}`;
    const saved = await db.saveWorkflow(workflow);
    return NextResponse.json({ success: true, workflow: saved });
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

    const { workflowId } = await request.json();
    if (!workflowId) return NextResponse.json({ success: false, error: 'workflowId required' }, { status: 400 });
    const success = await db.deleteWorkflow(workflowId);
    return NextResponse.json({ success });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
