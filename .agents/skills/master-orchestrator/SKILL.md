---
name: master-orchestrator
description: >-
  Master engineering router and autonomous decision engine for Antigravity.
  Use this skill to determine project context, select the best specialized skills,
  and orchestrate end-to-end engineering workflows (Plan -> Implement -> Test -> Audit -> Verify).
---

# Master Engineering Orchestrator & Skill Router

The Master Orchestrator guides Antigravity agents through a disciplined, high-quality development lifecycle. It translates user prompts into structured execution pipelines, selecting the exact specialized skills needed for the task.

---

## 1. The Autonomous Decision Pipeline

Every non-trivial request must pass through this 7-step pipeline:

```
[ USER PROMPT ]
       │
       ▼
1. PROJECT CONTEXT AUDIT (Inspect package.json, architecture, active phase)
       │
       ▼
2. DOMAIN & SKILL ROUTING (Identify domain & activate relevant skill)
       │
       ▼
3. ARCHITECTURE & PLANNING (Requirements gate, design, plan approval)
       │
       ▼
4. PRODUCTION IMPLEMENTATION (Clean code, type safety, modular design)
       │
       ▼
5. QA & VERIFICATION (Browser tests, API tests, unit tests, viewport checks)
       │
       ▼
6. SECURITY & PERFORMANCE AUDIT (OWASP top 10, Core Web Vitals, zero leaks)
       │
       ▼
7. EVIDENCE-BASED COMPLETION (Diff proof, test results, verification logs)
```

---

## 2. Skill Routing Matrix

Match the incoming request to the primary and supporting skills:

| Request Category | Primary Skill | Supporting Skills |
| :--- | :--- | :--- |
| **New Feature / Complex System** | `brainstorming-and-architecture` | `clean-code-and-refactoring`, `playwright-and-qa-automation` |
| **Bugs / Regressions / Crashes** | `systematic-debugging` | `playwright-and-qa-automation`, `clean-code-and-refactoring` |
| **Frontend / UI / UX / Styling** | `frontend-design-system` | `nextjs-fullstack-architecture`, `seo-and-web-vitals`, `playwright-and-qa-automation` |
| **Next.js App / SSR / RSC / Server Actions** | `nextjs-fullstack-architecture` | `frontend-design-system`, `api-design-and-security` |
| **Backend API / Auth / Endpoints** | `api-design-and-security` | `postgresql-and-supabase`, `security-auditing-and-owasp` |
| **Database / SQL / Supabase / Migrations** | `postgresql-and-supabase` | `api-design-and-security`, `performance-engineering` |
| **SaaS / Multi-Tenancy / Billing / RBAC** | `saas-multi-tenant-architecture` | `postgresql-and-supabase`, `api-design-and-security` |
| **CRM / Workflows / Notifications / Webhooks** | `crm-and-workflow-automation` | `background-jobs-and-queues`, `api-design-and-security` |
| **Async Jobs / Queues / Events** | `background-jobs-and-queues` | `postgresql-and-supabase`, `systematic-debugging` |
| **AI / LLM / MCP / RAG / Prompts** | `ai-agents-and-mcp` | `api-design-and-security`, `master-orchestrator` |
| **E2E Testing / Browser QA / Viewports** | `playwright-and-qa-automation` | `systematic-debugging`, `frontend-design-system` |
| **Security Audit / Hardening / OWASP** | `security-auditing-and-owasp` | `api-design-and-security`, `postgresql-and-supabase` |
| **Performance / Core Web Vitals / Profiling** | `performance-engineering` | `nextjs-fullstack-architecture`, `postgresql-and-supabase` |
| **Git / Commits / PRs / Releases** | `git-workflow-and-releases` | `technical-documentation` |
| **Docker / CI/CD / Deployment / Ops** | `devops-and-docker-deploy` | `security-auditing-and-owasp`, `git-workflow-and-releases` |
| **Documentation / RFCs / Runbooks** | `technical-documentation` | `brainstorming-and-architecture` |

---

## 3. Pre-Implementation Validation Gates

Before writing or altering any code, verify:
1. **Context Check**: Read active codebase configuration, existing components, database schema, and project rules in `.agents/AGENTS.md`.
2. **Duplication Check**: Does an existing utility, component, or endpoint already solve this problem? If yes, extend or reuse it.
3. **Business Value Check**: Does this solve a concrete operational, performance, or customer problem? Reject feature bloat.
4. **No Shopify Rule**: CakeToHome is a bespoke headless commerce and operations platform. Never reference, install, or implement Shopify/Hydrogen architectures.

---

## 4. Production Quality Definition of Done

Every task is only marked complete when:
- [ ] Code compiles with zero TypeScript errors.
- [ ] Lint checks pass cleanly without disabling rules.
- [ ] Automated tests or Playwright browser tests verify core user flows.
- [ ] Desktop, tablet, and mobile responsiveness are intact.
- [ ] No API keys, credentials, or service-role keys are exposed.
- [ ] Direct evidence (diffs, test logs, execution output) is provided in the final report.
