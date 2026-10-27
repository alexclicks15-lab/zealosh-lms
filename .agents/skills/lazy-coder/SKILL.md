---
name: lazy-coder
description: >-
  Senior engineer mindset: minimal code, maximum reuse, zero unnecessary complexity, anti-overengineering.
  Use this skill whenever asked to build a feature, modify code, fix bugs, refactor, create UI, add integrations,
  create APIs, write tests, optimize performance, create automations, work across multiple files, or perform repetitive development tasks.
---

# Lazy Coder — Minimum Complexity, Maximum Reliability

The `lazy-coder` skill enforces a senior engineering mindset: **avoid unnecessary coding, duplication, overengineering, and repetitive manual work**. Every task must be solved with the **minimum reliable amount of code and complexity**, while still producing production-quality results.

---

## 1. Core Philosophy

Before writing new code, you MUST inspect the existing project.

Always ask internally:
1. **Does this already exist?**
2. **Can existing code be reused?**
3. **Can an existing component / function / service / hook / API be extended?**
4. **Is there already an installed dependency that solves this?**
5. **Can configuration solve this instead of custom code?**
6. **Can the task be completed by changing a small number of files?**
7. **Can duplicated logic be eliminated?**
8. **Is this abstraction actually necessary?**
9. **Am I creating unnecessary infrastructure?**
10. **What is the simplest production-safe implementation?**

> **Golden Rule:** Do not write code simply because code can be written.

---

## 2. Repository Inspection Protocol

Before implementing anything:
- Inspect repository structure and directory organization.
- Identify the active framework, runtimes, and architectural patterns.
- Inspect package/dependency files (`package.json`, `pnpm-lock.yaml`, `requirements.txt`, etc.).
- Inspect relevant existing components and design system tokens.
- Inspect existing utility functions and helpers.
- Inspect existing API and service layers.
- Inspect database schema definitions, models, and migrations when relevant.
- Inspect authentication, authorization, and session resolution patterns.
- Inspect existing test frameworks and suites.
- Inspect configuration and environment files.
- **Search the entire repository aggressively** for related functionality before creating new files.

---

## 3. Reuse First (Strict Priority Hierarchy)

Follow this priority order for every implementation:

$$\text{Existing implementation} \longrightarrow \text{Extend existing implementation} \longrightarrow \text{Existing dependency} \longrightarrow \text{Small new implementation} \longrightarrow \text{New abstraction}$$

### Never Create:
- ❌ Duplicate components
- ❌ Duplicate API clients / HTTP wrappers
- ❌ Duplicate utility functions / date formatters / string helpers
- ❌ Duplicate database queries / parallel query builders
- ❌ Duplicate validation logic / schemas
- ❌ Duplicate authentication / session handling
- ❌ Duplicate styling systems / parallel CSS frameworks
- ❌ Duplicate state-management stores
- ❌ Unnecessary wrappers / factories / proxies
- ❌ Unnecessary services / microservices
- ❌ Unnecessary libraries

*If an equivalent implementation already exists, reuse it.*

---

## 4. Minimal Change Principle

### Prefer:
- Modifying **1 existing file** over creating **5 new files**.
- Extending an existing component over creating a parallel component.
- Adding a focused function to an existing utility module over creating another utility file.
- Reusing an existing API/service method over creating another endpoint/service layer.
- Configuration changes over custom algorithmic implementations.
- CSS adjustments over replacing entire UI components.
- Existing entity / column additions over creating parallel database tables.

> **Rule:** Do not refactor unrelated code unless strictly required for correctness.

---

## 5. Anti-Overengineering Rules

Do NOT introduce:
- ❌ Unnecessary design patterns (e.g. abstract factory when a plain function works)
- ❌ Unnecessary abstractions and indirection layers
- ❌ Unnecessary interfaces for single-use internal concrete classes
- ❌ Unnecessary wrappers around standard library or framework primitives
- ❌ Unnecessary microservices / micro-frontends
- ❌ Unnecessary external state-management libraries (Redux, MobX when React state/context suffices)
- ❌ Unnecessary dependencies
- ❌ Unnecessary database tables for data that fits naturally in existing entities
- ❌ Unnecessary API layers / redundant route hops
- ❌ Unnecessary configuration flags
- ❌ Unnecessary comments that restate obvious code
- ❌ Unnecessary documentation bloat
- ❌ Unnecessary folder structures and nesting
- ❌ Unnecessary temporary or duplicate files

> **Rule:** Do not build for hypothetical future requirements. Build for the actual requirement with clean extension points.

---

## 6. Dependency Management Rule

Before installing any package:
1. Search existing dependencies in `package.json` / workspace locks.
2. Check whether the required functionality is already provided by an installed library.
3. Check whether native platform / language / framework functionality is sufficient (e.g., native `fetch`, `crypto`, `Intl`, `URLSearchParams`).
4. Check whether a concise local implementation (10–20 lines) is safer, lighter, and zero-dependency.
5. Only install if the complexity of native implementation is prohibitive and the library is well-maintained and lightweight.

---

## 7. UI & Frontend Guidelines

For frontend tasks:
- Inspect the active design system tokens and component library (e.g., `@medusajs/ui`, `shadcn/ui`, Tailwind config).
- Reuse existing button, modal, drawer, table, form, input, and toast components.
- Reuse established typography classes, color variables, spacing scales, and icon packs (e.g., `lucide-react`).
- Reuse existing responsive grid and viewport breakpoints.
- Do NOT build a new design system or styling framework for a single feature.
- Do NOT redesign unrelated pages or layouts.
- Do NOT alter existing visual branding or styling identity unless explicitly requested.

---

## 8. Backend & API Guidelines

For backend tasks:
- Reuse existing service layer patterns and dependency injection / singleton instances.
- Reuse existing authentication, session guards, and RBAC / permission resolvers.
- Reuse existing input validation schemas (e.g., Zod, Medusa validators).
- Reuse existing error handlers, status codes, and exception formats.
- Reuse existing database connection pools, ORM models, and query builders.
- Reuse existing logger, audit log, and telemetry mechanisms.
- Reuse existing API route conventions (`/api/v1/*`, Medusa endpoints, Next.js route handlers).
- Avoid creating parallel backend architectures or competing route trees.

---

## 9. Database & Persistence Guidelines

Before modifying database schemas or creating tables:
- Search existing schemas, tables, and column definitions.
- Check whether an existing entity can naturally represent the data.
- Check existing foreign key relationships and junction tables.
- Check existing indexes and constraints to avoid duplicate query patterns.
- Check existing Row Level Security (RLS) or tenant isolation policies.
- Check existing migration history to maintain schema consistency.
- Avoid duplicate sources of truth across tables.

---

## 10. Focused Testing Guidelines

Do not blindly generate superficial tests for trivial boilerplate.

### Prioritize:
- Critical business logic and monetary / pricing calculations
- Authentication, authorization, and permission boundaries
- Payment confirmation and idempotency gates
- State machine transitions and dual OTP lifecycles
- Database integrity, concurrency locks, and transaction rollbacks
- Core user checkout, ordering, and fulfillment workflows
- Edge cases, error boundaries, and regression bug prevention

*Always leverage and reuse existing test runners (`tsx`, Playwright, Jest, Vitest).*

---

## 11. Automation Rule

When a task involves repetitive manual steps:
- Determine whether a lightweight automation script, generator, or command solves it permanently.
- Potential automation targets:
  - Verification test scripts (`scripts/test-*.ts`)
  - Database seeders / migration runners
  - Code transform / lint / format tasks
  - Asset optimizers or sync utilities
- Create reusable mechanisms whenever the time saved across development cycles outweighs the script cost.

---

## 12. Bug-Fixing Protocol

When diagnosing and resolving bugs:
1. **Reproduce & Understand:** Inspect runtime logs, error stacks, and test failures.
2. **Find the Root Cause:** Trace the exact faulty line or logic flaw.
3. **Targeted Fix:** Fix the root cause directly at the source.
4. **No Symptom Masking:** Do not wrap bugs in loose try/catch blocks or add superficial null-checks that hide underlying state corruption.
5. **Preserve Surrounding Code:** Avoid rewriting unrelated code or refactoring adjacent features.
6. **Add Regression Coverage:** Create an automated test or assertion covering the failure case.
7. **Verify Workflow:** Execute the affected end-to-end user journey.

---

## 13. Production Code Quality Standard

"Lazy" does **NOT** mean careless or sloppy.

Every solution must remain:
- ✅ **Correct:** Handles edge cases, boundary values, and error states.
- ✅ **Secure:** Enforces auth checks, input sanitization, and least privilege.
- ✅ **Maintainable:** Clean naming, predictable flow, and standard TypeScript types.
- ✅ **Performant:** Zero memory leaks, minimal re-renders, and efficient database queries.
- ✅ **Architecturally Consistent:** Integrates seamlessly into the codebase conventions.
- ✅ **Thoroughly Verified:** Backed by direct execution logs and passing tests.

$$\textbf{Goal:} \quad \textbf{Minimum Complexity} + \textbf{Maximum Reliability}$$

---

## 14. Gate: Before Creating New Files

Explicitly check if an existing file can reasonably contain the modification.

**Only create a new file when:**
1. The existing file has a distinct, single responsibility that would be violated.
2. Merging into an existing file would create an unmaintainable monolith.
3. The new functionality is independently reusable across multiple disparate modules.
4. The framework architecture explicitly mandates a separate file (e.g., Next.js `page.tsx`, `route.ts`).
5. Separation materially improves cohesion and testability.

---

## 15. The Lazy Coder Audit Checklist (Before Finishing)

Before concluding any task, run this mental audit:
- [ ] Did I duplicate any existing functionality?
- [ ] Did I create unnecessary files or folders?
- [ ] Did I add unnecessary external dependencies?
- [ ] Did I create unnecessary abstractions, interfaces, or factories?
- [ ] Did I duplicate database logic or create redundant tables?
- [ ] Did I duplicate UI components or styling patterns?
- [ ] Did I touch or refactor unrelated code?
- [ ] Could this solution be simpler, cleaner, and more direct?
- [ ] Did I strictly follow the project's existing architecture?
- [ ] Did I empirically verify the implementation with real tests or runtime logs?

*If any answer reveals unnecessary complexity, simplify the implementation before completing.*

---

## 16. Agent Operational Sequence

Always follow this strict workflow:

$$\textbf{UNDERSTAND} \longrightarrow \textbf{SEARCH} \longrightarrow \textbf{REUSE} \longrightarrow \textbf{PLAN} \longrightarrow \textbf{IMPLEMENT} \longrightarrow \textbf{VERIFY} \longrightarrow \textbf{SIMPLIFY}$$

$$\textbf{NEVER:} \quad \text{PROMPT} \longrightarrow \text{IMMEDIATELY WRITE CODE}$$

Behave like a principal engineer reviewing a mission-critical codebase: evaluate what exists, reuse proven components, make surgical changes, verify thoroughly, and leave the codebase cleaner than you found it.
