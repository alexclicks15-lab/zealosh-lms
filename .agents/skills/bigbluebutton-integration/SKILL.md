---
name: bigbluebutton-integration
description: Comprehensive runbook for integrating Zealosh LMS with BigBlueButton 2.7+ Live Classroom infrastructure. Use this skill when implementing WebRTC room provisioning, SHA-1 checksum calculation, moderator/student join token generation, attendance logging, or recording workflows.
---

# BigBlueButton Live Classroom Integration Runbook

## Overview
This skill governs the integration between Zealosh LMS and the BigBlueButton conferencing cluster. Zealosh manages session scheduling, batch rosters, and attendance verification, while BigBlueButton provides real-time WebRTC audio/video, interactive multi-user whiteboards, screen sharing, and server-side meeting recordings.

## Core Architectural Invariants
1. **Zero Secret Leakage:** The BigBlueButton shared secret salt (`BIGBLUEBUTTON_SALT`) must never be exposed to browser code, client bundles, or Git repositories. All cryptographic checksums are computed exclusively on the Zealosh application backend.
2. **Server-Side Authorization:** Students can only join live sessions if they have an active enrollment (`status = 'ACTIVE'`) in the corresponding cohort batch. Instructors can only join as moderators if explicitly assigned in `batch_instructors`.
3. **Attendance Truth:** Attendance must be tracked via server-side polling (`/getMeetingInfo`) or post-session webhooks capturing actual joined and left timestamps, rather than merely logging a click on the join link.

## Cryptographic Checksum Algorithm
BigBlueButton authenticates every REST API call using a SHA-1 hash over the call name, parameters, and secret salt:
```typescript
function calculateChecksum(callName: string, queryString: string, salt: string): string {
  const raw = `${callName}${queryString}${salt}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
}
```

## API Operations & Workflows

### 1. Provisioning a Live Meeting (`/create`)
- **Call Name:** `create`
- **Query Parameters:**
  - `meetingID`: Stable identifier (e.g. `zealosh-live-asp-001`).
  - `name`: Human-readable title (e.g. `ASP Math & Ventilation Workshop`).
  - `attendeePW`: Random or managed attendee password.
  - `moderatorPW`: Secure moderator password for instructors.
  - `record`: `true` (enables server-side recording).
  - `autoStartRecording`: `true`.
  - `welcome`: Branded welcome message.
- **Request:**
  `GET https://{bbb-host}/bigbluebutton/api/create?{queryParams}&checksum={checksum}`
- **Response Validation:** Verify `<returncode>SUCCESS</returncode>` in XML payload.

### 2. Generating Secure Join URLs (`/join`)
- **Call Name:** `join`
- **Parameters:**
  - `meetingID`: The provisioned meeting ID.
  - `fullName`: Student or Instructor full name.
  - `password`: Matching `attendeePW` for students, `moderatorPW` for tutors.
  - `userID`: Zealosh `user.id`.
- **Flow:**
  Zealosh backend computes checksum and returns the signed URL to the authenticated client, or redirects directly:
  `GET https://{bbb-host}/bigbluebutton/api/join?{queryParams}&checksum={checksum}`

### 3. Attendance & Recording Synchronization
- **Endpoint:** `/getRecordings?meetingID={meetingID}`
- **Usage:** Retrieve processed recording URLs once the live lecture concludes; store in `live_sessions.recording_url` for on-demand playback in the Student Hub.

## Development & Test Double Strategy
- In local development mode (`BIGBLUEBUTTON_MODE !== 'remote'`), route users to `/live/[sessionId]?role={role}&userId={userId}&simulated=true`.
- The interactive live simulator reproduces presenter audio/video stage, multi-user collaborative whiteboard, student roster, and chat without requiring a dedicated Linux bare-metal WebRTC server.
