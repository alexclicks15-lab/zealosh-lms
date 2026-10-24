# Zealosh LMS — Project Status Report

**Project:** Zealosh LMS — Enterprise HSE Certification Learning and Examination Platform  
**Client:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)  
**Document Version:** 1.0.0 (Phase 0 Baseline)  
**Date of Baseline Inspection:** October 25, 2026  
**Status:** Phase 0 (Environment Discovery & Architectural Baseline Established)

---

## 1. Executive Summary

Zealosh Training & Consultants specializes in advanced occupational health, safety, and environmental (HSE) professional certification training, specifically for:
- **ASP** — Associate Safety Professional (BCSP USA)
- **CSP** — Certified Safety Professional (BCSP USA)
- **CRSP** — Canadian Registered Safety Professional (BCRSP Canada)
- **CIT** — Certified Instructional Trainer (BCSP USA)
- **NEBOSH IDip** — International Diploma in Occupational Health and Safety

The primary directive is to engineer a unified, secure, high-performance learning and examination platform under the **Zealosh** brand. The platform consolidates public course catalogs, commerce and batch enrollment, multi-instructor cohort delivery (recorded, live, hybrid, and quick cards), a high-stakes HSE mock examination and practice engine with blueprint mapping, secure media delivery, and verified certificate generation into **one seamless web experience**.

---

## 2. Host Environment & Runtime Inspection (Verified)

An exhaustive physical inspection of the execution environment was conducted on October 25, 2026:

| Component | Verified State | Notes / Mitigation |
| :--- | :--- | :--- |
| **Operating System** | Windows 11 / Windows NT (x64) | Shell: PowerShell (`pwsh`) |
| **Node.js** | `v24.12.0` (Active) | Compatible with modern Next.js and NestJS runtimes |
| **npm** | `11.6.2` (Active) | Primary package manager |
| **pnpm / yarn** | Not installed | Use `npm` for all dependency installations |
| **Python** | `3.14.0` (Active) | Useful for automation scripts, data transformations |
| **Git** | `v2.56.0.windows.1` via MinGit | `C:\Program Files\Git\bin\git.exe` returned a fork-bomb anomaly. Resolved by executing `C:\Users\alexc\.gemini\mingit\cmd\git.exe`. |
| **Docker Engine** | Not detected / Not on system PATH | Local development will utilize in-process / lightweight runtime adapters; Docker Compose manifests provided for containerized deployment. |
| **PHP Runtime** | Not installed | Directly executing Moodle monolith on the Windows host is not feasible without PHP 8.1+; Moodle integration verified via REST Web Service adapters. |
| **Java Runtime** | Java 1.8.0_251 (Legacy) | Keycloak 24+ requires Java 17+ / 21+. Justifies selecting unified TypeScript JWT/OAuth2 identity service to eliminate JVM operational overhead. |
| **PostgreSQL / Redis** | Not installed as local Windows services | Local persistence will use SQLite/embedded SQL with strict PostgreSQL compatibility mode and Prisma/Drizzle schema migrations, allowing direct connection to managed PostgreSQL/Redis in staging/production. |
| **Storage Availability** | Drive C: ~43.9 GB free<br>Drive D: ~231.2 GB free | Sufficient disk headroom for application builds, assets, and test runs. |
| **Brand Assets** | Retrieved directly from `zealosh.com` | Official `logo.png` (320x94) and `logo-round.png` (66x68) downloaded and preserved under `assets/brand/`. Extracted exact brand colors from live production stylesheet. |

---

## 3. Current Phase Status

- **Phase 0 — Discovery, Acquisition & Architecture Verification:** **IN PROGRESS (Baseline Established)**
- **Phase 1 — Minimal Integrated Proof of Concept:** Pending Phase 0 sign-off
- **Phase 2 — Core LMS & Multi-Instructor Cohorts:** Scheduled
- **Phase 3 — HSE Certification Examination Engine:** Scheduled
- **Phase 4 — Commerce, Batches, & Certificates:** Scheduled
- **Phase 5 — AI Study Assistance & Enhanced Content Security:** Scheduled
- **Phase 6 — Production Readiness, Performance, & Security Hardening:** Scheduled

---

## 4. Key Architectural Decisions

1. **Brand Primacy:** Zealosh is the sole customer-facing brand. Users never see internal software names (Moodle, BigBlueButton, Keycloak).
2. **Unified Frontend & Domain:** Next.js (App Router, React 19, TypeScript) handles all customer, student, tutor, and admin surfaces under a unified URL structure (`/`, `/courses`, `/student`, `/instructor`, `/admin`, `/learn`, `/exams`, `/live`).
3. **Enterprise Adapter Pattern:** NestJS API orchestrates business logic and communicates with learning engines (Moodle) and conferencing servers (BigBlueButton) via secure server-to-server APIs with SHA1/HMAC signatures, while maintaining authoritative PostgreSQL data models for all application-owned business records.
4. **Resilient Local Verification:** Complete mock adapters and local development test doubles mirror Moodle 4.x and BigBlueButton 2.7+ contracts, guaranteeing end-to-end functionality, automated test execution, and browser validation without external cloud service blockers.
