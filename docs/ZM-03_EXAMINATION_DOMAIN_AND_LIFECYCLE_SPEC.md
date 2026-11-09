# Zealosh LMS — ZM-03 & ZM-03.1 Examination Domain, Immutable Snapshots & Lifecycle Specification

**Milestones:** ZM-03 & ZM-03.1  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** High-Stakes HSE Certification Examination Engine, Frozen Question Snapshots, Anti-Cheat Projection & Server-Authoritative Timer  
**Authoritative Implementation:** [`src/lib/store/db.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts) & [`src/types/index.ts`](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/types/index.ts)

---

## 1. Domain Overview & High-Stakes Architecture

Zealosh Training & Consultants delivers high-stakes professional health, safety, and environmental (HSE) certification masterclasses (e.g., BCSP ASP, BCSP CSP, BCRSP, and CIT). The High-Stakes Examination Engine enforces institutional integrity, anti-cheat protection, objective psychometric evaluation, and manual rubric evaluation.

### Key Lifecycle States

```
                +-----------------------------------------+
                |          SCHEDULED SITTING              |
                |  (Enrolled Candidate, Window Opened)    |
                +--------------------+--------------------+
                                     |
                                     v
                        +---------------------------+
                        |        IN_PROGRESS        | <------+
                        |  - Server timer ticking   |        | In-Flight
                        |  - Frozen question state  | -------+ Autosave &
                        |  - Redacted projection    |        | Reconnect
                        +-------------+-------------+
                                      |
                      +---------------+---------------+
                      |                               |
                      v                               v
             [Pure Objective Exam]          [Subjective / Hybrid Exam]
                      |                               |
                      v                               v
            +-------------------+       +-------------------------------+
            |     COMPLETED     |       |   PENDING_MANUAL_EVALUATION   |
            | - Authoritative   |       |   (Instructor Normalized      |
            |   scoring         |       |    Rubric Evaluation Queue)   |
            | - Domain breakdown|       +---------------+---------------+
            +---------+---------+                       |
                      |                         Evaluator Submits
                      v                         Manual Grade
            +-------------------+                       |
            |  EXAM CERTIFICATE | <---------------------+
            |  (ZEI/EXAM/...)   |
            +-------------------+
```

---

## 2. Frozen Question Snapshot Architecture (`FrozenExamQuestionSnapshot`)

### 2.1 The Mutation Vulnerability
In standard LMS architectures, exam attempts store only an array of question IDs (`assignedQuestionIds: string[]`). If faculty modify question stems, correct options, rubric criteria, or point values in the central question bank while students are testing or after submission, active attempts and gradebooks are silently corrupted.

### 2.2 The ZM-03.1 Immutable Freeze Solution
When `startExamAttempt` is invoked:
1. Assigned questions are retrieved from the authoritative bank.
2. An immutable deep snapshot (`FrozenExamQuestionSnapshot[]`) is generated and persisted on `ExamAttempt.questionSnapshots`:
   ```ts
   export interface FrozenExamQuestionSnapshot {
     id: string;
     version?: number;
     domain: string;
     topic?: string;
     stem: string;
     type: QuestionType;
     options: { id: string; text: string }[];
     points?: number;
     rubricCriteria?: { id: string; name: string; maxPoints: number; description?: string }[];
     correctOptionIds: string[]; // Preserved server-side for authoritative grading
     explanation?: string;       // Preserved server-side for post-exam review
   }
   ```
3. **Client-Safe Projection:** `getQuestionsForAttempt` projects questions from the frozen snapshot, redacting `correctOptionIds`, `explanation`, and `referenceSource`.
4. **Authoritative Evaluation:** `submitExamAttempt` evaluates student answers strictly against the frozen snapshot. Subsequent bank mutations have zero effect on active or completed candidate attempts.

---

## 3. Server-Authoritative Countdown Timing & Grace Period

- **Deadline Calculation:**
  $$\text{deadlineTime} = \text{startTime} + (\text{durationMinutes} \times 60 + \text{gracePeriodSeconds}) \times 1000\text{ ms}$$
- **Server Enforcement:**
  - Client clocks are untrusted.
  - Autosave calls (`saveExamAnswers`) verify `Date.now() < deadlineTime`. Post-deadline requests reject with `EXAM_DEADLINE_EXPIRED`.
  - Submit calls (`submitExamAttempt`) reject post-deadline requests with `EXAM_DEADLINE_EXPIRED: Examination deadline has elapsed`.
  - Reconnect recovery via `GET /api/exams/[id]` calculates remaining time based on server deadline without resetting the timer.
