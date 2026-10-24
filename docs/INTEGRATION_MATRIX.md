# Zealosh LMS — Integration Matrix & External API Contracts

**Document Version:** 1.0.0  
**Status:** Contract Specification Baseline  
**Scope:** Moodle REST, BigBlueButton API, Identity Federation, Payment Gateways, and AI Services.

---

## 1. System Integration Overview

| External System | Integration Protocol | Auth Mechanism | Primary Direction | Timeout / Circuit Breaker | Failure Fallback Mode |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Moodle Core** | HTTPS REST / JSON | Service Token (`wstoken`) | Zealosh Backend → Moodle | 5000ms / 3 retries with exponential backoff | Cached local read state; asynchronous write retry queue via background worker. |
| **BigBlueButton** | HTTPS REST / XML | Shared Secret + SHA-1 Checksum | Zealosh Backend → BBB | 3000ms / 2 retries | Display meeting unavailable banner; automated rescheduling notification to attendees. |
| **Identity Service** | OIDC / OAuth2 / JWT | RS256 Asymmetric Keypair | Browser ↔ Backend ↔ Moodle | 2000ms | Fail closed: Unauthorized status returned. |
| **Payment Gateway** (Razorpay / Stripe) | Webhook / Server SDK | HMAC-SHA256 Signature Verification | Gateway → Zealosh Backend | 3000ms acknowledgment | Idempotent event processing; manual payment reconciliation dashboard. |
| **AI Assessment Provider** (OpenAI / Gemini) | HTTPS REST / JSON | Bearer API Key (Server Only) | Zealosh Backend → AI API | 10000ms / 1 retry | Graceful degradation to human tutor review; AI disclaimer displayed. |

---

## 2. Moodle REST Integration Contract

- **Endpoint:** `https://{moodle-host}/webservice/rest/server.php`
- **Format:** `moodlewsrestformat=json`
- **Core Operations:**
  1. `core_user_create_users`: Synchronizes student account upon Zealosh registration.
  2. `enrol_manual_enrol_users`: Enrolls student into corresponding Moodle course upon confirmed payment or batch assignment.
  3. `core_course_get_contents`: Fetches modules, sections, and lesson activities.
  4. `core_completion_get_course_completion_status`: Synchronizes real-time completion status back to the Zealosh student dashboard.
- **Error Handling & Idempotency:**
  - If a user already exists in Moodle, catch `invaliduser` error and query `core_user_get_users_by_field` to link the external Moodle user ID with Zealosh's `external_learning_id`.
  - All enrollment calls are tagged with unique `idempotency_key` (Format: `enrol_{batchId}_{userId}`).

---

## 3. BigBlueButton API Contract

- **Base URL:** `https://{bbb-host}/bigbluebutton/api/`
- **Security:** Each request appends `&checksum=` where `checksum = SHA1(callName + queryString + bbbSharedSecret)`.
- **Privileged Credential Isolation:** Frontend never knows the BBB endpoint or secret. All calls are mediated by Zealosh Backend.
- **Workflows:**
  1. **Meeting Creation (`/create`):**
     - Parameters: `meetingID`, `name`, `attendeePW`, `moderatorPW`, `record=true`, `logoutURL`.
     - Automatically called 15 minutes before scheduled session start time or upon instructor click.
  2. **Student Join (`/join`):**
     - Validates student batch enrollment on Zealosh server.
     - Returns single-use redirect URL: `https://{bbb-host}/bigbluebutton/api/join?meetingID=...&password=...&fullName=...&checksum=...`.
  3. **Attendance & Analytics Sync (`/getMeetingInfo`, `/getRecordings`):**
     - Cron job checks meeting status; syncs attendee list and join/leave timestamps to Zealosh `attendance_records` table.

---

## 4. Payment Gateway Webhook Contract

- **Supported Providers:** Razorpay (India INR), Stripe (International USD/CAD).
- **Security & Integrity Policy:**
  - **No Trust on Client Redirects:** A frontend redirect to `/payment/success` NEVER activates an enrollment.
  - **Signature Verification:** The backend computes `HMAC_SHA256(rawBody, webhookSecret)` and verifies match with `X-Razorpay-Signature` or `Stripe-Signature`.
  - **Idempotency:** Webhook IDs are stored in the `payment_transactions` table with a unique constraint. Duplicate deliveries return HTTP 200 immediately without reprocessing.
  - **Batch Capacity Guard:** Capacity check is executed inside a PostgreSQL serializable transaction `SELECT ... FOR UPDATE` before issuing enrollment entitlement.
