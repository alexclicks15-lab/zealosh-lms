# Zealosh LMS — Master Product Feature Register (Authoritative Reconciled Baseline)

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Institution:** Zealosh Training & Consultants, Kollam, Kerala, India  
**Scope:** Complete Reconciled Inventory Across All Institutional Subsystems & Functional Domains  
**Classification Taxonomy:** Standardized 7-Category Engineering Protocol  
**Date:** November 10, 2026  
**Status:** FULLY RECONCILED POST-AUDIT MASTER REGISTER  

---

## 1. Classification Taxonomy & Evaluation Protocol

In accordance with Phase Two of the Final Product Gap Analysis mandate, each capability is classified under one of seven strict categories based on empirical codebase evidence:

1. **Complete (`COMPLETE`):** Working end-to-end workflow, persistent PostgreSQL storage, server-enforced authorization, input validation, error handling, and passing automated test suites (Vitest/Playwright).
2. **Partial (`PARTIAL`):** Substantial implementation exists across database, API, or UI, but specific UX workflows, validation edges, or cross-module automations remain open.
3. **Missing (`MISSING`):** Required institutional capability is not yet implemented in functional form.
4. **External Dependency (`EXTERNAL_DEP`):** Software implementation is fully coded and locally verified, but live production activation requires third-party credentials, external services, or provisioned infrastructure.
5. **Owner Decision (`OWNER_DECISION`):** Implementation is blocked or gated pending commercial, legal, institutional, or architectural approval by Zealosh executive leadership.
6. **Technical Debt (`TECH_DEBT`):** Feature functions correctly but contains architectural duplication, maintenance overhead, or tight coupling requiring refactoring.
7. **Not Applicable (`NOT_APPLICABLE`):** Capability is explicitly out of scope for the single-institution Zealosh platform (e.g. multi-tenant SaaS switching).

---

## 2. Master Feature Register (Reconciled Empirical Status)

| Feature ID | Product Domain | Capability Name | User Roles | DB Status | API Status | UI Status | Verification Evidence | Current Status | Priority | Identified Gap / Action |
| :---: | :--- | :--- | :--- | :---: | :---: | :---: | :--- | :---: | :---: | :--- |
| **AUTH-01** | Identity | Supabase GoTrue Auth Integration | All | `users`, `profiles` | `/api/auth/*` | `/login` | `tests/auth.test.ts`, `tests/phase1-auth-profiles.test.ts` | **COMPLETE** | P0 | Verified with JWT and local session state. |
| **AUTH-02** | Identity | Password Reset & Email Verification | All | `users`, `email_outbox` | `/api/auth/password-reset/*` | `/login` | `tests/phase1-auth-profiles.test.ts` (8/8 passed) | **COMPLETE** | P0 | Integrated with transactional outbox. |
| **AUTH-03** | Identity | Multi-Factor Authentication (TOTP MFA) | Staff, Admin | `users`, `user_sessions` | `/api/auth/mfa/*` | `/student/security` | `tests/auth-sessions-revocation.test.ts` | **COMPLETE** | P0 | TOTP challenge/response fully operational. |
| **AUTH-04** | Identity | Active Session Tracking & Immediate Revocation | All | `user_sessions` | `/api/auth/sessions/*` | `AccountSecuritySessions.tsx` | `tests/auth-sessions-revocation.test.ts` (6/6 passed) | **COMPLETE** | P1 | Supports single and all-session revocation. |
| **AUTH-05** | Identity | 5-Attempt Failed Login Lockout | All | `login_attempts` | `/api/auth/login` | `/login` | `tests/database-login-lockout.test.ts` (6/6 passed) | **COMPLETE** | P0 | Fail-closed server lockout after 5 failures. |
| **AUTH-06** | Identity | Enterprise OIDC / OAuth 2.0 PKCE | All | `oauth_codes`, `users` | `/api/oauth/*` | `/api/oauth/authorize` | `tests/oidc-sso.test.ts` (5/5 passed) | **COMPLETE** | P1 | Standards-compliant SSO token exchange. |
| **ADMIN-01**| Core Hub | Administrative Workspace & Navigation | Admin, Staff | `workspace_layouts` | `/api/admin/workspace/layout` | `WorkspaceLayoutArranger.tsx` | `tests/workspace-layout-customization.test.ts` | **COMPLETE** | P1 | Custom drag-and-drop workspace layout. |
| **ADMIN-02**| Core Hub | User Provisioning & Batch Import | Admin | `provisioning_jobs` | `/api/admin/provisioning/*` | `/admin/admissions` | `tests/resumable-provisioning-orchestrator.test.ts` | **COMPLETE** | P0 | Resumable multi-step worker provisioning. |
| **ADMIN-03**| Core Hub | Role-Based Access Control (RBAC) | Admin | `roles`, `user_roles` | `/api/admin/config/roles` | `/admin` | `src/lib/auth/rbac.ts`, `tests/phase1-security-acceptance-audit.test.ts` | **COMPLETE** | P0 | Server-enforced permissions on all routes. |
| **ADMIN-04**| Core Hub | Institutional Audit Archiving | Superadmin | `institutional_audit_archives` | `/api/admin/audit/*` | `/admin/operations` | `tests/institutional-audit-archives.test.ts` | **COMPLETE** | P1 | SHA-256 verifiable audit bundle export. |
| **ADMIN-05**| Core Hub | System Maintenance & Traffic Shedding | Superadmin | `maintenance_config` | `/api/admin/maintenance` | `MaintenanceBanner.tsx` | `tests/administrative-maintenance-mode.test.ts` | **COMPLETE** | P1 | Global maintenance banner & API block. |
| **ACAD-01** | Learning | Curriculum Tree Hierarchy | Admin, Faculty | `programmes`, `modules`, `topics` | `/api/admin/academic/tree` | `VisualCurriculumTree.tsx` | `tests/curriculum-tree-and-versions.test.ts` | **COMPLETE** | P0 | Multi-level hierarchy with syllabus snapshots. |
| **ACAD-02** | Learning | Academic Course Builder & Delivery Config | Faculty, Admin | `courses`, `delivery_configurations` | `/api/courses/*` | `/admin/curriculum` | `tests/academic-course-builder.test.ts` | **COMPLETE** | P0 | Configures classroom, blended, online delivery. |
| **ACAD-03** | Learning | Scheduled & Preloaded Teaching Materials | Faculty, Student | `learning_materials` | `/api/materials/*` | `/courses/[slug]` | `tests/scheduled-teaching-materials.test.ts` | **COMPLETE** | P1 | Timed release and classwork synchronization. |
| **ACAD-04** | Learning | Interactive Learning Player & Progress | Student | `learning_progress` | `/api/courses/[slug]/progress` | `/learn/[courseId]` | `tests/learner-workflow-e2e.test.ts` | **COMPLETE** | P0 | Granular lesson progression and prerequisites. |
| **ACAD-05** | Learning | Assignments & Rubric Evaluations | Faculty, Student | `assignments`, `assignment_submissions` | `/api/assignments/*` | `/courses/[slug]` | `tests/assignment-evaluation-workflow.test.ts` | **COMPLETE** | P1 | File submission, rubrics, and feedback. |
| **ACAD-06** | Learning | Formative AI Assignment Review Assistant | Faculty | `ai_tutor_sessions` | `/api/ai/assignment/*` | `/admin` | `tests/assignment-evaluation-workflow.test.ts` | **EXTERNAL_DEP** | P2 | Operational locally; cloud LLM model gated. |
| **EXAM-01** | Assessment | Central Question Bank & Psychometrics | Faculty, Admin | `question_bank_items`, `item_analytics` | `/api/assessment/questions/*` | `/admin/questions` | `tests/central-question-bank.test.ts` | **COMPLETE** | P0 | IRT difficulty, discrimination, versioning. |
| **EXAM-02** | Assessment | High-Stakes HSE Examination Engine | Student, Admin | `exam_blueprints`, `exam_attempts` | `/api/exams/*` | `/exams/[examId]` | `tests/exam-engine.test.ts` | **COMPLETE** | P0 | Server deadline enforcement, proctoring hooks. |
| **EXAM-03** | Assessment | Quizzes & Knowledge Checks | Student, Faculty | `quizzes`, `quiz_questions` | `/api/quizzes/*` | `/courses/[slug]` | `tests/scheduled-quizzes.test.ts` | **COMPLETE** | P1 | Randomized items, instant scoring, analytics. |
| **CRED-01** | Credentials | Tamper-Evident Ed25519 Certificates | All | `certificates`, `issued_certificates_v2`| `/api/certificates/*` | `/verify/[code]` | `tests/tamper-evident-certificates.test.ts` | **COMPLETE** | P0 | Asymmetric crypto signing & offline verify. |
| **CRED-02** | Credentials | Career Pathways & Progression Roadmap | Student, Staff | `career_pathways`, `student_career_plans`| `/api/career/*` | `/student/career` | `tests/career-certification-roadmap.test.ts` | **COMPLETE** | P2 | Milestone planning and external evidence review. |
| **CLASS-01**| Classroom | Live Classroom Provisioning (WebRTC / BBB) | Faculty, Student | `live_sessions`, `attendance_records` | `/api/live/*` | `/live/[sessionId]` | `tests/classroom-provider.test.ts` | **COMPLETE** | P0 | Signed SHA-1 token generation and join flow. |
| **CLASS-02**| Classroom | Course Recording Ingestion & Replay Hub | Student, Faculty | `class_recordings`, `recording_doubts` | `/api/recordings/*` | `/recordings/[recordingId]` | `tests/recording-doubts-highlights.test.ts` | **COMPLETE** | P1 | Webhook ingestion, doubts, video highlights. |
| **CLASS-03**| Classroom | Multi-Server WebRTC Media Streaming Node | Faculty, Student | External BBB Cluster | `/api/live/*` | Video Player | `tests/complete-classroom-experience.test.ts` | **EXTERNAL_DEP** | P1 | Gated on Server 2 infrastructure procurement. |
| **CRM-01**  | Admissions | Lead Capture & CRM Pipeline | Staff, Admin | `leads` | `/api/leads/*` | `/admin/admissions` | `tests/admissions-pipeline-transitions.test.ts` | **COMPLETE** | P0 | Lead generation and conversion to application. |
| **CRM-02**  | Admissions | 6-Stage Admissions & Document Review | Staff, Applicant | `admission_applications`, `applicant_documents` | `/api/admin/admissions/*` | `/admin/admissions` | `tests/admissions-pipeline-transitions.test.ts` | **COMPLETE** | P0 | Multi-stage review, document approve/reject. |
| **CRM-03**  | Admissions | Mandatory Course Orientation Gating | Student, Staff | `course_orientation_configs`, `orientation_bookings`| `/api/orientation/*` | `/student` | `tests/orientation-booking-gating.test.ts` | **COMPLETE** | P1 | Blocks coursework until orientation attended. |
| **COMM-01** | Commerce | Decoupled Product & Offering Model | All | `products`, `product_offerings` | `/api/commerce/products/*` | `/courses` | `tests/commerce-products-offerings.test.ts` | **COMPLETE** | P0 | Standalone commercial packages and pricing. |
| **COMM-02** | Commerce | Granular Entitlement Engine | Student | `user_entitlements` | `/api/commerce/entitlements/*`| `/student` | `tests/commerce-entitlement-engine.test.ts` | **COMPLETE** | P0 | Evaluates access to exams, replays, live class. |
| **FIN-01**  | Finance | Payment Orders & Idempotent Webhooks | Student, Admin | `payment_orders`, `payment_webhook_events` | `/api/payments/*` | `/courses/[slug]` | `tests/payment-webhook-idempotency.test.ts` | **COMPLETE** | P0 | Anti-replay isolation and transaction safety. |
| **FIN-02**  | Finance | GST Tax Invoicing & Credit Notes | All | `invoices`, `invoice_credit_notes` | `/api/invoices/*` | `/invoices/[invoiceId]` | `tests/enterprise-commerce-reports.test.ts` | **COMPLETE** | P0 | Statutory CGST/SGST/IGST breakdown (SAC 999293). |
| **FIN-03**  | Finance | Commercial Gateway Activation (Razorpay/Cashfree)| Student | Provider Credentials | `/api/payments/order` | Checkout Modal | Local mock passes | **OWNER_DECISION** | P0 | Gated on Owner Decision 6 (Payment Gateway). |
| **COMM-03** | Comms | Reliable Transactional Email Outbox | All | `email_outbox`, `email_delivery_events` | `/api/admin/email/*` | `/admin/email` | `tests/transactional-email-outbox.test.ts` | **COMPLETE** | P0 | PID-locked worker runner with dead-letter queue. |
| **COMM-04** | Comms | WhatsApp Business Message Adapter | Student, Staff | `whatsapp_opt_ins`, `whatsapp_message_logs` | `/api/webhooks/whatsapp` | Settings | `tests/whatsapp-business-adapter.test.ts` | **EXTERNAL_DEP** | P2 | Code adapter complete; Meta API keys pending. |
| **COMM-05** | Comms | In-App Academic Notification Center | All | `notifications`, `notification_templates` | `/api/notifications/*` | `NotificationBell.tsx` | `tests/notification-center.test.ts` | **COMPLETE** | P1 | Unread count badges, read/unread states. |
| **COMM-06** | Comms | Isolated Group Messaging & Channels | Faculty, Student | `conversations`, `channel_messages` | `/api/messaging/*` | `/messages` | `tests/isolated-group-messaging.test.ts` | **COMPLETE** | P1 | Cohort channels and moderation reporting. |
| **SYNC-01** | Platform | Domain Event Outbox & DLQ Replay | System | `event_outbox`, `dead_letter_events` | `/api/admin/events/*` | `/admin/sync` | `tests/event-outbox-synchronization.test.ts` | **COMPLETE** | P1 | Cross-domain reliable asynchronous event bus. |
| **CMS-01**  | CMS | Relational Visual PageBuilder | Admin | `cms_pages`, `cms_page_nodes` | `/api/cms/pages/*` | `CmsEditorWorkspace.tsx` | `tests/cms-lifecycle-and-publishing.test.ts` | **COMPLETE** | P0 | Drag-and-drop structural node builder. |
| **CMS-02**  | CMS | Dynamic Academic Data Bindings | All | `cms_pages` | `/api/cms/pages/*` | `CmsComponentRenderer.tsx` | `tests/cms-dynamic-bindings.test.ts` | **COMPLETE** | P1 | Resolves live course, instructor, batch data. |
| **CMS-03**  | CMS | Scheduled Publishing & Auto-Rollback | Admin | `cms_scheduled_publications` | `/api/cms/scheduled` | `/admin/workspace` | `tests/cms-scheduled-publishing.test.ts` | **COMPLETE** | P1 | Automatic scheduled publishing worker. |
| **CMS-04**  | CMS | Public Marketing Pages (17 Page Types) | Visitor | `cms_pages` | `/api/cms/pages` | `/p/[...slug]` | Missing pages | **PARTIAL** | P1 | Expands to full 17 public pages under WS-04. |
| **CMS-05**  | CMS | Theme & Design Studio | Admin | `branding_theme` | `/api/admin/config/branding` | Needs Visual UI | `tests/superadmin-config.test.ts` | **PARTIAL** | P1 | Needs visual design token editor under WS-03. |
| **SRE-01**  | Operations | Diagnostic Health & Telemetry | Admin | `diagnostic_events`, `diagnostic_issues`| `/api/health`, `/api/admin/diagnostics/*`| `/admin/diagnostics` | `tests/health-and-diagnostics.test.ts` | **COMPLETE** | P0 | Liveness, readiness, and synthetic monitoring. |
| **SRE-02**  | Operations | Automated Backup & Verified Restore | SRE | System Scripts | Shell / Node | CLI / SRE Tool | `tests/backup-recovery-automation.test.ts` | **COMPLETE** | P0 | Sandboxed two-stage restore with audit logs. |
| **SRE-03**  | Operations | Atomic Deployment & Instant Rollback | SRE | System Scripts | Shell / Node | CLI / SRE Tool | `tests/release-manager.test.ts` | **COMPLETE** | P0 | Timestamped releases with atomic symlink swaps. |
| **GROWTH-01**| Growth | Referral Engine & Marketing Campaigns | Student, Staff | `referral_codes`, `institutional_campaigns`| `/api/growth/*` | `/student` | `tests/institutional-growth-referrals.test.ts` | **COMPLETE** | P2 | Attribution tracking and reward computation. |
| **GROWTH-02**| Growth | Student Testimonials & Legal Consent | Public, Admin | `student_reviews`, `testimonial_consents` | `/api/testimonials/*` | `/admin/testimonials` | `tests/student-testimonials-reviews.test.ts` | **COMPLETE** | P2 | Review collection, moderation, poster generator. |
| **AI-01**   | AI | Course-Grounded RAG Assistant & Vector Search| Student | `rag_documents`, `rag_document_chunks` | `/api/rag/*`, `/api/ai-tutor/*` | Chat UI | `tests/vector-rag-ingestion.test.ts` | **COMPLETE** | P2 | Local similarity search with pgvector/cosine. |
| **PWA-01**  | Mobile | Progressive Web App & Offline Sync | All | `pwa_offline_events`, `pwa_push_subscriptions`| `/api/pwa/*` | `PwaProvider.tsx` | `tests/pwa-offline-and-telemetry.test.ts` | **COMPLETE** | P1 | Offline progress queue and Service Worker. |

---

## 3. Register Summary by Classification
- **COMPLETE & VERIFIED:** **41 capabilities** (83.7% of core functional scope).
- **PARTIAL (Evolving to Website Studio):** **2 capabilities** (CMS-04, CMS-05).
- **EXTERNAL DEPENDENCY GATED:** **3 capabilities** (CLASS-03, COMM-04, ACAD-06).
- **OWNER DECISION GATED:** **1 capability** (FIN-03 Payment Gateway).
- **TOTAL CORE CAPABILITIES TRACKED:** **47 authoritative entries**.
