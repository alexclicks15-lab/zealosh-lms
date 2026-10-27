# Architecture Decision Record (ADR)
## ADR-001: Self-Hosted Open-Source Adoption & Unified Zealosh Rebranding for LMS (Moodle) and Virtual Classroom (BigBlueButton)

**Document ID:** ADR-001  
**Status:** **ACCEPTED & ACTIVE**  
**Date:** October 26, 2026  
**Deciders:** Principal Software Architect, Senior Full-Stack Engineer, Product Architect  
**Supersedes:** ADR-000 (External Remote API Client / Integration Only Architecture)

---

## 1. Context & Problem Statement

Previously, Zealosh LMS was planned with an assumption that upstream learning engines (Moodle) and virtual conferencing systems (BigBlueButton) would be treated strictly as third-party external services accessed across the internet via REST APIs and SHA-1 webhook signatures.

However, treating these foundational capabilities as detached external third-party services introduces severe product, operational, and commercial liabilities:
1. **Brand Fragmentation:** Learners are exposed to external login screens, differing UI designs, and third-party software names rather than experiencing a unified **Zealosh Training & Consultants** platform.
2. **Operational Vulnerability & Data Sovereignty:** Dependency on hosted external instances risks unexpected API deprecations, licensing fees, latency spikes, and loss of governance over sensitive learner records and examination data.
3. **Unnecessary Duplication of Core Capabilities:** Features natively perfected by Moodle (SCORM packages, forum discussions, gradebook aggregation, submission rubrics) and BigBlueButton (WebRTC audio/video SFU, mediasoup clustering, multi-user whiteboard, breakout rooms) would otherwise require millions of dollars to rebuild from scratch in custom TypeScript.

**Core Question:** How can Zealosh LMS leverage the immense power of Moodle and BigBlueButton while delivering a 100% unified, self-hosted, rebranded, single-sign-on experience operated and controlled exclusively by Zealosh?

---

## 2. Decision

Zealosh will **adopt, self-host, customize, and rebrand** open-source Moodle Core and BigBlueButton Core into an integrated, self-operated platform topology:

1. **Zealosh Learning Engine (Moodle Core 4.4+ / 4.5 LTS):**
   - Self-hosted on containerized infrastructure (Docker / Kubernetes / Dedicated Linux VPS).
   - Custom theme: `theme_zealosh` extending `theme_boost`, applying official Zealosh design tokens (`#4f8c4c`, `#3a7536`, `#252c41`), custom header navigation linking seamlessly back to the Zealosh Hub, and suppressing upstream vendor branding.
   - Authoritative for deep course module navigation, SCORM packaging, structured homework assignments, and granular activity completion.

2. **Zealosh Live Classroom (BigBlueButton Core 2.7+ / 3.0):**
   - Self-hosted on dedicated Ubuntu 22.04 LTS media servers with WebRTC/mediasoup/FreeSWITCH audio-video bridges.
   - Branded overlay: Custom default slide deck (`Zealosh Executive Collaborative Whiteboard`), customized `settings.json`, Zealosh favicon, and custom CSS color schemes.
   - Authoritative for real-time video/audio conferencing, screen sharing, multi-user whiteboard sessions, breakout rooms, and session recording.

3. **Zealosh Core Hub & Portal (Next.js 14 App Router + TypeScript):**
   - Retained as the authoritative master portal, public storefront, course catalog, batch capacity governor, student dashboard, instructor management center, high-stakes BCSP/BCRSP mock examination engine, certificate verification registry, and Superadmin Control Center.
   - Acts as the central **OAuth2 / OpenID Connect (OIDC) Identity Provider** (`/api/oauth/*`) issuing JWT tokens that authenticate users automatically across both Next.js, Moodle, and BigBlueButton.

4. **Unified Domain & Reverse Proxy Routing:**
   - Single canonical domain (e.g. `lms.zealosh.com`) routed via high-performance Nginx edge proxy:
     - `/` and `/admin`, `/courses`, `/exams`, `/student`, `/instructor` → Next.js 14 Core Hub
     - `/learn-engine/` → Self-Hosted Zealosh Moodle Instance
     - `/classroom/` → Self-Hosted Zealosh BigBlueButton Cluster
     - `/verify/[code]` → Next.js Public Credential Verification Engine

---

## 3. Licensing, IP & Legal Isolation Strategy

| Upstream Software | Upstream License | Legal Boundary Strategy | Trademark & Attribution Compliance |
| :--- | :--- | :--- | :--- |
| **Moodle Core** | GNU General Public License v3.0 (GPLv3) | Isolated via independent process/network boundary (HTTP/TLS, OIDC). Custom plugins/themes (`theme_zealosh`) developed under GPLv3. Next.js proprietary portal and business code remain closed-source and unencumbered by copyleft. | All source code headers and required copyright notices preserved in `moodle/`. User-facing interface branded as **Zealosh Learning Engine**. No trademark infringement or false endorsement claimed. |
| **BigBlueButton** | GNU Lesser General Public License v3.0 (LGPLv3) | Client and server run as independent microservices. Custom UI branding applied via supported configuration files (`settings.json`, CSS overrides, SVG assets). | Copyright notices preserved in upstream source trees. User-facing room branded as **Zealosh Live Classroom**. |
| **Zealosh Core & UI** | Proprietary Commercial | Independent Next.js 14 codebase, internal ACID persistence engine, proprietary BCSP/BCRSP exam question bank and scoring engine. | Fully owned by Zealosh Training & Consultants. |

---

## 4. Consequences & Migration Roadmap

### Positive Impacts:
- **Zero Ongoing SaaS Seat Fees:** No per-user licensing fees to third-party LMS or video conferencing vendors.
- **Enterprise-Grade Capabilities from Day One:** Immediate access to SCORM, advanced gradebook formulas, WebRTC multi-party video, audio bridges, and high-fidelity session recording.
- **True Brand Consistency:** All surfaces reflect Zealosh colors, typography, logos, and domain names.
- **Data Sovereignty:** All student databases, exam attempts, and classroom recordings reside on Zealosh-controlled infrastructure.

### Operational Responsibilities:
- Linux server management (Ubuntu 22.04 LTS) for BigBlueButton media routing (requiring 8+ vCPU, 16GB+ RAM, 500GB+ SSD, 100Mbps+ unthrottled uplink).
- PHP 8.3 runtime and PostgreSQL 17 maintenance for self-hosted Moodle.
- Automated daily database backup and recording lifecycle retention policies.

---

## 5. Architectural Alignment & Next Steps

1. Update all primary documentation (`IMPLEMENTATION_ROADMAP.md`, `PROJECT_STATUS.md`, `ARCHITECTURE.md`, `INTEGRATION_MATRIX.md`, `DATA_OWNERSHIP.md`, `DEPLOYMENT_RUNBOOK.md`).
2. Provide local and production containerized manifests (`docker-compose.zealosh-platform.yml`) with full Moodle and reverse proxy integration.
3. Build the Zealosh Moodle theme asset package (`moodle-custom/theme_zealosh`).
4. Build the Zealosh BigBlueButton custom branding overlay (`bbb-custom/`).
5. Implement the central OAuth2/OIDC SSO authorization server endpoints (`/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/userinfo`) within Next.js.
6. Verify the entire solution through automated Vitest tests, Next.js build validation, and end-to-end browser testing.
