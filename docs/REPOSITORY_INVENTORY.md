# Zealosh LMS — Repository Inventory & Upstream Source Evaluation

**Document Version:** 2.0.0  
**Status:** Comprehensive Repository Inventory  
**Scope:** Application components, API routes, Superadmin modules, PWA assets, test suites, and upstream integration adapters.

---

## 1. Upstream Component Inventory

| Component Category | Target System | Official Upstream Repository | Evaluated Version | Upstream Integration Role & Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Learning Engine** | Moodle Core | [https://github.com/moodle/moodle](https://github.com/moodle/moodle) | 4.4.x / 4.5 LTS | Connected strictly via REST Web Service (`webservice/rest/server.php`) using token authentication. Built-in latency diagnostics and mock fallback. |
| **Live Classroom Infrastructure** | BigBlueButton | [https://github.com/bigbluebutton/bigbluebutton](https://github.com/bigbluebutton/bigbluebutton) | 2.7.x / 3.0 | Integrated via server-side SHA-1 checksum signed URLs. Meeting creation, join tokens, and status queries supported. |
| **Identity & Access Management** | Native Cryptographic Auth & RBAC | Internal TypeScript Engine | Strict mode | Argon2id/Bcrypt password hashing, JWT authorization, session verification, and granular permission checks. |
| **Progressive Web App (PWA)** | Service Worker & Web App Manifest | W3C Standard | v1 | Native `sw.js` with offline caching, `offline.html`, and `manifest.json`. Excludes high-stakes exam and auth endpoints. |

---

## 2. Implemented Route & API Inventory

### 2.1 Public & Application Surfaces
- `/`: Public landing page with HSE certification tracks, statistics, and faculty highlights.
- `/courses`: Interactive course catalog with delivery mode filters (ASP, CSP, CRSP, CIT, NEBOSH).
- `/courses/[slug]`: Course curriculum, downloadable materials, cohort schedules, and enrollment CTAs.
- `/student`: Student portal with active courses, progress bar, upcoming live sessions, and quick cards.
- `/instructor`: Instructor console with cohort batch rosters and live session management.
- `/exams`: HSE Mock Examination Center with BCSP blueprint descriptions and attempt launchers.
- `/exams/[examId]`: Live exam simulator with server-enforced timer, question navigation grid, and autosave.
- `/live/[sessionId]`: BigBlueButton live classroom interface with whiteboard, participant tiles, and chat.
- `/verify/[code]`: Public credential verification interface with verified/revoked badges.
- `/admin`: Superadmin Control Center with 14 management tabs.

### 2.2 Superadmin API Endpoints (`src/app/api/admin/`)
- `GET /api/admin/config`: Retrieves full platform configuration, feature flags, brand tokens, and metrics.
- `PUT /api/admin/config/settings`: Updates general platform configuration and records audit entry.
- `PUT /api/admin/config/branding`: Updates brand design tokens and records audit entry.
- `PUT /api/admin/config/features`: Updates 18 modular feature flags.
- `PUT /api/admin/config/navigation`: Updates navigation links, order, and role permissions.
- `POST / DELETE /api/admin/config/roles`: Role creation, permission assignment, and deletion (with system lockout guard).
- `POST /api/admin/config/rollback`: Restores previous configuration versions from audit history.
- `POST /api/admin/config/reset-brand`: Resets theme to official Zealosh brand tokens.
- `POST /api/admin/integrations/test`: Triggers real-time connection test and returns latency telemetry.
- `POST / DELETE /api/admin/courses`: Course creation, editing, and deletion.
- `POST / DELETE /api/admin/batches`: Cohort scheduling, instructor assignments, and capacity limits.
- `POST /api/admin/exams`: Exam blueprint creation and question bank management.
- `POST / DELETE /api/admin/workflows`: Event-driven automation rule builder.
- `POST /api/admin/templates`: In-app, email, and push notification templates.
- `POST /api/admin/certificates/revoke`: Revocation of issued certificates.

---

## 3. Test Suites Inventory (`tests/`)

| Test File | Test Suite Focus | Test Count | Status |
| :--- | :--- | :--- | :--- |
| `tests/auth.test.ts` | Bcrypt hashing, password verification, and JWT security | 3 | **PASS (100%)** |
| `tests/adapters.test.ts` | Moodle REST adapter & BigBlueButton SHA-1 client contracts | 6 | **PASS (100%)** |
| `tests/enrollment.test.ts` | Course enrollment, batch capacity limits, and concurrency guards | 4 | **PASS (100%)** |
| `tests/exam-engine.test.ts` | Timed exams, question scoring, autosave, and strict deadline enforcement | 4 | **PASS (100%)** |
| `tests/pwa-offline.test.ts` | Web app manifest validity, service worker security gates, and offline fallback | 3 | **PASS (100%)** |
| `tests/superadmin-config.test.ts` | Superadmin settings, branding reset, features, roles, rollback, and metrics | 7 | **PASS (100%)** |
| **Total Automated Tests** | | **27** | **PASS (100%)** |
