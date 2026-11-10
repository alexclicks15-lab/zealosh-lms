# Zealosh LMS — Staging Infrastructure Discovery & Technical Inventory Register

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-09 — Stage A: Staging Infrastructure Architecture, Technical Readiness & Procurement Planning  
**Authoritative Institution:** Zealosh Training & Consultants, Kollam, Kerala, India  
**Date:** November 2026  
**Status:** **DISCOVERY COMPLETE — READY FOR ARCHITECTURAL SYNTHESIS — CHARGES FROZEN**

---

## 1. Executive Summary

This document establishes the empirical technical baseline of the **Zealosh LMS** repository and infrastructure surface prior to any staging server procurement or provisioning. In adherence to Principle 6 ("Inspect Before Implementing") and Principle 5 ("No Simulated Realism"), this inventory analyzes actual repository code, configuration artifacts, database models, and historical design specifications to distinguish:

1. What has already been designed.
2. What has actually been implemented in executable code.
3. What has only been validated in local/isolated test harnesses.
4. What requires real cloud staging verification.
5. What external credentials and institutional vendor accounts are pending.
6. What decisions require executive stakeholder authorization.
7. What infrastructure components are genuinely required for staging vs deferred for production.

---

## 2. Technical Baseline & Local Verification State

The local software development phase of Zealosh LMS concluded under milestone **ZM-IMPL-11** with the following empirically verified status:

| Verification Gate | Command Executed | Empirical Result | Architecture Implication |
| :--- | :--- | :--- | :--- |
| **TypeScript Typecheck** | `npx tsc --noEmit` | **0 errors**, clean exit code 0 | Complete type safety; zero unresolved imports or broken contracts. |
| **Production Build Pipeline** | `npm run build` | **175 compiled routes** (static + dynamic App Router) | Complete standalone Next.js 14 production bundle ready for Node.js 20 LTS runtime. |
| **Vitest Regression Suite** | `npx vitest run` | **106 / 106 test files passed**, **1,008 / 1,008 tests green** (256.32s) | All unit, domain, API route, and simulated PostgreSQL tests passing. |
| **Playwright Real-Browser E2E** | `npx playwright test` | **14 / 14 spec files passed**, **72 / 72 tests green** (1.5m, Google Chrome) | All 6 institutional UAT journeys verified against compiled Next.js build on local port 3022. |
| **Disaster Recovery Schema Replay** | `tests/disaster-recovery-local-restore.test.ts` | **29 migrations replayed in 1.38s**, 145 canonical tables | Full cold-start schema restoration verified; 100% of tables enforce Row-Level Security (RLS). |
| **Protected Store Hash Integrity** | `Get-FileHash data/zealosh-store.json` | 45,005 bytes, SHA-256: `F1CB59D0B3FC129548763266B8A1993300D76EB842070657B7719F5F21B3FB10` | Historical store remains strictly unchanged byte-for-byte; zero runtime dependency. |

> [!IMPORTANT]
> **Cloud Egress Distinction (Profile D Tests):**  
> In local test execution, tests in `tests/supabase-persistence.test.ts` and `tests/supabase-coursework-live.test.ts` gracefully skip live external network roundtrips via `isSupabaseOnline` preflight checks. **Local 100% test pass does NOT constitute remote cloud database verification.** Validating real remote PostgREST queries, connection pooling under concurrency, and live latency is a primary objective of the staging environment.

---

## 3. Subsystem Implementation & Readiness Inventory

The repository was systematically audited across 10 functional modules to assess their code presence, adapter maturity, and staging dependencies:

### 3.1 Primary LMS Web Application (Next.js 14 App Router)
- **Code Presence:** `src/app/` (175 routes: 112 API route handlers, 63 user-facing pages).
- **Execution Engine:** Node.js 20 LTS, Next.js 14.2.15, React Server Components (RSC), standalone server bundle.
- **Process Supervision:** Tested with PM2 cluster mode configuration (`deploy/ecosystem.config.js`).
- **Reverse Proxy Requirement:** Requires front-facing Nginx reverse proxy with TLS termination, HTTP/2, WebSocket upgrade headers, and gzip/brotli compression.
- **Current State:** Fully implemented and locally verified.
- **Staging Dependency:** Requires Server 1 (LMS Core Host) with Node.js 20 LTS, Nginx, and PM2.

### 3.2 Authoritative Database (Supabase PostgreSQL)
- **Code Presence:** `src/lib/supabase.ts`, `src/lib/store/supabase-adapter.ts`, `supabase/migrations/` (29 chronological migrations).
- **Architecture:** Pure PostgreSQL 15+ hosted on Supabase Cloud. Authoritative for all 145 canonical tables (Users, Batches, Courses, Enrollments, Invoices, Certificates, Exams, Messaging, Audit Logs).
- **Local State:** Tested locally via embedded WASM PGlite (`tests/disaster-recovery-local-restore.test.ts`) and mock admin client.
- **Current State:** Implemented, schema finalized, 100% RLS policies written.
- **Staging Dependency:** Requires dedicated, isolated Supabase Staging Project (`zealosh-staging-core`) with Pro Plan tier ($25/mo) for automated backups and connection pooling via Supavisor (Port 5432 / 6543).

### 3.3 Live Video Conferencing & Classroom (Zealosh VC / BigBlueButton)
- **Code Presence:** `src/lib/adapters/bbb-adapter.ts`, `src/lib/classroom/classroom-provider.ts`, `src/app/api/webhooks/bbb/recording/route.ts`.
- **Integration Protocol:** BigBlueButton REST API with SHA-1 checksum query parameters; post-publish webhook recording processing with HMAC-SHA256 signature verification.
- **Local State:** Runs in mock mode when `BBB_MODE=mock` or when unconfigured. Room provisioning and token generation tested locally.
- **Current State:** Full adapter implemented with error handling, session window validation, and token signing.
- **Staging Dependency:** Requires dedicated physical or high-performance compute node (Server 2: OVHcloud Rise-1 Bare Metal or Contabo Cloud VDS M) running Ubuntu 24.04 LTS and BigBlueButton 2.7+ / 4.0 stack with dedicated public IPv4 and UDP ports 16384–32768 open.

### 3.4 AI Inference & RAG Tutoring (Zealosh AI)
- **Code Presence:** `src/lib/ai/ai-provider-adapter.ts`, `src/lib/ai/rag-pipeline.ts`, `src/lib/diagnostics/health-checker.ts`.
- **Integration Protocol:** HTTP REST client to Ollama daemon (`http://10.0.0.3:11434/api/generate` and `/api/tags`).
- **Local State:** Reports `UNCONFIGURED` status gracefully when `OLLAMA_BASE_URL` is omitted. AI tutoring falls back to deterministic curriculum heuristics.
- **Current State:** Adapter and prompt-grounding engine implemented.
- **Staging Dependency:** Architecture choice between Server 3 (private dedicated VPS running Ollama) vs. hosted cloud API (e.g. Gemini API / Anthropic API) vs. initial staging deferral.

### 3.5 Object & Media Storage (Encrypted S3 Abstraction)
- **Code Presence:** `src/lib/storage/s3-storage-client.ts`, `src/lib/storage/recording-storage.ts`, `src/app/api/storage/*`.
- **Integration Protocol:** AWS S3 SDK v3 protocol; supports AWS S3, Cloudflare R2, MinIO, and Supabase Storage. Supports presigned upload/download URLs and HMAC verification.
- **Local State:** In-memory / mock storage provider active in development.
- **Current State:** Generic client implemented with bucket routing, MIME-type validation, and time-limited URL generation.
- **Staging Dependency:** Provisioning of an S3-compatible bucket (Cloudflare R2 strongly recommended due to $0.00 egress charges).

### 3.6 Background Workers & Event Outbox
- **Code Presence:** `src/lib/email/email-dispatch-worker.ts`, `src/lib/events/domain-registry.ts`, `src/lib/maintenance/maintenance-service.ts`.
- **Integration Protocol:** Transactional outbox pattern using PostgreSQL table `event_outbox` with AES-256-GCM payload encryption and exponential backoff retry.
- **Local State:** Verified in Vitest suites (`tests/event-outbox-synchronization.test.ts`, `tests/transactional-email-outbox.test.ts`).
- **Current State:** Worker loop implemented with concurrency lock to prevent duplicate delivery.
- **Staging Dependency:** Process supervisor (PM2) on Server 1 to run the background worker as an isolated support thread.

### 3.7 Transactional Email & Messaging
- **Code Presence:** `src/lib/email/provider-adapter.ts`, `src/app/api/webhooks/whatsapp/route.ts`, `src/lib/adapters/whatsapp-adapter.ts`.
- **Integration Protocol:** Resend / AWS SES / SMTP for transactional email; WhatsApp Cloud API for admissions and class alerts.
- **Local State:** Email adapter reports `UNCONFIGURED` safely; emails accumulate in `email_outbox` table without throwing runtime exceptions.
- **Current State:** Adapter interfaces implemented.
- **Staging Dependency:** Staging email provider credentials (e.g., Resend free tier or AWS SES sandbox) and WhatsApp test credentials.

### 3.8 Observability, Diagnostics & Health Checks
- **Code Presence:** `src/lib/diagnostics/health-checker.ts`, `src/app/api/admin/diagnostics/*`, `src/app/api/health/route.ts`.
- **Integration Protocol:** Standardized JSON health responses with bounded 3000ms timeouts across Supabase, Moodle, BigBlueButton, Ollama, and Email.
- **Local State:** Endpoint returns HTTP 200 with honest service status badges (`HEALTHY`, `DEGRADED`, `UNCONFIGURED`).
- **Current State:** Fully implemented.
- **Staging Dependency:** Integration with uptime monitoring (e.g., UptimeRobot or BetterStack).

---

## 4. Master Infrastructure Discovery Register

| Component | Source Document / Code Reference | Planned Decision | Current Implementation State | Remaining Action Before Live Staging |
| :--- | :--- | :--- | :--- | :--- |
| **LMS Application Host** | `deploy/package-deployment-artifact.mjs`<br>`docs/infrastructure/ZEALOSH_STAGING_PROCUREMENT_BOM.md` | Single Ubuntu 24.04 VM (Hetzner CPX31 or Contabo VPS 2) running Next.js 14 via PM2 and Nginx. | Fully implemented; artifact packaging and verification scripts exist and pass. | Awaiting stakeholder server procurement approval and provisioning. |
| **Media Server (VC Node)** | `deploy/bbb-staging-setup.sh`<br>`docs/infrastructure/ZEALOSH_FINAL_STAGING_PROCUREMENT_APPROVAL.md` | Dedicated Bare Metal (OVHcloud Rise-1) in Mumbai DC running BigBlueButton 2.7+/4.0. Budget ceiling < ₹10,000/mo. | Automated setup script `bbb-staging-setup.sh` written; webhook receiver implemented in `src/app/api/webhooks/bbb/`. | Awaiting bare metal procurement approval, KYC completion, and server ordering. |
| **AI Inference Node** | `src/lib/ai/ai-provider-adapter.ts`<br>`docs/infrastructure/ZEALOSH_STAGING_PROVISIONING_RUNBOOKS.md` | Dedicated Private VPS (Contabo Cloud VPS 3) running Ollama on private network `10.0.0.3:11434`. | Client adapter and health checks implemented; honest unconfigured fallback active. | Stakeholder decision: Dedicated VPS vs. Cloud Model API vs. Stage A deferral. |
| **Authoritative Database** | `src/lib/supabase.ts`<br>`supabase/migrations/` (29 files) | Dedicated Supabase Staging Project (`zealosh-staging-core`) on Pro Plan ($25/mo). | 29 migrations verified; 145 canonical tables with 100% RLS; database durability tests active. | Stakeholder creation of separate staging Supabase project and execution of migrations. |
| **Object Storage** | `src/lib/storage/s3-storage-client.ts` | Cloudflare R2 bucket (`zealosh-staging-storage`) with $0.00 egress fee and S3 API compatibility. | S3 SDK client implemented; presigned URLs and chapter highlight storage ready. | Cloudflare account setup and R2 bucket creation with access key generation. |
| **Edge CDN & DNS** | `docs/infrastructure/ZEALOSH_STAGING_PROCUREMENT_BOM.md` | Cloudflare Anycast DNS with Orange Cloud proxy for Web, Grey Cloud for WebRTC TURN. | Nginx reverse proxy templates prepared (`deploy/nginx/nginx.staging.conf`). | Stakeholder purchase/delegation of `zealosh.com` and creation of staging DNS records. |
| **Security & Pentest** | `docs/infrastructure/ZEALOSH_PENETRATION_TESTING_RFP.md` | Independent CERT-In / CREST accredited penetration test prior to production promotion. | ASVS Level 2 RFP document prepared; internal security hardening (CSP, HSTS) complete. | Release RFP to vendors for quotation after staging environment is live. |

---

## 5. Staging vs Production Scope Boundary

To prevent wasteful expenditure and excessive operational complexity during the staging milestone, the following scope boundaries are strictly established:

| Infrastructure Item | Staging Requirement | Production Requirement | Justification |
| :--- | :--- | :--- | :--- |
| **LMS Core Server** | 1x Cloud VPS (4 vCPU, 8 GB RAM) | 2x Clustered VMs with Load Balancer | Single node is sufficient for 25–50 concurrent UAT testers; high availability deferred to production. |
| **Media Server (VC)** | 1x Dedicated Server (Rise-1 or VDS M) | 1x Dedicated Bare Metal + Failover STUN | Real WebRTC requires dedicated compute even in staging to test 20–30 video streams without stutter. |
| **Database** | 1x Supabase Pro Project (Staging) | 1x Supabase Pro/Team Project (Production) | Complete environment isolation; zero data sharing between staging and production. |
| **AI Inference** | Deferred or Minimal VPS / API | Dedicated High-RAM GPU/CPU Node | AI tutoring features can be tested with light local models or external API keys without expensive infrastructure. |
| **Object Storage** | 1x Cloudflare R2 Bucket (50 GB) | 1x Cloudflare R2 Bucket (Multi-TB) | Free tier covers first 10 GB; negligible staging storage cost ($0 egress). |
| **Penetration Testing** | RFP Quotation & Readiness | Formal Execution & Remediation | Testing is performed on the live staging target before production launch. |

---

## 6. Conclusion & Discovery Sign-Off

The Zealosh LMS codebase is completely developed, verified, and packageable for deployment. No architectural rewrites or code modifications are required before staging provisioning. The remaining prerequisites are purely institutional, financial, and infrastructural:
1. Executive approval of the infrastructure bill of materials (BOM).
2. Selection of the primary server hosting providers.
3. Creation of isolated staging vendor accounts (Supabase, Cloudflare, OVHcloud/Contabo).
4. Execution of the procurement plan under authorized supervision.

