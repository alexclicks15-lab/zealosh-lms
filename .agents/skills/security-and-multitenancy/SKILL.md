---
name: security-and-multitenancy
description: Governs multi-tenant isolation, row-level security (RLS), RBAC/ABAC authorization, SQL injection prevention, credential hygiene, and zero cross-tenant data leakage.
---

# Security and Multi-Tenant Isolation Guardian

## 1. Purpose & Non-Negotiable Rules
The **Security and Multi-Tenancy** skill enforces defense-in-depth security architectures for enterprise applications. It guarantees that multi-tenant boundaries are strictly impermeable and that data, credentials, and API access are rigorously protected.

### Non-Negotiable Invariants:
1. **Never rely on client-side state for access control**: All permissions, role checks, and tenant boundaries must be validated server-side.
2. **Zero Cross-Tenant Data Leakage**: An authenticated user in Tenant A must never be able to read, write, update, or enumerate records belonging to Tenant B.
3. **Zero Secret Exposure**: Passwords, API salts, private keys, and JWT secrets must never appear in client bundles, server logs, error bodies, or version control.

---

## 2. Multi-Tenant Data Isolation Architecture

### 1. PostgreSQL Row-Level Security (RLS)
Every multi-tenant table must enforce RLS at the database engine level:
```sql
ALTER TABLE organization_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON organization_courses
  FOR ALL
  USING (organization_id = auth.jwt() ->> 'org_id');
```

### 2. Tenant Identity Propagation
- Tenant identity must be extracted from verified cryptographically signed tokens (`jwt.verify()`) or authenticated session cookies.
- Never trust client-supplied query parameters or request body values (`?tenant_id=...`) to determine tenant context.

### 3. Tenant-Scoped Uniqueness & Constraints
- Unique indexes must incorporate the tenant identifier:
  ```sql
  CREATE UNIQUE INDEX idx_tenant_course_code ON courses(organization_id, code);
  ```

---

## 3. OWASP Top 10 Mitigation Checklist

| Threat | Prevention Standard |
| :--- | :--- |
| **Broken Access Control (A01)** | Server-side role guards (`SUPER_ADMIN`, `INSTRUCTOR`, `STUDENT`) checked before data retrieval. |
| **Cryptographic Failures (A02)** | Timing-safe secret comparison (`crypto.timingSafeEqual` with SHA-256 fixed-length digests); bcrypt salt rounds $\ge 10$. |
| **Injection (A03)** | 100% parameterized queries or ORM sanitization. Zero raw string interpolation in SQL queries. |
| **Insecure Design (A04)** | Anti-cheat question projection for exams; single-use replay protection for OAuth authorization codes. |
| **Security Misconfiguration (A05)** | Strict CORS headers, `X-Frame-Options: SAMEORIGIN`, `Content-Security-Policy`, and non-leaking error responses. |
| **Vulnerable Components (A06)** | Regular automated dependency audits (`npm audit`); zero unmaintained packages. |
| **Auth Failures (A07)** | HTTP-only, secure, `SameSite=Lax` cookies; token expiration enforcement; brute-force rate limits. |
| **Integrity Failures (A08)** | Webhook payload signature verification (HMAC-SHA256) before processing events. |
| **Logging Failures (A09)** | Structured audit logs recording actor, timestamp, action, and target entity; zero credentials logged. |
| **SSRF (A10)** | Strict allow-list validation on redirect URIs and external webhook endpoints. |

---

## 4. Multi-Tenant Regression Testing Protocol

To verify multi-tenant safety:
1. Issue an authenticated request as User A in Tenant 1.
2. Attempt to query an entity ID belonging to Tenant 2.
3. Assert that the response returns **HTTP 404 (Not Found)** or **HTTP 403 (Forbidden)**, preventing resource enumeration.
4. Verify that direct database queries enforce tenant filtering in the `WHERE` clause.
