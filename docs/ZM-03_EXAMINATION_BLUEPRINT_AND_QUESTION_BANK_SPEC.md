# Zealosh LMS — ZM-03 Examination Blueprint & Question Bank Specification

**Milestone:** ZM-03  
**Institution:** Zealosh Training & Consultants (`https://zealosh.com`)  
**Scope:** Blueprint Versioning, Question Bank Shielding & Rubric Criteria  
**Authoritative Reference:** [db.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/lib/store/db.ts), [index.ts](file:///C:/Users/alexc/.gemini/antigravity-ide/scratch/zealosh-lms/src/types/index.ts)

---

## 1. Blueprint Architecture & Versioning

Examination Blueprints govern high-stakes certification assessments. They specify the distribution of questions across professional domains, question types, time limits, and passing thresholds.

### Blueprint Entity Model

```typescript
export interface ExamBlueprint {
  id: string;
  certificationType: CertificationType | string; // 'ASP' | 'CSP' | 'BCRSP' | 'CIT'
  title: string;
  version: number;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  totalQuestions: number;
  timeLimitMinutes: number;
  gracePeriodSeconds: number; // Default 60s
  passingScorePercent: number; // e.g., 70%
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  sittingStartTime?: string;
  sittingEndTime?: string;
  domains: {
    domainId: string;
    domainName: string;
    questionCount: number;
    weightPercent: number;
  }[];
  rubricCriteria?: {
    id: string;
    name: string;
    maxPoints: number;
    description?: string;
  }[];
  createdAt?: string;
  updatedAt?: string;
}
```

### Versioning Rules
- Active blueprints in use by active examination sittings are immutable.
- Structural edits (domain weighting, passing score changes, or duration adjustments) increment `version` and preserve previous versions for historical audit.
- Sittings reference exact blueprint versions.

---

## 2. Question Bank Shielding & Anti-Cheat Projection

The question bank stores both objective (multiple choice, true/false, numerical) and subjective (rubric-evaluated scenario) questions.

### Security Shielding Rule
When delivering questions to candidates via `GET /api/exams/[id]` or `POST /api/exams/[id]/start`:
- `correctOptionIds` / `correctAnswer` are strictly stripped from server responses.
- `explanation` is strictly stripped during active examination.
- Explanations are only retrievable after the instructor or administrator publishes official results (`publishExamResults`).

### Question Item Types
1. `SINGLE_CHOICE`: Single select option ID (`correctOptionIds: string[]` containing 1 item).
2. `MULTIPLE_CHOICE`: Multi-select option IDs (`correctOptionIds: string[]` containing >= 2 items). Full points awarded only on exact match.
3. `TRUE_FALSE`: Binary boolean option.
4. `NUMERICAL`: Numerical value within configured tolerance range.
5. `ESSAY / CASE_STUDY`: Free-text answer evaluated against `rubricCriteria`.

