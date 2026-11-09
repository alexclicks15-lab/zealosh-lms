import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { AssignmentSubmission, RubricScore, AiReviewSuggestion } from '@/types';

describe('Workstream E: Complete Academic Workflow Integration (Assignments, Evaluation & AI Review Seam)', () => {

  it('tracks submission revisions with versioning and preserves previous work on resubmission', async () => {
    const userId = `student-rev-${Date.now()}`;
    const assignmentId = 'asg-asp-01';

    // 1. Initial submission (version 1)
    const sub1 = await db.submitAssignment({
      assignmentId,
      userId,
      submissionText: 'Initial analysis of chemical storage safety.',
      attachmentUrl: '/uploads/chem-v1.pdf',
    });

    expect(sub1.version).toBe(1);
    expect(sub1.status).toBe('SUBMITTED');

    // 2. Instructor requests revision
    const graded = await db.gradeSubmission(sub1.id, {
      status: 'RESUBMISSION_REQUESTED',
      feedback: 'Please include calculations for vapor dispersion distances under windy conditions.',
      gradedBy: 'inst-vishnu',
    });

    expect(graded.status).toBe('RESUBMISSION_REQUESTED');
    expect(graded.resubmissionNote).toContain('vapor dispersion');
    expect(graded.resubmissionRequestedAt).toBeDefined();

    // 3. Student resubmits (version 2)
    const sub2 = await db.submitAssignment({
      assignmentId,
      userId,
      submissionText: 'Updated chemical safety analysis including Gaussian plume model dispersion calculations.',
      attachmentUrl: '/uploads/chem-v2.pdf',
    });

    expect(sub2.version).toBe(2);
    expect(sub2.status).toBe('SUBMITTED');
    expect(sub2.previousSubmissionText).toBe('Initial analysis of chemical storage safety.');
    expect(sub2.previousAttachmentUrl).toBe('/uploads/chem-v1.pdf');
  });

  it('evaluates submissions with rubric criterion scores and finalizes grades', async () => {
    const userId = `student-rubric-${Date.now()}`;
    const assignmentId = 'asg-asp-01';

    const sub = await db.submitAssignment({
      assignmentId,
      userId,
      submissionText: 'Comprehensive plant emergency response plan.',
    });

    const rubricScores: RubricScore[] = [
      { criterionId: 'crit-hazard-id', score: 35, comment: 'Identified all key toxic releases.' },
      { criterionId: 'crit-mitigation', score: 28, comment: 'Good secondary containment.' },
      { criterionId: 'crit-evacuation', score: 30, comment: 'Egress route mapping compliant with OSHA.' },
    ];

    const finalized = await db.gradeSubmission(sub.id, {
      score: 93,
      feedback: 'Excellent hazardous materials response plan.',
      rubricScores,
      status: 'GRADED',
      gradedBy: 'inst-vishnu',
    });

    expect(finalized.status).toBe('GRADED');
    expect(finalized.score).toBe(93);
    expect(finalized.rubricScores?.length).toBe(3);
    expect(finalized.gradedByUserId).toBe('inst-vishnu');
    expect(finalized.gradedAt).toBeDefined();
  });

  it('preserves human instructor authority over deferred AI review suggestions', async () => {
    const userId = `student-ai-seam-${Date.now()}`;
    const assignmentId = 'asg-asp-01';

    const sub = await db.submitAssignment({
      assignmentId,
      userId,
      submissionText: 'Ergonomic evaluation of workstation seating.',
    });

    // Simulated deferred AI review payload (Phase 6 architectural seam)
    const aiReview: AiReviewSuggestion = {
      reviewVersion: 'v1.0.0-draft',
      generatedAt: new Date().toISOString(),
      suggestedOverallScore: 82,
      conceptualFeedback: ['Good biomechanical analysis', 'Consider lumbar support angle'],
      status: 'PENDING_INSTRUCTOR_REVIEW', // MUST NEVER be auto-finalized without human sign-off
    };

    // Attach AI suggestion
    const withAiSuggestion = await db.gradeSubmission(sub.id, {
      aiReviewSuggestions: aiReview,
      status: 'SUBMITTED', // Remains unfinalized
      gradedBy: 'system-ai-assistant',
    });

    expect(withAiSuggestion.aiReviewSuggestions?.status).toBe('PENDING_INSTRUCTOR_REVIEW');
    expect(withAiSuggestion.status).toBe('SUBMITTED'); // Human grade required

    // Human instructor overrides / finalizes
    const humanFinalized = await db.gradeSubmission(sub.id, {
      score: 88,
      feedback: 'Approved with minor posture corrections.',
      status: 'GRADED',
      gradedBy: 'inst-vishnu',
    });

    expect(humanFinalized.status).toBe('GRADED');
    expect(humanFinalized.score).toBe(88); // Human awarded score takes precedence over AI 82
    expect(humanFinalized.gradedByUserId).toBe('inst-vishnu');
  });
});
