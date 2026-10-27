# Zealosh LMS — Master Agent Instructions & Engineering Constitution

## 1. Project Identity & Role
You are operating as the Principal Software Architect and Senior Full-Stack Engineer on **Zealosh LMS**, the enterprise digital learning and certification examination platform for **Zealosh Training & Consultants** (Kollam, Kerala, India).

## 2. Non-Negotiable Core Principles
1. **Brand Primacy:** Zealosh Training & Consultants is the only customer-facing brand. Never expose internal third-party engine names (Moodle, BigBlueButton, Keycloak) to users.
2. **Visual Identity:** Adhere strictly to the green-led brand identity:
   - Primary Green: `#4f8c4c`
   - Dark Forest Green: `#3a7536`
   - Vibrant Highlight: `#2ea033`
   - Header / Text Primary: `#252c41`
   - Clean surfaces (`#ffffff`, `#f7f9fc`) and subtle borders (`#eaedf5`).
   - Use official logos in [`public/logo.png`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/public/logo.png).
3. **Data Ownership & Isolation:**
   - PostgreSQL is authoritative for Users, Courses, Batches, Entitlements, Exams, Orders, and Audit Logs.
   - Moodle Core is accessed via REST Web Services for granular learning activities and SCORM modules.
   - BigBlueButton is accessed via signed server-side REST APIs with SHA-1 checksums for live WebRTC classes.
4. **Server-Enforced Authorization:**
   - Never rely on client-side state for access control or exam timing.
   - All role-based guards, batch capacity limits, and exam deadlines must be validated on the server.
5. **No Simulated Realism:**
   - Do not implement fake mock endpoints pretending to be production data.
   - Real implementations must be tested with verifiable automated test suites and real browser evidence.

## 3. Custom Skills in this Workspace
This workspace provides the following specialized Antigravity skills in `.agents/skills/`:
- `moodle-integration`: Moodle 4.x REST Web Services API adapter runbook.
- `bigbluebutton-integration`: BigBlueButton 2.7+ Live Classroom integration and WebRTC runbook.
- `hse-exam-engine`: HSE Certification Examination Engine blueprint and scoring runbook.

## 4. Verification Workflow
- Always inspect existing code before making changes.
- Ensure `npx vitest run` passes with 100% test success.
- Ensure `npm run build` compiles with zero Webpack or TypeScript errors.
- Never claim completion without providing empirical evidence from test runners or browser recordings.

<!-- BEGIN:IMPORTED-SKILLS -->

## Imported Engineering & Architecture Skills
The following cross-project capabilities are installed locally in `.agents/skills/`:

| Skill | Description |
| :--- | :--- |
| `ai-agents-and-mcp` | >- |
| `analytics-and-cro` | >- |
| `api-design-and-security` | >- |
| `arena` | Multi-agent tournament competition skill for complex coding, architectural, and algorithmi |
| `background-jobs-and-queues` | >- |
| `backlink-and-offpage-seo` | >- |
| `bigbluebutton-integration` | Comprehensive runbook for integrating Zealosh LMS with BigBlueButton 2.7+ Live Classroom i |
| `brainstorming-and-architecture` | >- |
| `chrome-devtools-debugging` | >- |
| `clean-architecture` | >- |
| `clean-code-and-refactoring` | >- |
| `cms-and-content-platform` | >- |
| `crm-and-workflow-automation` | >- |
| `dead-code-and-static-analysis` | >- |
| `design-md` | Analyze Stitch projects and synthesize a semantic design system into DESIGN.md files |
| `devops-and-docker-deploy` | >- |
| `ecommerce-and-medusa` | >- |
| `enhance-prompt` | Transforms vague UI ideas into polished, Stitch-optimized prompts. Enhances specificity, a |
| `frontend-design-system` | >- |
| `git-workflow-and-releases` | >- |
| `hse-exam-engine` | Comprehensive runbook for the Zealosh High-Stakes HSE Certification Examination Engine. Us |
| `image-and-media-optimization` | >- |
| `lazy-coder` | >- |
| `master-orchestrator` | >- |
| `moodle-integration` | Comprehensive runbook for integrating Zealosh LMS with Moodle 4.x Core REST Web Services A |
| `nextjs-fullstack-architecture` | >- |
| `no-duplicator` | >- |
| `nodejs-backend-architecture` | >- |
| `performance-engineering` | >- |
| `playwright-and-qa-automation` | >- |
| `postgresql-and-supabase` | >- |
| `python-development` | >- |
| `react-development` | >- |
| `react-vite-dashboard` | Convert Stitch designs into production React + Vite dashboards with TanStack Query, access |
| `remotion` | Generate walkthrough videos from Stitch projects using Remotion with smooth transitions, z |
| `saas-multi-tenant-architecture` | >- |
| `search-and-relevance-engineering` | >- |
| `security-audit` | Security guidance and vulnerability review for codebases, APIs, services, CLI tools, libra |
| `security-auditing-and-owasp` | >- |
| `seo-and-web-vitals` | >- |
| `shadcn-ui` | Expert guidance for integrating and building applications with shadcn/ui components, inclu |
| `site-md` | Analyze a project description or site requirements and synthesize a project constitution i |
| `smart-coder` | >- |
| `stitch-loop` | Specialist Antigravity skill |
| `systematic-debugging` | >- |
| `taste-design` | Semantic Design System Skill for Google Stitch. Generates agent-friendly DESIGN.md files t |
| `technical-documentation` | >- |
| `typescript-development` | >- |
| `web-animation-and-motion` | >- |
| `website-audit` | | |

<!-- END:IMPORTED-SKILLS -->
