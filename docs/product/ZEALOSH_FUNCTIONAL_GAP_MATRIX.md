# Zealosh LMS — Comprehensive Functional Gap Matrix

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-08A — Complete Product Scope Audit, Functional Gap Analysis & Remaining Development Roadmap  
**Scope:** Layer-by-Layer Architectural Gap Analysis Across All 20 Functional Domains  
**Layers Evaluated:** Database, Backend Service/API, Frontend UI, External Integration, Test Verification  
**Date:** November 2026  
**Status:** APPROVED AUDIT BASELINE  

---

## 1. Executive Gap Analysis Summary

Across the 20 functional domains of the Zealosh platform:
- **Verified Complete & Robust:** 24 capabilities (including Exam Engine, Visual PageBuilder CMS, Academic Hierarchy, Delivery Modes, Video Scrub Resume, Quizzes, Rubric Grading, Invoicing, Support Ticketing, Multi-Domain Reports).
- **Partially Implemented (Workflow or UI Gaps):** 16 capabilities (including Supabase Auth decoupling, Admissions pipeline, Course-page dynamic offering linkage, Master Calendar, Cross-service sync outbox, Object storage direct client).
- **Completely Missing / Pending Development:** 12 capabilities (including Separate Product/Offering & Entitlement model, External Certification tracker, Student reviews & testimonials, Central question bank UI, Gamification streaks/badges, 1-on-1 Mentorship booking, Automated RAG document chunking/embeddings, Referral codes).
- **External Integrations Unconfigured / Gated:** 4 capabilities (Server 2 BigBlueButton live video, Server 3 Ollama live inference, Official WhatsApp Business API, Live Razorpay/Stripe credentials).

---

## 2. Layer-by-Layer Functional Gap Matrix

### Domain A: Identity, Security & Institutional Foundation
- **Expected Functionality:** Supabase Auth (`auth.users`) integration, multi-factor authentication (TOTP), self-registration with email verification, password recovery, session revocation / multi-device management, 5-attempt failed login lockout, and RBAC permission guards.
- **Current Implementation:** Custom JWT in `src/lib/auth/jwt.ts`, TOTP MFA verified (`tests/mfa-auth.test.ts`), password reset verified, profiles linked in database (`public.profiles`).
- **Database Gaps:** Database trigger on `auth.users` to automatically synchronize `public.profiles` on external signup; trigger-enforced 15-minute lockout on 5 failed attempts.
- **Backend Gaps:** Complete migration of session management from local JWT verification to Supabase GoTrue Auth token validation while preserving backward compatibility.
- **Frontend Gaps:** User security settings panel displaying active device sessions with a one-click "Revoke Other Sessions" button.
- **Integration Gaps:** Supabase GoTrue Auth client configuration.
- **Test Gaps:** Automated tests for concurrent multi-device session revocation.
- **Security Gaps:** Brute-force lockout currently evaluated in application memory rather than locked at database level.
- **Domain Status:** `PARTIALLY IMPLEMENTED (P0)`

---

### Domain B: Public Website, Dynamic CMS & Customization Layers
- **Expected Functionality:** Three distinct customization layers:
  1. Public website CMS (Visual PageBuilder, revisions, scheduling, templates, SEO metadata).
  2. Dynamic course page builder (linked directly to authoritative course data, fees, offerings, batches).
  3. Protected workspace layout customization (configurable dashboard widgets for admins).
- **Current Implementation:** Layer 1 (PageBuilder CMS at `/p/[...slug]`, `/api/cms/*`) is **100% verified complete** (55/55 Playwright green). Layer 2 links static course fields. Layer 3 has platform settings API.
- **Database Gaps:** Dynamic course page template mapping table linking CMS pages to authoritative product offerings.
- **Backend Gaps:** API route to dynamically assemble course landing page sections from authoritative course database records.
- **Frontend Gaps:** Visual layout configurator for admin dashboard widgets.
- **Integration Gaps:** None.
- **Test Gaps:** E2E test verifying that changing course fees in the database immediately updates the published course CMS landing page.
- **Security Gaps:** Ensure unpublished draft courses never stream HTTP 200 headers (remediated in 07B via `src/middleware.ts`).
- **Domain Status:** `LAYER 1 VERIFIED COMPLETE / LAYERS 2 & 3 PARTIAL (P0/P1)`

---

### Domain C: Core Academic Management
- **Expected Functionality:** 7-level academic hierarchy (Year -> Department -> Programme -> Course -> Module -> Topic -> Subtopic), batch management with capacity limits, lead and co-instructor assignments, recurring schedules, and course delivery modes (`LIVE`, `PRERECORDED`, `HYBRID`).
- **Current Implementation:** Hierarchy schema and tree assembly API fully verified (`/api/admin/academic/tree`); batch lifecycle verified (`tests/batch-lifecycle.test.ts`); delivery configurations verified.
- **Database Gaps:** None.
- **Backend Gaps:** Curriculum versioning and historical syllabus snapshotting API.
- **Frontend Gaps:** Visual drag-and-drop hierarchy reordering tree in the admin workspace.
- **Integration Gaps:** None.
- **Test Gaps:** Visual tree interaction tests.
- **Security Gaps:** Enforce that instructors can only edit syllabus trees for courses where they are assigned as lead instructor.
- **Domain Status:** `VERIFIED COMPLETE (CORE) / UI POLISH NEEDED (P1)`

---

### Domain D: Learning Experience & Academic Delivery
- **Expected Functionality:** Video lecture streaming with forward-scrub restrictions and high-frequency beacon resume, time-released learning materials (scheduled, manual, elapsed-time), and in-video bookmarks, highlights, and doubt submissions.
- **Current Implementation:** Video progress tracking verified (`tests/playback-progress.test.ts`); learning materials time-release engine verified (`tests/learning-materials.test.ts`); doubts and highlights verified (`tests/recording-doubts.test.ts`).
- **Database Gaps:** None.
- **Backend Gaps:** None.
- **Frontend Gaps:** Complete.
- **Integration Gaps:** None.
- **Test Gaps:** 100% covered across existing test files.
- **Security Gaps:** Prevent unauthorized material downloads using time-limited signed tokens (verified in `tests/learning-materials.test.ts`).
- **Domain Status:** `VERIFIED COMPLETE (P0)`

---

### Domain E: Assessments, Examinations & Credentials
- **Expected Functionality:** High-stakes HSE certification examination engine with anti-cheat proctoring, server-enforced deadline timers, frozen question snapshots, objective scoring, manual rubric evaluation for descriptive questions, formative topic/subtopic quizzes, central question bank, and digital certificates with public QR verification.
- **Current Implementation:** Exam simulator verified; topic quizzes verified (`tests/quizzes-lifecycle.test.ts`); rubric grading verified (`tests/assignments-rubric.test.ts`); completion policy verified; certificate verify route `/verify/[code]` verified.
- **Database Gaps:** Item difficulty and distractor analysis statistics tables (`public.question_statistics`).
- **Backend Gaps:** Centralized Question Bank management API with reusable question pools across multiple courses; dynamic PDF rasterizer with embedded QR codes.
- **Frontend Gaps:** Question Bank search and authoring workspace; student exam retake cooling-off countdown timer UI.
- **Integration Gaps:** PDF generation engine (PDFKit/Canvas).
- **Test Gaps:** Automated tests for psychometric distractor calculations.
- **Security Gaps:** Verify that answer keys are strictly excluded from student quiz/exam attempt payloads before submission (verified in `tests/exam-integrity.test.ts`).
- **Domain Status:** `CORE EXAM & QUIZ VERIFIED COMPLETE / QUESTION BANK UI MISSING (P1)`

---

### Domain F: External Certification Planning
- **Expected Functionality:** Student-owned planning tracker for external certification board examinations (BCSP ASP/CSP/CIT, BCRSP CRSP, NEBOSH, IOSH). Students record target exam dates, track preparation milestones, share plans with assigned tutors, and log verified outcomes.
- **Current Implementation:** None.
- **Database Gaps:** `public.external_certification_plans`, `public.certification_boards`, `public.external_exam_outcomes`.
- **Backend Gaps:** CRUD APIs for student certification plans and tutor milestone recommendations.
- **Frontend Gaps:** Student certification planner dashboard and tutor advisory view.
- **Integration Gaps:** None (explicitly excludes unofficial scraping or automated booking with external boards).
- **Test Gaps:** Complete suite required.
- **Security Gaps:** Distinguish between student-reported exam results and staff-verified certificates.
- **Domain Status:** `NOT IMPLEMENTED (P2)`

---

### Domain G: Student Reviews, Testimonials & Success Stories
- **Expected Functionality:** Granular student course/tutor reviews, written/photo/video testimonials, verified student achievements, success story poster generator, and public showcase page with strict student consent controls.
- **Current Implementation:** None.
- **Database Gaps:** `public.course_reviews`, `public.student_testimonials`, `public.testimonial_consents`.
- **Backend Gaps:** Review submission, consent capture, moderation queue (approve/reject/archive), and public aggregation APIs.
- **Frontend Gaps:** Student review modal, admin testimonial moderation queue, and public success story showcase block.
- **Integration Gaps:** Media storage for testimonial photos/videos.
- **Test Gaps:** Complete suite required.
- **Security Gaps:** Invariant: No student testimonial, photo, or name may be published publicly without an explicit, verifiable consent record.
- **Domain Status:** `NOT IMPLEMENTED (P2)`

---

### Domain H: Student Engagement & Gamification
- **Expected Functionality:** Daily study streaks, XP/learning points for lesson completion and quiz passing, milestone badges, cohort leaderboards, and study consistency tracking.
- **Current Implementation:** None.
- **Database Gaps:** `public.user_streaks`, `public.learning_points_ledger`, `public.achievement_badges`, `public.user_badges`.
- **Backend Gaps:** Point calculation service on academic activity completion; streak freeze / reset logic; privacy-respecting leaderboard aggregation.
- **Frontend Gaps:** Student streak flame icon, XP progress bar, badges showcase, and opt-out privacy toggle.
- **Integration Gaps:** None.
- **Test Gaps:** Complete suite required.
- **Security Gaps:** Gamification points must never bypass academic completion requirements or grant unearned certificate access.
- **Domain Status:** `BLOCKED BY INSTITUTIONAL POLICY DECISION (BDR-16) / NOT IMPLEMENTED (P3)`

---

### Domain I: One-to-One Mentorship & Booking
- **Expected Functionality:** Instructor 1-on-1 office hours booking, slot availability scheduling, student appointment booking, calendar integration, reschedule/cancellation, and attendance recording.
- **Current Implementation:** None.
- **Database Gaps:** `public.instructor_office_hours`, `public.mentorship_appointments`.
- **Backend Gaps:** Availability calculation API, conflict detection, booking confirmation, and BigBlueButton 1-on-1 room provisioning.
- **Frontend Gaps:** Student mentor booking calendar and instructor office-hours manager.
- **Integration Gaps:** BigBlueButton private meeting API.
- **Test Gaps:** Concurrency testing to prevent double-booking of instructor slots.
- **Security Gaps:** Verify whether mentorship is an included academic service or a separately paid commercial entitlement.
- **Domain Status:** `NOT IMPLEMENTED / COMMERCIAL CLASSIFICATION REQUIRED (P2)`

---

### Domain J: Complete Messaging & Communication
- **Expected Functionality:** Private 1-on-1 chat, group chat, course channels, batch channels, isolated cross-batch revision channels, shared admissions/support inboxes, message status (sending/sent/delivered/read), rich attachments, and official WhatsApp Business API integration.
- **Current Implementation:** 1-on-1 direct messaging verified (`tests/direct-messaging.test.ts`); support ticketing verified (`tests/support-ticketing.test.ts`); migration 18 defines channel tables.
- **Database Gaps:** None (channel schema defined in `supabase/migrations/20261103000018_zealosh_in_app_messaging.sql`).
- **Backend Gaps:** Channel message dispatch, thread replies, read receipt aggregation, and cross-batch academic isolation enforcement.
- **Frontend Gaps:** Channel drawer, message threading UI, and attachment uploader.
- **Integration Gaps:** WhatsApp Business API (WABA) provider unconfigured.
- **Test Gaps:** Test verifying cross-batch channel isolation (students in revision group cannot see other batch's assignments/grades).
- **Security Gaps:** Strict academic boundary: messaging channel membership must NEVER grant enrollment access to course materials or exams.
- **Domain Status:** `1-ON-1 & SUPPORT COMPLETE / CHANNELS DATABASE PRESENT, UI MISSING (P1)`

---

### Domain K: Admissions CRM & Enquiry Management
- **Expected Functionality:** Public website lead capture, course landing page enquiry forms, 14-stage admissions pipeline (New -> Contacted -> Application Started -> Submitted -> Document Review -> Eligibility Review -> Orientation Pending -> Approved -> Offer/Payment Pending -> Admitted -> Waitlisted -> Rejected -> Withdrawn -> Closed), document upload & verification, bulk CSV import, and follow-up scheduling.
- **Current Implementation:** Basic application submission (`/api/admissions/apply`), review route (`/api/admin/admissions`), bulk import (`/api/admin/admissions/bulk-import`).
- **Database Gaps:** Pipeline stage transitions audit table (`public.admission_status_history`).
- **Backend Gaps:** Complete 14-stage state machine transitions with reason tracking; follow-up reminder scheduling.
- **Frontend Gaps:** Interactive Kanban / Pipeline board for admissions staff; document verification viewer with side-by-side approval controls.
- **Integration Gaps:** Email/SMS notifications to applicants upon status changes.
- **Test Gaps:** Pipeline state machine transition validation tests.
- **Security Gaps:** Protect uploaded applicant identity documents (PAN/Aadhaar/Passports) with private storage and restricted RLS.
- **Domain Status:** `PARTIALLY IMPLEMENTED (P0)`

---

### Domain L: Master Calendar, Batch Scheduling & Capacity
- **Expected Functionality:** Unified institutional calendar aggregating live class sessions, orientation meetings, exam windows, assignment deadlines, and instructor availability with timezone conversion and conflict detection.
- **Current Implementation:** Batch schedule rules exist (`recurringScheduleRule`); live sessions exist (`live_sessions`).
- **Database Gaps:** Academic holiday exclusions table (`public.institutional_holidays`).
- **Backend Gaps:** Unified calendar aggregation endpoint (`/api/calendar/events`) merging classes, exams, and appointments.
- **Frontend Gaps:** Full-page interactive institutional calendar view (month, week, day) with role-based event filtering.
- **Integration Gaps:** iCal / WebCal subscribe feed URL.
- **Test Gaps:** Concurrency test for overbooking prevention on limited-seat sessions.
- **Security Gaps:** Students must only see calendar events for batches and courses where they hold active entitlements.
- **Domain Status:** `PARTIALLY IMPLEMENTED (P1)`

---

### Domain M: Orientation Management
- **Expected Functionality:** Course-specific orientation requirements (mandatory vs optional), session scheduling (online via BigBlueButton or physical venue), capacity reservation, attendance logging, and no-show tracking.
- **Current Implementation:** None.
- **Database Gaps:** `public.course_orientation_configs`, `public.orientation_sessions`, `public.orientation_attendances`.
- **Backend Gaps:** Orientation slot booking API, attendance recording, and gate check blocking course start if orientation is mandatory.
- **Frontend Gaps:** Student orientation booking screen and admin orientation attendance roster.
- **Integration Gaps:** BigBlueButton meeting provisioning for virtual orientation sessions.
- **Test Gaps:** Complete suite required.
- **Security Gaps:** Protect orientation venue instructions and private video links from unapproved applicants.
- **Domain Status:** `NOT IMPLEMENTED (P2)`

---

### Domain N: Course Commerce & Product Entitlements (CRITICAL GAP)
- **Expected Functionality:** Strict architectural decoupling of the Academic Course from the Commercial Sellable Product:
  - An **Academic Course** represents curriculum, modules, topics, and question banks.
  - A **Sellable Product** represents commercial offerings:
    - Offering A: "Video Lectures Only"
    - Offering B: "Question Bank & Mock Exams Only"
    - Offering C: "Complete Hybrid Live Coaching + Exam Prep"
  - Server-authoritative **Entitlement Engine** validating student access per feature rather than blanket course enrollment.
- **Current Implementation:** Courses have direct pricing fields (`price`, `currency`, `salePrice`); purchasing auto-enrolls in the entire course. Separate product/entitlement models are absent.
- **Database Gaps:** `public.products`, `public.product_offerings`, `public.product_entitlements`, `public.user_entitlements`.
- **Backend Gaps:** Entitlement verification middleware (`verifyEntitlement(userId, courseId, 'LIVE_CLASS' | 'EXAM' | 'VIDEO')`).
- **Frontend Gaps:** Multi-tier pricing table on course landing pages; product package manager in admin workspace.
- **Integration Gaps:** None.
- **Test Gaps:** Test proving that a student who bought "Video Only" is rejected when calling `/api/classroom` or `/api/exams/[id]/start`.
- **Security Gaps:** Prevent students with partial entitlements from accessing live WebRTC rooms or high-stakes certification exams.
- **Domain Status:** `NOT IMPLEMENTED / CRITICAL ARCHITECTURAL GAP (P0)`

---

### Domain O: Payment Gateway, Finance & Admission Lifecycle
- **Expected Functionality:** Multi-gateway payment adapter (Razorpay / Stripe / Manual Wire Transfer), server-side price verification, idempotent webhook processing, GST/tax invoice generation, credit notes, and automated reconciliation.
- **Current Implementation:** Provider-neutral order creation (`/api/payments/order`), idempotent webhook processing (`/api/payments/webhook`), invoice generation (`/api/invoices`), and credit notes (`invoice_credit_notes`) verified in `tests/payment-webhook-lifecycle.test.ts`.
- **Database Gaps:** None.
- **Backend Gaps:** Real gateway SDK initialization (currently running in local simulation/sandbox mode).
- **Frontend Gaps:** Gateway checkout modal integration (Razorpay Checkout.js / Stripe Elements).
- **Integration Gaps:** Live payment gateway merchant credentials unconfigured (gated pending client business decision).
- **Test Gaps:** 100% passing in simulation tests.
- **Security Gaps:** Client-supplied amounts are strictly rejected; prices are calculated server-side from authoritative product records.
- **Domain Status:** `BACKEND & IDEMPOTENCY VERIFIED COMPLETE / GATEWAY CREDENTIALS UNCONFIGURED (P0)`

---

### Domain P: Automatic Student Account & Course Provisioning
- **Expected Functionality:** Orchestrated, idempotent post-admission provisioning pipeline:
  $$\text{Payment / Admission Approval} \longrightarrow \text{Identity Match/Create} \longrightarrow \text{Profile Setup} \longrightarrow \text{Entitlement Grant} \longrightarrow \text{Batch Allocation} \longrightarrow \text{Welcome Notification}$$
- **Current Implementation:** Direct atomic enrollment exists (`enroll_student_atomic`), but multi-step orchestration across identity, entitlements, calendar, and email is not unified into a resumable saga.
- **Database Gaps:** `public.provisioning_jobs` (tracking step status: `PENDING`, `IDENTITY_VERIFIED`, `ENTITLED`, `BATCH_ALLOCATED`, `NOTIFIED`, `FAILED`).
- **Backend Gaps:** Resumable provisioning orchestrator with exponential backoff and dead-letter queue.
- **Frontend Gaps:** Admin provisioning failure monitor with manual retry button.
- **Integration Gaps:** Transactional email welcome dispatch.
- **Test Gaps:** Resumability test verifying that a failure during email dispatch can be retried without creating duplicate enrollments.
- **Security Gaps:** Invariant: Provisioning must never transmit plaintext passwords or reset tokens in unencrypted payloads.
- **Domain Status:** `PARTIALLY IMPLEMENTED (P0)`

---

### Domain Q: Admissions Administration Dashboard
- **Expected Functionality:** Unified admissions command center:
  1. Lead inbox & follow-up queue.
  2. 14-stage application pipeline Kanban.
  3. Document verification workspace.
  4. Payment exception & manual admission overrides.
  5. Provisioning status tracker.
- **Current Implementation:** Basic admissions list and detail view at `/admin` (`admissions` tab).
- **Database Gaps:** None.
- **Backend Gaps:** Lead assignment, follow-up scheduling, and manual override audit logging APIs.
- **Frontend Gaps:** Kanban board view, side-by-side document comparison viewer, and manual admission modal with mandatory reason prompt.
- **Integration Gaps:** None.
- **Test Gaps:** E2E test for manual admission override with audit verification.
- **Security Gaps:** Manual admission overrides must require `SUPER_ADMIN` role, capture an immutable reason, and never forge a fraudulent payment record.
- **Domain Status:** `PARTIALLY IMPLEMENTED (P0)`

---

### Domain R: Central Service Synchronization Architecture
- **Expected Functionality:** Event-driven cross-subsystem synchronization: transactional outbox pattern, event schema versioning, consumer idempotency, dead-letter queue, correlation ID tracking, and administrative replay control center.
- **Current Implementation:** Transactional email outbox (`email_outbox`, `email_delivery_events`) is implemented and verified. Generic cross-service event outbox is not yet generalized.
- **Database Gaps:** `public.event_outbox`, `public.event_dead_letter_queue`.
- **Backend Gaps:** Generic event publisher and background consumer worker for domain events (`STUDENT_ADMITTED`, `COURSE_PUBLISHED`, `EXAM_SUBMITTED`).
- **Frontend Gaps:** Admin event synchronization viewer with replay capabilities.
- **Integration Gaps:** None.
- **Test Gaps:** Event idempotency and replay tests.
- **Security Gaps:** Events must carry correlation IDs and actor identities; sensitive user credentials must be stripped from event payloads.
- **Domain Status:** `EMAIL OUTBOX COMPLETE / GENERIC EVENT OUTBOX PARTIAL (P1)`

---

### Domain S: Cloud Storage & Media Management
- **Expected Functionality:** Unified object storage abstraction supporting Cloudflare R2 / AWS S3: pre-signed direct upload URLs, private buckets, time-limited streaming tokens, and file metadata management.
- **Current Implementation:** `RecordingStorageService` (`src/lib/storage/recording-storage.ts`) generates HMAC-SHA256 playback tokens; Supabase Storage integration exists.
- **Database Gaps:** `public.media_assets` table tracking storage provider, bucket, object key, size, MIME type, and access policy.
- **Backend Gaps:** S3/R2 pre-signed PUT URL generator for direct browser-to-bucket uploads.
- **Frontend Gaps:** Upload progress bar with chunked/resumable upload support.
- **Integration Gaps:** Direct R2/S3 bucket credentials unconfigured (gated pending client decision).
- **Test Gaps:** Mock S3 upload/download lifecycle test.
- **Security Gaps:** Invariant: Private course materials and recordings must NEVER have permanent public URLs.
- **Domain Status:** `STORAGE ABSTRACTION COMPLETE / S3 DIRECT CLIENT PENDING (P0)`

---

### Domain T: AI-Assisted Learning (Zealosh AI)
- **Expected Functionality:**
  1. Course-grounded AI Tutor chatbot for students.
  2. Formative AI assignment review suggestions for faculty with mandatory tutor verification.
  3. Automatic PDF document extraction, text chunking, and vector embedding retrieval index.
- **Current Implementation:** `ZealoshAiProviderAdapter` verified; AI Tutor query route verified; assignment review queue verified; exam lockout verified.
- **Database Gaps:** Vector embeddings table (`public.course_document_embeddings` with `pgvector`).
- **Backend Gaps:** PDF text extraction and chunking pipeline.
- **Frontend Gaps:** Document indexing status indicator in course manager view.
- **Integration Gaps:** Server 3 Ollama VPS deployment (gated stage).
- **Test Gaps:** Document chunking and semantic retrieval accuracy tests.
- **Security Gaps:** Exam lockout: AI assistant is strictly disabled during active exam attempts (verified in tests).
- **Domain Status:** `CORE WORKFLOWS VERIFIED (LOCAL) / VECTOR INGESTION MISSING (P1)`

---

### Domain U: Reporting, Institutional Analytics & Owner Visibility
- **Expected Functionality:** Authoritative institutional reporting:
  - Admissions & lead conversion funnel.
  - Course enrollment & batch occupancy.
  - Attendance rates & drop-off alerts.
  - High-stakes exam score distributions & pass rates.
  - Financial revenue, refunds & tax reconciliation.
  - At-risk student identification.
- **Current Implementation:** `/api/admin/reports` with 8 specialized sub-endpoints verified in `tests/analytics-reports.test.ts`. Admin reports dashboard at `/admin/reports` verified.
- **Database Gaps:** None.
- **Backend Gaps:** Executive KPI summary card aggregator.
- **Frontend Gaps:** Visual charts (conversion funnel, revenue trends).
- **Integration Gaps:** CSV export sanitization (prevent CSV formula injection).
- **Test Gaps:** CSV export injection safety test.
- **Security Gaps:** Only `SUPER_ADMIN` and `FINANCE_OFFICER` can view financial reports.
- **Domain Status:** `VERIFIED COMPLETE (CORE) / ADVANCED VISUALIZATIONS PENDING (P1)`

---

### Domain V: Referrals, Campaigns & Growth
- **Expected Functionality:** Referral code generation for students, promotional discount coupons, campaign UTM attribution tracking, and commission calculation (reporting only).
- **Current Implementation:** None.
- **Database Gaps:** `public.referral_codes`, `public.discount_coupons`, `public.campaign_attributions`.
- **Backend Gaps:** Coupon validation API during checkout; referral reward attribution logic.
- **Frontend Gaps:** Coupon input box on checkout; student referral link dashboard.
- **Integration Gaps:** None.
- **Test Gaps:** Complete suite required.
- **Security Gaps:** Financial payouts and real commission transfers are explicitly out-of-scope/prohibited without institutional finance sign-off.
- **Domain Status:** `NOT IMPLEMENTED (P2)`

---

### Domain W: Progressive Web App (PWA) & Mobile Experience
- **Expected Functionality:** Mobile-responsive layouts across all student, instructor, and admin views, PWA web app manifest (`manifest.json`), service worker for offline shell caching, and mobile touch optimization.
- **Current Implementation:** Fully responsive UI verified across desktop, tablet, and mobile viewports in Playwright; mobile bottom navigation drawer.
- **Database Gaps:** None.
- **Backend Gaps:** None.
- **Frontend Gaps:** Web App Manifest file (`public/manifest.json`), PWA service worker registration (`public/sw.js`), and install banner.
- **Integration Gaps:** Push notifications (requires VAPID keys).
- **Test Gaps:** PWA lighthouse audit test.
- **Security Gaps:** Examination attempts must strictly disable offline mode; exam timers require active server heartbeat.
- **Domain Status:** `MOBILE RESPONSIVE COMPLETE / PWA MANIFEST PENDING (P1)`

---

### Domain X: External Integrations & Future Expansion
- **Expected Functionality:**
  - Supabase Managed PostgreSQL & Auth.
  - BigBlueButton Live Classroom Cluster.
  - Ollama AI Server.
  - Transactional Email Provider (Resend / SendGrid / Postmark).
  - WhatsApp Business API (WABA) for instant student notifications.
  - iCal Calendar Sync Feed.
- **Current Implementation:** Supabase adapter verified; BBB adapter verified; Ollama adapter verified; email outbox verified; calendar feed missing; WhatsApp missing.
- **Database Gaps:** None.
- **Backend Gaps:** iCal feed generator (`/api/calendar/feed/[token].ics`); WhatsApp webhook receiver.
- **Frontend Gaps:** External integrations status tab in admin workspace.
- **Integration Gaps:** Real provider accounts unconfigured (gated stage).
- **Test Gaps:** Integration health probe tests.
- **Security Gaps:** Invariant: All external API communications must use signed payloads, HTTPS transport, and zero credential leakage.
- **Domain Status:** `ADAPTERS VERIFIED / CREDENTIALS UNCONFIGURED (GATED STAGE)`

