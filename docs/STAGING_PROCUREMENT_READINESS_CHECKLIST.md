# Zealosh LMS — Staging Infrastructure Procurement Readiness Checklist & Gate Register

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-09 — Stage A: Staging Infrastructure Architecture, Technical Readiness & Procurement Planning  
**Target Environment:** Three-Node Production Staging Architecture v3.1  
**Status Taxonomy:** `COMPLETE` | `INCOMPLETE` | `AWAITING OWNER DECISION` | `EXTERNALLY DEPENDENT` | `NOT APPLICABLE`  
**Date:** November 2026  
**Procurement Status:** **FROZEN PENDING FORMAL STAKEHOLDER SIGN-OFF**

---

## 1. Executive Summary & Gating Protocol

This document serves as the binding institutional gating checklist for **Zealosh Training & Consultants**. No cloud accounts may be created, credit cards charged, servers provisioned, or DNS records modified until every prerequisite designated as `AWAITING OWNER DECISION` has received formal, written authorization from the institutional authority.

---

## 2. Comprehensive Procurement Readiness Checklist

| Prerequisite ID | Infrastructure Requirement / Domain | Evaluation Scope & Artifact Anchor | Current Status | Responsible Party & Required Action |
| :---: | :--- | :--- | :---: | :--- |
| **PR-01** | **Approved Hosting Provider Selection** | Server 1 (Contabo/Hetzner) & Server 2 (OVHcloud Rise-1 / Contabo VDS M) evaluated in `docs/SERVER_SPECIFICATION_AND_VENDOR_COMPARISON.md`. | **AWAITING OWNER DECISION** | Executive Sponsor to select primary provider (OVHcloud vs Contabo). |
| **PR-02** | **Approved Server Hardware Specifications** | Server 1 (4 vCPU, 8GB RAM), Server 2 (6C/12T Bare Metal, 32GB ECC RAM) fully specified. | **AWAITING OWNER DECISION** | Stakeholder sign-off on recommended specifications. |
| **PR-03** | **Approved Recurring Budget Ceiling** | Itemized monthly recurring cost model (~₹11,848/mo TCO) with Server 2 at ~₹6,195/mo (38% under ₹10k ceiling). | **AWAITING OWNER DECISION** | Executive sign-off on monthly operating budget. |
| **PR-04** | **Approved Datacenter Location** | Evaluated Mumbai, India (OVHcloud / Contabo) vs. European hubs (Gravelines / Falkenstein). | **AWAITING OWNER DECISION** | Institutional decision on data residency (Mumbai strongly recommended). |
| **PR-05** | **Approved Database Environment** | Dedicated Supabase Pro project (`zealosh-staging-core`, $25/mo) with isolated credentials and connection pooler. | **AWAITING OWNER DECISION** | Authorization to create dedicated staging Supabase project. |
| **PR-06** | **Approved Object Storage Provider** | Cloudflare R2 bucket (`zealosh-staging-storage`) evaluated with $0.00 egress and S3 compatibility. | **AWAITING OWNER DECISION** | Authorization to create Cloudflare account and R2 bucket. |
| **PR-07** | **Approved Domain & Subdomain Structure**| FQDNs defined: `app.staging.zealosh.com`, `vc.staging.zealosh.com`, `turn.staging.zealosh.com`, `storage.staging.zealosh.com`. | **AWAITING OWNER DECISION** | Approval of staging subdomain naming convention. |
| **PR-08** | **Approved DNS Execution Plan** | DNS Change Plan prepared in `docs/NETWORK_AND_DNS_DESIGN.md` with record types, TTLs, and rollback steps. | **COMPLETE** | Technical plan ready for execution after server IP assignment. |
| **PR-09** | **Security Design & Threat Model Sign-Off**| 21-point threat model, STRIDE analysis, CSP, and synthetic test data policy prepared in `docs/STAGING_SECURITY_THREAT_MODEL.md`. | **COMPLETE** | Technical security architecture finalized. |
| **PR-10** | **Backup & Disaster Recovery Sign-Off** | 4-tier backup architecture and restoration runbooks documented in `docs/BACKUP_AND_DISASTER_RECOVERY_DESIGN.md`. | **COMPLETE** | RTO (<30m) and RPO (<1h) targets defined and locally proven. |
| **PR-11** | **Payment Gateway Staging Policy** | Provider-neutral checkout implemented; test webhook verification active; staging operates with synthetic credentials. | **AWAITING OWNER DECISION** | Decision on primary commercial payment gateway (Razorpay vs Stripe). |
| **PR-12** | **Classroom Provider Configuration** | Automated BBB installer script (`deploy/bbb-staging-setup.sh`) and HMAC recording webhook receiver ready. | **COMPLETE** | Automated scripts packaged and validated. |
| **PR-13** | **AI Tutoring Hosting Decision** | Three options compared: Dedicated Server 3 (~₹1,947/mo) vs Managed Gemini API (~₹495/mo) vs Rule Heuristics (₹0/mo). | **AWAITING OWNER DECISION** | Stakeholder decision on AI hosting strategy for staging. |
| **PR-14** | **Environment Variable Inventory** | Master environment variable matrix prepared in `docs/infrastructure/ZEALOSH_SECRETS_MANAGEMENT_MATRIX.md`. | **COMPLETE** | Variable schemas and default staging values inventoried. |
| **PR-15** | **Secret-Management Plan** | Mode `0600` filesystem isolation, zero-secret Git rules, and key rotation lifecycles documented. | **COMPLETE** | Key management policy established. |
| **PR-16** | **Monitoring & Observability Plan** | Standardized `/api/health` and `/api/admin/diagnostics/*` endpoints implemented with bounded 3s timeouts. | **COMPLETE** | In-app health diagnostics verified. |
| **PR-17** | **Deployment Runbook Finalization** | End-to-end artifact packaging and release pipeline documented in `docs/STAGING_DEPLOYMENT_AND_ROLLBACK_RUNBOOK.md`. | **COMPLETE** | Packaging scripts (`package-deployment-artifact.mjs`) tested. |
| **PR-18** | **Rollback Plan Finalization** | < 2-minute atomic symlink reversion and PM2 cluster reload procedure documented. | **COMPLETE** | Rapid rollback runbook certified. |
| **PR-19** | **Independent Penetration Testing RFP** | ASVS Level 2 RFP document prepared in `docs/infrastructure/ZEALOSH_PENETRATION_TESTING_RFP.md`. | **COMPLETE** | Ready for vendor quotation release upon staging deployment. |
| **PR-20** | **Institutional Procurement Authorization**| Formal procurement sign-off package prepared in `docs/infrastructure/ZEALOSH_FINAL_STAGING_PROCUREMENT_APPROVAL.md`. | **AWAITING OWNER DECISION** | Awaiting formal executive signature. |

---

## 3. Outstanding Owner Decisions Summary (Action Required)

The following six decisions are currently pending executive stakeholder determination:

1. **Decision 1: Server 2 Bare-Metal Provider Selection**  
   - *Option A (Recommended):* **OVHcloud Rise-1 Bare Metal** (~₹6,195/mo, 6C/12T physical hardware, 32 GB ECC RAM, Mumbai DC).
   - *Option B (Alternate):* **Contabo Cloud VDS M** (~₹5,074/mo, 8 dedicated AMD vCPUs, 32 GB RAM).
2. **Decision 2: Server 1 Application Host Selection**  
   - *Option A (Recommended):* **Contabo Cloud VPS 2** (~₹601/mo, 4 vCPU, 8 GB RAM, 75 GB NVMe).
   - *Option B (Alternate):* **Hetzner Cloud CPX22** (~₹1,517/mo, 4 vCPU, 8 GB RAM, 80 GB NVMe).
3. **Decision 3: AI Tutoring Strategy for Staging**  
   - *Option A (Recommended):* **Managed Gemini 1.5 Flash API** (~₹495/mo pay-as-you-go, frontier quality, zero server overhead).
   - *Option B:* **Dedicated Contabo VPS 3** (~₹1,947/mo, self-hosted Ollama 3B models).
   - *Option C:* **Rule-Based Heuristic Fallback** (₹0/mo, already active in codebase).
4. **Decision 4: Staging Supabase Project Creation**  
   - Authorization to provision dedicated Supabase Pro project (`zealosh-staging-core`, $25/mo) in Mumbai or Frankfurt region.
5. **Decision 5: Cloudflare Account & Storage Setup**  
   - Authorization to add `zealosh.com` zone and provision Cloudflare R2 bucket (`zealosh-staging-storage`).
6. **Decision 6: Commercial Payment Gateway Selection**  
   - Preferred Indian payment gateway provider (Razorpay for domestic UPI/Netbanking vs Stripe for international cards).

---

## 4. Final Readiness Verdict

| Category | Score / Total | Percentage | Readiness Status |
| :--- | :---: | :---: | :---: |
| **Technical & Code Readiness** | 10 / 10 | 100% | **READY FOR DEPLOYMENT** |
| **Architectural Specifications** | 10 / 10 | 100% | **COMPLETE** |
| **Institutional & Owner Approvals**| 0 / 6 Decisions | 0% | **PENDING OWNER SIGN-OFF** |
| **Overall Procurement Readiness** | — | — | **HOLD — AWAITING STAKEHOLDER SIGN-OFF** |

> **Directive:**  
> All engineering preparation for Stage A is complete. The software cannot and will not proceed into live provisioning until the owner signs off on the outstanding decisions.

