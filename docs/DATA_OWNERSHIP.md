# Zealosh LMS — Data Ownership & Schema Boundary Specification

**Document Version:** 3.0.0 (Comprehensive Enterprise Persistence Baseline)  
**Status:** **AUTHORITATIVE SCHEMA BOUNDARY** (Supersedes API-Client Only Model via ADR-001, ADR-002, and ADR-003)  
**Scope:** Zealosh Core Store vs Self-Hosted Moodle Database vs BigBlueButton In-Memory State vs Proposed AI Tutor Boundary.

---

## 1. Authoritative Data Ownership Matrix

To prevent data drift, split-brain conditions, and duplicate sources of truth, each entity has a single authoritative system of record:

| Business Entity | Authoritative System | Primary Database / Store | Stable Identifier | Access Protocol | Synchronization & Federation Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **User Identity & Auth** | **Zealosh Core** | PostgreSQL (`public.users`) | `UUIDv4` (`user_id`) | Next.js OIDC API | Master source of truth. Federated to Moodle via OIDC SSO (`auth_oauth2`) on login. |
| **Course Offerings & Pricing** | **Zealosh Core** | PostgreSQL (`public.courses`) | `UUIDv4` (`course_id`, `slug`) | Next.js Course API | Public catalog, marketing syllabus, batch schedule, and commercial fees. |
| **Batches & Cohort Capacity** | **Zealosh Core** | PostgreSQL (`public.batches`) | `UUIDv4` (`batch_id`) | Next.js Batch API | Master source of truth for seat caps, date windows, and lead/assistant tutors. Atomic concurrency via `enroll_student_atomic`. |
| **Enrollments & Entitlements** | **Zealosh Core** | PostgreSQL (`public.enrollments`) | `UUIDv4` (`enrollment_id`) | Next.js Commerce API | Controls access to both Next.js exams and Moodle course modules. |
| **Coursework & Rubrics** | **Zealosh Core** | PostgreSQL (`public.assignments`) | `UUIDv4` (`assignment_id`) | Next.js Assignments API | Multi-criteria rubrics stored as JSONB; course and cohort scoping. |
| **Student Submissions & Grades** | **Zealosh Core** | PostgreSQL (`public.assignment_submissions`) | `UUIDv4` (`submission_id`) | Next.js Submission API | Enrolled student isolation, criterion-level grading scores and instructor feedback. |
| **Detailed Lessons & SCORM** | **Zealosh Learning Engine** | Dedicated Supabase Project 2 PostgreSQL (`mdl_*`) | `BIGINT` (`moodle_cmid`) | Moodle Engine / REST | Governs interactive SCORM packs, chapter trees, and forum topics. |
| **BCSP / BCRSP Question Bank** | **Zealosh Core** | PostgreSQL (`public.exam_questions`) | `UUIDv4` (`question_id`) | Next.js Exam Service | Proprietary HSE questions, BCSP blueprint domains, and explanations. Answer keys stripped on client delivery via `learner_exam_questions` view. |
| **Exam Attempts & Scoring** | **Zealosh Core** | PostgreSQL (`public.exam_attempts`) | `UUIDv4` (`attempt_id`) | Next.js Exam Service | Server-authoritative timer, autosaved answers, and domain scoring. |
| **Certificates & Verification** | **Zealosh Core** | PostgreSQL (`public.certificates`) | `UUIDv4` (`certificate_code`) | Next.js Cert API | Master registry for public tamper-proof credential verification (`/verify/[code]`). |
| **Payment Orders & Invoices** | **Zealosh Core** | PostgreSQL (`public.payment_orders`, `public.invoices`) | `UUIDv4` (`order_id`, `invoice_id`) | Next.js Commerce API | Statutory Indian GST invoicing (`INV-2026-XXXX`), cryptographic webhook verification, and atomic fulfillment. |
| **Class Recordings & Doubts** | **Zealosh Core** | PostgreSQL (`public.class_recordings`, 5 relation tables) | `UUIDv4` (`recording_id`) | Next.js Recordings API | Chapter highlights, attached resources, interactive learner doubts, and HMAC-SHA256 streaming tokens. |
| **Live Classroom Sessions** | **Zealosh Live Classroom** | BBB In-Memory / Redis State | `VARCHAR` (`meeting_id`) | BBB REST / WebRTC | Ephemeral WebRTC audio/video/whiteboard conference state. |
| **Session Attendance Records** | **Zealosh Core** | PostgreSQL (`public.attendance_records`) | `UUIDv4` (`attendance_id`) | Next.js Batch API | Pulled from BBB meeting status upon session conclusion. |
| **Configuration & Branding** | **Zealosh Core** | PostgreSQL (`public.platform_settings`, `public.branding_theme`, `public.feature_flags`) | Key-Value / Singleton | Next.js Admin API | Dynamic tokens (`#4f8c4c`), feature toggles (including `ai_tutor_enabled: false`), and 1-click rollback history. |
| **Proposed AI Tutor (Unapproved)** | **Zealosh Core Seam** | None (Disabled platform-wide) | N/A | `/api/ai-tutor/query` (403 Disabled) | Feature gated via `ai_tutor_enabled`. Zero background ingestion, zero student document leaks, zero unapproved spend. |

---

## 2. Synchronization Invariants & Conflict Prevention

1. **No Out-of-Band Enrollment:** Students cannot be manually enrolled in Moodle bypassing Zealosh Core. All enrollments originate in Zealosh Core upon verified payment or administrator grant.
2. **Immutable Exam Scoring:** Examination answers are scored exclusively by Zealosh Core and sealed upon submission; Moodle gradebooks receive aggregated final course completion flags.
3. **Single Identity Resolution:** Learners exist under normalized lowercase email addresses; OIDC tokens map `sub` directly to `zealosh_user_id`.
4. **Firewalled Assessment Content:** The proposed AI Tutor is strictly prohibited from accessing restricted question banks (`exam_questions.correct_option_ids`) or operating during active examination sessions.
