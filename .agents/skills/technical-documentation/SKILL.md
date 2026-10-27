---
name: technical-documentation
description: >-
  Technical documentation, API specification, architectural guides, and changelog management.
  Use this skill when creating high-signal developer documentation, architecture summaries,
  API references, runbooks, or evidence-based completion reports.
---

# Technical Documentation & Evidence Runbook

This skill outlines guidelines for writing accurate, high-density, actionable documentation and generating empirical evidence reports for engineering teams.

---

## 1. Documentation Taxonomy

1. **Architecture & Design Docs**: System overview, component interactions, database schemas, ADRs.
2. **API References**: Endpoint routes, request schemas, response codes, error formats, and curl examples.
3. **Operational Runbooks**: Setup guides, migration steps, disaster recovery, troubleshooting checklists.
4. **Evidence-Based Completion Reports**: Concrete proof of implementation, testing logs, and diffs.

---

## 2. Evidence-Based Completion Report Format

Every completed engineering task must provide hard empirical evidence rather than vague assertions. Use this standard structure:

```markdown
# [Feature / Fix Name] — Engineering Completion Report

## 1. Executive Summary
Brief summary of problem solved and business/technical outcome.

## 2. Files Modified & Created
- `[file-path]` (lines X-Y): What was changed and why.

## 3. Technical Implementation Details
- Key functions, state changes, schema updates, or API routes added.

## 4. Empirical Verification Evidence
### A. Build & Typecheck
- Output of `npm run build` / `tsc --noEmit`
### B. Test Execution
- Output of automated test suites / Playwright test passes.
### C. Browser / Runtime Evidence
- Screenshots, HTTP status codes, console error audits.

## 5. Technical Debt & Non-Blocking Observations
- Any noted edge cases or future scale considerations tracked with identifier (e.g. TD-101).
```

---

## 3. API Documentation Standard

Document every API endpoint with:
- **HTTP Method & Path**: e.g., `POST /api/v1/orders`
- **Authentication**: `Bearer <JWT>` or `Session Cookie` + RBAC permission.
- **Request Body**: Valid JSON schema with field requirements.
- **Response Format**: `200 OK`, `400 Bad Request`, `401 Unauthorized`, `500 Internal Error`.
