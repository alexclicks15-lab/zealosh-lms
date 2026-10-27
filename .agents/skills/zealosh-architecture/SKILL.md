---
name: zealosh-architecture
description: Authoritative software architecture and data boundary runbook for Zealosh LMS. Use this skill when designing modules, defining API contracts, enforcing multi-tenant isolation, managing role boundaries (SUPER_ADMIN, INSTRUCTOR, STUDENT), or orchestrating data flow between Next.js, PostgreSQL, Moodle, and BigBlueButton.
---

# Zealosh LMS — Master Software Architecture & Boundary Runbook

## 1. System Topology & Architectural Invariants

Zealosh LMS operates as an enterprise-grade learning management and assessment platform designed specifically for Health, Safety & Environment (HSE) professional credentials (BCSP ASP/CSP/CIT, BCRSP CRSP, IOSH, NEBOSH).

```
                      ┌────────────────────────────────────────┐
                      │          Client Web Browser            │
                      │  Next.js 14 App Router + Tailwind CSS  │
                      └───────────────────┬────────────────────┘
                                          │ HTTPS / WSS
                                          ▼
                      ┌────────────────────────────────────────┐
                      │          Zealosh Application           │
                      │      API Gateway & Core Business       │
                      │   (Auth, Commerce, Rosters, Exams)     │
                      └───────┬──────────────┬──────────────┬──┘
                              │              │              │
             PostgreSQL REST  │   REST Sync  │   REST/WebRTC│
                              ▼              ▼              ▼
                     ┌─────────────┐  ┌─────────────┐ ┌─────────────┐
                     │ PostgreSQL  │  │   Moodle    │ │BigBlueButton│
                     │  Supabase   │  │   Core 4.x  │ │   Cluster   │
                     │  Database   │  │  (SCORM/LMS)│ │ (Classroom) │
                     └─────────────┘  └─────────────┘ └─────────────┘
```

### Core Invariants
1. **Authoritative Master of Record:** Zealosh is the single source of truth for: Users, Credentials, Enrolments, Course Rosters, Batches, Orders/Invoices, HSE Exam Blueprints, Attempt Scores, and Completion Certificates.
2. **License Boundary Isolation:** Never import or compile Moodle PHP source directly into Zealosh. All LMS interactions occur via Moodle's REST API (`/webservice/rest/server.php`) using external service tokens.
3. **Cryptographic Secrecy:** Secrets such as `BIGBLUEBUTTON_SALT`, `JWT_SECRET`, and Moodle tokens must never be exposed to client bundles. Checksums (SHA-1 for BBB) are computed exclusively server-side.
4. **Server-Authoritative Clock & Scoring:** Exam countdowns and passing thresholds are enforced by the server. Browser timers are visual countdown aids only. Answers submitted after `deadlineTime + 60s grace` are rejected.

---

## 2. Multi-Tenancy & Role-Based Access Control (RBAC)

### Tenant Isolation
- Every primary database entity contains `organizationId` (default: `'org-zealosh-main'`).
- API route handlers and database queries must include tenant boundary filtering:
  `WHERE organization_id = req.user.organizationId`

### Role Hierarchy
1. `SUPER_ADMIN`: Global platform oversight, course catalog creation, instructor assignment, organization settings, system audit log inspection.
2. `INSTRUCTOR`: Assigned cohort management, live session moderating (BigBlueButton moderator credentials), assignment grading, student roster inspection.
3. `STUDENT`: Enrolled course lesson streaming, attendance at live workshops, exam simulation attempts, certificate download.

---

## 3. Data Ownership Matrix

| Entity | Master Owner | Secondary Sync | Cache Strategy |
|---|---|---|---|
| Users & Passwords | Zealosh PostgreSQL | Moodle (provisioned via `core_user_create_users`) | In-memory singleton / Redis |
| Courses & Batches | Zealosh PostgreSQL | Moodle (`core_course_create_courses`) | S-Maxage 3600s ISR |
| Live Sessions | Zealosh PostgreSQL | BigBlueButton (transient WebRTC room) | Real-time status polling |
| SCORM & Lesson Modules | Moodle Database | Zealosh (`core_course_get_contents`) | 15-minute revalidation |
| Exam Questions & Attempts | Zealosh PostgreSQL | None (pure Zealosh proprietary engine) | Real-time write-through |
| Certificates & Audits | Zealosh PostgreSQL | None (immutable append-only) | Immutable / CDN signed |

---

## 4. API Contract & Response Format Standards

All internal and external API endpoints under `/api/v1/` must conform to:
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```
HTTP status codes must accurately reflect domain outcomes:
- `200 OK`: Request succeeded.
- `201 Created`: Entity provisioned (e.g., attempt started, user registered).
- `400 Bad Request`: Validation failure.
- `401 Unauthorized`: Missing or invalid JWT.
- `403 Forbidden`: Insufficient role or tenant mismatch.
- `404 Not Found`: Resource non-existent.
- `408 Request Timeout`: Exam countdown expired.
- `409 Conflict`: Duplicate enrollment or concurrent attempt collision.
