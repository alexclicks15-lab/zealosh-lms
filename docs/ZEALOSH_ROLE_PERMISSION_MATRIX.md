# Zealosh LMS — Master Role and Permission Matrix

**Document Version:** 1.1.0  
**Milestone:** ZM-01.1 — Master Blueprint Reconciliation & Phase 1 Core Foundations Implementation  
**Target:** Single Institutional Learning & Certification Platform (`https://zealosh.com`)  
**Brand:** Zealosh Training & Consultants  
**Date:** October 31, 2026  

---

## 1. Identity, Profile & Role Architecture

Zealosh enforces a strict, four-layer separation of concerns for user identity and authorization:

```
┌────────────────────────────────────────────────────────┐
│ 1. Authentication Identity (Supabase auth.users)       │
│    UUID, email, password hash, email verified, MFA     │
└───────────────────────────┬────────────────────────────┘
                            │ 1:1
                            ▼
┌────────────────────────────────────────────────────────┐
│ 2. Application Profile (public.profiles)               │
│    Full name, phone, avatar, account status, lockout   │
└───────────────────────────┬────────────────────────────┘
                            │ 1:N
                            ▼
┌────────────────────────────────────────────────────────┐
│ 3. Platform Roles (public.user_roles)                  │
│    SUPER_ADMIN, ORG_ADMIN, COURSE_MANAGER, INSTRUCTOR, │
│    STUDENT, SUPPORT_STAFF                              │
└───────────────────────────┬────────────────────────────┘
                            │ Scoped
                            ▼
┌────────────────────────────────────────────────────────┐
│ 4. Academic Assignments (Courses, Batches, Cohorts)    │
│    Lead Instructor, Co-Instructor, Active Enrollee    │
└────────────────────────────────────────────────────────┘
```

- **No Role in Client Metadata:** User roles are stored in database tables, never in client-editable user metadata.
- **Multiple Responsibilities:** A single user can act as an `INSTRUCTOR` for Course A while holding an active enrollment as a `STUDENT` in Course B without creating separate accounts.

---

## 2. Platform Role Definitions

| Role Code | Role Name | Primary Responsibility & Boundary |
| :--- | :--- | :--- |
| `SUPER_ADMIN` | Principal Administrator | Full institutional authority, system configuration, database backups, audit log inspection, security keys, feature gates. |
| `ORG_ADMIN` | Institutional Director / Academic Dean | Academic administration, department oversight, faculty allocation, enrollment management, report generation, refunds. |
| `COURSE_MANAGER`| Curriculum Coordinator | Course creation, syllabus revision, module structuring, Question Bank approval, exam blueprint management. |
| `INSTRUCTOR` | Faculty / Lead Trainer | Assigned cohort teaching, BigBlueButton live class moderation, assignment grading with rubrics, student doubts. |
| `STUDENT` | Registered Learner | Coursework access, prerecorded video streaming, live class attendance, quiz/assignment submission, exam taking. |
| `SUPPORT_STAFF` | Student Services / Registrar | Student admission review, application document verification, technical assistance, non-academic profile updates. |

---

## 3. Comprehensive Resource Permission Matrix

| Resource / Capability | Permission Code | SUPER_ADMIN | ORG_ADMIN | COURSE_MANAGER | INSTRUCTOR | STUDENT | SUPPORT_STAFF |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Course Catalog (Published)** | `courses.read` | Grant | Grant | Grant | Grant | Grant | Grant |
| **Course Authoring (Draft)** | `courses.create` | Grant | Grant | Grant | Deny | Deny | Deny |
| **Course Content Modification** | `courses.update` | Grant | Grant | Grant | Assigned Only | Deny | Deny |
| **Course Publishing** | `courses.publish` | Grant | Grant | Grant | Deny | Deny | Deny |
| **Batch / Cohort Scheduling** | `cohorts.manage` | Grant | Grant | Grant | Deny | Deny | Deny |
| **Student Enrollment Approval** | `enrollments.manage` | Grant | Grant | Grant | Deny | Deny | Grant |
| **Student Profile Inspection** | `students.read` | Grant | Grant | Grant | Assigned Cohort | Deny | Grant |
| **Student Progress Inspection** | `progress.read` | Grant | Grant | Grant | Assigned Cohort | Own Only | Grant |
| **Prerecorded Lesson Upload** | `lessons.upload` | Grant | Grant | Grant | Assigned Only | Deny | Deny |
| **Prerecorded Video Playback** | `lessons.stream` | Grant | Grant | Grant | Assigned Only | Enrolled Only | Deny |
| **Live Classroom Launch (Mod)** | `live.moderate` | Grant | Grant | Deny | Assigned Only | Deny | Deny |
| **Live Classroom Join (Student)**| `live.join` | Grant | Grant | Deny | Assigned Only | Enrolled Only | Deny |
| **Recording Previous-Batch Grant**| `recordings.access_manage` | Grant | Grant | Grant | Deny | Deny | Deny |
| **Question Bank Authoring** | `questions.create` | Grant | Grant | Grant | Assigned Only | Deny | Deny |
| **Question Bank Approval** | `questions.approve` | Grant | Grant | Grant | Deny | Deny | Deny |
| **Topic Quiz Authoring** | `quizzes.manage` | Grant | Grant | Grant | Assigned Only | Deny | Deny |
| **Topic Quiz Attempt** | `quizzes.attempt` | Deny | Deny | Deny | Deny | Enrolled Only | Deny |
| **Assignment Authoring** | `assignments.create` | Grant | Grant | Grant | Assigned Only | Deny | Deny |
| **Assignment Submission** | `assignments.submit` | Deny | Deny | Deny | Deny | Enrolled Only | Deny |
| **Assignment Rubric Grading** | `assignments.grade` | Grant | Grant | Grant | Assigned Only | Deny | Deny |
| **High-Stakes Exam Blueprint** | `exams.manage` | Grant | Grant | Grant | Deny | Deny | Deny |
| **High-Stakes Exam Attempt** | `exams.attempt` | Deny | Deny | Deny | Deny | Enrolled Only | Deny |
| **Certificate Template Config** | `certificates.template`| Grant | Grant | Deny | Deny | Deny | Deny |
| **Certificate Issuance / Revoke** | `certificates.issue` | Grant | Grant | Deny | Deny | Deny | Deny |
| **Public Certificate Verify** | `certificates.verify` | Public | Public | Public | Public | Public | Public |
| **Commerce / Invoices View** | `payments.read` | Grant | Grant | Deny | Deny | Own Only | Grant |
| **Refund Processing (Dangerous)** | `payments.refund` | Grant | Grant | Deny | Deny | Deny | Deny |
| **Institutional Analytics Export**| `reports.export` | Grant | Grant | Grant | Cohort Only | Deny | Deny |
| **Platform Branding / Settings** | `settings.manage` | Grant | Deny | Deny | Deny | Deny | Deny |
| **Integration Secrets / Keys** | `integrations.manage`| Grant | Deny | Deny | Deny | Deny | Deny |
| **User Account Creation / Lock** | `users.manage` | Grant | Grant | Deny | Deny | Deny | Grant (Non-Admin) |
| **Role Assignment (Dangerous)** | `roles.manage` | Grant | Deny | Deny | Deny | Deny | Deny |
| **Audit Log Inspection** | `audit.read` | Grant | Grant | Deny | Deny | Deny | Deny |
| **Academic Hierarchy Management**| `academic.manage` | Grant | Grant | Grant | Deny | Deny | Deny |
| **Admissions Review Queue** | `admissions.manage` | Grant | Grant | Deny | Deny | Deny | Grant |
| **Bulk Admissions Import** | `admissions.import` | Grant | Grant | Deny | Deny | Deny | Deny |
| **User Profile Governance** | `profiles.manage` | Grant | Grant | Deny | Deny | Deny | Grant |
| **Cohort Transfers & Withdrawals**| `transfers.manage` | Grant | Grant | Deny | Deny | Deny | Grant |
| **Developer Diagnostics / Errors**| `diagnostics.read` | Grant | Deny | Deny | Deny | Deny | Deny |

---

## 4. Enforcement Mechanisms

1. **Database Row-Level Security (RLS):**
   - Enforced by PostgreSQL kernel on direct Supabase client queries.
   - Evaluates `public.is_admin()`, `public.is_course_instructor(course_id, batch_id)`, and `public.current_user_id()`.
2. **API Route Middleware Guards:**
   - Server-side Next.js route handlers inspect verified JWT session token.
   - Rejects missing authorization with HTTP 401; rejects insufficient permissions with HTTP 403.
3. **Faculty Scope Enforcement:**
   - Instructors can only view submissions, grade rubrics, and launch live sessions for courses where `lead_instructor_id = user.id` OR `user.id = ANY(co_instructor_ids)` OR `batches.lead_instructor_id = user.id`.
4. **Student Enrollment Scope:**
   - Students can only stream videos, take quizzes, submit coursework, and join classrooms for courses and batches where an `ACTIVE` and non-expired enrollment record exists in `public.enrollments`.

