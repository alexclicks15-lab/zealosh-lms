# WORKSTREAM I — CLASSROOM INTEGRATION REPORT

### 1. BigBlueButton 2.7+ Architecture
- Integrated via signed REST API using SHA-1 checksum parameter signing.
- Role mapping: `INSTRUCTOR` maps to BBB `MODERATOR`; `STUDENT` maps to BBB `VIEWER`.
- Session lifecycle: `SCHEDULED` $\rightarrow$ `ACTIVE` $\rightarrow$ `COMPLETED`.
- Attendance: Webhook events ingest join/leave timestamps and calculate attended minutes per candidate.

### 2. Brand Shielding
Client-facing pages (`/live/[sessionId]`, `/student`, `/instructor`) strictly display **Zealosh Virtual Classroom**. All internal engine names (BigBlueButton, freeswitch) are redacted from student interfaces.
