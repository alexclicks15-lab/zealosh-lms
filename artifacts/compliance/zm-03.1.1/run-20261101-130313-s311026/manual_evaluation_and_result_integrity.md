# WORKSTREAM E — MANUAL EVALUATION & RESULT INTEGRITY REPORT

### 1. Data Model & Foreign Key Safety
- **Queue Table:** `public.exam_manual_evaluations` (Migration `20261031000011`).
- **Foreign Keys:**
  - `attempt_id REFERENCES public.exam_attempts(id) ON DELETE RESTRICT`
  - `question_id REFERENCES public.exam_questions(id) ON DELETE RESTRICT`
  - `user_id REFERENCES public.users(id) ON DELETE RESTRICT`
  - `evaluator_id REFERENCES public.users(id) ON DELETE RESTRICT`
- **Protection:** Deleting a candidate user or exam question is blocked at the database constraint level if evaluation records exist.

### 2. Workflow Lifecycle
1. When an attempt containing subjective questions (`type === 'SCENARIO_BASED'` or rubric criteria) is submitted, status transitions to `PENDING_MANUAL_EVALUATION`.
2. Evaluator accesses queue via `GET /api/admin/exams/evaluations` (guarded by staff RBAC: `SUPER_ADMIN`, `ORG_ADMIN`, `INSTRUCTOR`).
3. Evaluator submits criteria marks via `POST /api/admin/exams/evaluations`.
4. Results are published via `PUT /api/admin/exams/evaluations` (`publish: true`), computing final percentage and issuing certificates if passed.
