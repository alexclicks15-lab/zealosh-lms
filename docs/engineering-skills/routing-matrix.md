# Antigravity Engineering Intelligence System — Routing Matrix & Execution Policy

**Document Version:** 1.0.0  
**Scope:** Autonomous Task Classification, Primary and Supporting Skill Assignments, Execution Ordering, and Verification Requirements.

---

## 1. Master Routing Matrix

| Task Category | Trigger Conditions & User Intent | Primary Mandatory Skills | Conditional Safety Specialists | Execution Sequence | Mandatory Verification Gate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. UI & Visual Styling** | Copy edits, CSS styling, colors, layout tweaks, icons, typography | `repository-investigator`<br>`minimal-implementation-architect` | `frontend-design-system`<br>`zealosh-ui-system` | 1. Inspect existing page & component<br>2. Identify active design tokens<br>3. Apply localized CSS changes<br>4. Run build compilation | `npx tsc --noEmit`<br>`npm run build` |
| **2. Document & File Generation** | Invoices, certificates, audit reports, PDF generation, CSV exports | `repository-investigator`<br>`reuse-before-rebuild` | `minimal-implementation-architect`<br>`technical-documentation` | 1. Search for existing export services<br>2. Reuse existing data serializer<br>3. Implement minimal file generation<br>4. Validate generated file integrity | Unit test verifying byte output and header types |
| **3. Database Schema Evolution** | New fields, new entities, schema adjustments, ORM changes | `database-architecture`<br>`database-migration-safety` | `postgresql-and-supabase`<br>`security-and-multitenancy` | 1. Inspect current schema & relations<br>2. Write additive/nullable DDL<br>3. Update ORM models & types<br>4. Run migration test suite | Migration up/down test, zero data loss verification |
| **4. Connection & Pool Failures** | Connection refused, timeout, pool exhausted, ECONNRESET | `systematic-debugging`<br>`database-connection-reliability` | `postgresql-and-supabase` | 1. Inspect active connection count & state<br>2. Detect leaking client handles<br>3. Enforce client release in `finally`<br>4. Verify healthcheck recovery | Liveness probe HTTP 200, zero connection leak |
| **5. Latency & Performance Tuning**| Slow API routes, p95 lag, CPU spikes, slow queries, heavy bundles | `performance-engineering`<br>`chrome-devtools-debugging` | `database-architecture`<br>`react-development` | 1. Measure baseline latency / bundle size<br>2. Profile query execution plans<br>3. Apply minimal targeted optimization<br>4. Re-measure under identical load | Baseline vs. post-optimization benchmark |
| **6. Frontend State & Rendering** | Infinite re-renders, hydration mismatch, state synchronization bug | `repository-investigator`<br>`systematic-debugging` | `react-development`<br>`nextjs-fullstack-architecture` | 1. Trace component props & state flow<br>2. Form and test render hypothesis<br>3. Apply minimal state lifting or memo<br>4. Verify component test passes | Component unit test, zero hydration warning |
| **7. Multi-Tenant Enterprise Feature**| Cohorts, multi-org branding, tenant-specific permissions | `minimal-implementation-architect`<br>`security-and-multitenancy` | `saas-multi-tenant-architecture`<br>`database-architecture` | 1. Trace tenant context in JWT/session<br>2. Enforce RLS and tenant-scoped queries<br>3. Add composite tenant unique keys<br>4. Execute cross-tenant negative test | Cross-tenant rejection test (HTTP 403/404) |
| **8. External API Integration** | Payment gateways, webhooks, Moodle sync, BigBlueButton rooms | `api-design-and-security`<br>`reuse-before-rebuild` | `background-jobs-and-queues`<br>`moodle-integration` | 1. Inspect existing adapter patterns<br>2. Enforce HMAC signature validation<br>3. Implement idempotent replay handler<br>4. Verify network timeout fallbacks | Idempotency replay test, signed webhook test |
| **9. Architectural Refactoring** | Eliminating duplicated code, dead exports, technical debt | `no-duplicator`<br>`reuse-before-rebuild` | `clean-architecture`<br>`dead-code-and-static-analysis` | 1. Map all existing call sites<br>2. Extract shared cohesive utility<br>3. Update callers to use shared utility<br>4. Run full regression test suite | 100% pass across full regression test suite |
| **10. Security & Penetration Audit** | Vulnerability assessment, OWASP audit, secret scanning, pen-test | `security-audit`<br>`security-and-multitenancy` | `api-design-and-security`<br>`security-auditing-and-owasp` | 1. Scan codebase for plaintext secrets<br>2. Audit auth middleware and timing safety<br>3. Verify input parameterization<br>4. Run negative security test suite | Zero credential leak, timingSafeEqual verified |
| **11. Production Incident Triage** | Broken staging deployment, unhandled exception in core flow | `systematic-debugging`<br>`testing-and-verification` | `zealosh-production-readiness`<br>`database-connection-reliability` | 1. Capture exact error log & stack trace<br>2. Reproduce failure in isolated test<br>3. Apply minimal safe hotfix<br>4. Run regression suite & deploy check | Root-cause regression test passing |
| **12. Deployment Verification** | Pre-commit gate, staging release audit, release packaging | `zealosh-production-readiness`<br>`testing-and-verification` | `devops-and-docker-deploy`<br>`git-workflow-and-releases` | 1. Verify `git status` hygiene<br>2. Run strict typecheck (`tsc --noEmit`)<br>3. Run full test suite (`npm test`)<br>4. Run clean build (`npm run build`) | 100% green tests, 0 build errors |

---

## 2. Dynamic Execution Ordering Rules

1. **Investigation Precedes Implementation**: `repository-investigator` must complete before any code-generating skill executes.
2. **Safety Gates Precede DDL Execution**: `database-migration-safety` preflight checks must pass before any database migration script is executed.
3. **Profiling Precedes Performance Changes**: `performance-engineering` baseline measurement must be recorded before caching, indexes, or algorithmic rewrites are applied.
4. **Verification Succeeds Implementation**: `testing-and-verification` executes only after code changes are completely staged in the workspace.
5. **Auditing Closes the Lifecycle**: `skill-execution-auditor` evaluates the agent's work and captures evidence before any completion claim is submitted.
