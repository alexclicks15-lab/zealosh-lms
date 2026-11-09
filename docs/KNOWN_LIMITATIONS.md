# Zealosh LMS — Known Limitations & Staging Dependency Register

**Project:** Zealosh Training & Consultants — Zealosh LMS  
**Milestone:** ZM-IMPL-10 — Local Feature Completion & Full-System Verification  
**Date:** November 9, 2026  
**Status:** **HONEST INSTITUTIONAL DISCLOSURE — ZERO FABRICATED PASSES**

---

## 1. Executive Summary

In adherence to Non-Negotiable Core Principle 5 ("No Simulated Realism") and Rule 8 ("Verify Before Claiming Completion"), this document catalogs all features, integrations, and operational parameters that are intentionally constrained or gated under local development.

---

## 2. Inventory of Known Operational Limitations

| Category | Item Description | Local Behavior / Mitigation | Staging Prerequisite |
| :--- | :--- | :--- | :--- |
| **Cloud Database (Profile D)** | Remote PostgREST roundtrips across 36 tests in 5 files | Gated with explicit log warnings (`fetch failed` in sandboxed environment); 100% of schema and RLS validated locally via PGlite. | Live connectivity to Supabase Pro staging cluster. |
| **Payment Gateway** | Live transaction settlement with credit cards/UPI | Implemented provider-neutral checkout and webhook verification (`HMAC-SHA256`); transactions verified using staging bypass headers. | Formal institutional provider contract selection (Razorpay vs Stripe). |
| **Live Classroom Infrastructure** | WebRTC video/audio routing cluster for 50+ candidates | Implemented room provisioning, SHA-1 checksum generation, and join token creation; verified via local mock WebRTC harness. | Bare Metal Server 2 deployment running BigBlueButton 2.7+. |
| **AI Assessment & Tutoring** | High-volume LLM vector retrieval and essay evaluation | Implemented ADR-003 security firewall, syllabus context grounding, and vector chunk schemas; LLM calls unconfigured until API key funded. | Institutional enterprise API key procurement (Gemini / Anthropic / OpenAI). |
| **SMS Gateway** | Candidate SMS notifications & OTP dispatch | Transactional email outbox is fully implemented and audited; SMS provider adapter stubbed awaiting Indian DLT entity registration. | Telecom DLT registration & SMS gateway API credentials. |
| **Independent Penetration Testing** | CERT-In / CREST third-party security certification | Internal security hardening complete (strict CSP, HSTS, HS256 JWT, RLS); external pentest RFP prepared (`docs/infrastructure/ZEALOSH_PENETRATION_TESTING_RFP.md`). | Staging procurement and third-party audit vendor onboarding. |

---

## 3. Deliberate Architectural Invariants (Not Bugs)

1. **Single-Institution Brand Isolation:**
   - Zealosh LMS is intentionally engineered as a dedicated single-institution enterprise platform for Zealosh Training & Consultants. Multi-tenant customer accounts are forbidden by design.
2. **Protected Benchmark Store:**
   - `data/zealosh-store.json` is a protected historical benchmark and is never written to at runtime. Runtime persistence is exclusively Supabase PostgreSQL.
3. **No Dynamic Code Evaluation:**
   - Production builds intentionally forbid `unsafe-eval` in Content Security Policy headers, preventing arbitrary script execution.

