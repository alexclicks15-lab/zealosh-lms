import { NextResponse } from 'next/server';
import { questionBankService } from '@/lib/assessment/question-bank-service';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await questionBankService.getQuestionItem(params.id);
    if (!data) {
      return NextResponse.json({ success: false, error: 'Question not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    if (body.action === 'TRANSITION_STATUS') {
      const version = await questionBankService.transitionVersionStatus({
        questionBankItemId: params.id,
        versionNumber: body.versionNumber,
        newStatus: body.newStatus,
        actorId: body.actorId || 'admin',
        changeSummary: body.changeSummary,
      });
      return NextResponse.json({ success: true, version });
    } else if (body.action === 'FORK_VERSION') {
      const version = await questionBankService.forkNewVersion({
        questionBankItemId: params.id,
        authorId: body.authorId || 'admin',
        updates: body.updates,
        changeSummary: body.changeSummary || 'Revision update',
      });
      return NextResponse.json({ success: true, version });
    } else {
      return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

