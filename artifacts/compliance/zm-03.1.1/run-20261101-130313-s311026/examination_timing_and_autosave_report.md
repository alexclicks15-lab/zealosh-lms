# WORKSTREAM B & C — EXAMINATION TIMING & AUTOSAVE REPORT

### 1. Authoritative Server Deadline Formula
```
deadlineTime = startTime + (durationMinutes * 60 + gracePeriodSeconds) * 1000
```
- `startTime`: Generated server-side using `new Date().toISOString()`.
- `durationMinutes`: Sourced from the authoritative `ExamBlueprint`.
- `gracePeriodSeconds`: Sourced from `blueprint.gracePeriodSeconds ?? 60`.
- `deadlineTime`: Persisted as an immutable UTC timestamp.

### 2. Enforced Expiration Boundaries
1. **Autosave (`PUT /api/exams/[id]/answers`):**
   - Validates ownership (`attempt.userId === payload.userId`).
   - Checks `Date.now() >= deadlineTime`.
   - If expired, sets `attempt.status = 'EXPIRED'`, persists to disk/database, and aborts with HTTP 408 `EXAM_DEADLINE_EXPIRED`.
2. **Final Submission (`POST /api/exams/[id]/submit`):**
   - If expired, marks attempt `EXPIRED` and rejects scoring.
   - If submitted within deadline, transitions attempt to `COMPLETED` (or `PENDING_MANUAL_EVALUATION`) idempotently.
3. **Storage Harmonization Remediation:**
   - Patched `src/lib/store/supabase-adapter.ts` to incorporate `blueprint.gracePeriodSeconds ?? 60` into `deadlineTime` and PostgreSQL insert payload.
