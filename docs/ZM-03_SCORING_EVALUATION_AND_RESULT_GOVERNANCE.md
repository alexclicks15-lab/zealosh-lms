# Zealosh LMS — ZM-03 & ZM-03.1 Scoring, Manual Rubric Evaluation & Result Governance Specification

**Milestones:** ZM-03 & ZM-03.1  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Objective Domain Scoring, Authoritative Manual Rubric Evaluations & Result Publication  
**Authoritative Implementation:** [`src/lib/store/db.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts) & [`supabase/migrations/20261031000011_zealosh_exam_and_commerce_phase3.sql`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/supabase/migrations/20261031000011_zealosh_exam_and_commerce_phase3.sql)

---

## 1. Objective Scoring Engine & Frozen Snapshots

Objective questions are scored exclusively against the candidate attempt's server-authoritative frozen question snapshot (`questionSnapshots`):

### Scoring Calculation Rules
1. **Per-Question Scoring:**
   - Single-choice and multiple-choice items evaluate candidate responses against `FrozenExamQuestionSnapshot.correctOptionIds`.
   - Full points are awarded on exact match; 0 points on mismatch.
2. **Domain Diagnostic Breakdown:**
   - Scores are computed across domains (`domainBreakdown`):
     - `total`: Total questions presented in domain.
     - `correct`: Questions correctly answered.
     - `percent`: Percentage achieved in domain ($\text{round}((\text{correct} / \text{total}) \times 100)$).
   - Generates personalized diagnostic feedback identifying domain strengths and weaknesses.
3. **Passing Grade Determination:**
   - Total score percentage: $\text{round}((\text{correctCount} / \text{totalQuestions}) \times 100)$.
   - Passed if $\text{totalScorePercent} \ge \text{passingScorePercent}$.

---

## 2. Normalized Authoritative Manual Rubric Evaluation Queue

For examinations incorporating subjective hazard scenarios or incident command calculations:

1. **State Transition:**
   - If an examination contains scenario questions or rubric criteria, `submitExamAttempt` sets `attempt.status = 'PENDING_MANUAL_EVALUATION'`.
   - Results are sealed until formally evaluated.
2. **Authoritative Table (`exam_manual_evaluations`):**
   - Manual rubric scores are recorded in the normalized `exam_manual_evaluations` table.
   - Foreign keys to `exam_attempts(id)`, `exam_questions(id)`, and `users(id)` enforce `ON DELETE RESTRICT`, preventing accidental cascade deletion of evaluation history.
3. **Score Aggregation & Result Publication (`publishExamResults`):**
   - Aggregates awarded points directly from `exam_manual_evaluations`.
   - Combines objective score + manual score to compute final weighted percentage.
   - Transitions attempt to `COMPLETED` and issues official examination certificate if passed.

---

## 3. Strict Separation of Examination & Course Completion Certificates

To prevent credential confusion and comply with accreditation standards:
1. **Course Completion Certificates:** Issued upon completing required coursework and lesson progression. Code format: `ZEI/COURSE/YYYY/XXXXXX`.
2. **Examination Certificates:** Issued only upon passing an official certification examination simulation. Code format: `ZEI/EXAM/YYYY/XXXXXX`.
3. Independent public verification URLs: `/verify/{code}` validates the credential type, recipient name, course title, and score.
