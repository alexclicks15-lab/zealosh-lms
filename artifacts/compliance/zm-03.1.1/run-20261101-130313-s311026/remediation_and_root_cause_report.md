# REMEDIATION & ROOT-CAUSE REPORT

### Defect 1: Client Header Trust in Admin MFA Guard
- **File:** `src/lib/auth/admin-guard.ts` (Line 79)
- **Root Cause:** Guard evaluated `mfaHeader === 'true'` from `request.headers.get('x-mfa-verified')`, allowing client forgery.
- **Fix:** Removed header check. Enforce `payload.mfaVerified === true || payload.aal === 'aal2'`.
- **Test Updated:** `tests/phase1-final-auth-integrity.test.ts` updated to assert HTTP 403 on client header.

### Defect 2: Grace Period & Deadline Divergence in Supabase Adapter
- **File:** `src/lib/store/supabase-adapter.ts` (Lines 1982, 1993, 2018)
- **Root Cause:** Hardcoded 60s and failed to add grace period to `deadlineTime`.
- **Fix:** Sourced `gracePeriodSeconds = blueprint.gracePeriodSeconds ?? 60` and added to `deadlineTime`.

### Roadmap Item 16.1: Live Class Material Preloading
- **File:** `docs/IMPLEMENTATION_ROADMAP.md`
- **Action:** Documented all 12 functional requirements under Phase 2.1 as deferred roadmap items.
