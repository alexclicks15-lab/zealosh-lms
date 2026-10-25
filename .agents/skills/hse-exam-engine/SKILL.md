---
name: hse-exam-engine
description: Comprehensive runbook for the Zealosh High-Stakes HSE Certification Examination Engine. Use this skill when implementing certification blueprints (BCSP ASP/CSP, BCRSP, CIT), question banks, randomized question selection, server-enforced countdown deadlines, anti-cheat question projection, in-flight answer saving, or domain diagnostic scoring.
---

# HSE Certification Examination Engine Runbook

## Overview
The Zealosh HSE Examination Engine provides authentic certification mock simulations for BCSP (ASP, CSP, CIT) and BCRSP (CRSP) credentials. It enforces server-authoritative integrity, domain blueprint weighting, formula references, and diagnostic reports.

## Core Architectural Invariants
1. **Anti-Cheat Question Projection:**
   - When delivering questions to an active exam screen (`/api/exams/:id/start`), the server MUST strip `correctOptionIds`, `explanation`, and `referenceSource` from the payload.
   - Answer keys and explanations are only revealed after the attempt has been finalized (`status = 'COMPLETED'`).
2. **Server-Enforced Deadline (Never Trust Browser Clocks):**
   - The exam deadline is set on the server: `deadlineTime = startTime + durationMinutes`.
   - The frontend timer is purely a visual countdown.
   - Any answer sent after `deadlineTime + 60s (grace period)` is rejected with HTTP 408 `EXAM_DEADLINE_EXPIRED`.
3. **Periodic In-Flight Answer Saving:**
   - Client sends incremental answers every 30 seconds or upon question navigation via `PUT /api/exams/:id/answers`.
   - Network dropouts do not result in data loss; upon reconnection or browser reload, the attempt resumes with all previously saved answers intact.
4. **Authoritative Domain Scoring:**
   - Scoring compares selected option IDs against authoritative `exam_questions.correctOptionIds`.
   - Results compute overall percentage, pass/fail status against the blueprint passing threshold, and domain-by-domain diagnostic breakdowns.
   - Completed attempts are sealed and immutable.

## BCSP & BCRSP Examination Blueprint Mapping

| Certification | Blueprint Domains | Standard Weights | Passing Threshold | Exam Time Limit |
| :--- | :--- | :--- | :--- | :--- |
| **ASP** (BCSP) | Advanced Sciences & Math<br>Emergency Response<br>Industrial Hygiene<br>Environmental Management | 35%<br>25%<br>20%<br>20% | 70% | 5.0 hours (200 Qs)<br>*Scaled for mock* |
| **CSP** (BCSP) | Advanced Sciences & Risk<br>Safety Management Systems<br>Occupational Health & Ergonomics<br>Emergency Prep & Security | 30%<br>30%<br>20%<br>20% | 70% | 5.5 hours (200 Qs) |
| **CRSP** (BCRSP)| Canadian OHS Legislation<br>Hazard Identification & Risk<br>Occupational Hygiene & Health<br>Safety Management Systems | 25%<br>30%<br>25%<br>20% | 70% | 3.5 hours (180 Qs) |
| **CIT** (BCSP) | Adult Learning Theory & Andragogy<br>Instructional Design (ADDIE)<br>Delivery & Presentation Skills<br>Evaluation & Measurement | 30%<br>30%<br>25%<br>15% | 75% | 2.0 hours (100 Qs) |

## Scoring Engine Algorithm
```typescript
function scoreAttempt(attempt: ExamAttempt, questionBank: Map<string, ExamQuestion>): ExamResult {
  let correctCount = 0;
  const domainBreakdown: Record<string, { total: number; correct: number; percent: number }> = {};

  attempt.assignedQuestionIds.forEach((qId) => {
    const q = questionBank.get(qId)!;
    if (!domainBreakdown[q.domain]) {
      domainBreakdown[q.domain] = { total: 0, correct: 0, percent: 0 };
    }
    domainBreakdown[q.domain].total += 1;

    const userSelected = attempt.answers[qId] || [];
    const isCorrect = userSelected.length === q.correctOptionIds.length &&
      userSelected.every((opt) => q.correctOptionIds.includes(opt));

    if (isCorrect) {
      correctCount += 1;
      domainBreakdown[q.domain].correct += 1;
    }
  });

  Object.keys(domainBreakdown).forEach((domain) => {
    const s = domainBreakdown[domain];
    s.percent = Math.round((s.correct / s.total) * 100);
  });

  const totalQuestions = attempt.assignedQuestionIds.length;
  const totalScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = totalScore >= attempt.passingScorePercent;

  return { totalScore, passed, domainBreakdown };
}
```
