# Zealosh LMS — Integration Matrix & Service Boundary Specification

**Document Version:** 3.0.0 (Self-Hosted Architecture)  
**Status:** **ACTIVE CONTRACT BASELINE** (Supersedes Remote SaaS Client Model via ADR-001)  
**Scope:** Internal Self-Hosted Microservices (Moodle, BigBlueButton), OAuth2/OIDC SSO, and Payment Gateways.

---

## 1. System Integration & Service Boundary Overview

| Service Component | Hosting Model | Protocol / API | Primary Direction | Timeout / Resiliency | Operational Mode |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Zealosh Learning Engine (Moodle Core 4.4+)** | Self-Hosted Container (`docker-compose.zealosh-platform.yml`) | OIDC SSO (`auth_oauth2`) & Internal REST API | Next.js ↔ Moodle | 5000ms / 3 retries | Primary self-hosted LMS engine for SCORM, deep lesson chapters, and forum activities. |
| **Zealosh Live Classroom (BigBlueButton 2.7+)** | Self-Hosted Dedicated Media Node | Server-Side Signed REST / WebRTC | Next.js → BBB | 3000ms / 2 retries | Primary self-hosted audio/video classroom, multi-user whiteboard, and session recording. |
| **Identity & Access Management (OIDC SSO)** | Native Next.js 14 Service (`/api/oauth/*`) | OAuth2 / OIDC Core 1.0 (JWT) | Moodle ↔ Next.js | 2000ms | Master identity provider for all platform sub-services. |
| **Payment Gateway (Razorpay / Stripe)** | External Gateway API | HMAC-SHA256 Webhook | Gateway → Next.js | 3000ms acknowledgment | Idempotent order verification and batch capacity entitlement. |

---

## 2. OpenID Connect (OIDC) SSO Contract

- **Issuer URL:** `https://lms.zealosh.com`
- **Discovery Endpoint:** `GET /.well-known/openid-configuration`
- **Authorization Endpoint:** `GET /api/oauth/authorize`
- **Token Endpoint:** `POST /api/oauth/token`
- **Userinfo Endpoint:** `GET /api/oauth/userinfo`
- **Supported Scopes:** `openid`, `profile`, `email`
- **Token Format:** RS256/HS256 signed JSON Web Tokens (JWT) containing `sub`, `email`, `name`, `role`, and `zealosh_user_id`.

---

## 3. BigBlueButton Session Dispatch Contract

- **Protocol:** Server-Side HTTP GET/POST with SHA-1 Checksum validation.
- **Base Endpoint:** `http://bbb-media:8090/bigbluebutton/api/` (internal network) or `https://lms.zealosh.com/classroom/api/`.
- **Workflow:**
  1. Instructor or Student clicks "Join Live Classroom" on `/student` or `/instructor`.
  2. Next.js backend checks user batch entitlement in `ZealoshDatabase`.
  3. Next.js creates or joins the meeting via `/create` and `/join` with signed checksum.
  4. User is redirected seamlessly into the branded Zealosh Live Classroom.
