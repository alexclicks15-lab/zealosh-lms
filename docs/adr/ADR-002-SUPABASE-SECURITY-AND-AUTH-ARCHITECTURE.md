# ADR-002: Server-Side Authoritative Data Access & Supabase Security Architecture

## Status
**APPROVED** — 2026-10-23

## Context
Zealosh Training & Consultants operates an enterprise HSE learning and certification platform (Zealosh LMS) built on Next.js 14 App Router. The platform features:
1. Native self-hosted Moodle Core 4.4 (*Zealosh Learning Engine*) and BigBlueButton 2.7+ (*Zealosh Live Classroom*).
2. A central RFC 8414 / RFC 6749 OpenID Connect (OIDC) identity provider implemented in the Next.js Core Hub.
3. Custom domain identifiers such as `usr-std-01`, `usr-inst-01`, `crs-asp-01`, and `btc-asp-weekday`, which are human-readable string identifiers rather than standard UUIDv4 strings.
4. Adoption of Supabase as the staging and production cloud PostgreSQL database.

Supabase PostgREST default configurations expect either:
- Direct client-side queries using Supabase Auth (GoTrue) where `auth.uid()` evaluates to an internal UUID.
- Or broad table grants combined with standard RLS.

Direct client-side database access with custom OIDC tokens poses three critical security challenges:
1. **JWT Trust Mismatch**: Supabase GoTrue does not automatically trust external third-party or custom Next.js JWT signatures without custom asymmetric JWKS verification configured in PostgREST.
2. **UUID Cast Failure**: Built-in `auth.uid()` in Supabase executes `(request.jwt.claims ->> 'sub')::uuid`. Passing custom text IDs such as `usr-std-01` causes PostgreSQL to throw `invalid input syntax for type uuid: "usr-std-01"`.
3. **Broad Database Grants Hazard**: Using `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated` relies solely on RLS policies; any omission or misconfigured policy immediately exposes sensitive data (e.g., exam answer keys, OAuth authorization codes, audit trails).

## Decision

We adopt a two-tier **Server-Side Authoritative Architecture with Defense-in-Depth RLS & Least-Privilege Grants**:

### 1. Primary Authorization Tier: Server-Side Authoritative Core
- All sensitive operations, state mutations, and authenticated queries are mediated by the Next.js server layer (`/api/*` Route Handlers and Server Actions).
- Next.js acts as the authoritative gatekeeper:
  - Cryptographically verifies session tokens using `src/lib/auth/jwt.ts` (`verifyToken`).
  - Enforces RBAC permissions using `PERMISSION_REGISTRY` in `src/lib/store/db.ts`.
  - Connects to Supabase using a strictly server-isolated client (`SUPABASE_SERVICE_ROLE_KEY` / `getSupabaseAdminClient()`).
  - The `SUPABASE_SERVICE_ROLE_KEY` is strictly prohibited from any client bundle or browser-facing code.

### 2. Secondary Defense-in-Depth Tier: Least-Privilege Grants & Hardened RLS
Even if a request reaches Supabase directly or via PostgREST, PostgreSQL enforces defense-in-depth:
- **Zero Blanket Grants**: The schema contains NO `GRANT ALL ON ALL TABLES`.
- **Role `anon` (Unauthenticated)**:
  - `GRANT SELECT` restricted exclusively to public catalog data (`courses`, `batches`, `certificates` verification, `navigation_items`, `branding_theme`, and the `public_platform_settings` view).
  - Explicitly denied access (`NO SELECT, NO INSERT, NO UPDATE, NO DELETE`) to `users`, `roles`, `oauth_codes`, `lessons`, `live_sessions`, `attendance_records`, `enrollments`, `exam_blueprints`, `exam_questions`, `exam_attempts`, `audit_logs`, `config_audits`.
- **Role `authenticated` (Learners & Instructors)**:
  - Can only SELECT own enrollments (`user_id = current_user_id()`), enrolled lessons, live sessions, and own exam attempts.
  - Can only INSERT/UPDATE in-progress exam answers with server-side grading protection (`WITH CHECK (status = 'IN_PROGRESS' AND total_score IS NULL AND passed IS NULL)`).
  - Absolutely blocked from viewing `exam_questions.correct_option_ids` (answer keys) via a sanitized view (`learner_exam_questions`).
  - Blocked from reading, creating, or modifying `oauth_codes` (only `service_role` has access).
  - Blocked from modifying or deleting immutable `audit_logs` and `config_audits`.

### 3. Non-UUID Identity Mapping (`current_user_id()`)
To ensure compatibility with custom Zealosh string identifiers (`usr-std-01`):
We define safe PostgreSQL security functions:
```sql
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', ''),
    nullif(current_setting('request.jwt.claim.sub', true), '')
  );
$$;
```
This safely retrieves the text identifier without casting to `uuid`.

### 4. Atomic OAuth Code Consumption
OAuth authorization codes used for Moodle SSO are isolated from public/authenticated roles and consumed atomically via the stored procedure `public.redeem_oauth_code(...)`. This provides transactional row locking (`SELECT ... FOR UPDATE`), single-use marking (`used = TRUE`), expiration checking, and replay attack rejection.

## Consequences

### Positive
- **Complete OWASP Top 10 Alignment**: Neutralizes BOLA/IDOR, broken authentication, sensitive data exposure, and privilege escalation.
- **Exam Integrity**: Candidate clients cannot access exam answer keys or manipulate exam scores.
- **Credential Safety**: Service role secrets never reach the browser; browser clients cannot manipulate database state directly.
- **Zero Regression**: Preserves compatibility with all existing Vitest test suites, seed entities, and Next.js routes.

### Negative / Operational Trade-offs
- Client components cannot directly query Supabase tables for private user data; all private data flows through Next.js server routes or Server Actions. This is an intentional architectural pattern for enterprise LMS applications.
