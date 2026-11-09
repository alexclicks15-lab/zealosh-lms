# WORKSTREAM D — CANDIDATE ANSWER-KEY SECURITY REPORT

### 1. Server-Side Redaction Protocol
In `ZealoshDatabase.getQuestionsForAttempt`:
```typescript
const snap = attempt?.questionSnapshots?.find((s) => s.id === qId);
if (snap) {
  const { correctOptionIds, explanation, referenceSource, ...clientSafe } = snap as any;
  return clientSafe as Partial<ExamQuestion>;
}
```

### 2. Verified API Endpoints
- `GET /api/exams/[id]`: Returns client questions via `getQuestionsForAttempt`. Correct answers and explanations are completely absent from serialized JSON payloads.
- `POST /api/exams/[id]/start`: Initializes attempt and returns sanitized questions.
- `GET /api/exams`: Lists blueprint metadata only; question arrays are omitted.
- `POST /api/exams/[id]/submit`: Reveals explanations and correct options ONLY after attempt is finalized and scored.
