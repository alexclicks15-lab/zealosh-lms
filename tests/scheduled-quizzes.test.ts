import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { Quiz, QuizQuestion } from '@/types';

describe('Workstream C: Pre-Scheduled Question-Bank Quizzes', () => {

  it('enforces pre-scheduled opening time window (rejects early attempts)', async () => {
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(); // 2 hours from now
    const quiz = await db.saveQuiz({
      id: `quiz-future-${Date.now()}`,
      courseId: 'course-asp',
      title: 'Upcoming Scheduled Radiation Quiz',
      quizType: 'TOPIC_QUIZ',
      scheduledStartTime: futureTime,
      timeLimitMinutes: 20,
    });

    await expect(db.startQuizAttempt(quiz.id, 'student-1')).rejects.toThrow('QUIZ_NOT_OPEN');
  });

  it('enforces pre-scheduled closing time window (rejects expired attempts)', async () => {
    const pastStart = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const pastEnd = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // Closed 1 hour ago
    const quiz = await db.saveQuiz({
      id: `quiz-past-${Date.now()}`,
      courseId: 'course-asp',
      title: 'Closed Radiation Practice Drill',
      quizType: 'PRACTICE_DRILL',
      scheduledStartTime: pastStart,
      scheduledEndTime: pastEnd,
      timeLimitMinutes: 20,
    });

    await expect(db.startQuizAttempt(quiz.id, 'student-1')).rejects.toThrow('QUIZ_CLOSED');
  });

  it('captures immutable frozen question snapshots upon attempt start', async () => {
    const quiz = await db.saveQuiz({
      id: `quiz-snap-${Date.now()}`,
      courseId: 'course-asp',
      title: 'Ergonomics Benchmark Assessment',
      quizType: 'TOPIC_QUIZ',
      timeLimitMinutes: 15,
    });

    // Add question
    const q1 = await db.saveQuizQuestion({
      id: `q-snap-1-${Date.now()}`,
      quizId: quiz.id,
      questionText: 'What is the action limit for the NIOSH lifting equation?',
      questionType: 'SINGLE_CHOICE',
      options: [
        { id: 'opt-1', text: '51 lbs (23 kg)' },
        { id: 'opt-2', text: '75 lbs (34 kg)' },
      ],
      correctAnswer: 'opt-1',
      points: 2,
    });

    const attempt = await db.startQuizAttempt(quiz.id, `student-snap-${Date.now()}`);
    expect(attempt.frozenQuestions).toBeDefined();
    expect(attempt.frozenQuestions?.length).toBe(1);
    expect(attempt.frozenQuestions?.[0].questionText).toContain('NIOSH lifting equation');

    // Mutate the question bank afterwards
    await db.saveQuizQuestion({
      ...q1,
      questionText: 'MUTATED QUESTION TEXT AFTER ATTEMPT CREATION',
    });

    // Verify the attempt preserves its frozen question snapshot intact
    const fetchedAttempt = (await db.getQuizAttempts(quiz.id)).find((a) => a.id === attempt.id);
    expect(fetchedAttempt?.frozenQuestions?.[0].questionText).toContain('NIOSH lifting equation');
  });

  it('enforces server-authoritative attempt deadline and marks overdue attempts TIMED_OUT', async () => {
    const quiz = await db.saveQuiz({
      id: `quiz-timeout-${Date.now()}`,
      courseId: 'course-asp',
      title: 'Speed Drill Fire Protection',
      quizType: 'PRACTICE_DRILL',
      timeLimitMinutes: 1, // 1 minute
    });

    await db.saveQuizQuestion({
      quizId: quiz.id,
      questionText: 'What is Class B fire fuel?',
      questionType: 'SINGLE_CHOICE',
      options: [
        { id: 'a', text: 'Flammable liquids' },
        { id: 'b', text: 'Ordinary combustibles' },
      ],
      correctAnswer: 'a',
      points: 1,
    });

    const userId = `student-time-${Date.now()}`;
    const attempt = await db.startQuizAttempt(quiz.id, userId);
    expect(attempt.deadline).toBeDefined();

    // Artificially simulate an expired deadline (e.g. deadline was 5 minutes ago)
    const pastDeadline = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    attempt.deadline = pastDeadline;
    db.quizAttempts.set(attempt.id, attempt);

    // Save student answer
    await db.saveQuizAttemptAnswer(attempt.id, Object.keys(attempt.answers)[0] || 'any', 'a');

    // Submit attempt after deadline
    const submitted = await db.submitQuizAttempt(attempt.id, userId);
    expect(submitted.status).toBe('TIMED_OUT');
    expect(submitted.passed).toBe(false);
  });
});
