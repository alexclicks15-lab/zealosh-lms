// Zealosh LMS — Gamification & Learner Motivation Test Suite
// File: tests/gamification-learner-motivation.test.ts
// Tests Workstream C: Authoritative points ledger, idempotency anti-abuse guards,
// Asia/Kolkata daily streak engine, badge awards, scoped leaderboards, and daily question challenges.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  gamificationService,
  inMemoryPointsLedger,
  inMemoryStudentStreaks,
  inMemoryUserBadgeAwards,
  inMemoryDailySubmissions,
  inMemoryGamificationRules,
} from '@/lib/gamification/gamification-service';
import { db } from '@/lib/store/db';

describe('Zealosh LMS — Workstream C: Gamification & Learner Motivation Suite', () => {
  const TEST_STUDENT_A = 'usr-student-gam-01';
  const TEST_STUDENT_B = 'usr-student-gam-02';
  const TEST_COURSE_ID = 'crs-asp-01';

  beforeEach(() => {
    inMemoryPointsLedger.clear();
    inMemoryStudentStreaks.clear();
    inMemoryUserBadgeAwards.clear();
    inMemoryDailySubmissions.clear();

    // Seed test users
    db.users.set(TEST_STUDENT_A, {
      id: TEST_STUDENT_A,
      name: 'Alex Chen',
      email: 'alex@example.com',
      role: 'STUDENT',
      createdAt: '2026-01-01T00:00:00Z',
    } as any);

    db.users.set(TEST_STUDENT_B, {
      id: TEST_STUDENT_B,
      name: 'Fatima Al-Mansoor',
      email: 'fatima@example.com',
      role: 'STUDENT',
      createdAt: '2026-01-01T00:00:00Z',
    } as any);

    // Seed enrollments for scoped leaderboards
    db.enrollments.set(`enr-${TEST_STUDENT_A}`, {
      id: `enr-${TEST_STUDENT_A}`,
      userId: TEST_STUDENT_A,
      courseId: TEST_COURSE_ID,
      batchId: 'btc-asp-nov26',
      status: 'ACTIVE',
      enrolledAt: '2026-01-01T00:00:00Z',
    } as any);

    db.enrollments.set(`enr-${TEST_STUDENT_B}`, {
      id: `enr-${TEST_STUDENT_B}`,
      userId: TEST_STUDENT_B,
      courseId: TEST_COURSE_ID,
      batchId: 'btc-asp-nov26',
      status: 'ACTIVE',
      enrolledAt: '2026-01-01T00:00:00Z',
    } as any);
  });

  it('GAMIFICATION-01: Ingests authoritative academic activity events and awards points according to active rules', () => {
    const res = gamificationService.recordActivityPoints({
      studentId: TEST_STUDENT_A,
      sourceEventId: 'lsn-01-completion',
      activityType: 'LESSON_COMPLETED',
      courseId: TEST_COURSE_ID,
    });

    expect(res.awarded).toBe(true);
    expect(res.pointsAwarded).toBe(15);
    expect(res.entry.idempotencyKey).toBe(`${TEST_STUDENT_A}:LESSON_COMPLETED:lsn-01-completion`);

    const totalPoints = gamificationService.getStudentTotalPoints(TEST_STUDENT_A);
    expect(totalPoints).toBe(15);
  });

  it('GAMIFICATION-02: Anti-abuse idempotency guard: duplicate source event delivery awards zero points', () => {
    // First delivery
    const res1 = gamificationService.recordActivityPoints({
      studentId: TEST_STUDENT_A,
      sourceEventId: 'asg-01-submission',
      activityType: 'ASSIGNMENT_SUBMITTED',
      courseId: TEST_COURSE_ID,
    });
    expect(res1.awarded).toBe(true);
    expect(res1.pointsAwarded).toBe(30);

    // Replayed duplicate delivery of identical event
    const res2 = gamificationService.recordActivityPoints({
      studentId: TEST_STUDENT_A,
      sourceEventId: 'asg-01-submission',
      activityType: 'ASSIGNMENT_SUBMITTED',
      courseId: TEST_COURSE_ID,
    });
    expect(res2.awarded).toBe(false);
    expect(res2.pointsAwarded).toBe(0);

    // Total points must remain exactly 30, NOT 60
    expect(gamificationService.getStudentTotalPoints(TEST_STUDENT_A)).toBe(30);
  });

  it('GAMIFICATION-03: Inactive or unconfigured rules award 0 points', () => {
    // Temporarily deactivate a rule
    const rule = inMemoryGamificationRules.get('QUIZ_COMPLETED');
    if (rule) rule.status = 'INACTIVE';

    const res = gamificationService.recordActivityPoints({
      studentId: TEST_STUDENT_A,
      sourceEventId: 'quiz-01-attempt',
      activityType: 'QUIZ_COMPLETED',
    });

    expect(res.pointsAwarded).toBe(0);
    expect(res.entry.awardReason).toContain('inactive or unconfigured');

    // Restore rule
    if (rule) rule.status = 'ACTIVE';
  });

  it('GAMIFICATION-04: Daily learning streak engine anchored to Asia/Kolkata handles multiple same-day and consecutive events', () => {
    const today = gamificationService.getTodayInKolkata();

    // 1. First activity of the day -> initializes streak to 1
    gamificationService.updateStreak(TEST_STUDENT_A);
    let streak = gamificationService.getStudentStreak(TEST_STUDENT_A);
    expect(streak.currentStreak).toBe(1);
    expect(streak.lastActivityDate).toBe(today);

    // 2. Second activity on the same local date -> streak remains 1 (no duplicate increment)
    gamificationService.updateStreak(TEST_STUDENT_A);
    streak = gamificationService.getStudentStreak(TEST_STUDENT_A);
    expect(streak.currentStreak).toBe(1);
    expect(streak.totalActiveDays).toBe(1);

    // 3. Simulate consecutive day (yesterday was active)
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    inMemoryStudentStreaks.set(TEST_STUDENT_B, {
      studentId: TEST_STUDENT_B,
      currentStreak: 4,
      longestStreak: 4,
      lastActivityDate: yesterday,
      totalActiveDays: 4,
      history: [yesterday],
      updatedAt: new Date().toISOString(),
    });

    // Student B acts today
    gamificationService.updateStreak(TEST_STUDENT_B);
    const updatedB = gamificationService.getStudentStreak(TEST_STUDENT_B);
    expect(updatedB.currentStreak).toBe(5);
    expect(updatedB.longestStreak).toBe(5);
    expect(updatedB.lastActivityDate).toBe(today);
  });

  it('GAMIFICATION-05: Badge engine awards milestone, streak, and assessment badges idempotently', () => {
    // Award FIRST_LESSON
    const award1 = gamificationService.awardBadge(TEST_STUDENT_A, 'FIRST_LESSON', 'evt-first-lesson');
    expect(award1.awarded).toBe(true);
    expect(award1.award?.badgeCode).toBe('FIRST_LESSON');

    // Re-award attempt must be idempotent
    const award2 = gamificationService.awardBadge(TEST_STUDENT_A, 'FIRST_LESSON', 'evt-first-lesson-repeat');
    expect(award2.awarded).toBe(false);

    const badges = gamificationService.getStudentBadges(TEST_STUDENT_A);
    expect(badges.length).toBe(1);
  });

  it('GAMIFICATION-06: Scoped leaderboards aggregate points across course, batch, or institution and respect privacy', () => {
    // Award points to Student A (100 pts) and Student B (50 pts)
    gamificationService.recordActivityPoints({
      studentId: TEST_STUDENT_A,
      sourceEventId: 'exam-01-pass',
      activityType: 'EXAM_PASSED',
      customPoints: 100,
    });

    gamificationService.recordActivityPoints({
      studentId: TEST_STUDENT_B,
      sourceEventId: 'quiz-01-pass',
      activityType: 'QUIZ_COMPLETED',
      customPoints: 50,
    });

    // Check course leaderboard
    const leaderboard = gamificationService.getLeaderboard('COURSE', 'ALL_TIME', TEST_COURSE_ID, TEST_STUDENT_A);
    expect(leaderboard.length).toBeGreaterThanOrEqual(2);

    const entryA = leaderboard.find(e => e.studentId === TEST_STUDENT_A);
    const entryB = leaderboard.find(e => e.studentId === TEST_STUDENT_B);
    expect(entryA).toBeDefined();
    expect(entryB).toBeDefined();
    expect(entryA?.totalPoints).toBe(100);
    expect(entryB?.totalPoints).toBe(50);
    expect(entryA!.rank).toBeLessThan(entryB!.rank);
    expect(entryA?.isCurrentUser).toBe(true);
  });

  it('GAMIFICATION-07: Daily Question Challenge reuses Central Question Bank with zero answer-key leakage', () => {
    // 1. Get daily challenge
    const challenge = gamificationService.getDailyChallenge();
    expect(challenge.id).toBeDefined();
    expect(challenge.stem).toBeDefined();
    expect(challenge.options.length).toBeGreaterThan(0);
    expect((challenge as any).correctOptionId).toBeUndefined(); // Zero answer key leakage!

    // 2. Submit answer
    const submission = gamificationService.submitDailyChallenge({
      studentId: TEST_STUDENT_A,
      challengeId: challenge.id,
      questionId: challenge.questionId,
      selectedOptionId: challenge.options[0].id,
    });

    expect(submission.challengeId).toBe(challenge.id);
    expect(submission.correctOptionId).toBeDefined(); // Revealed only post-submission!
    expect(submission.explanation).toBeDefined();

    // 3. Duplicate daily challenge attempt throws error
    expect(() => {
      gamificationService.submitDailyChallenge({
        studentId: TEST_STUDENT_A,
        challengeId: challenge.id,
        questionId: challenge.questionId,
        selectedOptionId: challenge.options[0].id,
      });
    }).toThrow(/already been completed/);
  });
});
