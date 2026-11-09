# Zealosh LMS — ZM-03 Test Acceptance Matrix

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Automated Vitest Suite, Coverage Verification & Test Assertions  
**Authoritative Reference:** [phase3-exam-and-commerce.test.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/tests/phase3-exam-and-commerce.test.ts)

---

## 1. Automated Test Suite Metrics

- **Total Test Files:** 37 test files passing (100%).
- **Total Test Cases:** 457 passing test cases out of 457 total (0 failed, 0 skipped).
- **Execution Runtime:** ~13.17 seconds.
- **Dedicated Phase 3 Test Suite:** `tests/phase3-exam-and-commerce.test.ts` (17 tests).

---

## 2. Requirement to Test Matrix

| Req ID | Description | Test Assertion | Test File | Status |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-ZM03-01** | Blueprint creation & versioning | `createExamBlueprint` persists version 1, active status | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-02** | Question bank answer shielding | Correct answers & explanations stripped for candidate query | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-03** | Sitting window enforcement | Rejects attempt start before window open with `EXAM_SITTING_WINDOW_CLOSED` | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-04** | Server countdown deadline | Calculates exact deadline including grace period | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-05** | In-flight autosave & recovery | `saveExamAnswers` commits and `getExamAttempt` recovers state | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-06** | Objective domain scoring | Evaluates questions and generates domain diagnostic breakdown | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-07** | Manual rubric evaluation | Enters `PENDING_MANUAL_EVALUATION` and grades via rubric criteria | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-08** | Result publication | `publishExamResults` transitions to COMPLETED and publishes | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-09** | Exam certificate separation | Generates `ZEI/EXAM/YYYY/XXXXXX` distinct from course certificate | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-10** | Commerce order initiation | Pre-order checks capacity, records billing address | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-11** | Zero overselling guard | Rejects payment order when cohort capacity is reached | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-12** | HMAC-SHA256 signature check | Rejects invalid webhook signatures with security alert | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-13** | Webhook idempotency | Replaying paid webhook returns 200 with zero duplicate seats/invoices | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-14** | Intra-state GST (Kerala) | Applies 9% CGST + 9% SGST for Kerala billing address | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-15** | Inter-state GST | Applies 18% IGST for non-Kerala Indian address | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-16** | Export of Services (LUT) | Applies 0% GST under LUT `AD320326000142L` for foreign USD orders | `phase3-exam-and-commerce.test.ts` | **PASS** |
| **REQ-ZM03-17** | Refund Credit Note issuance | Generates `CN-YYYY-XXXX`, revokes enrollment, restores seat | `phase3-exam-and-commerce.test.ts` | **PASS** |

