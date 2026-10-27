---
name: dead-code-and-static-analysis
description: >-
  Dead code detection, unused export analysis, unreachable module tracing, and static code analysis.
  Use this skill when auditing codebase dependencies, finding unreferenced files/functions,
  detecting duplicate implementations, and safely removing obsolete code without breaking dependencies.
---

# Dead-Code & Static Analysis Runbook

This skill outlines systematic methods, AST tracing, and verification protocols for finding, isolating, and safely eliminating dead code, unused exports, orphaned components, and duplicate logic across codebases.

---

## 1. Dead Code Categorization

1. **Unreachable Files / Modules**: Source files that are never imported anywhere in the dependency graph or routing tables.
2. **Unused Named Exports**: Functions, types, constants, or interfaces exported from a module but never imported by consumers.
3. **Dead Branches / Unreachable Code**: Code paths behind obsolete feature flags, dead conditions, or unreachable error handlers.
4. **Duplicate Logic Implementations**: Multiple functions performing identical business calculations or data transformations.
5. **Orphaned Database Tables / Columns**: Tables or columns in migrations that have zero active application queries.

---

## 2. Safe Deletion Protocol (Evidence-Based Deletion)

> **CRITICAL RULE**: Static analysis tool output is **evidence**, NOT automatic permission to delete. Every candidate file or function must be dependency-traced before deletion.

```
Step 1: Detection
  └── Run static analysis tools / ripgrep to find unreferenced symbols.

Step 2: Dynamic & Reflection Audit
  └── Search for dynamic imports: `import(...)`, `require(...)`, framework file-based routing.
  └── Search for string references (e.g., event names, config keys, database table names).

Step 3: Test Suite & Fixture Verification
  └── Search for references in test suites, scripts, and E2E fixtures.

Step 4: Dependency Graph Trace
  └── Confirm zero inbound references across the entire repository.

Step 5: Isolation & Removal
  └── Remove unreferenced code in a dedicated, atomic commit.
  └── Run compiler type-checks (`tsc --noEmit` / `mypy`) and full automated test suites immediately after removal.
```

---

## 3. Tooling & Analysis Techniques

### A. Static TypeScript / JavaScript Analysis
```bash
# Verify zero compilation or export binding errors
npx tsc --noEmit

# Find unused files and exports with Knip (if installed)
npx knip

# Find unused exports with ts-prune
npx ts-prune -e
```

### B. Ripgrep Symbol Reference Tracing
```bash
# Check if a function, class, or component name is imported anywhere
rg -w "SymbolName" --glob '!**/{dist,build,node_modules,.next,.git}/**'

# Check for dynamic string references
rg "['\"]SymbolName['\"]" --glob '!**/{dist,build,node_modules,.next,.git}/**'
```

### C. Python Static Analysis
```bash
# Find unused code with Vulture
vulture . --min-confidence 80

# Check type safety and unused imports with Ruff / Flake8 / Mypy
ruff check . --select F401,F841
mypy .
```

---

## 4. Verification Checklist Before Deletion

- [ ] Is this symbol part of a public library or published package API?
- [ ] Is this file part of a file-system-based router (e.g., Next.js `page.tsx`, `route.ts`, Remix `routes/`)?
- [ ] Is this symbol invoked dynamically via reflection, dependency injection, or plugin registration?
- [ ] Is this symbol utilized exclusively in end-to-end integration tests?
- [ ] Does removing this code break the build or any automated test?
