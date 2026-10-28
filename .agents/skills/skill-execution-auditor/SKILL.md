---
name: skill-execution-auditor
description: Audits whether the AI coding agent adhered to the 7-step engineering routing workflow, complied with non-negotiable engineering principles, preserved existing systems, and provided empirical evidence rather than simulated realism.
---

# Skill Execution Auditor

## 1. Purpose
The **Skill Execution Auditor** acts as an internal quality oversight engine. It verifies that the AI agent acted with the rigor and discipline of a Principal Software Architect, ensuring that engineering decisions followed the non-negotiable rules and that completion claims are supported by real evidence.

---

## 2. The 8-Point Compliance Audit

For every completed task, evaluate compliance against the core rules:

| # | Rule Evaluated | Verification Question | Failure Condition |
| :---: | :--- | :--- | :--- |
| **1** | **Inspect Before Implement** | Did the agent inspect entry points, existing services, and tests before editing? | Proposing edits without checking whether the feature or utility already exists. |
| **2** | **Reuse Before Rebuild** | Did the agent search for and extend existing components/services? | Building a second customer table, second API client, or duplicate utility. |
| **3** | **Minimal Implementation** | Did the agent avoid unnecessary abstractions, wrappers, and dependencies? | Introducing a heavy npm package for a simple function; over-architecting single-use cases. |
| **4** | **Preserve Existing System** | Were existing APIs, routes, databases, and uncommitted stores preserved? | Breaking existing callers, wiping store files, or altering unrelated routes. |
| **5** | **Fix Root Causes** | Did the agent identify and fix the underlying issue rather than symptom-patching? | Adding multiple try/catch blocks that silently swallow real errors. |
| **6** | **Measure Before Optimizing** | Were performance changes backed by baseline measurements and profiling? | Adding speculative caching or parallelization without measuring bottlenecks. |
| **7** | **Database Integrity** | Were schema changes additive, non-destructive, and pool-friendly? | Dropping tables, resetting databases, or introducing connection leaks. |
| **8** | **Verify Before Completion** | Were automated tests, builds, and typechecks run with real output captured? | Claiming completion based on code appearance without running test runners. |

---

## 3. Audit Scoring & Remediation Protocol

1. **Pass Verdict**: All 8 rules satisfied with captured terminal/runner evidence. The task is ready for operator review or commit.
2. **Conditional Verdict**: Minor formatting or non-breaking stylistic issue. Remedied immediately.
3. **Fail / Rejected Verdict**:
   - Agent bypassed testing $\rightarrow$ Agent must execute test runner.
   - Agent duplicated existing logic $\rightarrow$ Agent must refactor to reuse existing component.
   - Agent introduced breaking changes or wiped store files $\rightarrow$ Agent must revert and fix.

---

## 4. Final Output Verification Format

The auditor ensures the final response includes:
- **Exact Files Modified**: Explicit list with rationale.
- **Components Reused**: Confirmation of existing services/utilities leveraged.
- **Empirical Test Results**: Runner exit codes, test totals (passed/failed/skipped).
- **TypeScript & Build Results**: Compilation status of the build pipeline.
- **Preservation Check**: Explicit confirmation that persistent stores and unrelated work remain unmutated.
