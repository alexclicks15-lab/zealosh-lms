---
name: smart-coder
description: >-
  Architecture-aware coding agent runbook: inspect existing architecture before editing, reuse existing utilities,
  trace data flow, identify root cause before patching, preserve business logic, and verify changes with tests.
  Use this skill whenever planning or executing architectural refactoring, feature implementation, or bug fixes across any codebase.
---

# Smart Coder — Architecture-Aware Engineering Runbook

The `smart-coder` skill enforces disciplined, architecture-first software engineering. Rather than blindly generating code or guessing file structures, it acts as a senior principal engineer who understands system boundaries, dependencies, and business invariants before making surgical, high-integrity modifications.

---

## 1. The 5-Step Core Engineering Lifecycle

Every coding task must follow this strict sequential lifecycle:

```
┌────────────────────────────────────────────────────────┐
│ 1. PLAN                                                │
│    Understand the requirement, define boundaries,      │
│    and identify target outcomes.                       │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 2. INSPECT                                             │
│    Search existing codebase, trace data flow, inspect  │
│    dependencies, patterns, and conventions.            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 3. IMPLEMENT                                           │
│    Apply minimal, idiomatic, type-safe code changes    │
│    reusing proven components and utilities.            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 4. TEST                                                │
│    Run compiler checks, linters, unit tests, and E2E   │
│    suites to catch regressions immediately.            │
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│ 5. VERIFY                                              │
│    Gather empirical evidence (logs, diffs, test runs)  │
│    proving the change solves the root requirement.     │
└────────────────────────────────────────────────────────┘
```

> **Golden Rule:** **NEVER** modify code without first inspecting the surrounding implementation and dependency graph.

---

## 2. Deep Inspection & Context Discovery Protocol

Before touching a single line of code:
1. **Manifest & Config Audit**:
   - Inspect package manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`).
   - Identify active framework, ORM, styling systems, and validation libraries.
2. **Dependency & Symbol Tracing**:
   - Trace inbound and outbound imports of the file you intend to modify.
   - Search for callers, subscribers, and dynamic string references.
3. **Data Flow & State Mapping**:
   - Trace where data originates (database query, route handler, API client), how it is transformed, and where it is consumed in the UI.
4. **Architectural Conventions Check**:
   - Respect established naming conventions, folder structures, and layer boundaries.
   - Do NOT introduce alien paradigms (e.g., introducing Redux into a Zustand codebase, or mixing Axios into a native Fetch codebase).

---

## 3. Root-Cause Diagnosis vs. Superficial Patching

When addressing errors or bugs:
- **Diagnose at the Root**: Trace the flaw to the exact source (bad assumption, stale state, race condition, missing constraint).
- **No Masking**: Never wrap faulty logic in blanket `try/catch` blocks or inject superficial `|| ""` / `?.` null-coalescing chains that obscure corrupt state.
- **Preserve Business Invariants**: Ensure fixes honor existing domain rules and monetary/data accuracy requirements.

---

## 4. Multi-Language Quality Standards

### TypeScript / JavaScript:
- Strict type-safety: zero `any`, leverage discriminated unions, exhaustive switches, and runtime Zod validation.
- Clean async/await handling with explicit error recovery (Result pattern or structured exceptions).

### Python:
- Modern Python 3.11+ syntax, explicit type hints (`mypy --strict`), Pydantic models for validation, and async session hygiene.

### SQL / Database:
- Parameterized queries, transactional boundaries (`BEGIN ... COMMIT`), explicit foreign keys, and safe forward migrations.

---

## 5. Pre-Commit Verification Checklist

Before marking any task complete:
- [ ] Did I inspect and understand the existing code before modifying it?
- [ ] Did I reuse existing components, utilities, and libraries?
- [ ] Did I preserve existing business logic and edge-case handling?
- [ ] Did I verify type compilation (`tsc --noEmit`, `mypy`) with zero diagnostics?
- [ ] Did I run automated tests or browser validation covering the change?
- [ ] Is the solution maintainable, clean, and architecturally consistent?
