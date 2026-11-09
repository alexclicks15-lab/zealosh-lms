# WORKSTREAM A — DURABLE EXAMINATION SNAPSHOT INTEGRITY REPORT

### 1. Persistence Architecture
- **In-Memory & Filesystem Store:** `ExamAttempt.questionSnapshots` stores complete `FrozenExamQuestionSnapshot[]` records. Serialized during `this.persistToDisk()` and hydrated during `hydrateFromDisk()`.
- **Supabase PostgreSQL:** Stored as `question_snapshots JSONB` on `public.exam_attempts` (added in migration `20261031000011`).

### 2. Snapshot Immutability Under Mutation
In `tests/phase3-integrity-closure.test.ts` (test 1):
1. An attempt is started with assigned question `q1`.
2. The stem, options, and points are captured in `attempt.questionSnapshots`.
3. The authoritative question bank is subsequently mutated: stem altered, correct option ID swapped from `opt-env-b` to `opt-env-d`.
4. The candidate fetches questions: projected stem retains original unmutated text.
5. The candidate submits answer `['opt-env-b']`: scoring evaluates exclusively against the frozen snapshot, awarding full marks (100%) and ignoring bank mutations.

### 3. Survival Across Restarts
Because snapshots are embedded within the attempt record in both PostgreSQL (`question_snapshots JSONB`) and JSON store, stopping and restarting the server maintains attempt fidelity.
