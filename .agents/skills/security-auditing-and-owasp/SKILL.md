---
name: security-auditing-and-owasp
description: >-
  Security audits, OWASP Top 10 mitigation, secret scanning, authentication security, and vulnerability defense.
  Use this skill when auditing codebase security, preventing SQL injection/XSS/CSRF, managing secrets safely,
  implementing cryptographic protections, or hardening APIs and headers.
---

# Security Auditing & OWASP Defense Runbook

This skill establishes defensive security standards, vulnerability mitigation guidelines, and secrets protection policies.

---

## 1. Zero-Leak Secrets Policy (STRICT)

**NEVER** commit, log, or expose:
- API Keys (Stripe, OpenAI, Resend, Twilio)
- Supabase `service_role` secret keys
- Database connection strings with passwords (`postgres://user:pass@host/db`)
- JWT private signing keys
- Cloud credentials (AWS, GCP, Cloudflare)

### Guidelines:
1. Store all secrets in `.env.local` or environment secret stores.
2. Verify `.env*` is properly ignored in `.gitignore`.
3. Never interpolate secrets in client-exposed bundle variables (e.g., `NEXT_PUBLIC_*`).

---

## 2. OWASP Top 10 Mitigation Matrix

### A. SQL Injection (SQLi)
- **Rule**: Never concatenate raw strings into SQL queries.
- **Remedy**: Always use parameterized queries (`$1, $2`), ORM query builders (MikroORM, Prisma, Kysely), or tagged template literals (`sql`...``).

### B. Cross-Site Scripting (XSS)
- **Rule**: Never use `dangerouslySetInnerHTML` with un-sanitized user input.
- **Remedy**: Use DOMPurify before rendering raw HTML, or rely on React's automatic string escaping. Set strict `Content-Security-Policy`.

### C. Cross-Site Request Forgery (CSRF)
- **Rule**: Set `SameSite=Lax` or `SameSite=Strict` on session cookies.
- **Remedy**: Use custom request headers (`X-Requested-With`) or CSRF anti-forgery tokens for state-changing endpoints.

### D. Broken Object-Level Authorization (BOLA / IDOR)
- **Rule**: Never trust client-supplied entity IDs without verifying ownership.
- **Remedy**: Always verify `WHERE user_id = auth.uid()` or rely on Supabase Row Level Security (RLS).

### E. Rate Limiting & Denial of Service (DoS)
- **Rule**: Throttle expensive operations (login attempts, checkout submissions, AI generation requests).
- **Remedy**: Implement Redis/memory-based sliding window rate limiters.

---

## 3. Security Audit Checklist

- [ ] Dependency Vulnerability Check: Run `npm audit` and address high/critical CVEs.
- [ ] Safe Headers: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
- [ ] Cookie Security: `HttpOnly`, `Secure`, `SameSite=Lax`.
- [ ] Mass Assignment Protection: Strict DTO schema validation with Zod (`.strip()` or `.strict()`).
- [ ] Password Hashing: Use `bcrypt` (work factor >= 12) or `argon2id`.
