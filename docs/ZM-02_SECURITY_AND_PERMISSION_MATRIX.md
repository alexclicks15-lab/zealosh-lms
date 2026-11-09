# Zealosh LMS — ZM-02 Security & Permission Matrix

**Document Identifier:** `ZM-02-SPM`  
**Milestone:** ZM-02 — Learning Delivery & Academic Experience  
**Project:** Zealosh LMS & Virtual Classroom Platform  
**Client / Brand:** Zealosh Training & Consultants (Kollam, Kerala, India / Global)  
**Execution Date:** October 31, 2026  
**Status:** **AUTHORITATIVE & SERVER-ENFORCED**  

---

## 1. Security Architecture & Boundary Defenses

All permission checks within Milestone ZM-02 follow the **Server-Enforced Authorization** non-negotiable principle:
1. **Zero Client Trust:** Access to video streams, learning material downloads, quiz attempts, answer keys, and certificate generation is strictly authenticated and validated by Next.js Route Handlers and Supabase RLS.
2. **Answer Key Protection:** The server strips `correctAnswer` and `explanation` from quiz questions unless the caller is verified with an authoritative staff role (`SUPER_ADMIN`, `ADMIN`, `COURSE_MANAGER`, or `INSTRUCTOR`).
3. **Forensic Watermarking:** Video streaming manifests and playback tokens embed the student's unique identity (User ID, registered email, client IP address, and playback timestamp) to prevent unauthorized screen recording or redistribution.
4. **Student Identity Anonymization:** When an instructor promotes a doubt to the public course knowledge base, the student's personal name is stripped and sanitized to `"Verified Student Question"`.

---

## 2. Granular Role-Permission Matrix

| Operation / Capability | Route / Store Method | SUPER_ADMIN / ADMIN | COURSE_MANAGER | INSTRUCTOR | STUDENT (Enrolled) | GUEST / Public |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Manage Course Delivery Mode** | `POST /api/courses/[slug]/delivery` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| **Set Batch Delivery Override** | `POST /api/courses/[slug]/delivery` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| **Grant Student Exception** | `POST /api/courses/[slug]/delivery` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| **Upload Learning Material** | `POST /api/materials` | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED | DENIED |
| **View Learning Material** | `GET /api/materials/[id]` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (if `allowView`) | DENIED |
| **Download Learning Material** | `GET /api/materials/[id]` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **GATED** (Material & Batch) | DENIED |
| **Stream Prerecorded Video** | `GET /api/recordings/[id]/stream` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (Watermarked) | DENIED |
| **Create Formative Quiz** | `POST /api/quizzes` | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED | DENIED |
| **Inspect Quiz Answer Keys** | `GET /api/quizzes/[id]` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **STRIPPED** | DENIED |
| **Start / Resume Quiz Attempt** | `POST /api/quizzes/[id]/attempt` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (Enrolled) | DENIED |
| **Autosave Quiz Answers** | `PATCH /api/quizzes/[id]/attempt` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (Owner) | DENIED |
| **Submit Quiz for Scoring** | `PUT /api/quizzes/[id]/attempt` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (Owner) | DENIED |
| **Launch Live BBB Quiz** | `POST /api/quizzes/[id]/live` | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED | DENIED |
| **View Live Quiz Dashboard** | `GET /api/quizzes/[id]/live` | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED | DENIED |
| **Post Recording Doubt** | `POST /api/recordings/[id]/doubts` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (Enrolled) | DENIED |
| **Promote Doubt to Knowledge Base** | `PATCH .../doubts/[id]` | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED | DENIED |
| **Curate Recording Highlights** | `POST .../highlights` | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED | DENIED |
| **View Course-Wide Highlights** | `GET /api/courses/[slug]/highlights` | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** (Enrolled) | DENIED |
| **Configure Completion Policy** | `PUT /api/courses/[slug]/completion` | **ALLOWED** | **ALLOWED** | DENIED | DENIED | DENIED |
| **Trigger Auto Certificate** | `POST /api/courses/[slug]/completion`| **ALLOWED** | **ALLOWED** | **ALLOWED** | System Triggered | DENIED |
| **Public Certificate Verification** | `GET /api/certificates/verify/[code]`| **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** |
| **Inspect System Error Logs** | `GET /api/diagnostics/errors` | **ALLOWED** | DENIED | DENIED | DENIED | DENIED |
| **Submit Problem Report** | `POST /api/diagnostics/report-problem`| **ALLOWED** | **ALLOWED** | **ALLOWED** | **ALLOWED** | DENIED |

---

## 3. Defense-in-Depth Enforcement Mechanics

1. **Material Download Gating Cascade:**
   - Even when a material record has `allowDownload: true`, if the student's cohort delivery mode is `ONLINE_ONLY` with `downloadableMaterialsEnabled: false`, the download request is rejected with reason: `"Download disabled under current batch delivery configuration"`.
2. **Server-Side Answer Key Defense:**
   - In `db.getQuizQuestions(quizId, includeAnswers)`:
     ```ts
     if (!includeAnswers) {
       return questions.map(q => ({ ...q, correctAnswer: undefined, explanation: undefined }));
     }
     ```
   - In `src/app/api/quizzes/[quizId]/route.ts`, `includeAnswers` is only set to `true` when `auth.role` is `SUPER_ADMIN`, `ADMIN`, `COURSE_MANAGER`, or `INSTRUCTOR`.
3. **Idempotent Automated Certificate Issuance:**
   - Once a student meets all criteria under `evaluateCourseCompletion`, `issueAutomaticCertificate` checks whether a certificate with matching `(enrollmentId, certificateType)` exists before creating a new sequence entry. This eliminates duplicate certificate collisions.

