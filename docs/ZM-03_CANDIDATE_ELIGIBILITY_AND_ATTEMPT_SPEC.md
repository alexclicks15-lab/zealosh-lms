# Zealosh LMS — ZM-03 Candidate Eligibility & Attempt Lifecycle Specification

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Enrollment Verification, Sitting Allocation & Attempt Enforcement  
**Authoritative Reference:** [db.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts)

---

## 1. Candidate Eligibility Gate

Candidates cannot initiate an examination without satisfying strict server-enforced prerequisites:

1. **Identity & Authentication:** Candidate must hold a verified, active Zealosh user account (`status: 'ACTIVE'`).
2. **Active Academic Enrollment:** Candidate must be enrolled in a cohort batch associated with the target certification course.
3. **Sitting Window Validation:**
   - Blueprints or cohort schedules define `sittingStartTime` and `sittingEndTime`.
   - Initiation requests outside this interval are rejected with `EXAM_SITTING_WINDOW_CLOSED`.
4. **Attempt Limit Enforcement:**
   - Candidate attempts are counted per blueprint (`existingAttempts.length`).
   - If `existingAttempts.length >= blueprint.maxAttempts`, further starts are rejected with `MAX_ATTEMPTS_EXCEEDED`.

---

## 2. Examination Attempt Initialization

Upon invocation of `POST /api/exams/[examId]/start`:
- System checks for an existing active attempt (`status: 'IN_PROGRESS'`). If found, it returns the active attempt (idempotent resume).
- System selects questions stratified across domains specified in the blueprint.
- Questions are shuffled if `shuffleQuestions: true`.
- Attempt record is inserted into PostgreSQL `exam_attempts`:
  - `deadlineTime = now + timeLimitMinutes * 60 + gracePeriodSeconds`.
  - `assignedQuestionIds = selectedQuestions.map(q => q.id)`.
  - `answers = {}`.
  - `status = 'IN_PROGRESS'`.

---

## 3. In-Flight Autosave & Resiliency

- **Endpoint:** `PUT /api/exams/[examId]/answers`
- **Payload:** `{ answers: Record<string, string[]>, bookmarkedQuestionIds?: string[] }`
- **Validation:**
  - Verifies attempt exists and belongs to the requesting user.
  - Verifies `status === 'IN_PROGRESS'`.
  - Verifies current server timestamp `< deadlineTime + gracePeriodSeconds`.
- **Database Write:** Updates `answers`, `bookmarkedQuestionIds`, and sets `autosavedAt = now()`.
- **Failure Recovery:** If candidate experiences device crashes, battery outage, or network disruption, answers up to the last successful autosave are intact.

