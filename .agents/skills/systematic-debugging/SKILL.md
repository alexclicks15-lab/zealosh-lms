---
name: systematic-debugging
description: >-
  Systematic root-cause debugging and troubleshooting runbook for Antigravity.
  Use this skill when encountering errors, test failures, unhandled exceptions,
  API regressions, memory leaks, or unexpected system behavior.
---

# Systematic Debugging Runbook

This skill provides a scientific, evidence-based methodology for isolating, diagnosing, and permanently resolving bugs without introducing regressions.

---

## 1. The 5-Phase Debugging Cycle

```
[ BUG OBSERVED ]
       │
       ▼
PHASE 1: REPRODUCE & ISOLATE (Create minimal reproduction / inspect logs)
       │
       ▼
PHASE 2: TRACE THE DATA FLOW (Track input -> transformations -> output)
       │
       ▼
PHASE 3: FORMULATE & TEST HYPOTHESES (Identify root cause, not symptom)
       │
       ▼
PHASE 4: TARGETED FIX (Apply minimal, surgical fix adhering to invariants)
       │
       ▼
PHASE 5: REGRESSION & EDGE CASE VERIFICATION (Automated test + browser validation)
```

---

## 2. Phase-by-Phase Instructions

### Phase 1: Reproduce & Isolate
1. **Gather Evidence**: Collect exact stack traces, browser console errors, HTTP status codes, network payloads, and environment variables.
2. **Deterministic Reproduction**: Recreate the exact conditions (user session, route, payload, viewport).
3. **Isolate Scope**: Determine if the issue is in Frontend (Client/RSC), Backend (API/Service), Database (Query/Lock), or Infrastructure (Network/CORS).

### Phase 2: Trace Data Flow
1. **Entry Point**: Inspect where the request starts (e.g., button click, API route handler, webhook trigger).
2. **Transformations**: Follow data through validation schemas (e.g., Zod), business logic layers, and ORM/database queries.
3. **State Transitions**: Check React component state, server cache, session store, or database state.

### Phase 3: Formulate & Test Hypotheses
- **Root Cause vs Symptom**: Never apply cosmetic patches (e.g., adding `try/catch` with empty handler or arbitrary optional chaining `?.` without understanding undefined state).
- **Hypothesis Testing**: Modify one variable at a time or add temporary structured logging. Confirm or reject each hypothesis with hard data.

### Phase 4: Targeted Surgical Fix
- Make the fix minimal, clear, and robust.
- Maintain existing architecture patterns and TypeScript type invariants.
- Ensure proper error propagation, user-friendly fallback UI, and structured error logs.

### Phase 5: Regression & Edge Case Verification
- Write an automated unit test or Playwright E2E test covering the broken path and edge cases (e.g., `null`, empty arrays, network timeouts, concurrent requests).
- Verify related modules still pass all existing test suites.

---

## 3. Common Problem Profiles & Solutions

### A. Next.js / React Hydration Errors
- **Cause**: Server-rendered HTML mismatching initial client render (e.g., `localStorage`, `Date.now()`, `window.innerWidth` evaluated in SSR).
- **Fix**: Move client-only state into `useEffect`, use dynamic imports with `{ ssr: false }`, or ensure deterministic server/client defaults.

### B. Database Connection & Concurrency Deadlocks
- **Cause**: Unordered multi-row updates or long-running transactions holding row locks.
- **Fix**: Order locks consistently across transactions, use `SELECT ... FOR UPDATE SKIP LOCKED` for queues, and set statement timeouts.

### C. Authentication & Token Expiry Regressions
- **Cause**: Expired JWT tokens not refreshed, missing `HttpOnly` cookie forwarding on SSR fetch, or CORS credential mismatch.
- **Fix**: Inspect cookie headers on RSC requests, ensure token refresh middleware handles 401 gracefully, and verify `credentials: 'include'`.
