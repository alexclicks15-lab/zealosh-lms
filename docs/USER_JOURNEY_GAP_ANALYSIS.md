# Zealosh LMS — User Journey Gap Analysis & Workflow Audit

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Institution:** Zealosh Training & Consultants, Kollam, Kerala, India  
**Scope:** End-to-End Conceptual & Empirical Verification of Major User Personas  
**Auditor:** Principal Software Architect, Full-Stack Engineer, and UX Systems Specialist  
**Date:** November 10, 2026  
**Status:** RECONCILED POST-AUDIT WORKFLOW AUDIT  

---

## 1. Audit Framework & Personas Evaluated

A comprehensive product audit must evaluate the conceptual continuity of complete user workflows. Rather than checking isolated routes, this analysis tracks four major personas across their full lifecycle within the Zealosh platform:
1. **Student Journey (20 Steps):** From institutional discovery to certification and career advancement.
2. **Instructor Journey (18 Steps):** From course preparation and lesson delivery to grading and mentorship.
3. **Administrator Journey (18 Steps):** From user provisioning and academic governance to finance and security auditing.
4. **Public Visitor Journey (10 Steps):** From brand discovery and course exploration to lead enquiry and certificate verification.

---

## 2. Student Journey (20-Step End-to-End Analysis)

| Step # | Journey Stage | Route / Component | Underlying API / Database | Empirical Status | Identified Gap / Required Action |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **S-01** | Discover the Institution | `/`, `/p/home` | `cms_pages`, `CmsComponentRenderer.tsx` | **COMPLETE** | Renders hero, accreditation badges, and institutional statistics. |
| **S-02** | Browse Courses | `/courses` | `/api/commerce/products`, `products` | **COMPLETE** | Displays published course offerings, filters by delivery mode, fee schedule. |
| **S-03** | View Course Information | `/courses/[slug]` | `/api/courses/[slug]`, `courses` | **COMPLETE** | Authoritative syllabus, learning outcomes, batch dates, instructor credentials. |
| **S-04** | Submit Enquiry or Application | `/api/admissions/apply` | `admission_applications`, `leads` | **COMPLETE** | Captures applicant details, course selection, and initial identification data. |
| **S-05** | Complete Admissions | Admissions Portal | `admission_offers`, `applicant_documents` | **COMPLETE** | Submits required KYC and educational documents for administrative review. |
| **S-06** | Receive Account Credentials | Transactional Email | `email_outbox`, `worker-runner.mjs` | **COMPLETE** | Welcome email with secure password initialization link dispatched via outbox. |
| **S-07** | Verify Identity & Set Password | `/login`, `/auth/verify` | `/api/auth/password-reset/*`, GoTrue | **COMPLETE** | Secure password configuration, email verification, and session token generation. |
| **S-08** | Access Student Dashboard | `/student` | `/api/auth/me`, `enrollments` | **COMPLETE** | Overview of enrolled courses, upcoming live sessions, assignments, and alerts. |
| **S-09** | Complete Orientation | `/student`, Modal | `course_orientation_configs`, `orientation_bookings`| **COMPLETE** | Orientation session booking; locks coursework until verified attendance. |
| **S-10** | Access Assigned Course & Cohort | `/courses/[slug]` | `batches`, `user_entitlements` | **COMPLETE** | Entitlement verification grants access to cohort roster and timetable. |
| **S-11** | Access Lessons & Materials | `/learn/[courseId]` | `learning_materials`, `learning_progress` | **COMPLETE** | Interactive video player, forward-scrub protection, high-frequency beacons. |
| **S-12** | Join Live Classes | `/live/[sessionId]` | `/api/live/[sessionId]/join`, BBB | **COMPLETE** | Server generates signed SHA-1 join token; WebRTC connection to live session. |
| **S-13** | Review Class Recordings | `/recordings/[recordingId]` | `class_recordings`, `recording_doubts` | **COMPLETE** | Replay video with synchronized bookmarks, highlights, and doubt submissions. |
| **S-14** | Complete Assignments | `/courses/[slug]` | `assignments`, `assignment_submissions` | **COMPLETE** | File upload, submission status tracking, rubric criteria display. |
| **S-15** | Take Quizzes & Examinations | `/exams/[examId]` | `exam_blueprints`, `exam_attempts` | **COMPLETE** | Server-enforced countdown timer, proctoring webcam hooks, anti-cheat guards. |
| **S-16** | View Grades & Feedback | `/courses/[slug]` | `/api/assignments/[id]`, evaluations | **COMPLETE** | Objective exam scores, instructor rubric comments, and AI-assisted notes. |
| **S-17** | Track Learning Progress | `/student`, Progression | `learning_progress`, `student_streaks` | **COMPLETE** | Visual percentage bars, milestone checkmarks, attendance statistics. |
| **S-18** | Receive Certificates | `/verify/[code]` | `issued_certificates_v2`, Ed25519 | **COMPLETE** | Downloadable PDF with tamper-evident digital signature and public QR link. |
| **S-19** | Access Career & Alumni Features| `/student/career` | `career_pathways`, `alumni_profiles` | **COMPLETE** | Milestone roadmap, external certification evidence upload, alumni directory. |
| **S-20** | Receive Support & Notifications | `/support`, `/notifications` | `support_tickets`, `notifications` | **COMPLETE** | Helpdesk ticket creation, threaded support replies, in-app notification center. |

**Student Journey Verdict:** **100% FUNCTIONALLY COMPLETE**. No broken state transitions or missing database bindings exist.

---

## 3. Instructor Journey (18-Step End-to-End Analysis)

| Step # | Journey Stage | Route / Component | Underlying API / Database | Empirical Status | Identified Gap / Required Action |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **I-01** | Authentication | `/login` | `/api/auth/login`, `roles` (`INSTRUCTOR`) | **COMPLETE** | Secure login with role-based routing directly to instructor workspace. |
| **I-02** | Instructor Dashboard | `/instructor` | `/api/courses`, `batches` | **COMPLETE** | Active cohorts, upcoming teaching schedule, pending grading badges. |
| **I-03** | Assigned Courses | `/instructor` | `batches.lead_instructor_id` | **COMPLETE** | Course listings scoped strictly to authorized faculty assignments. |
| **I-04** | Course Preparation | `/admin/curriculum` | `VisualCurriculumTree.tsx`, `syllabus_versions`| **COMPLETE** | Review published syllabus versions and approved academic outcomes. |
| **I-05** | Curriculum Creation | `/admin/curriculum` | `/api/admin/academic/tree` | **COMPLETE** | Add modules, topics, subtopics, and reorder sequence. |
| **I-06** | Lesson Authoring | `/admin/curriculum` | `lessons`, `learning_materials` | **PARTIAL** | Functional via multiline form; inline WYSIWYG editor addressed in `WS-05`. |
| **I-07** | Teaching Material Scheduling | `/api/materials/*` | `learning_materials` | **COMPLETE** | Preload slides and PDF guides with timed release schedules. |
| **I-08** | Assessment Creation | `/api/quizzes/*` | `quizzes`, `quiz_questions` | **COMPLETE** | Configure topic knowledge checks with attempt limits and passing marks. |
| **I-09** | Question-Bank Reuse | `/admin/questions` | `question_bank_items`, `item_analytics` | **COMPLETE** | Central question repository with IRT difficulty metrics and version history. |
| **I-10** | Assignment Management | `/courses/[slug]` | `assignments` | **COMPLETE** | Set assignment deadlines, submission guidelines, and grading rubrics. |
| **I-11** | Student Oversight | `/instructor`, Cohort | `enrollments`, `learning_progress` | **COMPLETE** | View cohort student roster, completion percentages, at-risk flags. |
| **I-12** | Grading & Evaluation | `/api/assignments/[id]/grade`| `assignment_submissions`, rubrics | **COMPLETE** | Score rubric criteria, enter qualitative feedback, trigger student notification. |
| **I-13** | Live Class Scheduling | `/api/calendar` | `live_sessions`, `calendar_feed_tokens`| **COMPLETE** | Schedule live lectures, automatic conflict checks against holiday calendar. |
| **I-14** | Live Classroom Control | `/live/[sessionId]` | `/api/live/[sessionId]/host`, BBB | **COMPLETE** | Launch as moderator with presentation upload, screen share, and mute tools. |
| **I-15** | Attendance Reconciliation | `/api/live/[sessionId]/end` | `attendance_records` | **COMPLETE** | Auto-logs participant presence duration upon session termination. |
| **I-16** | Course Announcements | `/courses/[slug]` | `classroom_announcements` | **COMPLETE** | Broadcast urgent notices to enrolled students with instant email outbox push. |
| **I-17** | Cohort Analytics | `/instructor`, Analytics | `item_analytics`, `reports` | **COMPLETE** | Topic mastery graphs, quiz failure rates, attendance trends. |
| **I-18** | Mentorship Sessions | `/components/mentorship` | `instructor_office_hours`, appointments | **COMPLETE** | Manage weekly 1-on-1 office hours slots and confirmed student bookings. |

**Instructor Journey Verdict:** **CORE WORKFLOWS COMPLETE / WYSIWYG LESSON EDITOR ENHANCEMENT IN WS-05**.

---

## 4. Administrator Journey (18-Step End-to-End Analysis)

| Step # | Journey Stage | Route / Component | Underlying API / Database | Empirical Status | Identified Gap / Required Action |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **A-01** | Secure Login & MFA | `/login` | Supabase Auth, TOTP MFA, brute-force lock| **COMPLETE** | Fail-closed security with 5-attempt lockout and session auditing. |
| **A-02** | Institutional Overview | `/admin` | Executive Analytics API, KPI cards | **COMPLETE** | Live enrollment counts, gross revenue, active sessions, system alerts. |
| **A-03** | Admissions Pipeline | `/admin/admissions` | `admission_applications`, Kanban board | **COMPLETE** | Review applicant dossiers, request additional documents, issue offers. |
| **A-04** | User Provisioning | `/api/admin/provisioning` | `provisioning_jobs`, worker queue | **COMPLETE** | Automated account generation, welcome email trigger, enrollment link. |
| **A-05** | Role & Permission Assignment | `/api/admin/config/roles` | `roles`, `user_roles`, `rbac.ts` | **COMPLETE** | Assign/revoke roles (`STUDENT`, `INSTRUCTOR`, `STAFF`, `ADMIN`). |
| **A-06** | Course Configuration | `/admin/curriculum` | `courses`, `delivery_configurations` | **COMPLETE** | Set course codes, delivery modes, prerequisites, and graduation criteria. |
| **A-07** | Cohort & Batch Allocation | `/api/admin/batches` | `batches`, capacity limits | **COMPLETE** | Create batches, assign lead instructors, set start/end dates. |
| **A-08** | Instructor Management | `/admin/operations` | `instructor_profiles`, departments | **COMPLETE** | Profile management, department alignment, office hours oversight. |
| **A-09** | Academic Administration | `/api/admin/academic/*` | Hierarchy, module migrations, tree API | **COMPLETE** | Reopen student progressions, migrate legacy modules, freeze syllabi. |
| **A-10** | Classroom Operations | `/classroom`, SRE | `live_sessions`, active session monitors| **COMPLETE** | Monitor active WebRTC rooms, reconcile missing recordings. |
| **A-11** | Exam Administration | `/api/admin/exams/*` | `exam_blueprints`, manual evaluation queue| **COMPLETE** | Blueprint authoring, passing mark configuration, subjective evaluation. |
| **A-12** | Certificate Governance | `/api/admin/certificates/*` | `certificates`, revocation, audit logs | **COMPLETE** | Issue credentials, revoke compromised certificates, audit verification logs. |
| **A-13** | Communications & Dispatch | `/admin/email` | `email_outbox`, `email_templates` | **COMPLETE** | Outbox monitor, retry failed dispatches, broadcast announcements. |
| **A-14** | Finance & Payment Admin | `/invoices`, Refunds | `payment_orders`, `invoices`, reconciliation | **COMPLETE** | Review payment orders, issue GST credit notes, execute reconciliation runs. |
| **A-15** | Institutional Reporting | `/admin/reports` | Multi-domain reporting engine, CSV export | **COMPLETE** | Generate compliance reports, attendance summaries, faculty workload audits. |
| **A-16** | Integration Healthchecks | `/api/admin/integrations/test`| Moodle REST, BigBlueButton health checks | **COMPLETE** | Verify connectivity and shared secret configuration. |
| **A-17** | CMS & Website Studio | `/admin/workspace` | `cms_pages`, `CmsEditorWorkspace.tsx` | **PARTIAL** | Page builder operational; expanding to full 9-phase Website Studio. |
| **A-18** | Security & SRE Audit | `/admin/diagnostics` | `diagnostic_issues`, audit archives | **COMPLETE** | Telemetry graphs, synthetic monitoring, verifiable audit archive downloads. |

**Administrator Journey Verdict:** **100% OPERATIONAL WITH WEBSITE STUDIO ROADMAP EXPANSION IN PROGRESS**.

---

## 5. Public Visitor Journey (10-Step End-to-End Analysis)

| Step # | Journey Stage | Route / Component | Underlying API / Database | Empirical Status | Identified Gap / Required Action |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **V-01** | Visit Homepage | `/` | `src/app/page.tsx`, `CmsComponentRenderer` | **COMPLETE** | Institutional header, hero banner, value proposition, footer links. |
| **V-02** | Learn About Institution | `/p/about` | Dynamic CMS Page Router `/p/[...slug]` | **PARTIAL** | Route works; authoritative about page template added in `WS-04`. |
| **V-03** | Explore Training Programs | `/courses` | `src/app/courses/page.tsx`, `products` | **COMPLETE** | Full course directory with search, category filtering, delivery tags. |
| **V-04** | View Specific Course Details | `/courses/[slug]` | `src/app/courses/[slug]/page.tsx` | **COMPLETE** | Comprehensive syllabus outline, instructor bios, batch dates, fees. |
| **V-05** | Inspect Faculty Qualifications | `/courses/[slug]`, Faculty | `instructor_profiles` | **COMPLETE** | Instructor credentials, industry background, and HSE certifications. |
| **V-06** | Read Verified Testimonials | `/p/testimonials` | `student_reviews`, `testimonial_consents` | **COMPLETE** | Verified student reviews with legal consent badges and poster graphics. |
| **V-07** | Review Pricing & Fee Plans | `/courses/[slug]`, Pricing | `product_offerings`, GST breakdown | **COMPLETE** | Clear fee display with CGST/SGST breakdown and installment options. |
| **V-08** | Submit Lead Enquiry Form | `/api/leads` | `leads` table | **COMPLETE** | Enquiry form captures contact details and dispatches outbox notification. |
| **V-09** | Verify Student Certificate | `/verify/[code]` | `src/app/verify/[code]/page.tsx`, Ed25519 | **COMPLETE** | Instant cryptographic signature verification and credential details display. |
| **V-10** | Access Knowledge Base & FAQ | `/p/faq`, `/p/blog` | Dynamic CMS Page Router `/p/[...slug]` | **PARTIAL** | Dynamic CMS resolves slugs; template pre-seeding addressed in `WS-04`. |

**Public Visitor Journey Verdict:** **CORE JOURNEY FULLY FUNCTIONAL / EXPANDING TEMPLATE RICHNESS UNDER WEBSITE STUDIO WS-04**.
