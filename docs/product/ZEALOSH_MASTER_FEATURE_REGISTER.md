# Zealosh LMS — Master Product Feature Register

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-08A — Complete Product Scope Audit, Functional Gap Analysis & Remaining Development Roadmap  
**Scope:** Authoritative Inventory of All 20 Functional Domains  
**Classification Taxonomy:** Standardized 14-Status Classification  
**Date:** November 2026  
**Status:** APPROVED AUDIT BASELINE  

---

## 1. Classification Taxonomy & Evaluation Protocol

Every capability is assigned exactly one status:
- **`VERIFIED COMPLETE`**: Database, Backend, Frontend, and Verification evidence fully verified.
- **`PARTIALLY IMPLEMENTED`**: Implementation started across some layers but missing critical sub-features or tests.
- **`BACKEND COMPLETE / UI MISSING`**: API and database logic exist; frontend controls/screens missing.
- **`UI PRESENT / BACKEND MISSING`**: Mock/decorative frontend exists; backend API or database missing.
- **`DATABASE PRESENT / WORKFLOW MISSING`**: Tables exist; business workflow/orchestration missing.
- **`IMPLEMENTED BUT NOT FULLY VERIFIED`**: Code complete; automated integration test suite pending.
- **`EXTERNAL INTEGRATION UNCONFIGURED`**: Code adapter exists; real external provider credentials unconfigured.
- **`BLOCKED BY INSTITUTIONAL DECISION`**: Implementation blocked pending client business policy approval.
- **`DEFERRED TO LATER MILESTONE`**: Formally approved for future milestone.
- **`NOT IMPLEMENTED`**: Completely absent from codebase.
- **`DUPLICATED IMPLEMENTATION`**: Redundant competing implementations exist.
- **`FAILED VERIFICATION`**: Implementation fails automated test suite.
- **`OUT OF SCOPE`**: Explicitly excluded from single-institution platform.
- **`NATIVE MOBILE DECISION REQUIRED`**: Native iOS/Android vs PWA decision pending.

---

## 2. Master Feature Register (All 20 Functional Domains)

| Req ID | Domain | Feature Description | Source | Scope Class | Database | Backend | Frontend | Integration | Verification Status | Priority | Dependencies | Owning Module | Recommended Milestone | Outstanding Decision |
| :---: | :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :--- | :---: | :--- | :--- | :---: | :--- |
| **AUTH-01** | Identity | Supabase Auth Integration (`auth.users`) | Discovery 1.5 | `PARTIALLY IMPLEMENTED` | Existing | Partial | Existing | Working | Local JWT passes; GoTrue pending | P0 | None | Auth Service | ZM-IMPL-08B | Auth migration policy |
| **AUTH-02** | Identity | Password Reset & Email Verification | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in tests (8/8 green) | P0 | Email Outbox | Auth Service | Completed | None |
| **AUTH-03** | Identity | Multi-Factor Authentication (TOTP MFA) | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/mfa-auth.test.ts` | P0 | Auth Service | Auth Service | Completed | None |
| **AUTH-04** | Identity | Active Session Revocation & Multi-Device | Discovery 1.5 | `BACKEND COMPLETE / UI MISSING` | Existing | Existing | Missing | Working | API passes; user settings UI needed | P1 | Profiles | User Settings | ZM-IMPL-08B | Inactivity timeout |
| **AUTH-05** | Identity | 5-Attempt Failed Login Lockout | Discovery 1.5 | `DATABASE PRESENT / WORKFLOW MISSING` | Existing | Partial | Missing | Working | Counter in DB; lock UI missing | P0 | Auth Service | Security Guard | ZM-IMPL-08B | Lockout duration |
| **AUTH-06** | Identity | Single Sign-On (OIDC / OAuth 2.0 PKCE) | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/oidc-sso.test.ts` | P0 | Profiles | OIDC Provider | Completed | None |
| **CMS-01** | CMS | Visual Dynamic PageBuilder (`/p/[...slug]`) | Scope Rev 3.0 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | 55/55 Playwright green (E2E-04 fixed)| P0 | Storage | CMS Service | Completed | None |
| **CMS-02** | CMS | Reusable Blocks & Block Library | Scope Rev 3.0 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/cms-pagebuilder.test.ts` | P1 | CMS-01 | CMS Service | Completed | None |
| **CMS-03** | CMS | Scheduled Publishing & Unpublishing | Scope Rev 3.0 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/cms-scheduled.test.ts` | P1 | CMS-01 | CMS Worker | Completed | None |
| **CMS-04** | CMS | Course Page Builder Driven by Authoritative Course | Scope Rev 3.0 | `PARTIALLY IMPLEMENTED` | Existing | Partial | Partial | Working | Basic fields link; dynamic BOM missing | P0 | Commerce-01 | Public Course | ZM-IMPL-08C | Course template rules |
| **CMS-05** | CMS | Protected Workspace Layout Customization | Scope Rev 3.0 | `BACKEND COMPLETE / UI MISSING` | Existing | Existing | Partial | Working | Branding/Nav API green; layout builder missing | P2 | Admin UI | Platform Settings| ZM-IMPL-08G | Widget permissions |
| **ACAD-01** | Academics | 7-Level Academic Hierarchy | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/academic-hierarchy.test.ts`| P0 | Core DB | Academic Admin | Completed | None |
| **ACAD-02** | Academics | Batch Management & Recurring Schedules | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/batch-lifecycle.test.ts` | P0 | ACAD-01 | Batch Service | Completed | None |
| **ACAD-03** | Academics | Multi-Delivery Modes (LIVE, PRERECORDED, HYBRID) | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/delivery-config.test.ts` | P0 | Batch Service | Delivery Engine | Completed | None |
| **ACAD-04** | Academics | Visual Curriculum Tree & Syllabus History | Scope Rev 3.0 | `BACKEND COMPLETE / UI MISSING` | Existing | Existing | Partial | Working | Tree API exists; visual tree UI missing | P1 | ACAD-01 | Academic Admin | ZM-IMPL-08D | Syllabus change approval |
| **LEARN-01**| Learning | Prerecorded Video Playback & Scrub Resume | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/playback-progress.test.ts`| P0 | Delivery Engine | Learning Hub | Completed | Watch threshold (BDR-04) |
| **LEARN-02**| Learning | Time-Released Learning Materials | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/learning-materials.test.ts` | P0 | Storage | Material Service | Completed | None |
| **LEARN-03**| Learning | In-Video Bookmarks, Highlights & Personal Notes | Scope Rev 3.0 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/recording-doubts.test.ts` | P1 | LEARN-01 | Study Tools | Completed | None |
| **VC-01** | VC / Media | Live WebRTC Video Conferencing (BigBlueButton) | Discovery 1.5 | `EXTERNAL INTEGRATION UNCONFIGURED` | Existing | Existing | Existing | Unconfigured | Adapter verified; Server 2 VPS gated | P0 | Server 2 VPS | Zealosh VC | Gated Stage | Server 2 procurement |
| **VC-02** | VC / Media | Attendance Capture & Leave Tracking | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/attendance-tracking.test.ts`| P0 | VC-01 | Attendance Engine| Completed | Minimum threshold (BDR-02)|
| **VC-03** | VC / Media | Live Session Recording Ingestion (RAP Pipeline) | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | HMAC webhook verified in `tests/recording.test.ts`| P0 | VC-01 | Recording Service| Completed | None |
| **EXAM-01** | Assessment| High-Stakes HSE Certification Exam Simulator | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Timer & anti-cheat verified in tests | P0 | ACAD-01 | Exam Engine | Completed | Cooling-off retake policy|
| **EXAM-02** | Assessment| Topic & Subtopic Quizzes with Auto-Scoring | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/quizzes-lifecycle.test.ts` | P0 | ACAD-01 | Quiz Engine | Completed | None |
| **EXAM-03** | Assessment| Centralized Searchable Question Bank | Scope Rev 3.0 | `DATABASE PRESENT / WORKFLOW MISSING` | Existing | Partial | Missing | Working | Questions exist; central bank UI missing | P1 | EXAM-01 | Question Service | ZM-IMPL-08E | Approval workflow |
| **EXAM-04** | Assessment| Assignment Rubric Grading & Version History | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/assignments-rubric.test.ts` | P0 | ACAD-01 | Grading Queue | Completed | Late penalty policy (BDR-05)|
| **EXAM-05** | Assessment| Psychometric Distractor & Item Analysis | Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | No code exists for item discrimination | P2 | EXAM-01 | Exam Analytics | ZM-IMPL-08E | Calculation method |
| **CRED-01** | Credential | Multi-Criteria Course Completion Evaluator | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Evaluates lessons+attendance+exam | P0 | EXAM-01 | Completion Engine| Completed | Criteria weighting (BDR-12)|
| **CRED-02** | Credential | Digital Certificate Record & Public QR Verify | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Public verify route `/verify/[code]` green | P0 | CRED-01 | Certificate Hub | Completed | None |
| **CRED-03** | Credential | Dynamic PDF Certificate Rasterization | Scope Rev 3.0 | `BACKEND COMPLETE / UI MISSING` | Existing | Partial | Missing | Working | Record exists; PDFKit canvas generator needed | P1 | CRED-02 | PDF Service | ZM-IMPL-08E | Template layout sign-off |
| **PLAN-01** | Cert Plan | Student External Certification Planning Tracker | Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Student target date tracker absent | P2 | Student Hub | Student Portal | ZM-IMPL-08F | Board catalog selection |
| **TRUST-01**| Reviews | Course & Instructor Reviews & Testimonials | Discovery 1.5 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Rating & testimonial moderation absent | P2 | Course Hub | Public CMS | ZM-IMPL-08F | Consent & photo policy |
| **GAME-01** | Engagement| Learning Streaks, XP & Achievement Badges | User Request | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Gamification absent | P3 | Student Hub | Engagement Engine| ZM-IMPL-08F | Point/reward rules |
| **MENTOR-01**| Mentorship | 1-on-1 Faculty Mentorship Appointment Booking | User Request | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Office hours booking engine absent | P2 | Calendar-01 | Faculty Service | ZM-IMPL-08F | Free vs Paid entitlement |
| **MSG-01** | Messaging | 1-on-1 Direct Messaging & Student Doubts | Scope Rev 3.0 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Verified in `tests/direct-messaging.test.ts` | P1 | Identity | Message Service | Completed | None |
| **MSG-02** | Messaging | Group, Course & Batch Isolated Chat Channels | Scope Rev 3.0 | `DATABASE PRESENT / WORKFLOW MISSING` | Existing | Partial | Missing | Working | Migration 18 has channels; UI missing | P1 | MSG-01 | Channel Hub | ZM-IMPL-08D | Cross-batch policy |
| **MSG-03** | Messaging | Shared Admissions & Support Operational Inboxes | Scope Rev 3.0 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Support ticketing 100% verified (05C.3) | P1 | Support Teams| Support Hub | Completed | None |
| **MSG-04** | Messaging | Official External WhatsApp Business API | Scope Rev 3.0 | `EXTERNAL INTEGRATION UNCONFIGURED` | Missing | Missing | Missing | Unconfigured | Provider not selected; live messaging gated | P2 | CRM-01 | Messaging Gateway| Gated Stage | Provider selection (WABA)|
| **CRM-01** | Admissions | Public Lead Capture & Enquiry Management | Discovery 1.5 | `BACKEND COMPLETE / UI MISSING` | Existing | Partial | Partial | Working | Application route exists; lead CRM missing | P0 | Public CMS | Admissions Hub | ZM-IMPL-08C | Lead routing rules |
| **CRM-02** | Admissions | 14-Stage Admissions Pipeline & Document Review | Scope Rev 3.0 | `PARTIALLY IMPLEMENTED` | Existing | Existing | Partial | Working | Review queue exists; 14-stage workflow missing| P0 | CRM-01 | Admissions Admin | ZM-IMPL-08C | Course admission policies|
| **CRM-03** | Admissions | Automated Post-Admission Provisioning Orchestrator| Scope Rev 3.0| `PARTIALLY IMPLEMENTED` | Existing | Partial | Missing | Working | Direct enroll works; multi-step orchestrator needed| P0 | CRM-02 | Provisioner | ZM-IMPL-08C | Auto-enroll trigger |
| **CAL-01** | Calendar | Institutional Master Calendar & Scheduling | Scope Rev 3.0 | `PARTIALLY IMPLEMENTED` | Existing | Partial | Partial | Working | Batch schedules exist; unified calendar UI missing| P1 | ACAD-02 | Scheduling Hub | ZM-IMPL-08D | Holiday calendar |
| **ORIENT-01**| Orientation| Mandatory / Optional Course Orientation Booking | Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Orientation slot booking engine absent | P2 | CAL-01 | Admissions Hub | ZM-IMPL-08D | Mandatory course list |
| **COMM-01** | Commerce | Separate Commercial Product & Offering Model | Discovery 1.5 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Courses sold monolithically; package model absent| P0 | ACAD-01 | Commerce Core | ZM-IMPL-08C | Package pricing rules |
| **COMM-02** | Commerce | Granular Entitlement Engine (Video, Mock, Full)| Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Entitlement table absent; course enrollment used | P0 | COMM-01 | Entitlement Engine| ZM-IMPL-08C | Feature matrix per SKU |
| **FIN-01** | Finance | Payment Order Creation & Webhook Reconciliation | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | Idempotent webhook verified in tests | P0 | COMM-01 | Payment Gateway | Completed | Gateway vendor selection |
| **FIN-02** | Finance | Tax Breakdown (GST) & Invoicing Engine | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | InvoiceRecord & CreditNote verified | P0 | FIN-01 | Invoicing Service| Completed | GST rate structure (BDR-18)|
| **SYNC-01** | Sync | Cross-Service Event Outbox & Dead-Letter Queue | Scope Rev 3.0 | `PARTIALLY IMPLEMENTED` | Existing | Partial | Partial | Working | Email outbox works; generic event outbox needed | P1 | Core DB | Sync Control | ZM-IMPL-08G | Event retention policy |
| **MEDIA-01**| Storage | Cloud Object Storage Abstraction (R2 / S3) | Scope Rev 3.0 | `PARTIALLY IMPLEMENTED` | Existing | Existing | Partial | Working | Service abstraction exists; direct R2 client pending | P0 | Server Config | Storage Service | ZM-IMPL-08B | R2 vs S3 decision |
| **AI-01** | AI | Course-Grounded AI Tutor Chatbot | Discovery 1.5 | `VERIFIED COMPLETE (LOCAL)` | Existing | Existing | Existing | Unconfigured | Adapter works; Server 3 VPS inference gated | P1 | Server 3 VPS | Zealosh AI | Gated Stage | Inference model selection |
| **AI-02** | AI | Formative AI Assignment Review Suggestions | Discovery 1.5 | `VERIFIED COMPLETE (LOCAL)` | Existing | Existing | Existing | Unconfigured | Instructor approval queue 100% verified | P1 | EXAM-04 | Zealosh AI | Completed | Tutor verify mandate |
| **AI-03** | AI | Document Text Ingestion & Vector RAG Indexer | Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | PDF text chunking & embedding pipeline absent | P2 | AI-01 | AI Ingestion | ZM-IMPL-08E | Embedding model |
| **REP-01** | Analytics | Multi-Domain Institutional Reporting Suite | Discovery 1.5 | `VERIFIED COMPLETE` | Existing | Existing | Existing | Working | 8 reporting endpoints verified in tests | P1 | Core DB | Reporting Hub | Completed | Export permissions |
| **GROWTH-01**| Growth | Referral Attribution & Promo Codes | Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | Promo codes & referral tracking absent | P2 | COMM-01 | Growth Engine | ZM-IMPL-08F | Commission payout policy |
| **PWA-01** | Mobile | Responsive Web & Progressive Web App Manifest | Scope Rev 3.0 | `PARTIALLY IMPLEMENTED` | Existing | Existing | Partial | Working | Responsive UI passes; manifest.json/SW missing | P1 | Frontend | PWA Engine | ZM-IMPL-08G | Push notification scope |
| **PWA-02** | Mobile | Native Android & iOS Applications | User Request | `NATIVE MOBILE DECISION REQUIRED` | Missing | Missing | Missing | Not Req | Native codebase absent; decision pending | P3 | PWA-01 | Mobile Apps | Gated Stage | Native vs PWA decision |
| **INT-01** | Integration| Academic Calendar Sync Feed (iCal / WebCal) | Scope Rev 3.0 | `NOT IMPLEMENTED` | Missing | Missing | Missing | Not Req | iCal subscribe endpoints absent | P2 | CAL-01 | Integration Hub | ZM-IMPL-08G | Calendar feed security |

