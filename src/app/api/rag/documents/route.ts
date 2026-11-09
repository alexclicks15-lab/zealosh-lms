import { NextResponse } from 'next/server';
import { vectorRagService, inMemoryRagDocuments } from '@/lib/ai/vector-rag-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get('courseId');

    let docs = Array.from(inMemoryRagDocuments.values());
    if (courseId) {
      docs = docs.filter((d) => d.courseId === courseId);
    }

    return NextResponse.json({ success: true, count: docs.length, documents: docs });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const doc = await vectorRagService.registerDocument({
      courseId: body.courseId,
      title: body.title,
      docType: body.docType || 'LEARNING_MATERIAL',
      sourceFileName: body.sourceFileName,
      uploadedBy: body.uploadedBy || 'admin',
      content: body.content,
    });

    return NextResponse.json({ success: true, document: doc }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}

