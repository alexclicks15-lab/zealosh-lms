/**
 * Zealosh LMS — BigBlueButton Live Quiz Integration Contract
 * 
 * Defines message payloads, event schemas, and synchronization helpers
 * for pre-prepared in-session quizzes, live response collection, and
 * real-time instructor score dashboard updates.
 */

import { LiveScoreDashboardData } from '@/types';

export interface LiveQuizLaunchPayload {
  quizId: string;
  sessionId: string;
  batchId: string;
  courseId: string;
  instructorId: string;
  title: string;
  timeLimitMinutes?: number;
  totalQuestions: number;
  launchedAt: string;
}

export interface LiveQuizStudentAnswerPayload {
  quizId: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  questionId: string;
  selectedOptionId: string;
  submittedAt: string;
}

export interface LiveQuizSessionStatus {
  quizId: string;
  sessionId: string;
  isActive: boolean;
  participantCount: number;
  submittedCount: number;
  averageScorePercent: number;
  launchedAt?: string;
}

export interface LiveQuizEventMessage {
  type: 'ZEALOSH_LIVE_QUIZ_LAUNCH' | 'ZEALOSH_LIVE_QUIZ_END' | 'ZEALOSH_LIVE_QUIZ_UPDATE';
  quizId: string;
  sessionId: string;
  payload: any;
  timestamp: string;
}

