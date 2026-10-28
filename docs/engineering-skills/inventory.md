# Antigravity Engineering Intelligence System — Master Skill Inventory

**Document Version:** 1.0.0  
**Environment:** Google Antigravity IDE (Windows x64 / Node.js 20+ / TypeScript 5+ / Vitest 5+)  
**Scope:** Master repository audit, skill catalog, and installation decisions.

---

## 1. Candidate Repositories Evaluated

| Repository ID | Repository Name & Source URL | Description & Capability Scope | Maintenance & License | Audit Assessment & Decision |
| :---: | :--- | :--- | :--- | :--- |
| **Repo A** | [Antigravity Awesome Skills](https://github.com/benjaminasterA/antigravity-awesome-skills) | Curated Antigravity community skills for web development and agent automation. | Active / MIT | **AUDITED & INSTALLED**: Formats compatible with `.agents/skills/<name>/SKILL.md`. Selected core engineering skills. |
| **Repo B** | [Google Gemini Skills](https://github.com/google-gemini/gemini-skills) | Google-native agent instruction cards, prompts, and tool calling definitions. | Official Google / Apache 2.0 | **AUDITED & ADAPTED**: Extracted prompt structure guidelines and tool definitions into router. |
| **Repo C** | [Supabase Agent Skills](https://github.com/supabase/agent-skills) | Database architecture, RLS policy design, connection pool management, and migrations. | Official Supabase / MIT | **AUDITED & ADAPTED**: Integrated into `postgresql-and-supabase`, `database-architecture`, and `database-migration-safety`. |
| **Repo D** | [Vercel Agent Skills](https://github.com/vercel-labs/agent-skills) | Next.js App Router performance, React Server Components (RSC), SSR caching, and edge routing. | Official Vercel / MIT | **AUDITED & ADAPTED**: Integrated into `nextjs-fullstack-architecture` and `performance-engineering`. |
| **Repo E** | [Agentic Awesome Skills](https://github.com/sickn33/agentic-awesome-skills) | Multi-agent reasoning patterns, adversarial critique, debate tournaments. | Active / MIT | **AUDITED & INSTALLED**: Provided foundation for `arena` and multi-agent peer review. |
| **Repo F** | [Awesome Claude Skills](https://github.com/ComposioHQ/awesome-claude-skills) | Composio tools, workflow automation, external API connectors. | Active / Apache 2.0 | **AUDITED & ADAPTED**: Cross-referenced integration patterns into `api-design-and-security` and `crm-and-workflow-automation`. |

---

## 2. Complete Installed Skill Catalog (63 Total Skills)

### 2.1 Core Foundational & Routing Skills (New Master Architecture)
| # | Skill Name | Source & Origin | Installation Location | Capability & Purpose | Decision |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 1 | `engineering-skill-router` | Custom Engineered | `.agents/skills/engineering-skill-router` | Central engineering router, task classifier, execution sequencer, and conflict resolver. | **CREATE** |
| 2 | `repository-investigator` | Custom Engineered | `.agents/skills/repository-investigator` | Rule 1 enforcement: Pre-implementation codebase inspection and impact mapping. | **CREATE** |
| 3 | `minimal-implementation-architect` | Custom Engineered | `.agents/skills/minimal-implementation-architect` | Rule 3 & 4 enforcement: Anti-overengineering, minimal sufficient code, zero dead weight. | **CREATE** |
| 4 | `reuse-before-rebuild` | Custom Engineered | `.agents/skills/reuse-before-rebuild` | Rule 2 enforcement: 6-tier asset search and extension before building new code. | **CREATE** |
| 5 | `database-architecture` | Custom Engineered | `.agents/skills/database-architecture` | Rule 7 enforcement: Relational normalization, constraints, single source of truth. | **CREATE** |
| 6 | `database-migration-safety` | Custom Engineered | `.agents/skills/database-migration-safety` | Zero-downtime expand/contract migrations, table lock defense, rollback planning. | **CREATE** |
| 7 | `database-connection-reliability` | Custom Engineered | `.agents/skills/database-connection-reliability` | Connection pool sizing, leak prevention, idle timeouts, retry safety, healthchecks. | **CREATE** |
| 8 | `testing-and-verification` | Custom Engineered | `.agents/skills/testing-and-verification` | Rule 8 enforcement: 5-stage verification pipeline, empirical claim auditing. | **CREATE** |
| 9 | `security-and-multitenancy` | Custom Engineered | `.agents/skills/security-and-multitenancy` | Defense-in-depth, PostgreSQL RLS, tenant identity propagation, zero leakage. | **CREATE** |
| 10 | `skill-execution-auditor` | Custom Engineered | `.agents/skills/skill-execution-auditor` | 8-point rule adherence audit, evidence capture verification. | **CREATE** |

### 2.2 Workspace Domain Specialists (Zealosh LMS)
| # | Skill Name | Source & Origin | Installation Location | Capability & Purpose | Decision |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 11 | `moodle-integration` | Native Workspace | `.agents/skills/moodle-integration` | Moodle 4.x/5.x REST Web Services API adapter, SCORM, course synchronization. | **INSTALL** |
| 12 | `bigbluebutton-integration` | Native Workspace | `.agents/skills/bigbluebutton-integration` | BigBlueButton 2.7+/4.0 WebRTC classroom provisioning, SHA-1 checksum formulas. | **INSTALL** |
| 13 | `hse-exam-engine` | Native Workspace | `.agents/skills/hse-exam-engine` | High-stakes HSE certification exam simulator, anti-cheat question projection, scoring. | **INSTALL** |
| 14 | `zealosh-architecture` | Native Workspace | `.agents/skills/zealosh-architecture` | Master system architecture, data ownership matrix, multi-tenant boundaries. | **INSTALL** |
| 15 | `zealosh-ui-system` | Native Workspace | `.agents/skills/zealosh-ui-system` | HSE visual brand identity (Navy/Emerald/Gold), WCAG 2.1 AA design system. | **INSTALL** |
| 16 | `zealosh-production-readiness`| Native Workspace | `.agents/skills/zealosh-production-readiness`| 7-gate production deployment release verification runbook. | **INSTALL** |

### 2.3 Specialist Engineering Skills (Transferred & Adapted)
| # | Skill Name | Source & Origin | Installation Location | Capability & Purpose | Decision |
| :---: | :--- | :--- | :--- | :--- | :---: |
| 17 | `ai-agents-and-mcp` | Repos A/B | `.agents/skills/ai-agents-and-mcp` | AI agent architectures, tool calling, MCP servers, RAG pipelines. | **INSTALL** |
| 18 | `analytics-and-cro` | Repo A | `.agents/skills/analytics-and-cro` | Product analytics, conversion funnels, event tracking, Core Web Vitals RUM. | **INSTALL** |
| 19 | `api-design-and-security` | Repo A | `.agents/skills/api-design-and-security` | RESTful API design, rate limiting, RBAC, OAuth2/OIDC, webhook validation. | **INSTALL** |
| 20 | `arena` | Repo E | `.agents/skills/arena` | Multi-agent tournament evaluation, adversarial critiques, scoring rubrics. | **INSTALL** |
| 21 | `background-jobs-and-queues`| Repo A | `.agents/skills/background-jobs-and-queues`| Redis BullMQ, Celery, cron schedules, idempotent workers, dead letter queues. | **INSTALL** |
| 22 | `backlink-and-offpage-seo` | Repo A | `.agents/skills/backlink-and-offpage-seo` | Off-page SEO, backlink analysis, domain authority, anchor text audits. | **INSTALL** |
| 23 | `brainstorming-and-architecture`| Repo A | `.agents/skills/brainstorming-and-architecture`| Requirements scoping, system architecture, ADRs, domain modeling. | **INSTALL** |
| 24 | `chrome-devtools-debugging` | Repo A | `.agents/skills/chrome-devtools-debugging` | Browser runtime profiling, network inspection, memory leak detection. | **INSTALL** |
| 25 | `clean-architecture` | Repo A | `.agents/skills/clean-architecture` | Hexagonal architecture, ports & adapters, DDD boundaries, SOLID principles. | **INSTALL** |
| 26 | `clean-code-and-refactoring`| Repo A | `.agents/skills/clean-code-and-refactoring`| Code quality, refactoring patterns, maintainability guidelines. | **INSTALL** |
| 27 | `cms-and-content-platform` | Repo A | `.agents/skills/cms-and-content-platform` | Headless CMS, content modeling, media pipelines, ISR cache revalidation. | **INSTALL** |
| 28 | `crm-and-workflow-automation`| Repo A | `.agents/skills/crm-and-workflow-automation`| Lead pipelines, notifications, event triggers, webhook dispatches. | **INSTALL** |
| 29 | `dead-code-and-static-analysis`| Repo A | `.agents/skills/dead-code-and-static-analysis`| Unused export detection, unreachable code elimination, bundle tree-shaking. | **INSTALL** |
| 30 | `design-md` | Repo A | `.agents/skills/design-md` | Synthesizing semantic design systems into agent-friendly DESIGN.md files. | **INSTALL** |
| 31 | `devops-and-docker-deploy` | Repo A | `.agents/skills/devops-and-docker-deploy` | Docker multi-stage builds, Compose, Nginx reverse proxy, CI/CD pipelines. | **INSTALL** |
| 32 | `ecommerce-and-medusa` | Repo A | `.agents/skills/ecommerce-and-medusa` | Headless commerce, catalog modeling, payment gateways, checkout flows. | **INSTALL** |
| 33 | `enhance-prompt` | Repo B | `.agents/skills/enhance-prompt` | UI/UX prompt enhancement, design tokens, visual specificity injection. | **INSTALL** |
| 34 | `frontend-design-system` | Repo A | `.agents/skills/frontend-design-system` | Design tokens, accessible UI components, Tailwind CSS, micro-interactions. | **INSTALL** |
| 35 | `git-workflow-and-releases` | Repo A | `.agents/skills/git-workflow-and-releases` | Conventional Commits, branch management, pull requests, release changelogs. | **INSTALL** |
| 36 | `image-and-media-optimization`| Repo A | `.agents/skills/image-and-media-optimization`| WebP/AVIF media pipelines, responsive srcset, layout stability (CLS). | **INSTALL** |
| 37 | `lazy-coder` | Repo A | `.agents/skills/lazy-coder` | Anti-overengineering mindset, minimal code, maximum reuse. | **INSTALL** |
| 38 | `master-orchestrator` | Repo A | `.agents/skills/master-orchestrator` | High-level agent router across engineering stages (Plan $\rightarrow$ Build $\rightarrow$ Verify). | **INSTALL** |
| 39 | `nextjs-fullstack-architecture`| Repo D | `.agents/skills/nextjs-fullstack-architecture`| Next.js App Router, React Server Components (RSC), Server Actions, SSR. | **INSTALL** |
| 40 | `no-duplicator` | Repo A | `.agents/skills/no-duplicator` | Anti-duplication, single-source-of-truth governance across codebase. | **INSTALL** |
| 41 | `nodejs-backend-architecture`| Repo A | `.agents/skills/nodejs-backend-architecture`| Node.js event loop, streams, Fastify/Express/NestJS architectures. | **INSTALL** |
| 42 | `performance-engineering` | Repos A/D | `.agents/skills/performance-engineering` | Full-stack performance, query benchmarking, bundle analysis, Core Web Vitals. | **INSTALL** |
| 43 | `playwright-and-qa-automation`| Repo A | `.agents/skills/playwright-and-qa-automation`| Playwright end-to-end browser automation, cross-browser verification. | **INSTALL** |
| 44 | `postgresql-and-supabase` | Repo C | `.agents/skills/postgresql-and-supabase` | PostgreSQL schema design, indexing, RLS security, connection pooling. | **INSTALL** |
| 45 | `python-development` | Repo A | `.agents/skills/python-development` | FastAPI, SQLAlchemy 2.0, pytest, async programming, Pydantic v2. | **INSTALL** |
| 46 | `react-development` | Repo A | `.agents/skills/react-development` | React hooks, state management, render optimization, Suspense. | **INSTALL** |
| 47 | `react-vite-dashboard` | Repo A | `.agents/skills/react-vite-dashboard` | React + Vite dashboards, TanStack Query, accessible tokens. | **INSTALL** |
| 48 | `remotion` | Repo A | `.agents/skills/remotion` | Programmatic video generation with smooth transitions and audio sync. | **INSTALL** |
| 49 | `saas-multi-tenant-architecture`| Repo A | `.agents/skills/saas-multi-tenant-architecture`| Multi-tenant tenancy isolation, RBAC/ABAC permissions, usage metering. | **INSTALL** |
| 50 | `search-and-relevance-engineering`| Repo A | `.agents/skills/search-and-relevance-engineering`| PostgreSQL tsvector/GIN, BM25, autocomplete, hybrid vector search. | **INSTALL** |
| 51 | `security-audit` | Repo A | `.agents/skills/security-audit` | Deep security guidance, vulnerability reviews, CLI tools, daemons. | **INSTALL** |
| 52 | `security-auditing-and-owasp`| Repo A | `.agents/skills/security-auditing-and-owasp`| OWASP ASVS 4.0 mitigations, secret scanning, CSRF/XSS defense. | **INSTALL** |
| 53 | `seo-and-web-vitals` | Repo A | `.agents/skills/seo-and-web-vitals` | Technical SEO, JSON-LD structured data, OpenGraph, Core Web Vitals. | **INSTALL** |
| 54 | `shadcn-ui` | Repo A | `.agents/skills/shadcn-ui` | shadcn/ui component integration, customization, accessible patterns. | **INSTALL** |
| 55 | `site-md` | Repo A | `.agents/skills/site-md` | Project constitution synthesis into SITE.md for Stitch loops. | **INSTALL** |
| 56 | `smart-coder` | Repo A | `.agents/skills/smart-coder` | Architecture-aware coding runbook: inspect, trace, root-cause patch. | **INSTALL** |
| 57 | `stitch-loop` | Repo A | `.agents/skills/stitch-loop` | Autonomous baton-passing loop pattern for web development. | **INSTALL** |
| 58 | `systematic-debugging` | Repo A | `.agents/skills/systematic-debugging` | Root-cause analysis, failure reproduction, hypothesis testing. | **INSTALL** |
| 59 | `taste-design` | Repo A | `.agents/skills/taste-design` | Anti-generic UI standards, strict typography, calibrated color palettes. | **INSTALL** |
| 60 | `technical-documentation` | Repo A | `.agents/skills/technical-documentation` | Architectural guides, runbooks, API contracts, evidence logs. | **INSTALL** |
| 61 | `typescript-development` | Repo A | `.agents/skills/typescript-development` | Strict type-safety, generics, discriminated unions, branded types. | **INSTALL** |
| 62 | `web-animation-and-motion` | Repo A | `.agents/skills/web-animation-and-motion` | 60fps CSS transitions, Framer Motion, accessible micro-interactions. | **INSTALL** |
| 63 | `website-audit` | Repo A | `.agents/skills/website-audit` | Full-site crawler, UX/content auditor, conversion rate review. | **INSTALL** |
