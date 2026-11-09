# Zealosh LMS — ZM-02 Requirement Traceability Matrix

**Document Identifier:** `ZM-02-RTM`  
**Milestone:** ZM-02 — Learning Delivery & Academic Experience  
**Project:** Zealosh LMS & Virtual Classroom Platform  
**Client / Brand:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)  
**Execution Date:** October 31, 2026  
**Status:** **100% COVERAGE & VERIFIED**  

---

## 1. Traceability Overview

This matrix maps every functional requirement mandated for Milestone ZM-02 to its database schema entity, application API, business logic implementation, and automated test vector.

---

## 2. Bidirectional Traceability Matrix

| Requirement ID | Requirement Description | Domain Entities & DB Tables | API Route & Store Handler | Automated Test Case | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **REQ-ZM02-01** | Support `ONLINE_ONLY`, `RECORDED_ONLY`, `HYBRID`, and `ALL_MODES` delivery modes across courses and cohorts. | `DeliveryConfiguration`<br>`delivery_configurations` | `/api/courses/[slug]/delivery`<br>`db.getDeliveryConfig`<br>`db.saveDeliveryConfig` | `phase2-learning-delivery.test.ts` (Test 1) | **VERIFIED** |
| **REQ-ZM02-02** | 4-Tier Delivery Cascade: Course $\rightarrow$ Batch $\rightarrow$ Module $\rightarrow$ Student Exception override. | `EffectiveDeliveryConfig`<br>`delivery_configurations` | `/api/courses/[slug]/delivery`<br>`db.getEffectiveDeliveryConfig` | `phase2-learning-delivery.test.ts` (Tests 1 & 2) | **VERIFIED** |
| **REQ-ZM02-03** | Granular learning materials permissions (`allowView`, `allowDownload`, `allowPrint`). | `LearningMaterial`<br>`learning_materials` | `/api/materials`<br>`/api/materials/[id]`<br>`db.checkMaterialAccess` | `phase2-learning-delivery.test.ts` (Test 3) | **VERIFIED** |
| **REQ-ZM02-04** | Batch delivery mode download restriction overrides individual material download permission. | `LearningMaterial`<br>`DeliveryConfiguration` | `db.checkMaterialAccess` | `phase2-learning-delivery.test.ts` (Test 3) | **VERIFIED** |
| **REQ-ZM02-05** | Secure video streaming URL generation with dynamic forensic watermark overlay (email, IP, timestamp). | `ClassRecording`<br>`class_recordings` | `/api/recordings/[recordingId]/stream` | `phase2-learning-delivery.test.ts` (Test 4) | **VERIFIED** |
| **REQ-ZM02-06** | Stripping of secret answer keys and explanations for student quiz questions retrieval. | `QuizQuestion`<br>`quiz_questions` | `/api/quizzes/[quizId]`<br>`db.getQuizQuestions(..., false)` | `phase2-learning-delivery.test.ts` (Test 5) | **VERIFIED** |
| **REQ-ZM02-07** | In-flight autosaving of student quiz answers with resumption and attempt tracking. | `QuizAttempt`<br>`quiz_attempts` | `/api/quizzes/[quizId]/attempt` (POST/PATCH)<br>`db.saveQuizAttemptAnswer` | `phase2-learning-delivery.test.ts` (Test 6) | **VERIFIED** |
| **REQ-ZM02-08** | Server-authoritative quiz evaluation, maxScore, earned score, and pass/fail calculation. | `QuizAttempt`<br>`Quiz`<br>`quiz_attempts` | `/api/quizzes/[quizId]/attempt` (PUT)<br>`db.submitQuizAttempt` | `phase2-learning-delivery.test.ts` (Test 6) | **VERIFIED** |
| **REQ-ZM02-09** | BigBlueButton Live Classroom live quiz launch contract and webhook handling. | `LiveScoreDashboardData`<br>`live_score_dashboard` | `/api/quizzes/[quizId]/live` (POST)<br>`db.activateLiveQuiz` | `phase2-learning-delivery.test.ts` (Test 7) | **VERIFIED** |
| **REQ-ZM02-10** | Persistent instructor live quiz dashboard aggregating participant scores, averages, and question stats. | `LiveScoreDashboardData`<br>`quiz_attempts` | `/api/quizzes/[quizId]/live` (GET)<br>`db.getLiveScoreDashboard` | `phase2-learning-delivery.test.ts` (Test 7) | **VERIFIED** |
| **REQ-ZM02-11** | Granular learning progress tracking: playback position in seconds, watched duration, completion %, bookmarks. | `LearningProgressRecord`<br>`learning_progress_records` | `/api/courses/[slug]/progress`<br>`db.updateLearningProgress` | `phase2-learning-delivery.test.ts` (Test 8) | **VERIFIED** |
| **REQ-ZM02-12** | Multi-criteria course completion policy evaluation across lessons, live attendance, assignments, and exams. | `CourseCompletionPolicy`<br>`CompletionEvaluation`<br>`course_completion_policies` | `/api/courses/[slug]/completion` (GET/PUT)<br>`db.evaluateCourseCompletion` | `phase2-learning-delivery.test.ts` (Tests 9 & 10) | **VERIFIED** |
| **REQ-ZM02-13** | Automatic, collision-free certificate issuance formatted as `ZEI/COURSE/YYYY/XXXXXX` upon completion. | `CertificateRecord`<br>`certificates` | `db.issueAutomaticCertificate`<br>`/api/courses/[slug]/completion` (POST) | `phase2-learning-delivery.test.ts` (Test 11) | **VERIFIED** |
| **REQ-ZM02-14** | Public certificate verification endpoint resolving certificate metadata on `zealosh.com`. | `CertificateRecord`<br>`certificates` | `/api/certificates/verify/[code]`<br>`/verify/[code]`<br>`db.verifyCertificate` | `phase2-learning-delivery.test.ts` (Test 11) | **VERIFIED** |
| **REQ-ZM02-15** | Instructor-curated live class highlights shared course-wide across weekday and weekend cohorts. | `RecordingHighlight`<br>`recording_highlights` | `/api/courses/[slug]/highlights`<br>`db.getCourseHighlights` | `phase2-learning-delivery.test.ts` (Test 12) | **VERIFIED** |
| **REQ-ZM02-16** | Interactive video recording doubts with timestamp markers and instructor clarification threads. | `RecordingDoubt`<br>`recording_doubts` | `/api/recordings/[recordingId]/doubts` | `phase2-learning-delivery.test.ts` (Test 13) | **VERIFIED** |
| **REQ-ZM02-17** | Promotion of resolved doubts to course knowledge base with student identity anonymized. | `RecordingDoubt`<br>`recording_doubts` | `/api/recordings/[recordingId]/doubts/[doubtId]`<br>`db.promoteDoubtToKnowledgeBase` | `phase2-learning-delivery.test.ts` (Test 13) | **VERIFIED** |
| **REQ-ZM02-18** | Centralized application error logging with error code, stack trace, and deduplication fingerprint. | `AppErrorLog`<br>`app_error_logs` | `/api/diagnostics/errors`<br>`db.recordAppErrorLog`<br>`db.getAppErrorLogs` | `phase2-learning-delivery.test.ts` (Tests 14 & 15) | **VERIFIED** |
| **REQ-ZM02-19** | Student problem reporting lifecycle with sequential collision-safe ticket numbers (`REP-YYYY-XXXX`). | `StudentProblemReport`<br>`student_problem_reports` | `/api/diagnostics/report-problem`<br>`db.createStudentProblemReport` | `phase2-learning-delivery.test.ts` (Test 16) | **VERIFIED** |

---

## 3. Role-Based Verification Coverage

- **`STUDENT` Role:**
  - Verified access to enrolled course materials, video streams with personal watermark, and formative quizzes without exposed answer keys.
  - Verified restriction from downloading materials when cohort is `ONLINE_ONLY` without downloadable rights.
  - Verified submission of assignments, progress tracking with resumption, and public certificate verification.
  - Verified submission of problem reports receiving `REP-YYYY-XXXX`.
- **`INSTRUCTOR` Role:**
  - Verified ability to view complete answer keys and explanations for quizzes.
  - Verified ability to launch live class quizzes into BigBlueButton and inspect real-time score dashboards.
  - Verified ability to curate live highlights, reply to student doubts, and promote doubts to the knowledge base with automatic student name sanitization.
- **`SUPER_ADMIN` / `ADMIN` Role:**
  - Verified course-level and batch-level delivery overrides (`ONLINE_ONLY`, `RECORDED_ONLY`, `HYBRID`, `ALL_MODES`).
  - Verified student-specific delivery exceptions overriding batch and course defaults.
  - Verified course completion policy definitions and threshold tuning.
  - Verified system diagnostics error logs and resolution status workflows.

