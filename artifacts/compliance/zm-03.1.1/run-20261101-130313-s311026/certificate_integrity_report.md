# WORKSTREAM F — CERTIFICATE INTEGRITY REPORT

### 1. Numbering Scheme & Prefix Separation
- **Certification Examinations:** `ZEI/EXAM/YYYY/XXXXXX`
- **Course Completions:** `ZEI/COURSE/YYYY/XXXXXX`
- **Collision Safety:** Sequence counter increments atomically per calendar year and certification stream.

### 2. Public Verification
- Endpoint: `/verify/[code]`
- Privacy Protection: Returns certificate status, recipient name, course/certification title, issue date, and grade/score. Sensitive PII (email, phone, address) is strictly redacted from public verification responses.
- Revocation Handling: Revoked certificates return status `REVOKED` with revocation reason; they cannot be represented as valid credentials.
