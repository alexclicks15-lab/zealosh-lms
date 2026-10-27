---
name: no-duplicator
description: >-
  Anti-duplication and codebase consolidation runbook. Prevents duplicate components, utilities, API clients,
  database models, hooks, validation schemas, and competing implementations.
  Use this skill before creating new code, when refactoring parallel implementations, or consolidating redundant logic.
---

# No Duplicator — Anti-Duplication & Code Consolidation Runbook

The `no-duplicator` skill prevents codebase fragmentation, duplicate implementations, and architectural drift. Every feature, component, and utility in a codebase should have **one canonical implementation**.

---

## 1. The Search-First Protocol (Mandatory Before Creating Files)

Before writing any new function, component, utility, hook, or schema:

$$\textbf{SEARCH FIRST} \longrightarrow \textbf{EVALUATE REUSE} \longrightarrow \textbf{EXTEND OR COMPOSE} \longrightarrow \textbf{CREATE ONLY IF UNIQUE}$$

### Search Audit Checklist across Codebase:
1. **UI Components**: Search for existing buttons, dialogs, drawers, badges, dropdowns, form inputs, and layout grids.
2. **Utilities & Helpers**: Search for existing date formatters, currency formatters, slugifiers, string manipulators, and debounce/throttle utilities.
3. **API Clients & HTTP Wrappers**: Search for existing fetch wrappers, API route handlers, and request middleware.
4. **Custom Hooks**: Search for existing hooks for state, URL params, media queries, local storage, or data fetching.
5. **Services & Business Logic**: Search for existing calculation engines, pricing logic, and auth validators.
6. **Database Models & Entities**: Search for existing tables, ORM models, relations, and columns before creating new ones.
7. **Validation Schemas & Types**: Search for existing Zod/Pydantic schemas and TypeScript interfaces before creating parallel types.
8. **State Management**: Search for existing stores (Zustand, React Context) rather than spinning up parallel state mechanisms.
9. **Styling Systems**: Search for established Tailwind design tokens and CSS variables rather than creating ad-hoc color/spacing scales.

---

## 2. The 5-Step Consolidation Protocol (When Duplicates Already Exist)

If duplicate or competing implementations are discovered in a codebase:

```
Step 1: Identify Canonical Implementation
  └── Evaluate which implementation is most complete, tested, type-safe, and widely adopted.

Step 2: Gap Analysis & Feature Merging
  └── Port any missing edge-case handling or features from the secondary implementation into the canonical one.

Step 3: Redirect Inbound References
  └── Update all import statements across the codebase to point exclusively to the canonical implementation.

Step 4: Safe Removal
  └── Safely delete the redundant duplicate file/function in an atomic commit.

Step 5: Verify & Test
  └── Run compiler checks (`tsc --noEmit` / `mypy`) and automated tests to verify zero regressions.
```

---

## 3. Anti-Duplication Rules & Patterns

| Anti-Pattern (DO NOT DO) | Canonical Pattern (DO THIS) |
| :--- | :--- |
| Creating `CustomButton.tsx` when `components/ui/button.tsx` exists | Extend `button.tsx` variants using `cva` or props |
| Creating `formatDate2()` in a feature folder | Add or generalize options in `utils/date.ts` |
| Writing a raw `fetch('/api/...')` in a component | Reuse the shared typed API client / hook |
| Creating a new database table for data that fits in an existing entity | Add columns or JSONB metadata to the existing table |
| Maintaining two different schemas for the same domain entity | Export a single shared Zod / Pydantic schema and derive types |
| Installing a new npm package for a function already provided by an existing library | Leverage installed dependencies or native language primitives |

---

## 4. Codebase Hygiene & Refactoring Checklist

- [ ] Searched the repository aggressively for existing implementations before writing new code.
- [ ] Reused and extended existing components and utilities instead of creating duplicates.
- [ ] Consolidated any redundant or competing functions encountered during development.
- [ ] Redirected all import references to the single canonical source of truth.
- [ ] Removed all unused, orphaned, or duplicate files cleanly without breaking tests.
