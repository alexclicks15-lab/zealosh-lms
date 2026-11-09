import { NextResponse } from 'next/server';
import { vectorRagService } from '@/lib/ai/vector-rag-service';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const result = await vectorRagService.ingestAndIndexDocument({
      documentId: params.id,
      content: body.content,
      approvedBy: body.approvedBy || 'admin',
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

