# WORKSTREAM G — ROW-LEVEL SECURITY & AUTHORIZATION REPORT

### 1. Evaluated RLS Policies
- **`exam_manual_evaluations`:**
  - `"Faculty manage manual evaluations"`: Allows `SUPER_ADMIN`, `ORG_ADMIN`, `INSTRUCTOR`, `COURSE_MANAGER`.
  - `"Learner view own manual evaluations"`: Candidates can only view their own records AFTER attempt status is `COMPLETED`. In-flight evaluations are completely hidden from candidates.
- **`invoice_credit_notes`:**
  - `"Learner view own credit notes"`: Restricted to `user_id = auth.uid()::text`.
  - `"Admin manage credit notes"`: Restricted to administrative roles.
- **`payment_webhook_events`:**
  - Only accessible to administrators and service role.

### 2. Security Remediation (MFA Guard)
- Removed untrusted client header `x-mfa-verified` in `src/lib/auth/admin-guard.ts`. Admin requests must carry signed JWT claims (`aal2` or `mfaVerified`).
