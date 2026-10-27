# Zealosh LMS — Security Architecture & Threat Model: Self-Hosted Platform

**Document Version:** 2.0.0 (Self-Hosted Architecture)  
**Status:** **ACTIVE SECURITY BASELINE** (OWASP ASVS 4.0 Level 2 Aligned)  
**Scope:** Zealosh Core Hub, Self-Hosted Moodle Container, BigBlueButton Media Server, and OIDC SSO Gateway.

---

## 1. Security Architecture & Threat Mitigation Matrix

| Threat Vector | Affected Surface | Security Architecture & Countermeasure |
| :--- | :--- | :--- |
| **SSO Token Spoofing / Replay** | `/api/oauth/token`, `/api/oauth/userinfo` | Cryptographically signed RS256/HS256 JWTs with nonces, short expiration (300s), and strict `client_id` / `client_secret` validation. |
| **GPL / LGPL Copyleft Contamination** | Proprietary Next.js Codebase | Strict physical and network process separation. Next.js communicates with Moodle and BigBlueButton exclusively over network protocols (HTTP/TLS and OIDC). |
| **Exam Integrity Tampering** | Exam simulator (`/api/exams/*`) | Stored server-side, deadlines enforced by server clock, autosaved with write locks, stripped of answer keys, and **strictly excluded from PWA Service Worker caching**. |
| **Media Stream Hijacking / Leaks** | WebRTC Classroom & Recorded Lessons | BigBlueButton shared salt never exposed to client; signed URLs generated server-side with expiring timestamps. Canvas dynamic watermark overlays for video streams. |
| **Container & Process Privilege Escalation** | Dockerized Moodle / PHP-FPM / Redis | Containers run under unprivileged service users (`www-data`, `redis`), non-root user namespaces, and read-only root filesystems where applicable. |
| **BOLA / IDOR Across Services** | `/api/batches/:id`, `/learn-engine/*` | Server-side authorization check verifying user holds active enrollment for the requested cohort before granting course access or meeting tokens. |

---

## 2. OpenID Connect (OIDC) Single Sign-On Security Rules

1. **Authorization Code Flow with PKCE:** Web applications and client plugins use standard OAuth 2.0 Authorization Code flow with Proof Key for Code Exchange (PKCE) where supported.
2. **Strict Audience Binding:** JWT access tokens contain explicit `aud` matching the requesting client (e.g. `zealosh-moodle-client`).
3. **Session Revocation:** Triggering logout in the Zealosh Core Hub invalidates the session in `ZealoshDatabase`, triggering back-channel logout to federated Moodle sessions.
