import { NextResponse } from 'next/server';
import { db } from '@/lib/store/db';
import {
  getMaxDocumentSizeBytes,
  validateDocumentUpload,
} from '@/lib/storage/document-validation';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fullName,
      applicantName,
      email,
      applicantEmail,
      phone,
      applicantPhone,
      courseId,
      statementOfPurpose,
      documents,
    } = body;
    const preferredBatchId = body.preferredBatchId || body.batchId;

    const name = (fullName || applicantName || '').trim();
    const userEmail = (email || applicantEmail || '').trim().toLowerCase();

    if (!name) {
      return NextResponse.json({ error: 'Applicant name is required' }, { status: 400 });
    }

    if (!userEmail || !userEmail.includes('@')) {
      return NextResponse.json({ error: 'Valid applicant email address is required' }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ error: 'Course selection is required' }, { status: 400 });
    }

    const course = await db.getCourse(courseId);
    if (!course) {
      return NextResponse.json({ error: `Course not found with id: ${courseId}` }, { status: 404 });
    }

    if (preferredBatchId) {
      const batch = await db.getBatch(preferredBatchId);
      if (!batch) {
        return NextResponse.json({ error: `Selected batch not found with id: ${preferredBatchId}` }, { status: 404 });
      }
    }

    // Dynamic configurable file size limit
    const maxSizeBytes = getMaxDocumentSizeBytes();

    // Document security, magic byte & path traversal validation
    const sanitizedDocuments: any[] = [];
    if (Array.isArray(documents)) {
      for (let i = 0; i < documents.length; i++) {
        const doc = documents[i];
        const validation = validateDocumentUpload(doc, i, maxSizeBytes);

        if (!validation.valid) {
          return NextResponse.json({ error: validation.error }, { status: 400 });
        }

        sanitizedDocuments.push({
          documentType: doc.documentType || 'OTHER',
          filename: validation.sanitizedFilename,
          storagePath: doc.storagePath || `admissions/private/${Date.now()}-${i + 1}-${validation.sanitizedFilename}`,
          fileSizeBytes: validation.fileSizeBytes,
          mimeType: validation.mimeType,
          isVerified: false,
        });
      }
    }

    const application = await db.createAdmissionApplication({
      applicantName: name,
      applicantEmail: userEmail,
      applicantPhone: phone || applicantPhone,
      courseId,
      preferredBatchId,
      statementOfPurpose,
      documents: sanitizedDocuments,
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Admission application submitted successfully.',
        application,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err.message && err.message.includes('DUPLICATE_APPLICATION_EXISTS')) {
      return NextResponse.json(
        {
          error: 'DUPLICATE_APPLICATION_EXISTS',
          message: 'An active admission application already exists for this email and course.',
        },
        { status: 409 }
      );
    }
    if (err.message && (err.message.includes('COURSE_NOT_FOUND') || err.message.includes('BATCH_NOT_FOUND'))) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: err.message || 'Failed to submit admission application' }, { status: 500 });
  }
}
