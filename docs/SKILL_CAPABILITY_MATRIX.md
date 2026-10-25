# Zealosh LMS — Skill Capability Matrix

**Document Version:** 1.0.0  
**Scope:** Engineering Discipline Mapping, Capability Coverage, and Installation Priority.

---

## 1. Capability Status Definitions

- **AVAILABLE AND SUITABLE:** Skill is installed, inspected, directly applicable, and verified.
- **AVAILABLE BUT INCOMPLETE:** Skill exists but lacks specific domain nuances (supplemented with workspace skill).
- **AVAILABLE BUT INCOMPATIBLE:** Skill exists but assumes an incompatible framework/runtime.
- **MISSING (RESOLVED VIA WORKSPACE INSTALL):** Specialized capability was absent and has now been authored into `.agents/skills/`.
- **INSTALLATION BLOCKED:** Cannot run due to host OS/toolchain restrictions.
- **NOT REQUIRED:** Tooling irrelevant to the current phase or architecture.

---

## 2. Engineering Discipline Mapping

| Discipline | Requirement Description | Mapped Skill(s) | Verified Status |
| :--- | :--- | :--- | :--- |
| **A. Architecture & Planning** | Principal architecture, DDD boundaries, ADRs, technical documentation. | `master-orchestrator`<br>`brainstorming-and-architecture`<br>`clean-architecture`<br>`smart-coder` | **AVAILABLE AND SUITABLE** |
| **B. Frontend Engineering** | Next.js 14+ App Router, React 19, TypeScript, responsive UI, Tailwind design system, accessibility. | `nextjs-fullstack-architecture`<br>`react-development`<br>`frontend-design-system`<br>`typescript-development` | **AVAILABLE AND SUITABLE** |
| **C. Backend Engineering** | Node.js, NestJS / Express API design, JWT auth, RBAC authorization, background jobs, error handling. | `nodejs-backend-architecture`<br>`api-design-and-security`<br>`background-jobs-and-queues` | **AVAILABLE AND SUITABLE** |
| **D. Learning Management (LMS)** | Moodle 4.x REST Web Services API, user provisioning, course enrolment, SCORM module completion. | `moodle-integration` *(Workspace)* | **MISSING $\rightarrow$ INSTALLED & SUITABLE** |
| **E. Live Classroom** | BigBlueButton 2.7+ API, SHA-1 checksum signing, join tokens, WebRTC whiteboard, attendance logging. | `bigbluebutton-integration` *(Workspace)* | **MISSING $\rightarrow$ INSTALLED & SUITABLE** |
| **F. Database Engineering** | PostgreSQL schema design, indexing, migrations, transactional integrity, concurrency control. | `postgresql-and-supabase` | **AVAILABLE AND SUITABLE** |
| **G. Security** | OWASP ASVS 4.0 Level 2, anti-cheat question projection, cookie session security, secrets isolation. | `security-auditing-and-owasp`<br>`api-design-and-security` | **AVAILABLE AND SUITABLE** |
| **H. Performance & Scalability** | Core Web Vitals ($\le 2.0s$ LCP, $\le 150ms$ INP, $\le 0.05$ CLS), API p95 $\le 200ms$, caching tiers. | `performance-engineering`<br>`seo-and-web-vitals` | **AVAILABLE AND SUITABLE** |
| **I. Video & Content Protection** | Adaptive streaming (HLS/DASH), dynamic canvas forensic student watermark, signed playback tokens. | `image-and-media-optimization`<br>+ Custom Watermark Layer | **AVAILABLE AND SUITABLE** |
| **J. Exam & Assessment Engine** | BCSP/BCRSP blueprints, timed attempts, randomized questions, server deadline, domain diagnostics. | `hse-exam-engine` *(Workspace)* | **MISSING $\rightarrow$ INSTALLED & SUITABLE** |
| **K. Testing and QA** | Vitest unit/integration testing, Playwright E2E browser automation, concurrency race condition testing. | `playwright-and-qa-automation`<br>`systematic-debugging` | **AVAILABLE AND SUITABLE** |
| **L. DevOps & Deployment** | Multi-stage Dockerfile, Docker Compose, Nginx reverse proxy, health probes, automated backups. | `devops-and-docker-deploy` | **AVAILABLE AND SUITABLE** |
| **M. AI Integrations** | AI tutor, question explanation generation, safety guidelines, usage quotas, prompt injection defense. | `ai-agents-and-mcp` | **AVAILABLE AND SUITABLE** *(Scheduled Phase 5)* |
| **N. Documentation & Delivery** | Architectural runbooks, API contracts, deployment runbooks, evidence logs. | `technical-documentation` | **AVAILABLE AND SUITABLE** |

---

## 3. Analysis of Overlaps & Consolidation

1. **Frontend UI Skills:**
   - Overlap between `taste-design`, `frontend-design-system`, and `shadcn-ui`.
   - **Resolution:** `frontend-design-system` is designated as authoritative for Zealosh brand tokens (`#4f8c4c`, `#252c41`), while `taste-design` enforces anti-generic aesthetic guidelines.
2. **Coding Discipline Skills:**
   - Overlap between `smart-coder`, `clean-code-and-refactoring`, and `lazy-coder`.
   - **Resolution:** `smart-coder` serves as the primary code modification guideline, enforcing verification via Vitest tests before committing.
3. **Moodle & BigBlueButton Specifics:**
   - No pre-existing global skill contained Moodle's REST function signatures (`core_course_get_contents`, `enrol_manual_enrol_users`) or BigBlueButton's SHA-1 algorithm.
   - **Resolution:** Authored and installed dedicated workspace skills in `.agents/skills/moodle-integration` and `.agents/skills/bigbluebutton-integration`.
