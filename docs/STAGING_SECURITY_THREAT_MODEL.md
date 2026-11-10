# Zealosh LMS — Staging Security Architecture, Threat Model & Defense Matrix

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-09 — Stage A: Staging Infrastructure Architecture, Technical Readiness & Procurement Planning  
**Classification:** Restricted / Enterprise Security Architecture  
**Security Frameworks:** OWASP Top 10 (2021), OWASP ASVS v4.0.3 Level 2, WSTG v4.2, CIS Benchmarks  
**Date:** November 2026  

---

## 1. Executive Summary & Security Governance

This document establishes the authoritative threat model, security boundaries, and defense-in-depth controls for the **Zealosh LMS** staging environment.

### Mandatory Security Principles:
1. **Zero Real Student PII in Staging:** Under no circumstances will production student records, identity documents, phone numbers, or actual payment card details be imported into staging. Staging operates exclusively on synthetic accounts (`usr-student-01`, `usr-faculty-01`, etc.) and seeded mock masterclasses.
2. **Fail-Closed Authorization:** All administrative, exam scoring, and payment endpoints require server-side cryptographic token validation. Client-side state is never trusted for authorization.
3. **Defense-in-Depth Row-Level Security (RLS):** 100% of canonical database tables enforce PostgreSQL Row-Level Security, preventing cross-tenant and cross-user data leakage even if an application query lacks an explicit `WHERE` clause.
4. **Least-Privilege Secret Management:** Secrets are injected at runtime via file system mode `0600` (`-rw-------`) and restricted to the specific server node requiring them.

---

## 2. Threat Actor Taxonomy & Attack Surfaces

The staging environment exposes four distinct attack surfaces:
1. **Public Web Surface:** Next.js application, login portal, admissions application forms, certificate verification portal (`/verify/[code]`).
2. **Public WebRTC Media Surface:** BigBlueButton HTML5 client, FreeSWITCH SIP audio bridge, Mediasoup video streams on Server 2.
3. **Webhook Ingress Endpoints:** Payment callback (`/api/payments/webhook`), recording published callback (`/api/webhooks/bbb/recording`), WhatsApp status webhook (`/api/webhooks/whatsapp`).
4. **Server Management Surface:** SSH daemon on Port 22 across Server 1, Server 2, and Server 3.

---

## 3. Comprehensive 21-Point Threat Model & Mitigation Matrix

| Threat ID | Threat Category / Attack Vector | Threat Scenario & Impact | Technical Mitigation in Zealosh LMS Code & Infrastructure | Verification Anchor |
| :---: | :--- | :--- | :--- | :--- |
| **TH-01** | **Administrative Account Compromise** | Attacker brute-forces admin credentials to alter course grades or issue false certificates. | Supabase GoTrue MFA (TOTP) enforced for `superadmin` and `academic_director` roles; database login lockout after 5 failed attempts (`tests/auth-lockout-security.test.ts`). | `src/middleware.ts`<br>`tests/auth-lockout-security.test.ts` |
| **TH-02** | **Student Account Takeover** | Attacker takes over student session to view proprietary video lessons or take examinations. | Secure, `HttpOnly`, `SameSite=Lax`, `Secure` cookies; device fingerprint binding; automated session revocation on password change (`tests/auth-sessions-revocation.test.ts`). | `src/lib/session.ts`<br>`tests/auth-sessions-revocation.test.ts` |
| **TH-03** | **Session Theft & Replay** | Attacker intercepts network token to impersonate user across sessions. | High-entropy HS256 JWT tokens with 15-minute sliding expiration; multi-secret key rotation support (`JWT_SECRET`, `JWT_SECRET_PREVIOUS`) in edge middleware. | `src/middleware.ts`<br>`tests/phase3-integrity-closure.test.ts` |
| **TH-04** | **Source Code Credential Leakage** | Database passwords or API tokens accidentally committed to Git repository. | Zero-secret Git policy; pre-commit hooks scan for high-entropy strings; staging `.env.staging` generated strictly on the server host with mode `0600`. | `docs/infrastructure/ZEALOSH_SECRETS_MANAGEMENT_MATRIX.md` |
| **TH-05** | **Database Credential Exposure** | Direct database port 5432 exposed to the public internet. | Supabase PostgreSQL requires SSL (`sslmode=require`); public IP allowlisting configured in Supabase Network Restrictions; Server 1 uses Supavisor pooler. | `src/lib/supabase.ts` |
| **TH-06** | **Privilege Escalation** | Regular student edits HTTP request body to claim `instructor` or `superadmin` role. | Role checks are enforced in server-side edge middleware and verified via database JWT claims; student cannot elevate role via API parameter tampering. | `src/middleware.ts`<br>`tests/phase3-integrity-closure.test.ts` |
| **TH-07** | **Cross-User Data Leakage** | Candidate A crafts API query to view Candidate B's admissions statement of purpose. | PostgreSQL Row-Level Security (RLS) on `admission_applications` enforces `auth.uid() = user_id` for students; admins restricted via role-based RLS policies. | `supabase/migrations/`<br>`tests/cms-real-postgresql-and-rls.test.ts` |
| **TH-08** | **Insecure File Upload** | Attacker uploads executable PHP/Node script disguised as an admissions identity proof. | Uploads bypass application server entirely via presigned S3/R2 URLs; S3 client enforces strict MIME-type allowlists (PDF, PNG, JPG) and max size limits (15 MB). | `src/lib/storage/s3-storage-client.ts`<br>`src/app/api/storage/` |
| **TH-09** | **Malicious Document Payload (Polyglot)** | Attacker uploads malicious PDF designed to exploit PDF rendering libraries. | File headers validated; certificates generated server-side using trusted static templates; zero client-controlled executable code execution. | `src/lib/certificates/`<br>`tests/tamper-evident-certificates.test.ts` |
| **TH-10** | **Webhook Forgery** | Attacker sends fake HTTP POST to `/api/webhooks/bbb/recording` claiming meeting ended. | HMAC-SHA256 signature verification enforced in middleware; payloads without valid `x-zealosh-signature-256` matching `BBB_WEBHOOK_SECRET` are rejected with HTTP 401. | `src/app/api/webhooks/bbb/recording/route.ts` |
| **TH-11** | **Payment Webhook Replay** | Attacker intercepts valid payment confirmation webhook and resends it to trigger double enrollment. | Idempotency key tracking in `payment_webhook_events` table; duplicate `event_id` records are detected and return HTTP 200 without duplicate provisioning. | `src/app/api/payments/webhook/route.ts`<br>`tests/payment-webhook-idempotency.test.ts` |
| **TH-12** | **Server-Side Request Forgery (SSRF)** | Attacker exploits image URL or webhook field to force server to scan internal AWS metadata `169.254.169.254`. | URL validation strictly blocks loopback (`127.0.0.1`), link-local (`169.254.0.0/16`), and private RFC 1918 subnets (`10.0.0.0/8`, `192.168.0.0/16`) in external fetch calls. | `src/lib/security/url-sanitizer.ts`<br>`tests/cms-sanitizer-and-security.test.ts` |
| **TH-13** | **Cross-Site Scripting (XSS)** | Attacker injects `<script>` into course discussion channel or review testimonial. | Strict Content Security Policy (CSP) in `next.config.mjs` forbidding `unsafe-eval`; HTML entity sanitization on all user inputs via DOMPurify / sanitizer utility. | `src/middleware.ts`<br>`tests/cms-sanitizer-and-security.test.ts` |
| **TH-14** | **Cross-Site Request Forgery (CSRF)** | Malicious third-party website submits form to change user's email address. | Cookies use `SameSite=Lax`; mutation endpoints require JSON `Content-Type: application/json` which triggers browser CORS preflight check for cross-origin requests. | `src/middleware.ts` |
| **TH-15** | **SQL Injection (SQLi)** | Attacker injects `' OR 1=1 --` into search query or course filter. | 100% of database queries use parameterized SQL via Supabase PostgREST client or tagged template literals; zero dynamic string concatenation in SQL statements. | `src/lib/store/supabase-adapter.ts`<br>`tests/supabase-security.test.ts` |
| **TH-16** | **API Abuse & Scraping** | Attacker aggressively scrapes question bank or certificate verification portal. | Rate limiting enforced at Cloudflare Edge and in application middleware; maximum 60 requests per minute per IP on public endpoints. | `src/middleware.ts`<br>`deploy/nginx/nginx.staging.conf` |
| **TH-17** | **Rate-Limit Bypass** | Attacker rotates `X-Forwarded-For` headers to circumvent local IP rate limits. | Nginx and middleware trust IP address strictly from Cloudflare's authenticated `CF-Connecting-IP` header; untrusted client-supplied headers are stripped. | `deploy/nginx/nginx.staging.conf` |
| **TH-18** | **Exposed Internal Services** | Redis (6379), FreeSWITCH (5060), or Ollama (11434) accidentally exposed to internet. | Internal services are bound strictly to `127.0.0.1` or private subnet `10.0.0.3`; host firewalls (`ufw`) reject all incoming public packets on internal ports. | `docs/NETWORK_AND_DNS_DESIGN.md` |
| **TH-19** | **Misconfigured Host Firewall** | Operator leaves all incoming ports open during troubleshooting. | Automated firewall verification script in staging deployment pipeline checks open ports using `nmap` before certifying release. | `deploy/validate-staging-env.mjs` |
| **TH-20** | **Unprotected Class Recordings** | Student shares direct MP4 download URL with unauthorized third parties. | Recordings stored in private R2 bucket; playback delivered via signed, time-limited HMAC tokens (15-min expiry) with watermarked learner email. | `src/lib/storage/recording-storage.ts`<br>`tests/recording-doubts-highlights.test.ts` |
| **TH-21** | **Unauthorized Examination Access** | Student inspects browser network tab to view correct answers during active exam. | Examination engine strips `correct_option` and answer keys on the server before transmitting questions to client; answers validated strictly server-side upon submit. | `src/app/api/exams/`<br>`tests/exam-engine.test.ts` |

---

## 4. Secret Management & Key Rotation Lifecycle

| Secret Asset | Scope & Location | Permissions | Rotation Interval | Rotation Procedure |
| :--- | :--- | :---: | :---: | :--- |
| **`JWT_SECRET`** | Server 1 (`.env.staging`) | `0600` | 90 Days | Generate 64-character random hex key; set as primary while retaining previous key in `JWT_SECRET_PREVIOUS` for 24 hours. |
| **`SUPABASE_SERVICE_ROLE_KEY`** | Server 1 (`.env.staging`) | `0600` | 180 Days | Regenerate in Supabase dashboard; update `.env.staging`; execute graceful `pm2 reload`. |
| **`BBB_SECURITY_SALT`** | Server 1 & Server 2 | `0600` | 180 Days | Run `bbb-conf --setsecret` on Server 2; update Server 1 `.env.staging`; restart BBB. |
| **`BBB_WEBHOOK_SECRET`** | Server 1 & Server 2 | `0600` | 180 Days | Update `/etc/bigbluebutton/zealosh-secret.env` on Server 2 and `.env.staging` on Server 1. |
| **`S3_SECRET_ACCESS_KEY`** | Server 1 (`.env.staging`) | `0600` | 180 Days | Create secondary access key in Cloudflare R2 dashboard; update Server 1; delete obsolete key. |
| **SSH Host & Admin Keys** | All Server Nodes | `0600` | Annual (or personnel exit) | Ed25519 cryptographic keys only; root login disabled; password authentication disabled. |

---

## 5. Security Incident Response Protocol

In the event of a suspected security event in staging:
1. **Containment:** Immediately restrict public access to `app.staging.zealosh.com` by enabling Cloudflare "Under Attack" mode or updating Nginx to return HTTP 503 Maintenance Mode (`src/components/maintenance/MaintenanceBanner.tsx`).
2. **Session Invalidation:** Revoke all active user sessions by cycling `JWT_SECRET` in `.env.staging` and issuing a PM2 reload.
3. **Log Extraction:** Preserve `/var/log/nginx/` and application audit logs (`app_error_logs` table) for forensic analysis before restarting servers.
4. **Remediation & Re-Verification:** Patch vulnerable endpoints; re-run `npx vitest run` and `npx playwright test` to confirm regression-free resolution before lifting restrictions.

