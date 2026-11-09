import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { POST as applyHandler } from '@/app/api/admissions/apply/route';
import { GET as listAdmissionsHandler } from '@/app/api/admin/admissions/route';
import { GET as getAdmissionHandler } from '@/app/api/admin/admissions/[id]/route';
import { POST as reviewAdmissionHandler } from '@/app/api/admin/admissions/[id]/review/route';
import { POST as transferEnrollmentHandler } from '@/app/api/admin/enrollments/[id]/transfer/route';
import { POST as withdrawEnrollmentHandler } from '@/app/api/admin/enrollments/[id]/withdraw/route';
import { POST as bulkImportHandler } from '@/app/api/admin/admissions/bulk-import/route';

describe('Zealosh LMS — Phase 1 Workstream 3: Admissions & Student Lifecycle Management', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  it('1. should submit admission application with applicant metadata', async () => {
    const req = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Naveen Kumar',
        email: 'naveen.kumar@example.com',
        phone: '+91 984 600 7788',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-nov26',
        educationLevel: 'B.Sc Chemistry',
        industryExperienceYears: 5,
        currentEmployer: 'Apollo Tyres HSE Division',
        currentDesignation: 'Safety Executive',
        statementOfPurpose: 'Intend to achieve BCSP ASP credential to advance to Plant Safety Manager.',
      }),
    });

    const res = await applyHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.application.applicationNumber).toMatch(/^APP-\d{4}-\d{4}$/);
    expect(body.application.status).toBe('SUBMITTED');
  });

  it('2. should reject application for non-existent course or batch', async () => {
    const req = new Request('http://localhost:3000/api/admissions/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Invalid Candidate',
        email: 'invalid@example.com',
        phone: '+91 000 000 0000',
        courseId: 'crs-unknown-99',
        batchId: 'btc-unknown-99',
      }),
    });

    const res = await applyHandler(req);
    expect(res.status).toBe(404);
  });

  it('3. should attach and retrieve application documents', async () => {
    const app = await db.createAdmissionApplication({
      fullName: 'Rahul Varma',
      email: 'rahul.varma@example.com',
      phone: '+91 944 700 8899',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
    });

    const doc = await db.addApplicationDocument({
      applicationId: app.id,
      documentType: 'DEGREE_CERTIFICATE',
      filename: 'rahul-varma-btech-degree.pdf',
      storagePath: '/uploads/admissions/rahul-varma-degree.pdf',
      fileSizeBytes: 1048576,
      mimeType: 'application/pdf',
      uploadedAt: new Date().toISOString(),
      isVerified: true,
    });

    expect(doc.id).toBeDefined();

    const docs = await db.getApplicationDocuments(app.id);
    expect(docs.length).toBe(1);
    expect(docs[0].filename).toBe('rahul-varma-btech-degree.pdf');
    expect(docs[0].isVerified).toBe(true);
  });

  it('4. should filter admissions queue by status and course in /api/admin/admissions', async () => {
    const req = new Request('http://localhost:3000/api/admin/admissions?status=APPROVED&courseId=crs-asp-01');
    const res = await listAdmissionsHandler(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.applications.length).toBeGreaterThanOrEqual(1);
    expect(body.applications[0].status).toBe('APPROVED');
  });

  it('5. should review and approve application with atomic enrollment creation', async () => {
    // 1. Submit fresh application
    const app = await db.createAdmissionApplication({
      fullName: 'Meera Krishnan',
      email: 'meera.krishnan@example.com',
      phone: '+91 984 622 3344',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      educationLevel: 'B.Tech Fire & Safety',
      industryExperienceYears: 2,
    });

    // 2. Approve application
    const reqReview = new Request(`http://localhost:3000/api/admin/admissions/${app.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'APPROVED',
        notes: 'Verified qualifications. Approved for Cohort 16.',
        reviewerId: 'usr-admin-01',
      }),
    });

    const resReview = await reviewAdmissionHandler(reqReview, { params: Promise.resolve({ id: app.id }) });
    expect(resReview.status).toBe(200);
    const bodyReview = await resReview.json();
    expect(bodyReview.success).toBe(true);
    expect(bodyReview.application.status).toBe('APPROVED');
    expect(bodyReview.enrollment).toBeDefined();
    expect(bodyReview.enrollment.status).toBe('ACTIVE');
    expect(bodyReview.enrollment.batchId).toBe('btc-asp-nov26');

    // Verify User and Profile were generated
    const user = await db.getUserByEmail('meera.krishnan@example.com');
    expect(user).toBeDefined();
    expect(user?.role).toBe('STUDENT');
    const profile = await db.getProfile(user!.id);
    expect(profile?.fullName).toBe('Meera Krishnan');

    // 3. Re-reviewing already reviewed application is rejected
    const reqDuplicate = new Request(`http://localhost:3000/api/admin/admissions/${app.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'APPROVED',
        notes: 'Duplicate attempt',
        reviewerId: 'usr-admin-01',
      }),
    });
    const resDuplicate = await reviewAdmissionHandler(reqDuplicate, { params: Promise.resolve({ id: app.id }) });
    expect(resDuplicate.status).toBe(409);
  });

  it('6. should review and reject application without enrollment', async () => {
    const app = await db.createAdmissionApplication({
      fullName: 'Ineligible Applicant',
      email: 'ineligible@example.com',
      phone: '+91 900 000 1111',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
    });

    const reqReview = new Request(`http://localhost:3000/api/admin/admissions/${app.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        decision: 'REJECTED',
        notes: 'Insufficient industry experience for professional certification preparation.',
      }),
    });

    const resReview = await reviewAdmissionHandler(reqReview, { params: Promise.resolve({ id: app.id }) });
    expect(resReview.status).toBe(200);
    const bodyReview = await resReview.json();
    expect(bodyReview.application.status).toBe('REJECTED');
    expect(bodyReview.enrollment).toBeUndefined();
  });

  it('7. should execute atomic student batch transfer and update cohort counts', async () => {
    const enrollment = db.enrollments.get('enr-std-01-asp')!;
    const sourceBatch = db.batches.get(enrollment.batchId)!;
    const initialSourceCount = sourceBatch.enrolledCount || 0;

    const targetBatch = db.batches.get('btc-asp-weekday')!;
    const initialTargetCount = targetBatch.enrolledCount || 0;

    const reqTransfer = new Request(`http://localhost:3000/api/admin/enrollments/${enrollment.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetBatchId: 'btc-asp-weekday',
        reason: 'Work schedule clash; transferred to weekday intensive cohort.',
        approvedBy: 'usr-admin-01',
      }),
    });

    const resTransfer = await transferEnrollmentHandler(reqTransfer, { params: Promise.resolve({ id: enrollment.id }) });
    expect(resTransfer.status).toBe(200);
    const bodyTransfer = await resTransfer.json();
    expect(bodyTransfer.success).toBe(true);
    expect(bodyTransfer.transfer.sourceBatchId).toBe(sourceBatch.id);
    expect(bodyTransfer.transfer.targetBatchId).toBe('btc-asp-weekday');

    // Verify enrollment updated
    expect(enrollment.batchId).toBe('btc-asp-weekday');

    // Verify batch seat counts updated
    expect(sourceBatch.enrolledCount).toBe(Math.max(0, initialSourceCount - 1));
    expect(targetBatch.enrolledCount).toBe(initialTargetCount + 1);

    // Re-transferring to identical batch is rejected
    const reqIdentical = new Request(`http://localhost:3000/api/admin/enrollments/${enrollment.id}/transfer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetBatchId: 'btc-asp-weekday',
        reason: 'Duplicate transfer attempt to same batch.',
        approvedBy: 'usr-admin-01',
      }),
    });
    const resIdentical = await transferEnrollmentHandler(reqIdentical, { params: Promise.resolve({ id: enrollment.id }) });
    expect(resIdentical.status).toBe(409);
  });

  it('8. should withdraw student enrollment and update batch seats', async () => {
    const enrollment = db.enrollments.get('enr-std-01-asp')!;
    const batch = db.batches.get(enrollment.batchId)!;
    const initialCount = batch.enrolledCount || 0;

    const reqWithdraw = new Request(`http://localhost:3000/api/admin/enrollments/${enrollment.id}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reason: 'Relocated overseas to non-English jurisdiction.',
        refundAmount: 0,
        approvedBy: 'usr-admin-01',
      }),
    });

    const resWithdraw = await withdrawEnrollmentHandler(reqWithdraw, { params: Promise.resolve({ id: enrollment.id }) });
    expect(resWithdraw.status).toBe(200);
    const bodyWithdraw = await resWithdraw.json();
    expect(bodyWithdraw.success).toBe(true);
    expect(bodyWithdraw.withdrawal.reason).toContain('Relocated');

    // Enrollment cancelled
    expect(enrollment.status).toBe('CANCELLED');
    expect(batch.enrolledCount).toBe(Math.max(0, initialCount - 1));
  });

  it('9. should execute bulk CSV admissions import and report metrics', async () => {
    const csvData = [
      'fullName,email,phone,courseId,batchId,educationLevel,industryExperienceYears,currentEmployer,currentDesignation',
      'Anand Mohan,anand.m@example.com,+91 944 611 2233,crs-asp-01,btc-asp-nov26,B.Tech Mechanical,3,Bharat Petroleum,Safety Engineer',
      'Divya Pillai,divya.p@example.com,+91 984 722 3344,crs-asp-01,btc-asp-nov26,M.Tech Safety,4,L&T Construction,HSE Lead',
      'Corrupt Row,,+91 000 000 0000,crs-asp-01,btc-asp-nov26,None,0,None,None', // Missing email
    ].join('\n');

    const reqBulk = new Request('http://localhost:3000/api/admin/admissions/bulk-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csvContent: csvData }),
    });

    const resBulk = await bulkImportHandler(reqBulk);
    expect(resBulk.status).toBe(200);
    const bodyBulk = await resBulk.json();
    expect(bodyBulk.success).toBe(true);
    expect(bodyBulk.totalRows).toBe(3);
    expect(bodyBulk.importedCount).toBe(2);
    expect(bodyBulk.failedCount).toBe(1);
    expect(bodyBulk.errors.length).toBeGreaterThanOrEqual(1);

    // Verify users created
    const user1 = await db.getUserByEmail('anand.m@example.com');
    expect(user1).toBeDefined();
    const user2 = await db.getUserByEmail('divya.p@example.com');
    expect(user2).toBeDefined();
  });
});
