# Zealosh LMS — Master Architecture Specification: Unified Self-Hosted Platform

**Document Version:** 3.0.0 (Unified Self-Hosted Architecture)  
**Status:** **ACTIVE ARCHITECTURAL BASELINE** (Supersedes API-Client Only Model via ADR-001)  
**Target Brand:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)

---

## 1. Architectural Philosophy & Principles

1. **One Cohesive Zealosh Product:** The learner experiences a unified brand identity (*Zealosh Training & Consultants*). Third-party vendor names are strictly suppressed from all learner-facing interfaces.
2. **Self-Hosted Open-Source Foundation:** Upstream Moodle Core 5.3 LTS and BigBlueButton Core 2.7+/3.0 are self-hosted and customized as the *Zealosh Learning Engine* and *Zealosh Live Classroom*, eliminating external SaaS dependencies and recurring license fees. Both Core Hub and Moodle persist their authoritative state to dedicated, isolated Supabase PostgreSQL instances.
3. **Strict Legal & Copyleft Isolation:** 
   - Proprietary Next.js Core Hub operates across a clear network/HTTP boundary from GPL-licensed Moodle and LGPL-licensed BigBlueButton.
   - Customizations to Moodle (`theme_zealosh`) and BigBlueButton (`bbb-custom`) are maintained as separate extension packages conforming to upstream licenses.
4. **Single Sign-On (SSO) via Central OIDC Provider:** Next.js serves as the master Identity Provider (`/api/oauth/*`). Logging in once to Zealosh authenticates the learner seamlessly across all modules, courses, and live classrooms.
5. **"Nothing Unnecessarily Hardcoded":** Operational settings, branding tokens, feature toggles, and navigation links remain dynamically configurable via the Superadmin Control Center.

---

## 2. Unified System Architecture Diagram

```mermaid
graph TD
    Client["Learner / Instructor / Admin Browser & PWA"]
    
    subgraph Edge["Unified Ingress Edge (Nginx / Cloudflare TLS)"]
        ReverseProxy["High-Performance Reverse Proxy (lms.zealosh.com)"]
    end
    
    subgraph Zealosh_Core["Zealosh Core Hub (Next.js 14 App Router / React 19 / TypeScript)"]
        PublicCatalog["Public Storefront & Curriculums (/courses)"]
        StudentHub["Student Dashboard & Entitlements (/student)"]
        InstructorHub["Instructor Cohort Operations (/instructor)"]
        ExamEngine["High-Stakes BCSP/BCRSP Exam Simulator (/exams)"]
        SuperadminCenter["Superadmin Control Center & Governance (/admin)"]
        OIDC_Provider["Central OAuth2 / OIDC Identity Provider (/api/oauth/*)"]
        CoreStore[("Supabase Project 1: Core Hub DB (Cloud PostgreSQL)")]
    end
    
    subgraph Learning_Engine["Zealosh Learning Engine (Moodle 5.3 LTS Container)"]
        MoodleCore["Moodle Core Engine (PHP 8.3 / Apache)"]
        ThemeZealosh["Custom Theme: theme_zealosh (#4f8c4c Palette)"]
        OIDC_Client["Moodle auth_oauth2 Client Plugin"]
        MoodleDB[("Supabase Project 2: Dedicated Moodle PostgreSQL 17 DB (Port 5432)")]
    end
    
    subgraph Live_Classroom["Zealosh Live Classroom (Self-Hosted BigBlueButton 2.7+ Cluster)"]
        BBBCore["BBB Server (Ubuntu 22.04 LTS / mediasoup / FreeSWITCH)"]
        BBBSkin["Custom Zealosh Whiteboard & HTML5 Client Skin"]
        WebRTC_Bridge["WebRTC Audio / Video SFU & Recording Service"]
    end

    Client -->|HTTPS :443| ReverseProxy
    ReverseProxy -->|/ | /courses | /exams | /student | /admin| Zealosh_Core
    ReverseProxy -->|/learn-engine/*| Learning_Engine
    ReverseProxy -->|/classroom/*| Live_Classroom
    
    Learning_Engine -->|OIDC Token Verification| OIDC_Provider
    Zealosh_Core -->|Signed Session Tokens| Live_Classroom
```

---

## 3. Unified URL & Routing Structure

All services route through the canonical domain (`lms.zealosh.com`):

| Public Path | Upstream Handler | User-Facing Description |
| :--- | :--- | :--- |
| `/` | Next.js Core Hub | Zealosh homepage, HSE credentials, platform metrics. |
| `/courses`, `/courses/[slug]` | Next.js Core Hub | Course catalog, syllabi, batch selection, and enrollment. |
| `/student` | Next.js Core Hub | Student dashboard, enrolled tracks, exam launcher, and quick cards. |
| `/instructor` | Next.js Core Hub | Instructor batch rosters, attendance overview, and gradebook shortcuts. |
| `/exams`, `/exams/[examId]` | Next.js Core Hub | Server-enforced BCSP/BCRSP mock examination engine. |
| `/verify/[code]` | Next.js Core Hub | Public tamper-proof credential verification. |
| `/admin` | Next.js Core Hub | 14-tab Superadmin Control Center and governance console. |
| `/learn-engine/*` | Self-Hosted Moodle (`theme_zealosh`) | Deep learning modules, SCORM packages, homework submissions. |
| `/classroom/*` | Self-Hosted BigBlueButton (`bbb-custom`) | Live interactive WebRTC classrooms and collaborative whiteboard. |
| `/api/oauth/*` | Next.js Core Hub | OAuth2/OIDC discovery, authorization, and token issuance. |

---

## 4. Single Sign-On (SSO) Protocol Specification

1. Learner authenticates at `/login` on the Zealosh Core Hub.
2. Next.js issues a secure, HTTP-only session token and OIDC authorization code.
3. When the learner clicks **"Launch Interactive Learning Module"**, the browser navigates to `/learn-engine/auth/oauth2/login.php?id=zealosh`.
4. Moodle queries `/api/oauth/token` using client credentials, receives a signed RS256 JWT, and queries `/api/oauth/userinfo`.
5. Moodle matches or provisions the student account seamlessly under the verified email, logging the user in instantly with **zero additional password prompts**.
6. When launching a live classroom (`/live/[sessionId]`), Zealosh Core generates a single-use signed join token verified by BigBlueButton's API.

---

## 5. Optional AI Tutor Capability Gate & Integration Seam (ADR-003)

- **Status:** **OPTIONAL / PROPOSED / NOT APPROVED FOR FULL IMPLEMENTATION**.
- **Architecture Principle:** Server-authoritative capability gating, zero unapproved infrastructure, zero outbound inference calls while disabled, and zero client exposure.
- **Components:**
  - `src/lib/ai-tutor/gate.ts`: Capability verification functions (`isAiTutorEnabled()`, `assertAiTutorEnabled()`).
  - `src/lib/ai-tutor/types.ts`: Provider contract (`AiTutorProvider`), request context (`AiTutorContext`), configuration schema and strict validator (`validateAiTutorConfig()`), and typed error `AiTutorDisabledError`.
  - `src/lib/ai-tutor/service.ts`: Server-side proxy boundary with active exam session suspension guard and student course enrollment validation.
  - `src/app/api/ai-tutor/query/route.ts`: Protected endpoint seam returning HTTP 403 `AI_TUTOR_DISABLED` while capability is inactive.
  - PostgreSQL schema: `public.feature_flags.ai_tutor_enabled` defaulting strictly to `FALSE`.
- **Security & Privacy Boundaries:**
  - Examination answer keys, question explanations, and blueprint scoring weights are firewalled from tutor retrieval.
  - Active exam attempts immediately suspend tutor access.
  - Client applications never communicate directly with Ollama or external LLM endpoints; all calls are routed through server-side boundaries.
