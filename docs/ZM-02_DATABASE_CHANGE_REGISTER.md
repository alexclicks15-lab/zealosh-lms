# Zealosh LMS — ZM-02 Database Change Register

**Document Identifier:** `ZM-02-DCR`  
**Milestone:** ZM-02 — Learning Delivery & Academic Experience  
**Project:** Zealosh LMS & Virtual Classroom Platform  
**Client / Brand:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)  
**Execution Date:** October 31, 2026  
**Status:** **MIGRATION APPLIED, IDEMPOTENT & VERIFIED**  
**Migration Artifact:** [`supabase/migrations/20261031000010_zealosh_learning_delivery_phase2.sql`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/supabase/migrations/20261031000010_zealosh_learning_delivery_phase2.sql)

---

## 1. Migration Architecture & Safety Guarantees

In strict accordance with **Rule 7 (Database integrity is mandatory)** and the **database-migration-safety** protocol:
1. **Forward-Only DDL:** The migration strictly creates new tables, enum types, indexes, and RLS policies. It contains zero destructive actions (`DROP TABLE`, `DROP COLUMN`, `TRUNCATE`).
2. **Idempotency Guarding:** All DDL statements utilize `IF NOT EXISTS` constructs, and all enum types are wrapped in safe PL/pgSQL exception blocks handling `duplicate_object`.
3. **Lock Timeout Safe:** Migration applies no exclusive locks on existing high-traffic Phase 1 tables (`users`, `courses`, `batches`, `enrollments`).
4. **Relational Integrity:** Foreign keys strictly link to authoritative Phase 1 parents (`courses(id)`, `batches(id)`, `users(id)`, `enrollments(id)`) with appropriate referential cascades or restrictions.

---

## 2. New Custom Enum Types

```sql
-- 1. Delivery Mode
CREATE TYPE delivery_mode_enum AS ENUM ('ONLINE_ONLY', 'RECORDED_ONLY', 'HYBRID', 'ALL_MODES');

-- 2. Material Types
CREATE TYPE material_type_enum AS ENUM ('PDF', 'DOCUMENT', 'PRESENTATION', 'IMAGE', 'EXTERNAL_LINK', 'BLUEPRINT', 'HANDOUT');

-- 3. Quiz Types
CREATE TYPE quiz_type_enum AS ENUM (
  'TOPIC_QUIZ',
  'SUBTOPIC_QUIZ',
  'LESSON_END_QUIZ',
  'MODULE_QUIZ',
  'PRACTICE_QUIZ',
  'PRACTICE_DRILL',
  'LIVE_CLASS_QUIZ'
);

-- 4. Quiz Question Types
CREATE TYPE quiz_question_type_enum AS ENUM (
  'SINGLE_CHOICE',
  'MULTIPLE_CHOICE',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'NUMERICAL',
  'MATCHING',
  'ORDERING',
  'ESSAY'
);

-- 5. Learning Activity Types
CREATE TYPE learning_activity_type_enum AS ENUM (
  'VIDEO',
  'PRERECORDED_VIDEO',
  'TEXT',
  'DOCUMENT',
  'QUIZ',
  'ASSIGNMENT',
  'LIVE_CLASS'
);

-- 6. Diagnostics & Problem Reporting Types
CREATE TYPE log_severity_enum AS ENUM ('INFO', 'WARN', 'ERROR', 'CRITICAL');
CREATE TYPE bug_resolution_status_enum AS ENUM ('NEW', 'INVESTIGATING', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'WONT_FIX');
CREATE TYPE problem_report_category_enum AS ENUM ('VIDEO_PLAYBACK', 'LIVE_CLASS', 'QUIZ_SUBMISSION', 'MATERIAL_DOWNLOAD', 'CERTIFICATE', 'OTHER');
```

---

## 3. Canonical Tables Register

### 1. `delivery_configurations`
Stores delivery mode definitions and capability flags across Course, Batch, Module, and Student Exception scopes.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - Dynamic polymorphic target referencing `entity_type` (`COURSE`, `BATCH`, `MODULE`, `TOPIC`, `SUBTOPIC`, `STUDENT_EXCEPTION`, `STUDENT`) and `entity_id` (`VARCHAR(64)`).
- **Core Columns:** `delivery_mode`, `live_sessions_enabled`, `recorded_lessons_enabled`, `downloadable_materials_enabled`, `settings` (`JSONB`), `release_date`, `access_end_date`.
- **Unique Constraint:** `(entity_type, entity_id)`

### 2. `learning_materials`
Stores curriculum learning assets (handouts, blueprints, slide decks, PDFs) with granular permission toggles.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `course_id` $\rightarrow$ `courses(id)` `ON DELETE CASCADE`
  - `batch_id` $\rightarrow$ `batches(id)` `ON DELETE SET NULL`
- **Core Columns:** `title`, `description`, `material_type`, `file_url`, `file_size_bytes`, `mime_type`, `file_format`, `allow_view`, `allow_download`, `allow_print`, `watermark_enabled`, `sort_order`, `status`.

### 3. `quizzes`
Unified table for formative assessments, topic quizzes, practice drills, and BBB live class quizzes.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `course_id` $\rightarrow$ `courses(id)` `ON DELETE CASCADE`
  - `batch_id` $\rightarrow$ `batches(id)` `ON DELETE SET NULL`
- **Core Columns:** `title`, `description`, `quiz_type`, `passing_score_percent`, `duration_minutes`, `time_limit_minutes`, `max_attempts`, `shuffle_questions`, `allow_review`, `is_live_active`, `live_session_id`, `status`.

### 4. `quiz_questions`
Question bank questions linked to quizzes or curriculum topics.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `quiz_id` $\rightarrow$ `quizzes(id)` `ON DELETE CASCADE`
- **Core Columns:** `question_text`, `question_type`, `options` (`JSONB`), `correct_answer` (`JSONB`), `explanation` (`TEXT`), `points` (`NUMERIC(5,2)`), `sort_order` (`INT`).

### 5. `quiz_attempts`
Student attempt lifecycle records, tracking in-flight answer state, time spent, and server-scored results.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `quiz_id` $\rightarrow$ `quizzes(id)` `ON DELETE CASCADE`
  - `user_id` $\rightarrow$ `users(id)` `ON DELETE CASCADE`
  - `batch_id` $\rightarrow$ `batches(id)` `ON DELETE SET NULL`
- **Core Columns:** `attempt_number`, `start_time`, `end_time`, `score`, `max_score`, `percentage`, `passed`, `status`, `answers` (`JSONB`), `live_session_id`.

### 6. `learning_progress_records`
Fine-grained video and lesson telemetry tracking exact playback position, watched duration, completion flags, and student bookmarks.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `users(id)` `ON DELETE CASCADE`
  - `course_id` $\rightarrow$ `courses(id)` `ON DELETE CASCADE`
- **Core Columns:** `activity_type`, `last_playback_position_seconds`, `watched_duration_seconds`, `total_duration_seconds`, `completion_percentage`, `is_completed`, `completed_at`, `bookmarks` (`JSONB`), `notes` (`TEXT`).
- **Unique Constraint:** `(user_id, course_id, lesson_id, activity_type)`

### 7. `course_completion_policies`
Multi-criteria evaluation policies specifying requirements for course certificate issuance.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `course_id` $\rightarrow$ `courses(id)` `ON DELETE CASCADE`
- **Core Columns:** `version`, `required_lesson_completion_percentage`, `required_live_attendance_percentage`, `require_all_assignments_passed`, `require_all_quizzes_passed`, `require_formal_exam_passed`, `minimum_exam_score_percentage`, `is_active`.

### 8. `completion_evaluations`
Audit evaluations determining whether a student enrollment meets course completion policies.
- **Primary Key:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `enrollment_id` $\rightarrow$ `enrollments(id)` `ON DELETE CASCADE`
  - `user_id` $\rightarrow$ `users(id)` `ON DELETE CASCADE`
  - `course_id` $\rightarrow$ `courses(id)` `ON DELETE CASCADE`
  - `policy_id` $\rightarrow$ `course_completion_policies(id)`
- **Core Columns:** `is_completed`, `completion_date`, `lesson_completion_percentage`, `attendance_percentage`, `assignments_passed_count`, `quizzes_passed_count`, `formal_exam_passed`, `formal_exam_score_percentage`, `aggregate_score`, `criteria_results` (`JSONB`).

### 9. `app_error_logs` & `student_problem_reports`
Centralized application error diagnostics and student support ticketing with sequential numbers (`REP-YYYY-XXXX`).
- **Primary Keys:** `id` (`VARCHAR(64)`)
- **Foreign Keys:**
  - `user_id` $\rightarrow$ `users(id)` `ON DELETE SET NULL`
- **Core Columns:**
  - Error Logs: `module`, `error_code`, `message`, `stack_trace`, `fingerprint`, `severity`, `status`, `context` (`JSONB`).
  - Problem Reports: `ticket_number`, `user_id`, `user_email`, `category`, `title`, `description`, `device_info` (`JSONB`), `status`, `assigned_to`.

---

## 4. Row-Level Security (RLS) Policy Register

All nine tables have Row-Level Security enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

1. **`delivery_configurations`:**
   - Read: Public / Authenticated.
   - Write: `has_role(auth.uid(), 'ADMIN') OR has_role(auth.uid(), 'SUPER_ADMIN')`.
2. **`learning_materials`:**
   - Read: Enrolled students (`EXISTS(SELECT 1 FROM enrollments WHERE ...)`), instructors, and admins.
   - Write: Instructors and admins.
3. **`quizzes` & `quiz_questions`:**
   - Read Quizzes: Enrolled students, instructors, and admins.
   - Read Questions: Authenticated users (Server API strips `correct_answer` and `explanation` for students).
   - Write: Instructors and admins.
4. **`quiz_attempts`:**
   - Read/Insert/Update: Student owns the attempt (`user_id = auth.uid()`), or instructor/admin.
5. **`learning_progress_records`:**
   - Read/Write: Student owns the record (`user_id = auth.uid()`), or instructor/admin.
6. **`course_completion_policies` & `completion_evaluations`:**
   - Read Policy: Public / Authenticated.
   - Read Evaluation: Student owns evaluation (`user_id = auth.uid()`), or instructor/admin.
   - Write: Service role / Admin only.
7. **`app_error_logs` & `student_problem_reports`:**
   - Read Error Logs: Admin only.
   - Insert Problem Reports: Authenticated students.
   - Read Problem Reports: Reporter (`user_id = auth.uid()`) or Admin/Support.

