---
name: moodle-integration
description: Comprehensive runbook for integrating Zealosh LMS with Moodle 4.x Core REST Web Services API. Use this skill when implementing user synchronization, course enrollment, module/section content retrieval, gradebook sync, or SCORM tracking.
---

# Moodle REST Web Services Integration Runbook

## Overview
This skill governs the integration boundary between Zealosh LMS (authoritative for commerce, users, batches, and certificates) and Moodle Core (authoritative for SCORM learning modules, assignments, and detailed gradebooks).

## Core Architectural Invariants
1. **GPLv3 License Boundary Isolation:** Never import or compile Moodle PHP source directly into the Zealosh proprietary codebase. All communication occurs over HTTPS REST API (`/webservice/rest/server.php`) using external service tokens.
2. **Authoritative Data Separation:**
   - Zealosh PostgreSQL owns: Users, Credentials, Orders, Batches, Entitlements, Exams, Certificates.
   - Moodle Database owns: Course module completion tracking, SCORM runtime states, interactive assignment submissions.
3. **Idempotent Enrolment:** Every enrollment request must carry an `idempotency_key` (Format: `enrol_{batchId}_{userId}`). If a user is already enrolled, the adapter must return success without creating duplicate records.

## Official Web Services API Endpoints & Schemas

### 1. User Provisioning (`core_user_create_users`)
- **Function:** `core_user_create_users`
- **Method:** `POST`
- **Payload Schema:**
  ```json
  {
    "users": [
      {
        "username": "student_email_prefix_or_id",
        "firstname": "Arjun",
        "lastname": "Menon",
        "email": "student@zealosh.com",
        "auth": "manual",
        "idnumber": "usr-std-01"
      }
    ]
  }
  ```
- **Error Handling:** If Moodle returns exception `invaliduser` or duplicate email, catch and query `core_user_get_users_by_field(field="email", values=[email])` to retrieve and store `external_learning_id`.

### 2. Manual Course Enrolment (`enrol_manual_enrol_users`)
- **Function:** `enrol_manual_enrol_users`
- **Method:** `POST`
- **Payload Schema:**
  ```json
  {
    "enrolments": [
      {
        "roleid": 5, // 5 = Student, 3 = Editing Teacher, 4 = Non-editing Teacher
        "userid": 501,
        "courseid": 101,
        "timestart": 1730000000,
        "timeend": 1745500000
      }
    ]
  }
  ```

### 3. Curriculum & Module Fetching (`core_course_get_contents`)
- **Function:** `core_course_get_contents`
- **Method:** `GET` / `POST`
- **Parameters:** `courseid=101&moodlewsrestformat=json`
- **Output:** Hierarchical JSON containing sections, lesson modules (`modname = 'resource' | 'scorm' | 'assign' | 'url'`), and completion conditions.

### 4. Course Completion Status (`core_completion_get_course_completion_status`)
- **Function:** `core_completion_get_course_completion_status`
- **Method:** `GET` / `POST`
- **Parameters:** `courseid=101&userid=501&moodlewsrestformat=json`
- **Usage:** Used to synchronize real-time progress bars back to the Zealosh Student Hub.

## Development & Test Double Strategy
- During local development or when Moodle server is unreachable, use `MoodleClientAdapter` with `isMockMode: true`.
- Mock returns deterministic, schema-compliant responses matching Moodle 4.x JSON structures, ensuring tests run offline without network blockers.
