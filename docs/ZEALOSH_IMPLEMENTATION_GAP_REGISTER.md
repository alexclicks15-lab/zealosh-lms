# Zealosh LMS — Master Implementation Gap Register

**Document Version:** 1.0.0  
**Milestone:** ZM-01 — Master Product Blueprint  
**Target:** Single Institutional Learning & Certification Platform (`https://zealosh.com`)  
**Brand:** Zealosh Training & Consultants  
**Date:** October 30, 2026  

---

## 1. Classification Taxonomy
Every identified product requirement is evaluated and classified into exactly one status:
- `IMPLEMENTED_AND_VERIFIED`: Code exists, is wired to database/API, and is verified by automated test suites.
- `PARTIALLY_IMPLEMENTED`: Code or schema exists, but features are incomplete, unintegrated, or lack full test coverage.
- `MISSING`: Functional requirement is completely absent from the codebase.
- `UNDECIDED`: Institutional policy, legal mandate, or workflow decision required before implementation.
- `BLOCKED_BY_EXTERNAL_DEPENDENCY`: Cannot be verified or completed without physical server provisioning or external third-party services.

---

## 2. Comprehensive Implementation Gap Register

| Gap ID | Domain | Requirement | Current Implementation | Missing Functionality | Status | Priority | Complexity | Decision Needed? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GAP-01** | Auth | Supabase Auth Integration | Custom JWT signing in `src/lib/auth/jwt.ts` | Migration to Supabase Auth (`auth.users`), GoTrue session handling, `profiles` table | `PARTIALLY_IMPLEMENTED` | P0 | Medium | No |
| **GAP-02** | Auth | Self-Registration & Email Verify | None | Public registration route, email verification tokens, rate limiting | `MISSING` | P0 | Medium | Yes (Registration Mode) |
| **GAP-03** | Auth | Password Reset & MFA | None | Password reset request/confirm flows, TOTP/MFA enrollment and challenge | `MISSING` | P0 | Medium | No |
| **GAP-04** | Auth | Session Revocation & Lockout | None | User sessions tracking table, multi-device view, 5-attempt lockout logic | `MISSING` | P0 | Small | No |
| **GAP-05** | Profiles | Student, Instructor & Staff Profiles | Single `users` table with role string | Dedicated `profiles`, `student_profiles`, `instructor_profiles` tables | `PARTIALLY_IMPLEMENTED` | P0 | Medium | No |
| **GAP-06** | Profiles | Multi-Role & Profile Pictures | Single role string per user; static avatars | Multi-role assignment table (`user_roles`), secure avatar upload pipeline | `MISSING` | P1 | Small | No |
| **GAP-07** | Academic | Institutional Hierarchy | `courses` and `batches` tables only | `academic_years`, `departments`, `programmes`, `subjects`, `modules`, `topics`, `subtopics` | `PARTIALLY_IMPLEMENTED` | P1 | Large | Yes (Dept Structure) |
| **GAP-08** | Academic | Academic Calendar & Scheduling | `scheduleDescription` string | Structured academic calendars, holiday exclusions, term date bounds | `MISSING` | P1 | Medium | Yes (Term Dates) |
| **GAP-09** | Admissions | Application & Review Workflow | Direct enrollment only | Student applications, document upload, admin review queue, approval | `MISSING` | P1 | Medium | Yes (Admission Policy) |
| **GAP-10** | Admissions | Batch Transfers & Withdrawals | Atomic enrollment only | Safe cohort transfer API, withdrawal processing, enrollment history logs | `MISSING` | P1 | Small | No |
| **GAP-11** | Delivery | Multi-Level Delivery Overrides | Course-level enum only | Overrides at Batch, Module, Topic, Activity level; Combined delivery mode | `PARTIALLY_IMPLEMENTED` | P1 | Medium | No |
| **GAP-12** | Prerecorded | Video Upload & Processing | Static external URLs | Faculty video upload, format validation (MP4/WebM), thumbnail generation | `MISSING` | P1 | Large | No (S3 Deferred) |
| **GAP-13** | Prerecorded | Playback Progress & Scrub Resume | Boolean `completedLessonIds` | High-frequency progress beacon, exact resume timestamp, 90% watch threshold | `MISSING` | P1 | Medium | Yes (Watch Threshold) |
| **GAP-14** | Prerecorded | Video Notes & Bookmarks | None | Timestamp-linked personal notes and bookmarks for students | `MISSING` | P2 | Small | No |
| **GAP-15** | Live Class | Live WebRTC Meeting Conduction | BBB provider and join tokens verified | Real multi-party WebRTC audio/video in production browser | `BLOCKED_BY_EXTERNAL_DEPENDENCY` | P1 | Large | No (Awaiting S2 VPS) |
| **GAP-16** | Live Class | Recurring Class Session Generator | Manual session entry | Auto-generation of weekly recurring batch sessions based on schedule rule | `PARTIALLY_IMPLEMENTED` | P1 | Small | No |
| **GAP-17** | Recordings | Live Recording Ingestion | Webhooks & database deduplication verified | Verified in tests; real recording publish callback from staging media server | `BLOCKED_BY_EXTERNAL_DEPENDENCY` | P1 | Medium | No (Awaiting S2 VPS) |
| **GAP-18** | Attendance | Disconnect & Leave Tracking | `attendance_records` stores join | Event-driven leave time capture from BBB webhooks; duration calculation | `PARTIALLY_IMPLEMENTED` | P1 | Medium | No |
| **GAP-19** | Attendance | Attendance Threshold Enforcement | None | Configurable minimum attendance threshold (e.g. 75%) for exam eligibility | `MISSING` | P1 | Small | Yes (Threshold %) |
| **GAP-20** | Assignments | Coursework & Rubric Grading | Schema, submit, grade API verified | Late submission policies, attempt limits, submission version history | `PARTIALLY_IMPLEMENTED` | P1 | Medium | Yes (Late Policy) |
| **GAP-21** | Question Bank | Central Question Bank | `exam_questions` tied to certType | Generalized bank with Course/Module/Topic mapping, approval workflow | `PARTIALLY_IMPLEMENTED` | P1 | Large | No |
| **GAP-22** | Quizzes | Topic & Subtopic Quizzes | None | `quizzes`, `quiz_questions`, `quiz_attempts`, automated objective scoring | `MISSING` | P1 | Large | No |
| **GAP-23** | Examinations | High-Stakes Exam Simulator | Blueprint, timer, answers verified | Exam scheduling windows, retake cooling-off periods, manual evaluation | `IMPLEMENTED_AND_VERIFIED` | P1 | Small | Yes (Retake Policy) |
| **GAP-24** | Exams | Online Proctoring / Invigilation | None | Remote webcam proctoring, browser lockdown, identity verification | `UNDECIDED` | P3 | Large | Yes (Institute Policy) |
| **GAP-25** | Certificates | Multi-Criteria Completion Engine | Exam-triggered certificate only | Engine evaluating Lessons + Attendance + Quizzes + Assignments + Exam | `MISSING` | P1 | Medium | Yes (Criteria Rules) |
| **GAP-26** | Certificates | Dynamic PDF Generation & QR | Data record & verify route exist | PDF template compilation with embedded QR code pointing to verify URL | `PARTIALLY_IMPLEMENTED` | P1 | Medium | No |
| **GAP-27** | Dashboards | Responsive Multi-Role Dashboards | Desktop layouts exist for 3 roles | Unified student timeline, instructor grading queue, mobile responsive layout | `PARTIALLY_IMPLEMENTED` | P1 | Large | No |
| **GAP-28** | Notifications | In-App & Transactional Email | Template schema only | In-app notification center, SMTP transactional email sender, preferences | `MISSING` | P2 | Medium | Yes (Email Provider) |
| **GAP-29** | Analytics | Source-of-Truth Progress & Reports | Rudimentary lesson count | Weighted completion calculation, drop-off reports, batch pass rate trends | `PARTIALLY_IMPLEMENTED` | P2 | Medium | No |
| **GAP-30** | Monitoring | Live Bug Monitoring & Error Tracker | Standard console logs only | Client/server structured exception capture, error grouping, diagnostic UI | `MISSING` | P0 | Medium | No |
| **GAP-31** | AI Tutor | Course-Grounded AI Tutor | Feature gate only (ADR-003) | Ollama VPS, RAG pipeline, course notes vector index, tutor chatbot | `MISSING` | P3 | Large | Approved Deferred |
| **GAP-32** | AI Grading | AI-Assisted Assignment Evaluation | None | Ollama prompt evaluation producing suggested rubric scores in tutor queue | `MISSING` | P3 | Large | Approved Deferred |

---

## 3. Detailed Gap Descriptions & Implementation Blueprints

### GAP-01: Supabase Auth & Application Profile Decoupling
- **Current State:** Handcrafted JWT signing and bcrypt password verification in `src/lib/auth/jwt.ts`.
- **Root Cause:** Early prototyping used in-memory / local JWT before Supabase Auth architecture was formalized.
- **Risk:** High. Bypasses Supabase built-in security features, brute-force protection, and official client token refresh lifecycles.
- **Proposed Solution:** Implement Supabase Auth SDK on backend route handlers. Create a database trigger on `auth.users` to automatically populate `public.profiles`. Maintain existing session cookie pattern via Supabase SSR helpers.
- **Acceptance Criteria:** Users log in via Supabase Auth; session tokens are validated against Supabase; profiles table links to `auth.users.id`.

### GAP-07: Relational Academic Hierarchy
- **Current State:** Only `courses` and `batches` exist. Modules are strings on lessons. Topics and subtopics do not exist as database entities.
- **Root Cause:** Initial milestones focused on course-level enrollment and live session orchestration.
- **Risk:** Prevents granular delivery configuration, topic-specific quizzes, and structured curriculum navigation.
- **Proposed Solution:** Create normalized tables `academic_years`, `departments`, `programmes`, `modules`, `topics`, and `subtopics` with foreign key cascades and display order indexes.
- **Acceptance Criteria:** Instructors can author modules, topics, and subtopics; lessons and quizzes map cleanly to the academic tree.

### GAP-22: Topic & Subtopic Quiz Subsystem
- **Current State:** Completely missing. The repository has high-stakes certification exam attempts (`exam_attempts`), but no formative quiz engine.
- **Root Cause:** Focus was placed on the BCSP/BCRSP certification exam simulator before classroom quizzes were scheduled.
- **Risk:** Students have no self-assessment or topic checkpoint mechanisms during course progression.
- **Proposed Solution:** Implement `public.quizzes` (mapping to module/topic), `public.quiz_questions` (linking to Question Bank), and `public.quiz_attempts` with automatic objective evaluation and immediate/delayed feedback.
- **Acceptance Criteria:** Students can take topic quizzes; scores record in gradebook; completion engine evaluates quiz pass status.

### GAP-25: Multi-Criteria Course Completion Engine
- **Current State:** Certificates are issued directly upon passing an exam attempt or manual admin call.
- **Root Cause:** Multi-activity completion evaluation was not yet synthesized into an authoritative rule evaluator.
- **Risk:** High. Certificates could be awarded to students who have not attended live classes or submitted mandatory coursework.
- **Proposed Solution:** Create `public.course_completion_policies` storing required criteria. Implement server-authoritative service `evaluateCourseCompletion(userId, courseId)` that checks lessons, attendance %, quizzes, assignments, and exam score before permitting certificate issuance.
- **Acceptance Criteria:** Certificate generation fails with descriptive unmet criteria if any requirement is incomplete.

### GAP-30: Live Bug Monitoring & Developer Diagnostics
- **Current State:** Application logs to stdout/stderr. No persistent error tracker or real-time diagnostic dashboard.
- **Root Cause:** Staging infrastructure preparation preceded operational observability implementation.
- **Risk:** Production defects, silent webhook failures, or WebRTC connection errors cannot be triaged or diagnosed quickly.
- **Proposed Solution:** Implement a centralized lightweight error-logging service (`public.system_errors`) with client-side error boundary reporting, server API exception logging, error fingerprint grouping, and an administrative diagnostic viewer at `/admin/diagnostics`.
- **Acceptance Criteria:** Unhandled exceptions capture stack traces and correlation IDs without leaking secrets; errors display in admin diagnostic UI.

