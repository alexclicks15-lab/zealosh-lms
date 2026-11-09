// Zealosh LMS — Gamification & Learner Motivation Engine
// File: src/lib/gamification/gamification-service.ts
// Governs the durable XP points ledger, Asia/Kolkata daily learning streak engine,
// idempotent badge grants, privacy-scoped leaderboards, and daily question challenges.

import {
  GamificationActivityType,
  PointLedgerEntry,
  GamificationRule,
  StudentStreak,
  BadgeDefinition,
  UserBadgeAward,
  LeaderboardScope,
  LeaderboardPeriod,
  LeaderboardEntry,
  DailyQuestionChallenge,
  DailyChallengeSubmission,
} from '@/types';
import { db } from '@/lib/store/db';
import {
  questionBankService,
  inMemoryQuestionBankItems,
  inMemoryQuestionVersions,
} from '@/lib/assessment/question-bank-service';

export const inMemoryGamificationRules: Map<string, GamificationRule> = new Map();
export const inMemoryPointsLedger: Map<string, PointLedgerEntry> = new Map(); // idempotencyKey -> entry
export const inMemoryStudentStreaks: Map<string, StudentStreak> = new Map(); // studentId -> streak
export const inMemoryBadgeDefinitions: Map<string, BadgeDefinition> = new Map();
export const inMemoryUserBadgeAwards: Map<string, UserBadgeAward> = new Map(); // idempotencyKey -> award
export const inMemoryDailySubmissions: Map<string, DailyChallengeSubmission> = new Map(); // studentId:challengeId -> submission

export class GamificationService {
  constructor() {
    this.seedDefaultRulesAndBadges();
  }

  // --------------------------------------------------------------------------
  // Seed Default Rules & Badges
  // --------------------------------------------------------------------------
  private seedDefaultRulesAndBadges() {
    if (inMemoryGamificationRules.size === 0) {
      const defaultRules: GamificationRule[] = [
        {
          id: 'rule-lesson-completed',
          activityType: 'LESSON_COMPLETED',
          points: 15,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded when a learner marks an academic lesson completed.',
        },
        {
          id: 'rule-assignment-submitted',
          activityType: 'ASSIGNMENT_SUBMITTED',
          points: 30,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded upon initial submission of course assignment.',
        },
        {
          id: 'rule-quiz-completed',
          activityType: 'QUIZ_COMPLETED',
          points: 20,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded upon completing a modular formative quiz.',
        },
        {
          id: 'rule-exam-passed',
          activityType: 'EXAM_PASSED',
          points: 100,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded for scoring >= 70% on a certification examination or full mock.',
        },
        {
          id: 'rule-attendance-recorded',
          activityType: 'ATTENDANCE_RECORDED',
          points: 25,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded for verified attendance in a live classroom lecture.',
        },
        {
          id: 'rule-daily-question',
          activityType: 'DAILY_QUESTION_ANSWERED',
          points: 10,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded for answering the daily question challenge.',
        },
        {
          id: 'rule-course-completed',
          activityType: 'COURSE_COMPLETED',
          points: 250,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Awarded for achieving 100% course curriculum completion.',
        },
        {
          id: 'rule-manual-award',
          activityType: 'MANUAL_AWARD',
          points: 50,
          status: 'ACTIVE',
          policyVersion: '1.0',
          description: 'Audited administrative discretionary point grant.',
        },
      ];

      for (const rule of defaultRules) {
        inMemoryGamificationRules.set(rule.activityType, rule);
      }
    }

    if (inMemoryBadgeDefinitions.size === 0) {
      const defaultBadges: BadgeDefinition[] = [
        {
          id: 'badge-first-lesson',
          code: 'FIRST_LESSON',
          title: 'First Step to Safety',
          description: 'Completed your very first academic lesson on Zealosh LMS.',
          icon: '🎯',
          category: 'MILESTONE',
          criteriaDescription: 'Complete at least 1 course lesson.',
          status: 'ACTIVE',
          version: 1,
        },
        {
          id: 'badge-7-day-streak',
          code: 'SEVEN_DAY_STREAK',
          title: '7-Day Safety Discipline',
          description: 'Maintained a 7-day continuous learning streak.',
          icon: '🔥',
          category: 'STREAK',
          criteriaDescription: 'Reach a streak of 7 consecutive days in Asia/Kolkata timezone.',
          status: 'ACTIVE',
          version: 1,
        },
        {
          id: 'badge-first-quiz-perfect',
          code: 'FIRST_QUIZ_PERFECT',
          title: 'Flawless Knowledge',
          description: 'Achieved 100% score on a formative assessment.',
          icon: '⭐',
          category: 'ASSESSMENT',
          criteriaDescription: 'Score 100% on any quiz attempt.',
          status: 'ACTIVE',
          version: 1,
        },
        {
          id: 'badge-exam-master',
          code: 'EXAM_MASTER',
          title: 'Certification Ready',
          description: 'Passed an official mock exam with a score >= 80%.',
          icon: '🏆',
          category: 'MASTERY',
          criteriaDescription: 'Pass a certification exam attempt with 80% or higher.',
          status: 'ACTIVE',
          version: 1,
        },
        {
          id: 'badge-daily-scholar',
          code: 'DAILY_SCHOLAR',
          title: 'Daily Scholar',
          description: 'Answered 5 daily question challenges.',
          icon: '📚',
          category: 'COMMUNITY',
          criteriaDescription: 'Successfully answer 5 daily challenges.',
          status: 'ACTIVE',
          version: 1,
        },
      ];

      for (const b of defaultBadges) {
        inMemoryBadgeDefinitions.set(b.id, b);
        inMemoryBadgeDefinitions.set(b.code, b);
      }
    }
  }

  // --------------------------------------------------------------------------
  // Asia/Kolkata Date Helper
  // --------------------------------------------------------------------------
  public getTodayInKolkata(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date()); // Formats as 'YYYY-MM-DD'
  }

  private getPreviousDay(dateString: string): string {
    const d = new Date(dateString + 'T00:00:00.000Z');
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().split('T')[0];
  }

  // --------------------------------------------------------------------------
  // Durable Points Ledger & Idempotent Ingestion
  // --------------------------------------------------------------------------
  public recordActivityPoints(params: {
    studentId: string;
    sourceEventId: string;
    activityType: GamificationActivityType;
    courseId?: string;
    batchId?: string;
    policyVersion?: string;
    customPoints?: number;
    awardReason?: string;
    awardedBy?: string;
  }): { awarded: boolean; pointsAwarded: number; entry: PointLedgerEntry } {
    const idempotencyKey = `${params.studentId}:${params.activityType}:${params.sourceEventId}`;

    // Idempotency Check: prevent duplicate rewards for replayed events
    const existing = inMemoryPointsLedger.get(idempotencyKey);
    if (existing) {
      return { awarded: false, pointsAwarded: 0, entry: existing };
    }

    // Lookup points policy rule
    const rule = inMemoryGamificationRules.get(params.activityType);
    let points = 0;
    let reason = params.awardReason || 'Academic learning reward';

    if (params.customPoints !== undefined) {
      points = params.customPoints;
    } else if (rule && rule.status === 'ACTIVE') {
      points = rule.points;
      reason = rule.description;
    } else {
      // Unconfigured or inactive rule awards 0 points
      points = 0;
      reason = 'Rule inactive or unconfigured';
    }

    const entryId = `pts-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const entry: PointLedgerEntry = {
      id: entryId,
      studentId: params.studentId,
      sourceEventId: params.sourceEventId,
      activityType: params.activityType,
      pointsAwarded: points,
      awardReason: reason,
      courseId: params.courseId,
      batchId: params.batchId,
      earnedAt: new Date().toISOString(),
      idempotencyKey,
      policyVersion: params.policyVersion || rule?.policyVersion || '1.0',
      awardedBy: params.awardedBy || 'SYSTEM',
    };

    inMemoryPointsLedger.set(idempotencyKey, entry);

    // If points > 0, update learning streak and check badges
    if (points > 0) {
      this.updateStreak(params.studentId);
      this.evaluateBadges(params.studentId);
    }

    return { awarded: true, pointsAwarded: points, entry };
  }

  public getStudentTotalPoints(studentId: string): number {
    let sum = 0;
    for (const entry of inMemoryPointsLedger.values()) {
      if (entry.studentId === studentId && !entry.reversedAt) {
        sum += entry.pointsAwarded;
      }
    }
    return sum;
  }

  public getStudentPointsLedger(studentId: string): PointLedgerEntry[] {
    return Array.from(inMemoryPointsLedger.values())
      .filter(e => e.studentId === studentId)
      .sort((a, b) => new Date(b.earnedAt).getTime() - new Date(a.earnedAt).getTime());
  }

  // --------------------------------------------------------------------------
  // Daily Learning Streak Engine (Asia/Kolkata Boundaries)
  // --------------------------------------------------------------------------
  public updateStreak(studentId: string): StudentStreak {
    const today = this.getTodayInKolkata();
    const yesterday = this.getPreviousDay(today);

    let streak = inMemoryStudentStreaks.get(studentId);

    if (!streak) {
      streak = {
        studentId,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: today,
        totalActiveDays: 1,
        history: [today],
        updatedAt: new Date().toISOString(),
      };
      inMemoryStudentStreaks.set(studentId, streak);
      return streak;
    }

    // Edge Case 1: Multiple activities on the same local civil date
    if (streak.lastActivityDate === today) {
      streak.updatedAt = new Date().toISOString();
      return streak;
    }

    // Edge Case 2: Consecutive day activity
    if (streak.lastActivityDate === yesterday) {
      streak.currentStreak += 1;
      if (streak.currentStreak > streak.longestStreak) {
        streak.longestStreak = streak.currentStreak;
      }
      streak.totalActiveDays += 1;
      streak.lastActivityDate = today;
      streak.history.push(today);
      streak.updatedAt = new Date().toISOString();

      // Check 7-day streak badge
      if (streak.currentStreak >= 7) {
        this.awardBadge(studentId, 'SEVEN_DAY_STREAK', `streak-7-${today}`);
      }

      return streak;
    }

    // Edge Case 3: Missed day(s) -> Streak resets to 1
    streak.currentStreak = 1;
    streak.totalActiveDays += 1;
    streak.lastActivityDate = today;
    streak.history.push(today);
    streak.updatedAt = new Date().toISOString();

    return streak;
  }

  public getStudentStreak(studentId: string): StudentStreak {
    const streak = inMemoryStudentStreaks.get(studentId);
    if (!streak) {
      return {
        studentId,
        currentStreak: 0,
        longestStreak: 0,
        lastActivityDate: '',
        totalActiveDays: 0,
        history: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return streak;
  }

  // --------------------------------------------------------------------------
  // Badge Evaluation & Idempotent Awards
  // --------------------------------------------------------------------------
  public awardBadge(
    studentId: string,
    badgeCode: string,
    sourceEventId: string,
    awardedBy = 'SYSTEM',
    notes?: string
  ): { awarded: boolean; award?: UserBadgeAward } {
    const badge = inMemoryBadgeDefinitions.get(badgeCode);
    if (!badge || badge.status !== 'ACTIVE') {
      return { awarded: false };
    }

    const idempotencyKey = `${studentId}:${badge.code}:${badge.version}`;
    const existing = inMemoryUserBadgeAwards.get(idempotencyKey);
    if (existing) {
      return { awarded: false, award: existing };
    }

    const awardId = `awd-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const award: UserBadgeAward = {
      id: awardId,
      studentId,
      badgeId: badge.id,
      badgeCode: badge.code,
      badgeTitle: badge.title,
      badgeIcon: badge.icon,
      category: badge.category,
      awardedAt: new Date().toISOString(),
      sourceEventId,
      idempotencyKey,
      awardedBy,
      notes,
    };

    inMemoryUserBadgeAwards.set(idempotencyKey, award);
    return { awarded: true, award };
  }

  public evaluateBadges(studentId: string): UserBadgeAward[] {
    const newAwards: UserBadgeAward[] = [];

    // 1. Check FIRST_LESSON
    const hasLesson = Array.from(inMemoryPointsLedger.values()).some(
      e => e.studentId === studentId && e.activityType === 'LESSON_COMPLETED'
    );
    if (hasLesson) {
      const res = this.awardBadge(studentId, 'FIRST_LESSON', 'first-lesson-check');
      if (res.awarded && res.award) newAwards.push(res.award);
    }

    // 2. Check EXAM_MASTER
    const hasExamPass = Array.from(inMemoryPointsLedger.values()).some(
      e => e.studentId === studentId && e.activityType === 'EXAM_PASSED'
    );
    if (hasExamPass) {
      const res = this.awardBadge(studentId, 'EXAM_MASTER', 'exam-pass-check');
      if (res.awarded && res.award) newAwards.push(res.award);
    }

    // 3. Check DAILY_SCHOLAR
    const challengeSubmissions = Array.from(inMemoryDailySubmissions.values()).filter(
      s => s.studentId === studentId
    );
    if (challengeSubmissions.length >= 5) {
      const res = this.awardBadge(studentId, 'DAILY_SCHOLAR', 'daily-scholar-check');
      if (res.awarded && res.award) newAwards.push(res.award);
    }

    return newAwards;
  }

  public getStudentBadges(studentId: string): UserBadgeAward[] {
    return Array.from(inMemoryUserBadgeAwards.values()).filter(a => a.studentId === studentId);
  }

  // --------------------------------------------------------------------------
  // Scoped Leaderboards (Course, Batch, Institution with Privacy Controls)
  // --------------------------------------------------------------------------
  public getLeaderboard(
    scope: LeaderboardScope,
    period: LeaderboardPeriod,
    scopeId?: string,
    currentUserId?: string
  ): LeaderboardEntry[] {
    // Gather all candidate student IDs
    let candidateStudentIds: string[] = [];

    if (scope === 'COURSE' && scopeId) {
      candidateStudentIds = Array.from(db.enrollments.values())
        .filter(e => e.courseId === scopeId)
        .map(e => e.userId);
    } else if (scope === 'BATCH' && scopeId) {
      candidateStudentIds = Array.from(db.enrollments.values())
        .filter(e => e.batchId === scopeId)
        .map(e => e.userId);
    } else {
      // Institution-wide: all enrolled students
      candidateStudentIds = Array.from(db.enrollments.values()).map(e => e.userId);
    }

    const uniqueStudentIds = Array.from(new Set(candidateStudentIds));

    // Aggregate points per student
    const entries: LeaderboardEntry[] = [];

    for (const studentId of uniqueStudentIds) {
      const user = db.users.get(studentId);
      // Privacy safeguard: check user preference
      const pref = db.userPreferences.get(studentId);
      const isCurrentUser = studentId === currentUserId;

      const totalPoints = this.getStudentTotalPoints(studentId);
      const streak = this.getStudentStreak(studentId);
      const badges = this.getStudentBadges(studentId);

      // Display name formatting (respecting pseudonymous preferences)
      let displayName = user?.name || `Learner #${studentId.substring(studentId.length - 4)}`;
      if (pref && (pref as any).pseudonymousLeaderboard && !isCurrentUser) {
        displayName = `Learner #${studentId.substring(studentId.length - 4)}`;
      }

      entries.push({
        rank: 0,
        studentId,
        displayName,
        totalPoints,
        currentStreak: streak.currentStreak,
        badgesCount: badges.length,
        isCurrentUser,
      });
    }

    // Sort descending by points, then by streak
    entries.sort((a, b) => b.totalPoints - a.totalPoints || b.currentStreak - a.currentStreak);

    // Assign ranks
    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return entries.slice(0, 50); // Bounded to top 50
  }

  // --------------------------------------------------------------------------
  // Daily Question Challenge Engine (Question Bank Integration)
  // --------------------------------------------------------------------------
  public getDailyChallenge(dateString?: string, studentId?: string): DailyQuestionChallenge {
    const targetDate = dateString || this.getTodayInKolkata();
    const challengeId = `daily-chal-${targetDate}`;

    // Reuse published questions from QuestionBankService
    const publishedItems = Array.from(inMemoryQuestionBankItems.values()).filter(q => q.status === 'PUBLISHED');
    const selectedQuestion = publishedItems[0];

    if (selectedQuestion) {
      const versions = inMemoryQuestionVersions.get(selectedQuestion.id) || [];
      const currentVersion = versions.find(v => v.versionNumber === selectedQuestion.currentVersionNumber) || versions[versions.length - 1];
      if (currentVersion) {
        const safeProjection = questionBankService.projectStudentSafeQuestion(currentVersion);
        return {
          id: challengeId,
          date: targetDate,
          questionId: selectedQuestion.id,
          stem: safeProjection.stem,
          options: safeProjection.options,
          domain: safeProjection.domain,
          difficulty: safeProjection.difficulty,
          pointsValue: 10,
        };
      }
    }

    // Fallback if no questions published yet
    return {
      id: challengeId,
      date: targetDate,
      questionId: 'qbk-fallback-01',
      stem: 'Under OSHA 1910 Subpart I, which hazard assessment is required prior to selecting PPE for personnel?',
      options: [
        { id: 'opt-a', text: 'Workplace Hazard Assessment certification in writing' },
        { id: 'opt-b', text: 'Informal verbal assessment by shop foreman' },
        { id: 'opt-c', text: 'Annual financial budget review' },
        { id: 'opt-d', text: 'Equipment vendor recommendation sheet' },
      ],
      domain: 'Safety Regulations',
      difficulty: 'MODERATE',
      pointsValue: 10,
    };
  }

  public submitDailyChallenge(params: {
    studentId: string;
    challengeId: string;
    questionId: string;
    selectedOptionId: string;
  }): DailyChallengeSubmission {
    const submissionKey = `${params.studentId}:${params.challengeId}`;

    // Enforce 1 attempt per student per daily challenge
    const existing = inMemoryDailySubmissions.get(submissionKey);
    if (existing) {
      throw new Error('Daily challenge has already been completed for this date');
    }

    // Resolve question version for authoritative grading
    let isCorrect = false;
    let correctOptionId = 'opt-a';
    let explanation = 'OSHA 1910.132(d) mandates written certification of hazard assessment.';

    const versions = inMemoryQuestionVersions.get(params.questionId);
    if (versions && versions.length > 0) {
      const activeVersion = versions[versions.length - 1];
      correctOptionId = activeVersion.correctOptionIds[0] || 'opt-a';
      isCorrect = activeVersion.correctOptionIds.includes(params.selectedOptionId);
      explanation = activeVersion.explanation;
    } else {
      isCorrect = params.selectedOptionId === 'opt-a';
    }

    let pointsEarned = 0;
    if (isCorrect) {
      pointsEarned = 10;
      this.recordActivityPoints({
        studentId: params.studentId,
        sourceEventId: params.challengeId,
        activityType: 'DAILY_QUESTION_ANSWERED',
        customPoints: 10,
        awardReason: `Daily Question Challenge for ${this.getTodayInKolkata()}`,
      });
    }

    const submission: DailyChallengeSubmission = {
      id: `sub-${Date.now()}`,
      challengeId: params.challengeId,
      studentId: params.studentId,
      selectedOptionId: params.selectedOptionId,
      isCorrect,
      correctOptionId,
      explanation,
      pointsEarned,
      submittedAt: new Date().toISOString(),
    };

    inMemoryDailySubmissions.set(submissionKey, submission);
    return submission;
  }
}

export const gamificationService = new GamificationService();
