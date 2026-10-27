---
name: background-jobs-and-queues
description: >-
  Asynchronous job processing, queue architectures, event handlers, retry policies, and scheduled cron tasks.
  Use this skill when implementing background workers, event-driven pipelines, webhook dispatchers,
  email/SMS queues, dead letter queues (DLQ), and idempotent job handlers.
---

# Background Jobs & Queues Runbook

This skill outlines design patterns and operational procedures for asynchronous processing, background task queues, and fault-tolerant event handling.

---

## 1. Asynchronous Architecture Patterns

```
[ Web Request / Event ]
       │
       ▼
[ Enqueue Job ] ── Writes job payload to persistent queue (Redis / BullMQ / Postgres Job Table)
       │
       ▼ (202 Accepted returned to client)
[ Background Worker Pool ]
       │
       ├── Attempt Job Execution
       ├── Success ──> Mark complete & emit downstream event
       └── Failure ──> Evaluate Retry Strategy
             ├── Retry with Exponential Backoff + Jitter (e.g., attempt 1: 5s, attempt 2: 30s, attempt 3: 5m)
             └── Max Retries Exceeded ──> Move to Dead Letter Queue (DLQ) & Alert
```

---

## 2. Job Handler Invariants

1. **Idempotency**: Every job must be safely retryable. Use a unique `job_id` or `idempotency_key` check in the database before performing side effects.
2. **Transaction Isolation**: Separate database updates from external network calls (e.g., sending emails via Resend or SMS via Twilio).
3. **Payload Minimalism**: Store only entity IDs (e.g., `{ orderId: 'ord_123' }`) rather than full entity snapshots in the queue. Fetch fresh data from the database at execution time.
4. **Timeouts & Heartbeats**: Configure explicit job timeouts to prevent hung processes from blocking workers.

---

## 3. Postgres-Backed Queue Pattern (SKIP LOCKED)

For lightweight setups without external Redis dependencies, use transactional row locking:

```sql
-- Atomic job fetch and lock
WITH next_job AS (
  SELECT id
  FROM background_jobs
  WHERE status = 'pending' 
    AND run_at <= NOW()
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
UPDATE background_jobs
SET status = 'processing',
    locked_at = NOW(),
    attempts = attempts + 1
WHERE id IN (SELECT id FROM next_job)
RETURNING *;
```

---

## 4. Dead Letter Queue (DLQ) & Observability

- **DLQ Monitoring**: Every job that fails all retries must land in the DLQ table/stream with:
  - `job_id`, `payload`, `error_message`, `stack_trace`, `failed_at`, `total_attempts`.
- **Replay Tooling**: Build an administrative endpoint or CLI script to safely re-queue DLQ items after bug fixes.
