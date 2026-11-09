# Zealosh LMS — ZM-03 Examination Certificate Integration Specification

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Strict Separation of Course Completion vs Formal Examination Certificates  
**Authoritative Reference:** [db.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts), [config.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/types/config.ts)

---

## 1. Dual Certificate Architecture

Zealosh LMS maintains a strict institutional separation between two distinct classes of credentials:

| Property | Course Completion Certificate | Formal Examination Certificate |
| :--- | :--- | :--- |
| **Trigger** | Multi-criteria course completion (lessons + live attendance + quizzes + assignments) | Passing a high-stakes certification examination |
| **Numbering Pattern** | `ZEI/COURSE/YYYY/XXXXXX` | `ZEI/EXAM/YYYY/XXXXXX` |
| **Issuer Authority** | Zealosh Academic Board & Program Director | Zealosh Certification & Examination Directorate |
| **Verification Route** | `https://zealosh.com/verify/[code]` | `https://zealosh.com/verify/[code]` |
| **Revocation Policy** | Revocable on enrollment withdrawal / disciplinary action | Revocable on certification board audit or fraud |

---

## 2. Collision-Free Numbering Engine

Sequential, collision-free certificate numbers are issued based on calendar year:

```typescript
// Calendar Year Extraction
const year = new Date().getFullYear();
const prefix = certificateType === 'COURSE_COMPLETION' 
  ? `ZEI/COURSE/${year}/` 
  : `ZEI/EXAM/${year}/`;

// Find max existing number in sequence
let maxNum = 0;
for (const cert of this.certificates.values()) {
  if (cert.certificateNumber?.startsWith(prefix)) {
    const num = parseInt(cert.certificateNumber.replace(prefix, ''), 10);
    if (!isNaN(num) && num > maxNum) maxNum = num;
  }
}

// Format 6-digit padded number
const certificateNumber = `${prefix}${String(maxNum + 1).padStart(6, '0')}`;
```

---

## 3. Public Verification Gateway

Each certificate features a unique verification code (`certificateCode`) and public verification URL:
- **Verification Endpoint:** `GET /verify/[code]`
- **Verification Output:**
  - Candidate Name (partially masked for privacy if unauthenticated).
  - Certification Title & Professional Body Alignment (e.g., Associate Safety Professional - ASP Prep).
  - Issue Date and Expiration Date (if applicable).
  - Certificate Type (`COURSE_COMPLETION` or `EXAM_CERTIFICATION`).
  - Integrity Signature Hash validating against PostgreSQL authoritative certificate records.

