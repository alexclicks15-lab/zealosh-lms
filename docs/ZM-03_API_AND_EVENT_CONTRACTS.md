# Zealosh LMS — ZM-03 API & Event Contracts Specification

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** REST Endpoints, Payload Schemas & Error Codes for Examination and Commerce  
**Authoritative Reference:** [route.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/app/api/exams/[examId]/route.ts), [route.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/app/api/admin/exams/evaluations/route.ts)

---

## 1. Examination Engine REST Endpoints

### 1. `GET /api/exams`
- **Access:** Authenticated.
- **Query Params:** `certificationType?: string`.
- **Response:** `{ success: true, blueprints: ExamBlueprint[] }` (all with shielded answer keys).

### 2. `GET /api/exams/[examId]`
- **Access:** Authenticated.
- **Description:** Reconnect recovery endpoint. Fetches candidate's active attempt and shielded questions.
- **Response:**
  ```json
  {
    "success": true,
    "blueprint": { "id": "bp-asp-01", "title": "ASP Exam Blueprint", ... },
    "activeAttempt": {
      "id": "att-001",
      "status": "IN_PROGRESS",
      "startTime": "2026-10-31T10:00:00Z",
      "deadlineTime": "2026-10-31T11:01:00Z",
      "gracePeriodSeconds": 60,
      "answers": { "q1": ["opt-a"] },
      "bookmarkedQuestionIds": []
    },
    "questions": [
      { "id": "q1", "questionText": "...", "options": [...] }
    ]
  }
  ```

### 3. `POST /api/exams/[examId]/start`
- **Access:** Enrolled Candidate.
- **Payload:** `{}`
- **Response:** `{ success: true, attempt: ExamAttempt, questions: ExamQuestion[] }`.
- **Errors:**
  - `400 / 403 EXAM_SITTING_WINDOW_CLOSED`
  - `403 MAX_ATTEMPTS_EXCEEDED`
  - `404 EXAM_NOT_FOUND`

### 4. `PUT /api/exams/[examId]/answers`
- **Access:** Candidate (Active Attempt).
- **Payload:** `{ answers: Record<string, string[]>, bookmarkedQuestionIds?: string[] }`.
- **Response:** `{ success: true, autosavedAt: string }`.
- **Errors:** `400 EXAM_ATTEMPT_EXPIRED`.

### 5. `POST /api/exams/[examId]/submit`
- **Access:** Candidate (Active Attempt).
- **Payload:** `{ answers?: Record<string, string[]> }`.
- **Response:**
  ```json
  {
    "success": true,
    "status": "COMPLETED | PENDING_MANUAL_EVALUATION",
    "totalScorePercent": 85,
    "passed": true,
    "certificateNumber": "ZEI/EXAM/2026/000001",
    "domainBreakdown": { ... }
  }
  ```

### 6. `GET /api/admin/exams/evaluations`
- **Access:** Instructor / Admin.
- **Response:** `{ success: true, queue: ExamAttempt[] }` (attempts awaiting manual evaluation).

### 7. `POST /api/admin/exams/evaluations`
- **Access:** Instructor / Admin.
- **Payload:**
  ```json
  {
    "action": "grade | publish",
    "attemptId": "att-001",
    "questionId": "q-essay-01",
    "awardedPoints": 15,
    "feedback": "Comprehensive mitigation steps identified."
  }
  ```

---

## 2. Commerce & Invoicing REST Endpoints

### 1. `POST /api/payments/order`
- **Access:** Enrolled / Prospective Candidate.
- **Payload:** `{ courseId: string, batchId: string, billingAddress: BillingAddress }`.
- **Response:** `{ success: true, order: PaymentOrder, gatewayOrder: { id, amount, currency } }`.

### 2. `POST /api/payments/webhook`
- **Access:** Public (Protected by HMAC-SHA256 Signature Header `x-razorpay-signature`).
- **Payload:** Gateway webhook JSON.
- **Response:** `{ success: true, message: "Order completed" }` (HTTP 200).
- **Idempotency:** Replay returns HTTP 200 with zero duplicate mutations.

### 3. `GET /api/invoices/[invoiceId]`
- **Access:** Order Owner or Admin.
- **Response:** `{ success: true, invoice: InvoiceRecord, creditNotes: InvoiceCreditNote[] }`.

### 4. `POST /api/admin/refunds`
- **Access:** Admin.
- **Payload:** `{ orderId: string, reason: string }`.
- **Response:** `{ success: true, creditNote: InvoiceCreditNote, invoice: InvoiceRecord }`.

