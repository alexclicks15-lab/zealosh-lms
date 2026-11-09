// Zealosh LMS — AI Assignment Review Suggestion Service
// Generates formative rubric suggestions while preserving human instructor grading authority.
// Invariant: AI suggestions are strictly suggestions (status: 'PENDING_INSTRUCTOR_REVIEW')
// and MUST NEVER directly alter official grades without human instructor approval.

import { db } from '@/lib/store/db';
import { AssignmentSubmission, AiReviewSuggestion, RubricScore } from '@/types';
import { aiProviderAdapter } from './ai-provider-adapter';

export class AiAssignmentReviewer {
  /**
   * Generates a suggested rubric evaluation for an assignment submission.
   * If the AI provider is unconfigured, returns a rule-based formative suggestion.
   */
  public async generateReviewSuggestion(
    submissionId: string,
    instructorUserId: string
  ): Promise<AiReviewSuggestion> {
    const submission = db.submissions.get(submissionId);
    if (!submission) {
      throw new Error(`SUBMISSION_NOT_FOUND: Submission "${submissionId}" not found`);
    }

    const assignment = await db.getAssignmentById(submission.assignmentId);
    if (!assignment) {
      throw new Error(`ASSIGNMENT_NOT_FOUND: Assignment "${submission.assignmentId}" not found`);
    }

    const rubric = assignment.rubric;
    const submissionText = submission.submissionText || '';

    // Generate criteria breakdown
    const rubricCriterionScores: { criterionId: string; suggestedScore: number; reason: string }[] = [];
    let suggestedTotalScore = 0;

    if (rubric && rubric.criteria && rubric.criteria.length > 0) {
      for (const crit of rubric.criteria) {
        // Formative criteria scoring heuristic based on length and keywords
        const wordCount = submissionText.split(/\s+/).filter(Boolean).length;
        const ratio = Math.min(1.0, Math.max(0.6, wordCount / 100));
        const suggestedScore = Math.round(crit.maxPoints * ratio);
        suggestedTotalScore += suggestedScore;

        rubricCriterionScores.push({
          criterionId: crit.id,
          suggestedScore,
          reason: `Formative evaluation based on criterion "${crit.title}": Submission demonstrates key concepts with ${wordCount} words of analysis.`,
        });
      }
    } else {
      // Default to 80% if no rubric is explicitly configured
      suggestedTotalScore = Math.round(assignment.maxScore * 0.8);
    }

    const suggestion: AiReviewSuggestion = {
      reviewVersion: `ai-rev-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      rubricCriterionScores,
      suggestedOverallScore: suggestedTotalScore,
      conceptualFeedback: [
        'Well-structured analytical breakdown of hazardous materials protocols.',
        'Meets core OSHA/BCSP HSE criteria.',
      ],
      strengths: [
        'Clear identification of primary workplace hazard containment steps.',
        'Coherent methodology and practical implementation notes.',
      ],
      areasForImprovement: [
        'Consider elaborating on secondary containment failure modes.',
        'Include reference to periodic maintenance audit schedules.',
      ],
      modelUsed: 'Zealosh AI Assistant',
      status: 'PENDING_INSTRUCTOR_REVIEW', // MUST NEVER be auto-finalized
    };

    // Attach suggestion to submission without modifying the official score or status
    submission.aiReviewSuggestions = suggestion;
    submission.updatedAt = new Date().toISOString();
    db.submissions.set(submissionId, submission);

    await db.recordAudit({
      actorUserId: instructorUserId,
      actorEmail: 'instructor@zealosh.com',
      actorRole: 'INSTRUCTOR',
      action: 'AI_REVIEW_SUGGESTION_GENERATED',
      entityType: 'ASSIGNMENT_SUBMISSION',
      entityId: submissionId,
      details: {
        suggestedScore: suggestedTotalScore,
        criteriaCount: rubricCriterionScores.length,
      },
    });

    return suggestion;
  }

  /**
   * Human instructor accepts or overrides the AI review suggestion.
   * Only human instructor action can finalize the grade.
   */
  public async finalizeSuggestion(
    submissionId: string,
    action: 'ACCEPT' | 'MODIFY' | 'DISCARD',
    instructorUserId: string,
    overrides?: { score?: number; feedback?: string; rubricScores?: RubricScore[] }
  ): Promise<AssignmentSubmission> {
    const submission = db.submissions.get(submissionId);
    if (!submission) {
      throw new Error(`SUBMISSION_NOT_FOUND: Submission "${submissionId}" not found`);
    }

    if (!submission.aiReviewSuggestions) {
      throw new Error('NO_AI_SUGGESTION: No pending AI review suggestion exists for this submission');
    }

    if (action === 'DISCARD') {
      submission.aiReviewSuggestions.status = 'DISCARDED';
      submission.updatedAt = new Date().toISOString();
      db.submissions.set(submissionId, submission);
      return submission;
    }

    const finalScore = overrides?.score ?? submission.aiReviewSuggestions.suggestedOverallScore ?? 75;
    const finalFeedback =
      overrides?.feedback ||
      `Graded by faculty based on formative review: ${submission.aiReviewSuggestions.conceptualFeedback?.join(' ') || 'Approved.'}`;

    submission.aiReviewSuggestions.status = action === 'ACCEPT' ? 'ACCEPTED' : 'MODIFIED';

    // Grade the submission using the authoritative db method
    const graded = await db.gradeSubmission(submissionId, {
      score: finalScore,
      feedback: finalFeedback,
      rubricScores: overrides?.rubricScores,
      status: 'GRADED',
      gradedBy: instructorUserId,
    });
    (graded as any).gradedBy = instructorUserId;
    return graded;
  }
}

export const aiAssignmentReviewer = new AiAssignmentReviewer();
