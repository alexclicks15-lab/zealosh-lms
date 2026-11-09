# Zealosh LMS — Complete Functional Requirements Specification

**Document Version:** 1.0.0  
**Milestone:** ZM-01 — Master Product Blueprint  
**Target:** Single Institutional Learning & Certification Platform (`https://zealosh.com`)  
**Brand:** Zealosh Training & Consultants  
**Date:** October 30, 2026  

---

## 1. Scope & Structure of the Functional Audit
This document details the functional specifications across all 21 operational domains of Zealosh LMS. Each domain evaluates:
1. **Existing Implementation:** What code, schemas, and routes currently exist.
2. **Missing Functionality:** Features required by the institution that are absent.
3. **Partial Implementation:** Code that exists but requires hardening or expansion.
4. **Technical Requirements:** Database tables, API routes, and UI components.
5. **Business Rules, Validation & Failure Handling:** Guardrails and edge cases.
6. **Acceptance Criteria & Implementation Priority:** Priority rankings (P0: Critical, P1: Core Academic, P2: Operations, P3: Deferred Extensions).

---

## DOMAIN 1 — Authentication and Account Management

### 1.1 Existing Implementation
- Local JWT generation and verification in [`src/lib/auth/jwt.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/auth/jwt.ts) using `jsonwebtoken` and `bcryptjs`.
- Endpoints: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Session cookie `zealosh_token` (HTTP-only, SameSite=strict).
- Single-use PKCE OAuth2/OIDC codes in `public.oauth_codes` for Moodle SSO.

### 1.2 Missing & Partial Functionality
- **Missing:** Native Supabase Auth integration (`auth.users`), self-registration flow with email verification, password reset requesting and verification, administrative user invitations with secure tokens, Multi-Factor Authentication (MFA/TOTP), account suspension and reactivation flags, active session revocation / multiple device management, login attempt throttling / rate-limiting, and failed login lockout.
- **Partial:** Role check is basic; no distinction between platform-level administrative privileges and academic assignments.

### 1.3 Technical Architecture
- **Database Requirements:**
  - Leverage Supabase `auth.users` for credentials and core session tokens.
  - `public.profiles`: Links `auth.users.id` (UUID) to application metadata, account status (`ACTIVE`, `SUSPENDED`, `PENDING_INVITE`), failed login counter, and MFA status.
  - `public.user_sessions`: Active session tracking (IP, User-Agent, last active timestamp, revocation flag).
  - `public.auth_audit_events`: Immutable security log for logins, logouts, password resets, and MFA challenges.
- **API Requirements:**
  - `POST /api/auth/register`: Public student registration (if enabled by config).
  - `POST /api/auth/invite`: Administrative creation and email invitation for faculty/staff.
  - `POST /api/auth/password-reset/request` & `POST /api/auth/password-reset/confirm`.
  - `POST /api/auth/mfa/enroll`, `POST /api/auth/mfa/verify`.
  - `POST /api/auth/sessions/revoke` & `GET /api/auth/sessions`.
- **Frontend Requirements:**
  - Registration page with validation, password strength meter, and terms agreement.
  - Password reset request and confirmation screens.
  - Account security settings panel with MFA configuration and active sessions list.

### 1.4 Business Rules & Validation
- Passwords must be at least 10 characters with uppercase, lowercase, number, and special character.
- 5 consecutive failed login attempts lock the account for 15 minutes.
- Registration mode is centrally configurable: `PUBLIC`, `INVITE_ONLY`, or `DISABLED`.
- Priority: **P0 (Critical)**.

---

## DOMAIN 2 — User Profiles and Permissions

### 2.1 Existing Implementation
- Model in `src/types/index.ts` (`User`, `UserRole`: `STUDENT`, `INSTRUCTOR`, `COURSE_MANAGER`, `ORG_ADMIN`, `SUPER_ADMIN`, `SUPPORT_STAFF`).
- Role definitions and permissions registry in `src/lib/store/db.ts` (`PERMISSION_REGISTRY`).
- Hardcoded `organizationId: 'org-zealosh-main'` across user records.

### 2.2 Missing & Partial Functionality
- **Missing:** Separation between Student Profile (enrollment history, certificates, academic standing), Instructor Profile (bio, qualifications, assigned subjects, office hours), and Staff Profile (department, permissions).
- **Missing:** Profile picture upload to secure storage, contact details management, and multi-role assignment (e.g. an instructor taking an advanced certification course as a student).
- **Partial:** Role-based permissions exist in memory but are not fully enforced across all API endpoints.

### 2.3 Technical Architecture
- **Database Requirements:**
  - `public.profiles`: Base identity details.
  - `public.student_profiles`: Emergency contact, educational background, professional affiliation (HSE credentials).
  - `public.instructor_profiles`: Specializations, credentials, biographical summary, max assigned teaching hours.
  - `public.user_roles`: Mapping table allowing users to hold multiple distinct academic roles.
- **API Requirements:**
  - `GET /api/users/profile`, `PATCH /api/users/profile`.
  - `POST /api/users/profile/avatar`: Image upload with MIME validation and image optimization.
  - `GET /api/admin/users/[userId]/roles`, `POST /api/admin/users/[userId]/roles`.
- **Priority:** **P0 (Critical)**.

---

## DOMAIN 3 — Academic Administration

### 3.1 Existing Implementation (Completed in Phase 1 / ZM-01.1A)
- 7-Node Academic Hierarchy fully implemented in database and API layers:
  $$\text{Academic Year} \longrightarrow \text{Department} \longrightarrow \text{Programme} \longrightarrow \text{Course} \longrightarrow \text{Module} \longrightarrow \text{Topic} \longrightarrow \text{Subtopic}$$
- `courses` and `batches` tables in PostgreSQL linked to `departments`, `programmes`, and `academic_years`.
- Batch status: `UPCOMING`, `ACTIVE`, `COMPLETED`, `CANCELLED`.
- `lead_instructor_id` and `co_instructor_ids` arrays on courses and batches.
- Subtopic CRUD and complete tree assembly verified via `/api/admin/academic/tree`.
- Legacy lesson string `moduleTitle` migrated to relational `modules` idempotently.

### 3.2 Outstanding Administrative Capabilities (Phase 2+)
- Institutional academic calendar UI with holidays, live exam dates, and registration windows.
- Course curriculum versioning and historical syllabus archiving.

### 3.3 Technical Architecture
- **Database Tables (Implemented):**
  - `public.academic_years`: `id`, `name`, `code`, `start_date`, `end_date`, `is_current`, `status`.
  - `public.departments`: `id`, `name`, `code`, `description`, `head_instructor_id`, `status`.
  - `public.programmes`: `id`, `department_id`, `name`, `code`, `credential_title`, `description`, `duration_months`, `qualification_level`, `status`.
  - `public.modules`: `id`, `course_id`, `programme_id`, `title`, `code`, `description`, `delivery_mode`, `display_order`, `order_index`, `status`.
  - `public.topics`: `id`, `module_id`, `title`, `description`, `learning_objectives`, `display_order`, `order_index`, `estimated_minutes`, `status`.
  - `public.subtopics`: `id`, `topic_id`, `title`, `code`, `description`, `display_order`, `order_index`, `content_summary`, `status`.
- **API Endpoints (Implemented & Verified):**
  - `GET /api/admin/academic/tree`: Full institutional syllabus hierarchy.
  - Full CRUD under `/api/admin/academic/years`, `/departments`, `/programmes`, `/modules`, `/topics`, `/subtopics`.
  - Idempotent migration endpoint: `POST /api/admin/academic/migrate-modules`.
- **Status:** **COMPLETE & VERIFIED (ZM-01.1A)**.

---

## DOMAIN 4 — Admissions and Enrollment

### 4.1 Existing Implementation
- `enrollments` table with user, course, and batch foreign keys.
- Atomic stored procedure `enroll_student_atomic` enforcing batch capacity limits and preventing duplicate enrollments.
- Expiration dates and progress percentage tracking.

### 4.2 Missing & Partial Functionality
- **Missing:** Formal admission applications, application document uploads, administrative review and approval workflow, batch transfer management (moving a student from one cohort to another), student withdrawal workflow, readmission/rejoining handling, bulk student import via CSV/Excel, and historical enrollment audit logs.
- **Undecided:** Payment-linked automated admission vs. administrative review.

### 4.3 Technical Architecture
- **Database Requirements:**
  - `public.admission_applications`: `id`, `user_id`, `course_id`, `preferred_batch_id`, `status` (`DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `WITHDRAWN`), `submitted_at`, `reviewed_by`, `review_notes`.
  - `public.application_documents`: `id`, `application_id`, `document_type`, `file_url`, `verified`.
  - `public.enrollment_transfers`: `id`, `enrollment_id`, `source_batch_id`, `target_batch_id`, `reason`, `authorized_by`, `transferred_at`.
- **API Requirements:**
  - `POST /api/admissions/apply`: Submit student application.
  - `GET /api/admin/admissions`, `POST /api/admin/admissions/[id]/review`.
  - `POST /api/admin/enrollments/[id]/transfer`: Concurrency-safe batch transfer.
  - `POST /api/admin/enrollments/bulk-import`: CSV parsing and validation.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 5 — Course and Delivery Configuration

### 5.1 Existing Implementation
- `delivery_model` column on `courses` with enum `('RECORDED', 'LIVE', 'HYBRID', 'MATERIALS_ONLY')`.
- Course statuses: `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED`.

### 5.2 Missing & Partial Functionality
- **Missing:** Multi-level delivery configuration overriding at the Batch, Module, Topic, and Activity levels.
- **Missing:** Combined delivery mode utilizing all capabilities simultaneously.
- **Missing:** Delivery-dependent activity unlock rules (e.g. live workshop unlock requires completion of preceding prerecorded module).
- **Missing:** Course versioning and syllabus change tracking.

### 5.3 Technical Architecture
- **Database Requirements:**
  - `public.delivery_configurations`: Relational table storing delivery rules and prerequisites at the course, batch, module, or topic level.
  - Supported modes: `ONLINE_LIVE`, `PRERECORDED_ASYNC`, `HYBRID_BLENDED`, `COMBINED_FULL`.
- **API Requirements:**
  - `GET /api/courses/[id]/delivery-rules`.
  - `PUT /api/admin/courses/[id]/delivery-rules`.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 6 — Prerecorded Learning Management

### 6.1 Existing Implementation
- `lessons` table with `video_url`, `duration_minutes`, `downloadable_materials`, `content_html`.
- `completed_lesson_ids` array on enrollments for progress tracking.

### 6.2 Missing & Partial Functionality
- **Missing:** Native instructor video upload pipeline (supported formats: MP4, WebM; size limits, MIME validation).
- **Missing:** Video chapters and timestamps for prerecorded lessons.
- **Missing:** Playback progress persistence (exact resume playback timestamp in seconds, watch percentage).
- **Missing:** Video completion threshold (e.g. student must watch at least 90% of the video to mark lesson completed).
- **Missing:** Student personal notes and bookmarks linked to video playback timestamps.
- **Strict Constraint:** S3 storage remains deferred; local storage or external streaming URLs must be supported initially.

### 6.3 Technical Architecture
- **Database Requirements:**
  - `public.prerecorded_videos`: `id`, `lesson_id`, `title`, `duration_seconds`, `storage_path`, `thumbnail_url`, `transcription_text`.
  - `public.video_chapters`: `id`, `video_id`, `title`, `start_seconds`.
  - `public.video_playback_progress`: `id`, `user_id`, `lesson_id`, `last_position_seconds`, `max_watched_seconds`, `is_completed`, `updated_at`.
  - `public.student_notes`: `id`, `user_id`, `lesson_id`, `timestamp_seconds`, `note_text`.
- **API Requirements:**
  - `POST /api/lessons/[id]/progress`: Lightweight beacon saving playback position.
  - `GET /api/lessons/[id]/notes`, `POST /api/lessons/[id]/notes`.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 7 — Live Classroom Management

### 7.1 Existing Implementation
- BigBlueButton 4.0 integration via `BbbApiClassroomProvider` and `BigBlueButtonAdapter`.
- Session lifecycle: `SCHEDULED` $\rightarrow$ `LIVE` $\rightarrow$ `ENDING` $\rightarrow$ `ENDED` with provider verification.
- Server-side join token issuance with attendee vs. moderator credentials.
- Rejection of join attempts during `ENDING` status.

### 7.2 Missing & Partial Functionality
- **Missing:** Live session recurring schedule generator (e.g. automatically provision 16 weekend sessions across 8 weeks).
- **Missing:** Participant disconnect and reconnect tracking during live meetings.
- **Missing:** Waiting room / pre-session lobby with countdown timer.
- **Partial:** Classroom launch works, but real multi-user WebRTC acceptance testing requires live Server 2 deployment (CP-8.14B).

### 7.3 Priority: **P1 (Core Academic / Deployment Dependent)**.

---

## DOMAIN 8 — Live Recording Management

### 8.1 Existing Implementation
- `class_recordings`, `recording_batch_access`, `recording_highlights`, `recording_resources`, `recording_doubts`.
- Dual webhook authentication (`bbb-webhooks` checksum and `meta_bbb-recording-ready-url` JWT).
- Ingestion reconciliation with duplicate event prevention.
- Previous-batch access governance.

### 8.2 Interactive Highlights & Timeline Doubts Specifications
- **Classroom Highlights Specification:**
  - Moderator/instructor-authored timeline markers with explicit boundaries (`startTimeSeconds`, `endTimeSeconds`).
  - Carries `title`, `description`, and `importance` rating (`HIGH`, `MEDIUM`, `LOW`).
  - Faculty preview capability before publishing to the cohort.
  - Student interface is view-only with direct playback seeking to key instructional timestamps.
- **Interactive Doubts Specification:**
  - Enrolled learners can submit doubts pinned to exact video seconds (`timestampSeconds`).
  - Thread-based instructor reply model supporting follow-up clarifications.
  - Lifecycle states: `OPEN` $\rightarrow$ `ANSWERED` $\rightarrow$ `RESOLVED`.
  - Service Level Agreement (SLA): Technical default of 48 hours for faculty response (institutional policy pending via BDR-15).

### 8.3 Missing & Partial Functionality
- **Missing:** Automated recording processing status notifications to enrolled students.
- **Missing:** Video download watermarking / access logging.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 9 — Learning Resources

### 9.1 Existing Implementation
- `recording_resources` table for live recordings.
- `downloadable_materials` JSONB on lessons.

### 9.2 Missing & Partial Functionality
- **Missing:** Centralized Institutional Resource Library (categorized by department, course, subject).
- **Missing:** Resource versioning and expiration dates.
- **Missing:** Access permission rules (e.g. View-only in browser vs. Downloadable PDF).
- **Priority:** **P2 (Operations)**.

---

## DOMAIN 10 — Attendance and Participation

### 10.1 Existing Implementation
- `attendance_records` table storing `sessionId`, `userId`, `joinedAt`, `leftAt`, `durationMinutes`, `attended: boolean`.

### 10.2 Missing & Partial Functionality
- **Missing:** Webhook-driven leave time and reconnection logging from BigBlueButton `user-left` events.
- **Missing:** Configurable attendance calculation policy (e.g. attended at least 75% of scheduled meeting minutes).
- **Missing:** Faculty attendance override and manual correction interface with audit trail.
- **Missing:** Attendance threshold enforcement for exam eligibility and certificate issuance.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 11 — Assignments and Submissions

### 11.1 Existing Implementation
- `assignments` and `assignment_submissions` tables.
- Rubrics supported: `GradingRubric`, `RubricCriterion`, `RubricScore`.
- Endpoints: `POST /api/assignments`, `POST /api/assignments/[id]/submit`, `POST /api/assignments/[id]/grade`.

### 11.2 Missing & Partial Functionality
- **Missing:** Late submission penalty policy (e.g. -5% per day overdue, hard cutoff after 3 days).
- **Missing:** Multi-attempt / resubmission limits and versioned submission history.
- **Missing:** Scheduled release date for assignments.
- **Missing:** Concurrency guard during instructor grading (preventing simultaneous overwrite by two co-instructors).
- **Missing:** Safe file upload handling for student attachments (virus scan, file extension whitelisting, 25MB ceiling).
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 12 — Question Bank

### 12.1 Existing Implementation
- `exam_questions` table linked directly to `certificationType` with `domain` and `topic` string fields.

### 12.2 Missing & Partial Functionality
- **Missing:** Generalized Question Bank decoupled from specific exam blueprints.
- **Missing:** Hierarchical mapping: Course $\rightarrow$ Module $\rightarrow$ Topic $\rightarrow$ Subtopic.
- **Missing:** Support for extended question types: Short Answer, Numerical, Matching, Descriptive.
- **Missing:** Question versioning, review status (`DRAFT`, `IN_REVIEW`, `APPROVED`, `ARCHIVED`), and author tracking.
- **Missing:** Question reuse across multiple quizzes and examinations without duplication.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 13 — Quizzes

### 13.1 Existing Implementation
- **Completely Missing:** There is currently zero quiz implementation in the codebase.

### 13.2 Technical Requirements
- **Database Requirements:**
  - `public.quizzes`: `id`, `course_id`, `module_id`, `topic_id`, `title`, `quiz_type` (`PRE_LESSON`, `POST_LESSON`, `MODULE_CHECKPOINT`, `IN_CLASS`), `time_limit_minutes`, `passing_score_percent`, `max_attempts`, `randomize_questions`, `immediate_feedback`.
  - `public.quiz_questions`: Mapping table selecting questions from Question Bank with point values.
  - `public.quiz_attempts`: `id`, `quiz_id`, `user_id`, `attempt_number`, `status` (`IN_PROGRESS`, `SUBMITTED`, `TIMED_OUT`), `score`, `passed`, `answers` JSONB, `started_at`, `submitted_at`.
- **API Requirements:**
  - `GET /api/quizzes/[id]`: Delivers sanitized questions (no answer keys).
  - `POST /api/quizzes/[id]/start`, `POST /api/quizzes/[id]/answer`, `POST /api/quizzes/[id]/submit`.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 14 — Examinations

### 14.1 Existing Implementation
- `exam_blueprints`, `exam_questions`, `exam_attempts`.
- Server-authoritative timer enforcement with 60-second grace window.
- Sanitized view `learner_exam_questions` stripping answer keys.
- Domain diagnostic score breakdown.

### 14.2 Missing & Partial Functionality
- **Missing:** Examination scheduling windows (e.g. exam only accessible between Oct 30 10:00 AM and 1:00 PM).
- **Missing:** Retake policies and mandatory cooling-off periods between attempts.
- **Missing:** Subjective / descriptive question evaluation workflow.
- **Undecided:** Online proctoring and webcam invigilation.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 15 — Course Completion and Certificates

### 15.1 Existing Implementation
- `certificates` table (`id`, `user_id`, `course_id`, `certificate_number`, `verification_code`, `issue_date`, `score_percent`, `status`).
- Public verification route: `/api/certificates/verify/[code]`.

### 15.2 Missing & Partial Functionality
- **Missing:** Configurable Multi-Criteria Completion Evaluation Engine:
  $$\text{Completion} = f(\text{Lessons Watched}, \text{Attendance \%}, \text{Quizzes Passed}, \text{Assignments Graded}, \text{Exam Score})$$
- **Missing:** Dynamic certificate PDF generation with embedded QR codes and institutional signatures.
- **Missing:** Certificate revocation and reissuance workflow with audit logging.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 16 — Student Dashboard

### 16.1 Existing Implementation
- `/student` page showing enrolled courses, upcoming live classes, and recent recordings.

### 16.2 Missing & Partial Functionality
- **Missing:** Unified learning timeline integrating live classes, pending quizzes, assignments, and prerecorded modules.
- **Missing:** Gradebook view displaying all scores, feedback, and certificate download links.
- **Missing:** Responsive mobile layout optimization and empty/loading state completeness.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 17 — Instructor Dashboard

### 17.1 Existing Implementation
- `/instructor` page with assigned cohort overview, live class launcher, and grading queue shortcuts.

### 17.2 Missing & Partial Functionality
- **Missing:** Comprehensive grading queue with filter by batch/course and inline rubric scoring.
- **Missing:** Batch attendance inspection and manual correction interface.
- **Missing:** Course content editor for uploading lessons and attaching resources.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 18 — Administration Dashboard

### 18.1 Existing Implementation
- `/admin` page with configuration tabs (branding, feature flags, roles, settings, audit logs).

### 18.2 Missing & Partial Functionality
- **Missing:** User management interface (create, suspend, reset password, assign roles).
- **Missing:** Academic structure editor (academic years, departments, programmes, courses, modules).
- **Missing:** Live system health and error monitoring dashboard.
- **Priority:** **P1 (Core Academic)**.

---

## DOMAIN 19 — Communication and Notifications

### 19.1 Existing Implementation
- `notification_templates` table in migration 3.

### 19.2 Missing & Partial Functionality
- **Missing:** In-app notification center (bell icon, unread count, mark as read).
- **Missing:** Transactional email dispatch engine (welcome, password reset, class reminder, assignment due, grade posted).
- **Missing:** User notification preference controls.
- **Undecided:** WhatsApp and SMS notifications.
- **Priority:** **P2 (Operations)**.

---

## DOMAIN 20 — Learning Progress and Analytics

### 20.1 Existing Implementation
- Elementary `progress_percent` column calculated from completed lesson count.

### 20.2 Missing & Partial Functionality
- **Missing:** True source-of-truth weighted progress calculation across lessons, quizzes, and live classes.
- **Missing:** Student performance analytics, learning gap identification, and drop-off reports.
- **Missing:** Batch-level pass rate and attendance analytics for instructors and admins.
- **Priority:** **P2 (Operations)**.

---

## DOMAIN 21 — System Configuration

### 21.1 Existing Implementation
- `platform_settings`, `branding_theme`, `feature_flags`, `navigation_items`, `roles`.
- Superadmin audit trail and version rollback mechanism in `config_audits`.

### 21.2 Hardening Required
- Strict separation between database-backed business settings, admin-managed options, and environment secrets.
- Elimination of all scattered hardcoded constants across application code.
- Priority: **P1 (Core Governance)**.

---

## 22. Phase 2 Readiness Dependency Matrix

With Phase 1 Core Foundations fully audited, hardened, and verified under Milestone ZM-01.1A (34 test files, 408/408 passing tests, zero TypeScript errors, clean production Next.js build), the platform is certified ready to advance to **Phase 2: Learning Delivery**.

| Phase 2 Workstream | Phase 1 Foundation Prerequisite | Verification Status in ZM-01.1A | Readiness State |
| :--- | :--- | :--- | :--- |
| **WS 2.1: Video Delivery & Lesson Player** | Academic Hierarchy (Modules & Topics) | 7-node tree (`/api/admin/academic/tree`) verified | **READY** |
| **WS 2.2: Live Classroom Schedule Engine** | Batches & Academic Years | Batches linked to `ay-2026-2027` verified | **READY** |
| **WS 2.3: Formative Quizzes & Question Bank** | Topics & Subtopics Entities | Subtopic CRUD verified in security test suite | **READY** |
| **WS 2.4: Coursework Rubric Grading** | Multi-Role Assignments (Student vs Instructor) | Role boundaries & profile resolution verified | **READY** |
| **WS 2.5: Interactive Recordings & Highlights** | Recording Doubts & Highlights API | Webhooks, doubts, and highlights contracts verified | **READY** |
| **WS 2.6: Admissions Onboarding Queue** | Atomic Enrollment Stored Procedure | Concurrency safety & duplicate rejection verified | **READY** |


