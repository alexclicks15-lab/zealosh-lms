import { describe, it, expect } from 'vitest';
import { db } from '../src/lib/store/db';

describe('HSE Certification Examination Engine Invariants', () => {
  it('should initialize a timed attempt with assigned blueprint questions', async () => {
    const attempt = await db.startExamAttempt('usr-std-01', 'bp-asp-bcsp-v10');

    expect(attempt).toBeDefined();
    expect(attempt.status).toBe('IN_PROGRESS');
    expect(attempt.assignedQuestionIds.length).toBeGreaterThan(0);
    expect(new Date(attempt.deadlineTime).getTime()).toBeGreaterThan(new Date(attempt.startTime).getTime());
  });

  it('should auto-save answers and bookmarks during an active attempt', async () => {
    const attempt = await db.startExamAttempt('usr-std-01', 'bp-asp-bcsp-v10');
    const qId = attempt.assignedQuestionIds[0];

    const updated = await db.saveExamAnswers(attempt.id, 'usr-std-01', { [qId]: ['opt-b'] }, [qId]);

    expect(updated.answers[qId]).toEqual(['opt-b']);
    expect(updated.bookmarkedQuestionIds).toContain(qId);
  });

  it('should reject answer updates after exam deadline has expired', async () => {
    const attempt = await db.startExamAttempt('usr-std-01', 'bp-asp-bcsp-v10');
    // Artificially simulate passed deadline
    attempt.deadlineTime = new Date(Date.now() - 60000).toISOString();

    await expect(
      db.saveExamAnswers(attempt.id, 'usr-std-01', { 'q-asp-01': ['opt-b'] })
    ).rejects.toThrow('EXAM_DEADLINE_EXPIRED');

    expect(attempt.status).toBe('EXPIRED');
  });

  it('should calculate authoritative scores, passing thresholds, and domain breakdowns upon submission', async () => {
    const attempt = await db.startExamAttempt('usr-std-01', 'bp-asp-bcsp-v10');

    // Answer with known correct options:
    // q-asp-01 correct is 'opt-b' (13.3 mR/hr)
    // q-asp-02 correct is 'opt-b' (88 dBA)
    // q-asp-03 correct is 'opt-c' (LEV)
    // q-asp-04 correct is 'opt-d' (Class D)
    // q-asp-05 correct is 'opt-a' (Ignitability, Corrosivity...)
    await db.saveExamAnswers(attempt.id, 'usr-std-01', {
      'q-asp-01': ['opt-b'],
      'q-asp-02': ['opt-b'],
      'q-asp-03': ['opt-c'],
      'q-asp-04': ['opt-d'],
      'q-asp-05': ['opt-a'],
    });

    const result = await db.submitExamAttempt(attempt.id, 'usr-std-01');

    expect(result.status).toBe('COMPLETED');
    expect(result.totalScore).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.domainBreakdown).toBeDefined();
    expect(result.domainBreakdown!['Advanced Sciences and Math'].percent).toBe(100);
    expect(result.domainBreakdown!['Environmental Management Systems'].percent).toBe(100);
  });
});
