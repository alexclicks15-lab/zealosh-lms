# PERFORMANCE & DIAGNOSTICS REPORT

### 1. Query & Indexing Optimization
- Partial indexes on `payment_orders(idempotency_key)` and `invoices(credit_note_id)`.
- Indexes on `exam_attempts(deadline_time)` and `exam_attempts(user_id, blueprint_id)`.
- Composite unique index on `payment_webhook_events(provider, event_id)`.

### 2. Diagnostics System
- Structured error logging via `db.recordAppErrorLog`.
- Student issue reporting via `db.createStudentProblemReport` (`REP-YYYY-XXXX`).
- Sensitive credential sanitization: Passwords, session cookies, and payment secrets are redacted before logging.
