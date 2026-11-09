# Zealosh LMS — ZM-03 Deployment & Recovery Guide

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Two-Server Staging Architecture, Safe Migration Execution & Disaster Recovery  
**Authoritative Reference:** [deploy/package-deployment-artifact.mjs](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/deploy/package-deployment-artifact.mjs)

---

## 1. Staging Deployment Architecture

Zealosh LMS executes across two hardened staging environments:
- **Server 1 (`100.82.215.93`):** Core Next.js LMS, PostgreSQL database cluster, and Moodle 4.x background engine.
- **Server 2 (`100.125.122.86`):** BigBlueButton 2.7+ Live Classroom cluster and WebRTC media relays.

---

## 2. Deployment Procedure

1. **Pre-Deployment Gate:**
   - Run typecheck: `npx tsc --noEmit` (must exit 0).
   - Run test suite: `npx vitest run` (must pass 100%).
   - Verify build: `npm run build` (must compile clean across all 75 routes).
2. **Database Migration Execution:**
   - Execute forward-only migration:
     `psql -f supabase/migrations/20261031000011_zealosh_exam_and_commerce_phase3.sql`
   - Zero lock timeout risk; zero destructive schema changes.
3. **Artifact Packaging & Verification:**
   - Package artifact: `node deploy/package-deployment-artifact.mjs`.
   - Verify manifest and SHA-256 integrity: `node deploy/verify-deployment-artifact.mjs`.

---

## 3. Rollback & Disaster Recovery Protocol

If an unexpected production defect occurs post-activation:
1. **Application Rollback:** Point reverse proxy back to previous verified release symlink.
2. **Database Safety:** The migration `20261031000011` is non-destructive (only added columns with defaults or new tables). Existing Phase 1 and Phase 2 queries continue to execute without regression.
3. **Data Integrity:** `data/zealosh-store.json` snapshot remains intact (SHA-256 verified).

