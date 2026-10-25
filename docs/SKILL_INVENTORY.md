# Zealosh LMS — Skill Ecosystem Inventory

**Document Version:** 1.0.0  
**Scope:** Complete inventory of discoverable AI coding-agent skills across global, built-in, and project customization scopes.  
**Audit Date:** October 25, 2026

---

## 1. Summary of Discovered Skills

- **Total Skills Discovered:** 59 skills
  - Global User Skills (`~/.gemini/config/skills`): 53 skills
  - Antigravity IDE Built-in Skills (`builtin/skills`): 3 skills (`agy-customizations`, `antigravity_guide`, `permissioned-github`)
  - Project Workspace Custom Skills (`.agents/skills`): 3 skills (`moodle-integration`, `bigbluebutton-integration`, `hse-exam-engine`)
- **Connected MCP Servers:** 2 servers
  - `StitchMCP`: Google Stitch MCP server for UI screen generation and design systems.
  - `supabase`: Supabase database, functions, and documentation MCP server.

---

## 2. Complete Inventory Table

| Skill Name | Scope / Location | Primary Purpose | Installation Status | Relevance to Zealosh LMS |
| :--- | :--- | :--- | :--- | :--- |
| **moodle-integration** | Workspace (`.agents/skills/`) | Moodle 4.x REST Web Services API adapter, user provisioning, course enrolment, completion sync. | **Installed (Workspace)** | **Critical (Direct)** |
| **bigbluebutton-integration** | Workspace (`.agents/skills/`) | BigBlueButton 2.7+ Live Classroom API, SHA-1 checksum signing, join tokens, WebRTC whiteboard. | **Installed (Workspace)** | **Critical (Direct)** |
| **hse-exam-engine** | Workspace (`.agents/skills/`) | BCSP/BCRSP certification blueprint mapping, anti-cheat question projection, countdown deadlines, scoring. | **Installed (Workspace)** | **Critical (Direct)** |
| **nextjs-fullstack-architecture** | Global (`config/skills/`) | Next.js 14+ App Router, RSC, Server Actions, SSR, streaming edge rendering, route handlers. | **Installed (Global)** | **Critical (Direct)** |
| **nodejs-backend-architecture** | Global (`config/skills/`) | Node.js runtime, Event Loop optimization, Express/NestJS server architecture, stream processing. | **Installed (Global)** | **Critical (Direct)** |
| **postgresql-and-supabase** | Global (`config/skills/`) | PostgreSQL schema design, indexing, migrations, query optimization, foreign keys, constraints. | **Installed (Global)** | **Critical (Direct)** |
| **security-auditing-and-owasp** | Global (`config/skills/`) | OWASP ASVS Level 2, IDOR/BOLA defense, SQLi/XSS prevention, secrets management, authentication guards. | **Installed (Global)** | **Critical (Direct)** |
| **api-design-and-security** | Global (`config/skills/`) | RESTful API design, schema validation (`class-validator`), rate limiting, JWT, RBAC authorization. | **Installed (Global)** | **Critical (Direct)** |
| **playwright-and-qa-automation** | Global (`config/skills/`) | End-to-end browser automation, Playwright testing, responsive viewport validation, evidence capture. | **Installed (Global)** | **Critical (Direct)** |
| **frontend-design-system** | Global (`config/skills/`) | Modern UI/UX design systems, Tailwind CSS tokens, accessibility (WCAG 2.1 AA), responsive layouts. | **Installed (Global)** | **Critical (Direct)** |
| **react-development** | Global (`config/skills/`) | React component architecture, custom hooks, state management, render optimization, Suspense. | **Installed (Global)** | **Critical (Direct)** |
| **typescript-development** | Global (`config/skills/`) | Strict type-safety, generics, discriminated unions, type narrowing, runtime DTO validation. | **Installed (Global)** | **Critical (Direct)** |
| **performance-engineering** | Global (`config/skills/`) | Full-stack performance, Core Web Vitals (LCP, INP, CLS), bundle optimization, caching strategies. | **Installed (Global)** | **Critical (Direct)** |
| **clean-architecture** | Global (`config/skills/`) | Domain-Driven Design (DDD), Ports & Adapters, SOLID principles, separation of domain from infrastructure. | **Installed (Global)** | **Critical (Direct)** |
| **devops-and-docker-deploy** | Global (`config/skills/`) | Docker multi-stage builds, Docker Compose, CI/CD pipelines, reverse proxy, health checks, deployments. | **Installed (Global)** | **Critical (Direct)** |
| **technical-documentation** | Global (`config/skills/`) | High-signal architecture specs, API references, runbooks, evidence-based completion logs. | **Installed (Global)** | **Critical (Direct)** |
| **image-and-media-optimization**| Global (`config/skills/`) | WebP/AVIF encoding, responsive picture markup, blur placeholders, layout stability (CLS). | **Installed (Global)** | **High (Direct)** |
| **background-jobs-and-queues** | Global (`config/skills/`) | Asynchronous job queues (BullMQ/Redis), event handlers, retry policies, scheduled cron tasks. | **Installed (Global)** | **High (Direct)** |
| **smart-coder** | Global (`config/skills/`) | Architecture-aware coding, inspect before editing, reuse utilities, verify changes with tests. | **Installed (Global)** | **High (Direct)** |
| **master-orchestrator** | Global (`config/skills/`) | Autonomous engineering decision engine (Plan $\rightarrow$ Implement $\rightarrow$ Test $\rightarrow$ Verify). | **Installed (Global)** | **High (Direct)** |
| **systematic-debugging** | Global (`config/skills/`) | Root-cause troubleshooting, stack trace isolation, regression prevention. | **Installed (Global)** | **High (Direct)** |
| **ai-agents-and-mcp** | Global (`config/skills/`) | AI agent architecture, tool calling, Model Context Protocol, RAG pipelines, prompt engineering. | **Installed (Global)** | **Medium (Phase 5)** |
| **seo-and-web-vitals** | Global (`config/skills/`) | Schema.org structured data, sitemaps, robots.txt, canonical URLs, OpenGraph cards. | **Installed (Global)** | **Medium (Public)** |
| **website-audit** | Global (`config/skills/`) | Full-site crawling, page structure audit, broken link detection, UX inspection. | **Installed (Global)** | **Medium (QA)** |
| **analytics-and-cro** | Global (`config/skills/`) | Product analytics, conversion rate optimization, event taxonomy design, A/B testing. | **Installed (Global)** | **Medium (Ops)** |
| **ecommerce-and-medusa** | Global (`config/skills/`) | Headless e-commerce architecture, catalog modeling, pricing engines, cart/checkout pipelines. | **Installed (Global)** | **Medium (Commerce)** |
| **crm-and-workflow-automation** | Global (`config/skills/`) | Lead management, booking workflows, email/SMS/WhatsApp dispatchers, webhooks. | **Installed (Global)** | **Medium (Batches)** |
| **saas-multi-tenant-architecture**| Global (`config/skills/`) | Multi-tenant SaaS, tenant isolation, RBAC/ABAC permissions, usage metering. | **Installed (Global)** | **Medium (Expansion)**|
| **agy-customizations** | Built-in (`builtin/skills/`) | Antigravity customization guide, loading priorities, rules, plugins, and hooks. | **Installed (Builtin)** | **Direct (Config)** |
| **antigravity_guide** | Built-in (`builtin/skills/`) | Guide for Antigravity IDE, CLI, SDK, keybindings, and slash commands. | **Installed (Builtin)** | **Direct (IDE)** |
| **permissioned-github** | Built-in (`builtin/skills/`) | Secure GitHub version control, PR management, and branch workflows. | **Installed (Builtin)** | **Direct (VCS)** |
| **clean-code-and-refactoring** | Global (`config/skills/`) | Code quality, refactoring patterns, maintainability. | **Installed (Global)** | **Supporting** |
| **dead-code-and-static-analysis** | Global (`config/skills/`) | Dead code detection, unused export analysis. | **Installed (Global)** | **Supporting** |
| **lazy-coder** | Global (`config/skills/`) | Anti-overengineering, bundle bloat elimination, minimal code. | **Installed (Global)** | **Supporting** |
| **no-duplicator** | Global (`config/skills/`) | Anti-duplication, utility consolidation. | **Installed (Global)** | **Supporting** |
| **taste-design** | Global (`config/skills/`) | Semantic design system, anti-generic UI standards. | **Installed (Global)** | **Supporting** |
| **shadcn-ui** | Global (`config/skills/`) | Component library patterns and tokens. | **Installed (Global)** | **Supporting** |
| **search-and-relevance-engineering** | Global (`config/skills/`) | Full-text search (tsvector/GIN), BM25 ranking, typeahead. | **Installed (Global)** | **Supporting** |
| **git-workflow-and-releases** | Global (`config/skills/`) | Conventional Commits, changelogs, release tags. | **Installed (Global)** | **Supporting** |
| **cms-and-content-platform** | Global (`config/skills/`) | Headless CMS, content modeling, media pipelines. | **Installed (Global)** | **Supporting** |
| **web-animation-and-motion** | Global (`config/skills/`) | Fluid web animations, CSS transforms, transitions. | **Installed (Global)** | **Supporting** |
| **chrome-devtools-debugging** | Global (`config/skills/`) | DevTools runtime debugging, memory leaks, HAR analysis. | **Installed (Global)** | **Supporting** |
| **python-development** | Global (`config/skills/`) | Python backend, FastAPI, pytest testing. | **Installed (Global)** | **Secondary** |
| **backlink-and-offpage-seo** | Global (`config/skills/`) | Competitor backlink profiling, referring domain authority. | **Installed (Global)** | **Secondary** |
| **remotion** | Global (`config/skills/`) | Walkthrough video generation from code. | **Installed (Global)** | **Secondary** |
| **react-native** | Global (`config/skills/`) | React Native mobile conversion. | **Installed (Global)** | **Future Phase** |
| **code-to-design** | Global (`config/skills/`) | Convert frontend code to Stitch design. | **Installed (Global)** | **Tooling** |
| **design-md** | Global (`config/skills/`) | Synthesize Stitch design system into DESIGN.md. | **Installed (Global)** | **Tooling** |
| **enhance-prompt** | Global (`config/skills/`) | Transforms UI ideas into polished prompts. | **Installed (Global)** | **Tooling** |
| **extract-design-md** | Global (`config/skills/`) | Extract design system from source code. | **Installed (Global)** | **Tooling** |
| **extract-static-html** | Global (`config/skills/`) | Inlines CSS and images into static HTML. | **Installed (Global)** | **Tooling** |
| **generate-design** | Global (`config/skills/`) | Generate Stitch screens from text prompts. | **Installed (Global)** | **Tooling** |
| **manage-design-system** | Global (`config/skills/`) | Manage design systems in Stitch MCP. | **Installed (Global)** | **Tooling** |
| **react-components** | Global (`config/skills/`) | Convert Stitch designs into modular Vite/React. | **Installed (Global)** | **Tooling** |
| **react-vite-dashboard** | Global (`config/skills/`) | Convert Stitch designs into React + Vite dashboards. | **Installed (Global)** | **Tooling** |
| **site-md** | Global (`config/skills/`) | Synthesize project constitution into SITE.md. | **Installed (Global)** | **Tooling** |
| **stitch-loop** | Global (`config/skills/`) | Autonomous baton-passing loop in Stitch. | **Installed (Global)** | **Tooling** |
| **upload-to-stitch** | Global (`config/skills/`) | Upload local mockups to Stitch project. | **Installed (Global)** | **Tooling** |

---

## 3. Known Limitations & Scope Boundaries
- **Moodle PHP Core on Host:** Moodle PHP monolith cannot run bare-metal on the local Windows host without PHP 8.1+ and Apache/Nginx. Local development utilizes the verified `moodle-integration` adapter with mock contracts, while Docker manifests deploy Moodle in staging/production.
- **BigBlueButton Core on Host:** BigBlueButton requires a dedicated bare-metal Ubuntu 20.04/22.04 LTS instance. The `bigbluebutton-integration` skill provides server-side SHA-1 signature validation and an interactive local classroom simulator.
