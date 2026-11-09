# Zealosh LMS — Master Development Dependency & Precedence Map

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-08A — Complete Product Scope Audit, Functional Gap Analysis & Remaining Development Roadmap  
**Scope:** Topological Ordering of Technical Dependencies Across All Remaining Product Workstreams  
**Date:** November 2026  
**Status:** APPROVED ARCHITECTURAL SPECIFICATION  

---

## 1. Principles of Dependency Ordering

In accordance with **Engineering Constitution Rule 1 (Inspect Before Implementing)** and **Rule 3 (Minimal Sufficient Implementation)**:
1. **Foundation Before Features:** Security boundaries, data models, and authoritative entities must be locked before building user interfaces or secondary automation.
2. **Entitlements Before Commerce:** The platform must define what granular access rights a product represents before selling multiple SKUs.
3. **Admissions Before Provisioning:** Admissions eligibility workflows must be complete before automating post-payment student provisioning.
4. **Calendar Before Mentorship:** A unified calendar and conflict-detection engine must exist before scheduling 1-on-1 faculty office hours or student orientations.
5. **Software Complete Before Hardware Procurement:** All 20 application domains must be locally verified and code-complete before initiating cloud server purchasing or staging deployment.

---

## 2. Global Development Dependency Graph

```mermaid
flowchart TD
    subgraph Track1["Track 1: Foundation & Identity Hardening"]
        ID_01["AUTH-01: Supabase GoTrue Auth Decoupling<br/>(Trigger on auth.users -> public.profiles)"]
        ID_02["AUTH-04/05: Session Revocation & Lockout Guard<br/>(User sessions panel & 5-attempt DB lockout)"]
        MEDIA_01["MEDIA-01: S3/R2 Direct Storage Client<br/>(Pre-signed PUT/GET URL generator)"]
    end

    subgraph Track2["Track 2: Commerce, Entitlements & Admissions Pipeline"]
        COMM_01["COMM-01: Separate Product & Offering Model<br/>(Decouple Academic Course from Sellable SKU)"]
        COMM_02["COMM-02: Server-Authoritative Entitlement Engine<br/>(Verify user access per feature: Video, Mock, Live)"]
        CRM_01["CRM-01/02: Admissions Pipeline & Document Verification<br/>(14-stage Kanban & identity proof review)"]
        PROV_01["CRM-03: Post-Admission Provisioning Orchestrator<br/>(Identity -> Entitlement -> Batch -> Welcome Email)"]
        CMS_04["CMS-04: Course Landing Pages Driven by Offerings<br/>(Dynamic pricing, batch schedules, enrollment CTAs)"]
    end

    subgraph Track3["Track 3: Institutional Calendar, Scheduling & Communication"]
        CAL_01["CAL-01: Master Institutional Calendar<br/>(Aggregates classes, exams, holidays, timezone logic)"]
        ORIENT_01["ORIENT-01: Course Orientation Booking Engine<br/>(Mandatory/optional slot booking & attendance)"]
        MENTOR_01["MENTOR-01: 1-on-1 Faculty Mentorship Booking<br/>(Office hours, conflict prevention, private BBB link)"]
        MSG_02["MSG-02: Group, Course & Batch Isolated Chat Channels<br/>(Cross-batch revision channels with strict academic isolation)"]
    end

    subgraph Track4["Track 4: Academic Quality, Question Bank & Certification"]
        QBANK_01["EXAM-03: Centralized Reusable Question Bank<br/>(Searchable pools, versioning, difficulty tags)"]
        QBANK_02["EXAM-05: Psychometric Distractor & Item Analysis<br/>(Item difficulty, discrimination index, score trends)"]
        PDF_01["CRED-03: Dynamic PDF Certificate Rasterization<br/>(PDFKit canvas compilation with embedded QR code)"]
        PLAN_01["PLAN-01: External Certification Planning Tracker<br/>(Student target exam dates, milestones, tutor advice)"]
        AI_03["AI-03: PDF Document Text Ingestion & Vector RAG<br/>(Text chunking, pgvector embeddings, citation index)"]
    end

    subgraph Track5["Track 5: Student Engagement, Growth & Mobile PWA"]
        TRUST_01["TRUST-01: Course Reviews & Verified Success Stories<br/>(Student consent, photo/video testimonials, moderation)"]
        GROWTH_01["GROWTH-01: Referral Attribution & Promo Coupons<br/>(Coupon discounts at checkout, lead referral source)"]
        GAME_01["GAME-01: Learning Streaks & Milestone Badges<br/>(Daily study consistency, XP points, privacy opt-out)"]
        PWA_01["PWA-01: Progressive Web App Manifest & Service Worker<br/>(Installable web app, offline shell, touch navigation)"]
        SYNC_01["SYNC-01: Cross-Service Event Outbox & Replay Center<br/>(Domain event bus, dead-letter queue, correlation IDs)"]
    end

    subgraph Track6["Track 6: Gated External Infrastructure & Launch (Future)"]
        INFRA_BUY["Server Procurement & Cloud Provisioning<br/>(Server 1 LMS, Server 2 BBB, Server 3 Ollama)"]
        PEN_TEST["Independent Penetration Testing (OWASP ASVS L2)<br/>(CERT-In accredited third-party security audit)"]
        PROD_LAUNCH["Official Production Launch<br/>(DNS cutover to https://zealosh.com)"]
    end

    %% Dependencies between tracks
    ID_01 --> COMM_01
    ID_01 --> CRM_01
    ID_02 --> CRM_01
    MEDIA_01 --> CRM_01
    MEDIA_01 --> AI_03

    COMM_01 --> COMM_02
    COMM_02 --> CMS_04
    COMM_02 --> PROV_01
    CRM_01 --> PROV_01

    PROV_01 --> CAL_01
    CAL_01 --> ORIENT_01
    CAL_01 --> MENTOR_01
    PROV_01 --> MSG_02

    COMM_02 --> QBANK_01
    QBANK_01 --> QBANK_02
    QBANK_01 --> PDF_01
    PROV_01 --> PLAN_01
    MEDIA_01 --> PDF_01

    CMS_04 --> TRUST_01
    COMM_01 --> GROWTH_01
    PROV_01 --> GAME_01
    ID_01 --> PWA_01
    PROV_01 --> SYNC_01

    %% Everything flows to final infrastructure gating
    PROV_01 --> INFRA_BUY
    MSG_02 --> INFRA_BUY
    PDF_01 --> INFRA_BUY
    PWA_01 --> INFRA_BUY
    SYNC_01 --> INFRA_BUY
    INFRA_BUY --> PEN_TEST
    PEN_TEST --> PROD_LAUNCH
```

---

## 3. Strict Precedence Rules & Non-Negotiable Gate Constraints

1. **Rule P1: Entitlement Gate before Commerce Checkout:**
   No multi-tier pricing tables or course package checkouts may be released without `COMM-02` (Server-Authoritative Entitlement Engine) active in middleware. A student purchasing a "Video Only" SKU must be programmatically barred from live WebRTC classroom tokens and high-stakes mock exams.

2. **Rule P2: Post-Admission Provisioning Resumability:**
   Post-admission provisioning (`PROV_01`) must be implemented as an idempotent state machine with a dead-letter queue. If an email notification fails during student onboarding, retrying must NOT duplicate user profiles, batch roster seats, or financial invoices.

3. **Rule P3: Messaging Academic Isolation:**
   When cross-batch revision chat channels (`MSG_02`) are implemented, messaging channel membership must NEVER be used to determine academic course access or grade visibility.

4. **Rule P4: Complete Software Development Before Infrastructure Procurement:**
   The entire application code (Tracks 1 through 5) must pass 100% of unit, integration, and Playwright tests locally before authorizing cloud server purchasing, hosting sign-ups, or staging deployment.

