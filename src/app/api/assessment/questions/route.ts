import { NextResponse } from 'next/server';
import { questionBankService } from '@/lib/assessment/question-bank-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const certificationType = searchParams.get('certificationType') || undefined;
    const status = (searchParams.get('status') as any) || undefined;
    const search = searchParams.get('search') || undefined;

    const items = await questionBankService.listQuestions({
      certificationType,
      status,
      search,
    });

    return NextResponse.json({ success: true, count: items.length, items });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await questionBankService.createQuestion(body);
    return NextResponse.json({ success: true, item: result.item, version: result.version }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

