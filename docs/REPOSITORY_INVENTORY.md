# Zealosh LMS — Repository Inventory & Upstream Source Evaluation

**Document Version:** 1.0.0  
**Status:** Verified Evaluation Baseline  
**Scope:** Upstream learning engines, live classroom infrastructure, identity and access management, and video playback components.

---

## 1. Upstream Component Inventory

| Component Category | Target System | Official Upstream Repository | Evaluated Version | License | Upstream Integration Role & Strategy |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Learning Engine** | Moodle Core | [https://github.com/moodle/moodle](https://github.com/moodle/moodle) | 4.4.x / 4.5 LTS | GNU GPLv3 | Authoritative for granular learning activities, SCORM compliance, and learning progression tracks. Connected strictly via `webservice/rest/server.php` using token-authenticated REST calls. No direct database access or code modification. |
| **Live Classroom Infrastructure** | BigBlueButton | [https://github.com/bigbluebutton/bigbluebutton](https://github.com/bigbluebutton/bigbluebutton) | 2.7.x / 3.0 | GNU LGPLv3 | Authoritative for WebRTC video conferencing, audio bridge, multi-user whiteboard, breakout rooms, and session recording. Integrated strictly via server-side REST API with SHA-1 signature validation. Secrets kept exclusively on backend. |
| **Identity & Access Management** | Keycloak *(Evaluated)* vs Native JWT/OIDC Service | [https://github.com/keycloak/keycloak](https://github.com/keycloak/keycloak) | 25.x | Apache 2.0 | **Evaluation Verdict:** Keycloak requires Java 17/21 Quarkus container with ~1.5GB RAM baseline. To maintain high agility, sub-millisecond session validation, and zero-JVM overhead, Zealosh LMS implements a high-security NestJS Auth module (Argon2id/Bcrypt, RS256 JWT, refresh token rotation, and MFA) with OIDC/OAuth2 federation support for Moodle SSO. |
| **Video Playback & DRM** | Shaka Player | [https://github.com/shaka-project/shaka-player](https://github.com/shaka-project/shaka-player) | v4.8+ / v4.9+ | Apache 2.0 | Client-side adaptive bitrate streaming (HLS/DASH), dynamic watermark injection, expiring token validation, and multi-resolution playback controls. Integrated directly as an npm dependency (`shaka-player`). |

---

## 2. Upstream Source Analysis & Compatibility

### 2.1 Moodle (`moodle/moodle`)
- **Technology Stack:** PHP 8.1+, PostgreSQL / MariaDB / MySQL.
- **Repository Size:** ~1.4 GB (large legacy codebase).
- **Licensing Compliance:** GPLv3 dictates that any software that links directly to Moodle internals becomes subject to GPL. By isolating Moodle behind an independent network boundary and interacting solely over HTTP REST Web Services, Zealosh LMS frontend and proprietary NestJS backend remain completely unencumbered by copyleft constraints.
- **API Surface:**
  - `core_course_get_courses_by_field`
  - `core_enrol_get_enrolled_users`
  - `enrol_manual_enrol_users`
  - `gradereport_user_get_grade_items`
  - `mod_assign_get_submissions`
- **Deployment Model:** Containerized in production via `docker-compose.prod.yml` or deployed on a dedicated Linux VPS with PHP-FPM and PostgreSQL. For local Windows development without PHP installed, the application utilizes a contract-compliant mock adapter (`MoodleClientMockAdapter`) that implements identical request/response schemas.

### 2.2 BigBlueButton (`bigbluebutton/bigbluebutton`)
- **Technology Stack:** Ubuntu Linux, FreeSWITCH, Kurento / mediasoup, Redis, Scala/Grails backend.
- **Repository Nature:** Cannot run natively on Windows host or inside minimal Docker desktop without specialized bare-metal kernel configurations.
- **Licensing Compliance:** LGPLv3 permits proprietary systems to integrate via its published network API without license contamination.
- **API Surface:**
  - `create`: Provisions meeting with room configuration, attendee/moderator PWs, and recording flags.
  - `join`: Generates single-use signed join URLs.
  - `isMeetingRunning`: Health and status verification.
  - `getRecordings`: Retrieves completed and processed class recordings.
  - `end`: Programmatically terminates live sessions.
- **Deployment Model:** Production connects to a dedicated BigBlueButton server or managed BBB cluster (e.g., Scalelite). Local environment runs the `BigBlueButtonMockAdapter` with real-time room status simulation.

### 2.3 Shaka Player (`shaka-project/shaka-player`)
- **Technology Stack:** Vanilla JavaScript / Web Components / TypeScript definitions.
- **Licensing Compliance:** Permissive Apache 2.0 license.
- **Integration Approach:** Embedded directly within the Next.js video player module with HTML5 video fallback and canvas-based dynamic student identifier watermark (rendering student name, email, and timestamp to deter screen recording).

---

## 3. Dependency Management & Pinning Strategy

All application libraries and client wrappers are pinned in `package.json` to fixed semantic versions:
- Frontend: Next.js 14.2.x, React 18.3.x / 19.x, Lucide-React, TailwindCSS, Shaka-Player.
- Backend: NestJS 10.x, TypeScript 5.x, Class-Validator, Prisma ORM / SQLite-Postgres compatibility driver, JWT, Axios, Bcrypt.
- Testing: Vitest, Playwright, Supertest.
