# Zealosh LMS — Master Product Blueprint & Technical Specification

**Document Version:** 1.0.0  
**Milestone:** ZM-01 — Master Product Blueprint  
**Status:** **AUTHORITATIVE PRODUCT BLUEPRINT & TECHNICAL SPECIFICATION**  
**Target Platform:** Single Institutional Learning Management & Certification Platform  
**Target Domain:** `https://zealosh.com`  
**Client / Brand:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)  
**Date:** October 30, 2026  

---

## 1. Executive Product Vision & Architectural Mandate

### 1.1 Single-Institution Architecture
Zealosh LMS is an enterprise-grade digital learning, examination, and academic operations platform purpose-built for **one educational institution**: **Zealosh Training & Consultants**.
- **Strict Anti-Scope:** This is **NOT** a multi-tenant SaaS application. Multi-organization subscriptions, cross-tenant isolation boundaries, tenant switcher dropdowns, and organization-scoped billing frameworks are explicitly excluded from the product architecture.
- **Academic Hierarchy as Internal Structure:** Academic divisions, departments, programmes, academic years, courses, batches, and cohorts exist purely as internal organizational structures within the single institution.
- **Role Separation:** Robust security and authorization enforce strict boundaries between **Students**, **Instructors**, **Academic Administrators**, and **Superadmins** through server-enforced role-based access control (RBAC) and database Row-Level Security (RLS).

### 1.2 Unified Public Experience (`https://zealosh.com`)
All public-facing and authenticated learner, instructor, and administrative journeys operate under a single unified web presence: **`https://zealosh.com`**.
- While underlying infrastructure may distribute workloads across dedicated servers (e.g. Server 1 for Next.js LMS Core and Moodle engine, Server 2 for BigBlueButton WebRTC media, and Server 3 for future Ollama AI services), reverse-proxy routing, Single Sign-On (SSO), and embedded interfaces ensure that the end-user never experiences disjointed branding or third-party vendor names.
- Brand Primacy: All learner-facing copy, certificates, video players, and emails strictly feature **Zealosh Training & Consultants** with calibrated green visual identity (`#4f8c4c`, `#3a7536`, `#2ea033`, `#252c41`).

### 1.3 Master Product Sequence
The institutional product roadmap follows a strict, dependency-ordered 6-phase sequence:
1. **Complete the Core LMS:** Academic hierarchy, course delivery combinations, prerecorded video management, live classroom, assignments, question bank, topic quizzes, exams, multi-criteria completion, certificates, notifications, and developer bug monitoring.
2. **Complete AI Development Using Ollama:** Dedicated Linux VPS, local open-source LLM deployment, course-grounded RAG, AI Tutor, and AI-assisted assignment evaluation with mandatory tutor verification.
3. **Complete Full-System Testing:** End-to-end multi-role browser journeys, concurrency stress testing, exam timer integrity, and security audits.
4. **Prepare & Provision Infrastructure:** Multi-node VPS sizing, network configuration, and hardened deployment automation.
5. **Complete Deployment, DNS, HTTPS & Production Configuration:** Staging verification, DNS cutover to `zealosh.com`, TLS certificates, and database backup verification.
6. **Official Production Launch:** Full platform activation on `https://zealosh.com`.

---

## 2. Core System Architecture & Topology

```mermaid
graph TD
    User["Learner / Faculty / Admin Browser"] -->|HTTPS :443| Gateway["Nginx Reverse Proxy Gateway<br/>(https://zealosh.com)"]
    
    subgraph S1["Server 1: LMS Application & Learning Engine Node"]
        CoreHub["Zealosh Core Hub (Next.js 14 App Router)<br/>Auth, Academic Admin, Commerce, Exams, Quizzes"]
        MoodleContainer["Moodle 5.3 LTS Engine (/learn-engine)<br/>Deep SCORM Packages & Interactive H5P"]
        Redis["Redis 7 (Session Cache & Event Queue)"]
        DiagnosticLogger["Developer Diagnostic & Error Tracker"]
    end

    subgraph S2["Server 2: Live Classroom Media Node"]
        BBB["Zealosh Live Classroom (BigBlueButton 4.0)<br/>WebRTC Audio/Video SFU, Whiteboard, Chat"]
        RecordingPipeline["Recording & Processing Pipeline"]
    end

    subgraph S3["Server 3: Dedicated AI Node (Deferred Phase 6)"]
        Ollama["Ollama Engine (Local Open-Source LLMs)"]
        VectorDB["Course Document Embeddings & RAG Engine"]
    end

    subgraph DataTier["Authoritative Persistence Tier (PostgreSQL)"]
        Supabase1[("Supabase Project 1: Core Hub DB<br/>Users, Courses, Batches, Exams, Quizzes, Submissions")]
        Supabase2[("Supabase Project 2: Dedicated Moodle DB<br/>mdl_* SCORM & Lesson Progress")]
    end

    Gateway -->|/ | /courses | /student | /instructor | /admin | /api/*| CoreHub
    Gateway -->|/learn-engine/*| MoodleContainer
    Gateway -->|/live/* | /recordings/*| BBB
    
    CoreHub --> Supabase1
    MoodleContainer --> Supabase2
    CoreHub -->|Signed Join URLs & End APIs| BBB
    RecordingPipeline -->|Authenticated Webhook Callbacks| CoreHub
    CoreHub -.->|Internal Private REST (Phase 6)| Ollama
```

---

## 3. Authoritative Architectural Foundations

### 3.1 Identity & Authentication (Supabase Auth Mandate)
- **Primary Identity Authority:** Supabase Auth (`auth.users`) is the authoritative identity provider.
- **Application Profile Separation:** Zealosh maintains application profile records in `public.profiles`, separating identity from academic roles, faculty assignments, and enrollments.
- **No Role In Metadata:** Authoritative roles (`STUDENT`, `INSTRUCTOR`, `COURSE_MANAGER`, `ORG_ADMIN`, `SUPER_ADMIN`, `SUPPORT_STAFF`) are stored in database tables, never in client-editable user metadata.
- **Single Identity, Multiple Responsibilities:** A single user account can hold multiple legitimate roles (e.g. an instructor who is also enrolled in an advanced course) without creating duplicate accounts.
- **Session Lifecycle:** Managed via secure, HTTP-only cookies, with server-side revocation, session timeouts, and multi-factor authentication (MFA) support.

### 3.2 Granular Course Delivery Model
A course is never restricted to a single monolithic delivery type. Zealosh supports four approved delivery modes:
1. **Online-Only:** Scheduled live virtual classroom sessions with interactive workshops and realtime attendance.
2. **Prerecorded-Only:** Asynchronous video lessons with chapter navigation, downloadable resources, and topic checkpoints.
3. **Hybrid:** Structured combination of scheduled live sessions and self-paced prerecorded modules.
4. **Combined Delivery:** Complete blended model utilizing live classes, prerecorded lectures, interactive assignments, quizzes, and formal exams.

#### Hierarchical Delivery Configuration:
Delivery configuration is defined and overridden across multiple academic levels:
$$\text{Course Level} \longrightarrow \text{Batch / Cohort Level} \longrightarrow \text{Module Level} \longrightarrow \text{Topic Level} \longrightarrow \text{Subtopic / Activity Level}$$

Different batches of the same course can employ distinct delivery schedules (e.g. Weekend Live Batch vs. Self-Paced Recorded Cohort) while sharing the same curriculum and question bank.

### 3.3 Separation of Content Origins
The system maintains strict metadata and architectural separation between:
- **Independently Uploaded Prerecorded Lessons:** Uploaded by faculty, structured into modules/topics, accompanied by slides and transcripts, independent of any live meeting.
- **Live Classroom Recordings:** Generated automatically by Server 2 upon conclusion of a BigBlueButton session, ingested via authenticated webhooks, reconciled with batch rosters, and managed under previous-batch access governance.

---

## 4. Academic & Assessment Subsystems

### 4.1 Academic Hierarchy (7-Node Relational Tree)
The platform organizes learning through a strict 7-node institutional academic hierarchy:

$$\text{Academic Year} \longrightarrow \text{Department} \longrightarrow \text{Programme} \longrightarrow \text{Course} \longrightarrow \text{Module} \longrightarrow \text{Topic} \longrightarrow \text{Subtopic}$$

1. **Academic Year (`academic_years`):** Institutional operating session (e.g. `2026-2027`) with server-enforced date boundaries and single active flag (`is_current`).
2. **Department (`departments`):** Academic division (e.g. Health, Safety & Environment; Process Safety) with uppercase code and designated faculty lead.
3. **Programme (`programmes`):** Formal degree or qualification track (e.g. Associate Safety Professional Preparation Diploma) with standard duration in months.
4. **Course (`courses`):** Master course syllabus, certification blueprint mapping, pricing, and multi-delivery mode configuration.
5. **Module (`modules`):** Relational pedagogical curriculum unit linked to Course and Programme, supporting distinct delivery modes (`RECORDED`, `LIVE`, `HYBRID`, `MATERIALS_ONLY`).
6. **Topic (`topics`):** Focused subject unit carrying measurable learning objectives and estimated study duration.
7. **Subtopic (`subtopics`):** Granular instructional concept unit carrying specific equations, code references, or procedural steps.

Learning activities (Prerecorded Video Lessons, Live Classes, PDF Resources, Quizzes, Assignments, and Exams) attach hierarchically to Modules, Topics, and Subtopics.

### 4.1.1 Live Classroom Recording Highlights & Interactive Doubts
Live classroom recordings support deep post-session learning through interactive timeline features:
- **Timeline Highlights:**
  - Authored by course instructors or moderators during or after the live session.
  - Carries precise timeline boundaries (`startTimeSeconds`, `endTimeSeconds`), concise title, and summary notes.
  - Preview before publish capability allows faculty to audit markers before student visibility.
  - Learners have view-only access with one-click navigation to core instructional moments.
- **Interactive Doubts:**
  - Enrolled learners can place questions pinned to an exact video playback timestamp (`timestampSeconds`).
  - Thread-based discussion with instructor replies and resolution states (`OPEN` $\rightarrow$ `ANSWERED` $\rightarrow$ `RESOLVED`).
  - Institutional response SLA governed by BDR-15 (technical default: 48-hour business day turnaround).

### 4.2 Comprehensive Assessment Architecture
Assessment is organized into three distinct tiers:

| Tier | Purpose | Question Types | Timing & Delivery | Evaluation |
| :--- | :--- | :--- | :--- | :--- |
| **Quizzes** | Formative topic checkpoints | MCQ, True/False, Multiple Select | Immediate or delayed feedback; untimed or short timer; retakes permitted | Fully automated objective scoring |
| **Assignments** | Practical coursework & projects | File uploads, text submissions | Due dates, late submission penalties, multi-attempt policies | Faculty grading via structured criterion rubrics |
| **Examinations** | Summative high-stakes certification | Multi-domain blueprints, scenario calculations | Strict server-enforced countdown timer, randomized questions, anti-cheat | Server-authoritative automated scoring + domain breakdown |

### 4.3 Configurable Completion & Certificate Engine
Certificates are awarded based on a course-specific configurable completion policy:
- Minimum lesson watch progress (e.g. 100% of mandatory lessons).
- Minimum live class attendance threshold (e.g. $\ge 75\%$ duration).
- Passing scores on all required topic quizzes.
- Passing grade on all required coursework assignments.
- Minimum score on the final certification examination.

Certificates feature tamper-proof verification:
- Unique sequential certificate numbers (e.g. `ZEAL-2026-ASP-1042`).
- Cryptographic verification code.
- Public QR code routing to `https://zealosh.com/verify/[code]`.
- Public verification endpoint disclosing only sanitized credential status without leaking private student records.

---

## 5. Live Error Monitoring & Developer Diagnostics

Production operations require a dedicated diagnostic subsystem that empowers engineers to detect, investigate, and resolve issues in real time:
- **Client-Side Exception Capture:** Unhandled JavaScript rejections, video playback buffering failures, WebRTC audio/video disconnects.
- **Server-Side Exception Capture:** API 500 errors, database lock timeouts, webhook verification rejections, queue processing failures.
- **Diagnostic Context:** Every error records safe metadata (timestamp, error code, stack trace, release version, environment, correlation ID, route) while **strictly redacting** passwords, bearer tokens, cookies, and student submission contents.
- **Developer Lifecycle:** `Detected` $\rightarrow$ `Grouped` $\rightarrow$ `Prioritized` $\rightarrow$ `Investigating` $\rightarrow$ `Fixing` $\rightarrow$ `Resolved` $\rightarrow$ `Verified`.
- **User-Facing Problem Reporting:** Students and instructors can submit contextual problem reports directly from the interface.

---

## 6. Future AI Architecture (Ollama VPS) — Direction Approved, Implementation Deferred

The institute has approved local AI capability powered by **Ollama** running on a separate Linux VPS (Server 3). Implementation is scheduled for Phase 6 (after core LMS completion).

### Core Architectural Principles:
1. **Course-Grounded RAG:** The AI Tutor answers questions strictly based on authorized course materials, syllabus notes, approved question banks, and faculty slides.
2. **Source Citations:** Every response must provide verifiable citations to course modules or pages.
3. **No Direct Grade Modification:** The AI Assignment Evaluator produces suggested criterion scores and feedback in a private queue; faculty verification is mandatory before grades become official.
4. **Data Isolation:** Zero student personal data or proprietary course content is transmitted to external third-party AI APIs.

---

## 7. Canonical Document Suite

This master blueprint is supported by detailed companion specifications:
1. [`ZEALOSH_FUNCTIONAL_REQUIREMENTS.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_FUNCTIONAL_REQUIREMENTS.md): Complete 21-domain functional requirements audit.
2. [`ZEALOSH_IMPLEMENTATION_GAP_REGISTER.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_IMPLEMENTATION_GAP_REGISTER.md): Requirement-by-requirement gap register with priorities and complexity estimates.
3. [`ZEALOSH_DATABASE_ARCHITECTURE.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_DATABASE_ARCHITECTURE.md): Authoritative schema, entity relationships, constraints, and migration plan.
4. [`ZEALOSH_ROLE_PERMISSION_MATRIX.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_ROLE_PERMISSION_MATRIX.md): Detailed RBAC matrix across all roles and resources.
5. [`ZEALOSH_WORKFLOW_CATALOG.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_WORKFLOW_CATALOG.md): Complete end-to-end user journeys for students, instructors, and administrators.
6. [`ZEALOSH_BUSINESS_DECISION_REGISTER.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_BUSINESS_DECISION_REGISTER.md): Decisions requiring explicit institutional sign-off.
7. [`ZEALOSH_TEST_ACCEPTANCE_MATRIX.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/ZEALOSH_TEST_ACCEPTANCE_MATRIX.md): Verifiable test acceptance matrix.
8. [`IMPLEMENTATION_ROADMAP.md`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/docs/IMPLEMENTATION_ROADMAP.md): Prioritized multi-phase implementation roadmap.

