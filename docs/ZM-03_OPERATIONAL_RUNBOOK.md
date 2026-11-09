# Zealosh LMS — ZM-03 Operational Runbook

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Examination Administration, Evaluation Queue Management & Invoice Auditing  
**Authoritative Reference:** [db.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts)

---

## 1. Routine Examination Administration

### A. Scheduling a Certification Exam Sitting
1. Navigate to SuperAdmin Examination Management (`/admin`).
2. Select target certification blueprint (e.g., `ASP Exam Blueprint v1`).
3. Set `sittingStartTime` and `sittingEndTime` corresponding to the cohort schedule.
4. Verify question bank item count meets blueprint minimum domain requirements.
5. Publish blueprint status to `ACTIVE`.

### B. Managing Manual Evaluation Queue
1. Log in with `INSTRUCTOR` or `ADMIN` credentials.
2. Query pending evaluations: `GET /api/admin/exams/evaluations`.
3. Select an attempt with status `PENDING_MANUAL_EVALUATION`.
4. Review candidate's subjective response against displayed `rubricCriteria`.
5. Enter awarded marks and qualitative feedback; submit evaluation.
6. Once all subjective items have been evaluated, click "Publish Official Results" (`publishExamResults`).

---

## 2. Commerce & Invoice Administration

### A. Inspecting Invoices & Tax Breakdowns
1. Query `GET /api/invoices/[invoiceId]`.
2. Verify:
   - Consecutive serial number: `INV-YYYY-XXXX`.
   - Buyer GSTIN and Place of Supply code.
   - Tax breakdown: 9% CGST + 9% SGST for Kerala, 18% IGST for interstate, or 0% LUT for foreign export.
3. Invoices are permanently archived and accessible for statutory GSTR-1 and GSTR-3B filings.

### B. Executing Student Refunds & Credit Notes
1. Identify order to refund (`POST /api/admin/refunds`).
2. Provide mandatory justification reason in the prompt.
3. System issues Credit Note `CN-YYYY-XXXX` automatically.
4. Verify that enrollment status shifts to `REVOKED` and batch seats are freed.

