// Zealosh LMS — Central Authoritative Question Bank & Item Analytics Tests
// Milestone: ZM-IMPL-08E — Assessment Intelligence
// File: tests/central-question-bank.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import {
  questionBankService,
  inMemoryQuestionBankItems,
  inMemoryQuestionVersions,
  inMemoryItemAnalytics,
  AttemptItemResponse,
} from '@/lib/assessment/question-bank-service';

describe('Central Question Bank & Psychometrics (ZM-IMPL-08E)', () => {
  beforeEach(() => {
    inMemoryQuestionBankItems.clear();
    inMemoryQuestionVersions.clear();
    inMemoryItemAnalytics.clear();
  });

  it('QBK-01: Creates a new question bank item with version 1 in DRAFT status', async () => {
    const { item, version } = await questionBankService.createQuestion({
      certificationType: 'ASP',
      title: 'Combustible Dust MEC Calculation',
      stem: 'What is the Minimum Explosive Concentration (MEC) threshold for organic dust in accordance with NFPA 652?',
      difficulty: 'HARD',
      cognitiveLevel: 'APPLICATION',
      domain: 'Domain 1: Advanced Safety Sciences and Math',
      topic: 'Explosion Dynamics & Chemical Kinetics',
      options: [
        { id: 'opt-a', text: '30 g/m³' },
        { id: 'opt-b', text: '50 g/m³' },
        { id: 'opt-c', text: '100 g/m³' },
        { id: 'opt-d', text: '150 g/m³' },
      ],
      correctOptionIds: ['opt-a'],
      explanation: 'NFPA 652 Section 8.4 establishes baseline MEC at approximately 30 g/m³ for typical fine organic agricultural dust.',
      referenceSource: 'NFPA 652 (2025 Edition), Section 8.4.2',
      authorId: 'faculty-001',
      authorName: 'Dr. V. Rajesh, CSP',
      tags: ['combustible-dust', 'nfpa-652', 'explosion-prevention'],
    });

    expect(item).toBeDefined();
    expect(item.code).toMatch(/^QBK-ASP-\d+/);
    expect(item.status).toBe('DRAFT');
    expect(item.currentVersionNumber).toBe(1);

    expect(version).toBeDefined();
    expect(version.versionNumber).toBe(1);
    expect(version.status).toBe('DRAFT');
    expect(version.correctOptionIds).toEqual(['opt-a']);
    expect(version.points).toBe(1.0);
  });

  it('QBK-02: Enforces lifecycle status transitions and published immutability', async () => {
    const { item, version } = await questionBankService.createQuestion({
      certificationType: 'CSP',
      title: 'Fault Tree Minimal Cut Sets',
      stem: 'In a Fault Tree Analysis (FTA), what defines a minimal cut set?',
      domain: 'Domain 2: Risk Management',
      topic: 'System Safety Analysis',
      options: [
        { id: 'opt-1', text: 'The smallest combination of basic events whose occurrence causes the top event' },
        { id: 'opt-2', text: 'The largest sequence of redundant gates' },
      ],
      correctOptionIds: ['opt-1'],
      explanation: 'A minimal cut set is the smallest combination of primary events whose concurrent occurrence guarantees top-event realization.',
      referenceSource: 'NUREG-0492 Fault Tree Handbook',
      authorId: 'faculty-002',
    });

    // DRAFT -> IN_REVIEW
    const inReviewVer = await questionBankService.transitionVersionStatus({
      questionBankItemId: item.id,
      versionNumber: 1,
      newStatus: 'IN_REVIEW',
      actorId: 'editor-001',
    });
    expect(inReviewVer.status).toBe('IN_REVIEW');

    // IN_REVIEW -> APPROVED
    const approvedVer = await questionBankService.transitionVersionStatus({
      questionBankItemId: item.id,
      versionNumber: 1,
      newStatus: 'APPROVED',
      actorId: 'dean-001',
    });
    expect(approvedVer.status).toBe('APPROVED');
    expect(approvedVer.approvedBy).toBe('dean-001');

    // APPROVED -> PUBLISHED
    const publishedVer = await questionBankService.transitionVersionStatus({
      questionBankItemId: item.id,
      versionNumber: 1,
      newStatus: 'PUBLISHED',
      actorId: 'controller-001',
    });
    expect(publishedVer.status).toBe('PUBLISHED');
    expect(publishedVer.publishedAt).toBeDefined();

    // Verify parent item pointer updated
    const updatedItem = (await questionBankService.getQuestionItem(item.id))?.item;
    expect(updatedItem?.status).toBe('PUBLISHED');

    // IMMUTABILITY CHECK: Attempting to revert published version back to DRAFT must fail
    await expect(
      questionBankService.transitionVersionStatus({
        questionBankItemId: item.id,
        versionNumber: 1,
        newStatus: 'DRAFT',
        actorId: 'editor-001',
      })
    ).rejects.toThrow(/Immutable once published/);
  });

  it('QBK-03: Forks new version from published question without mutating v1', async () => {
    const { item } = await questionBankService.createQuestion({
      certificationType: 'CRSP',
      title: 'Canadian OHS Act Internal Responsibility System (IRS)',
      stem: 'Under Canadian provincial OHS statutes, which party bears the primary responsibility for workplace safety?',
      domain: 'Domain 1: Law and Ethics',
      topic: 'Internal Responsibility System',
      options: [
        { id: 'opt-a', text: 'Every workplace party in proportion to their authority' },
        { id: 'opt-b', text: 'The Ministry Inspector solely' },
      ],
      correctOptionIds: ['opt-a'],
      explanation: 'The IRS establishes that everyone in the workplace shares responsibility according to authority.',
      referenceSource: 'Canada Labour Code Part II',
      authorId: 'faculty-003',
    });

    // Advance v1 to PUBLISHED
    await questionBankService.transitionVersionStatus({
      questionBankItemId: item.id,
      versionNumber: 1,
      newStatus: 'IN_REVIEW',
      actorId: 'auditor',
    });
    await questionBankService.transitionVersionStatus({
      questionBankItemId: item.id,
      versionNumber: 1,
      newStatus: 'APPROVED',
      actorId: 'dean',
    });
    await questionBankService.transitionVersionStatus({
      questionBankItemId: item.id,
      versionNumber: 1,
      newStatus: 'PUBLISHED',
      actorId: 'registrar',
    });

    // Fork Version 2
    const v2 = await questionBankService.forkNewVersion({
      questionBankItemId: item.id,
      authorId: 'faculty-003',
      updates: {
        stem: 'Under Canadian federal and provincial OHS legislation, how does the Internal Responsibility System allocate duty?',
      },
      changeSummary: 'Clarified jurisdiction to encompass both federal and provincial scopes.',
    });

    expect(v2.versionNumber).toBe(2);
    expect(v2.status).toBe('DRAFT');
    expect(v2.changeSummary).toContain('Clarified jurisdiction');

    // Confirm Version 1 remains PUBLISHED and unchanged
    const details = await questionBankService.getQuestionItem(item.id);
    expect(details?.versions.length).toBe(2);
    expect(details?.versions[0].versionNumber).toBe(1);
    expect(details?.versions[0].status).toBe('PUBLISHED');
  });

  it('QBK-04: Student-safe projection strictly isolates server answer key and explanation', async () => {
    const { version } = await questionBankService.createQuestion({
      certificationType: 'NEBOSH',
      title: 'Confined Space Oxygen Enrichment',
      stem: 'What is the upper permissible safe concentration limit of oxygen before atmosphere is considered enriched?',
      domain: 'Element 3: Workplace Hazards',
      topic: 'Confined Space Atmospheres',
      options: [
        { id: 'opt-1', text: '19.5%' },
        { id: 'opt-2', text: '20.9%' },
        { id: 'opt-3', text: '23.5%' },
        { id: 'opt-4', text: '25.0%' },
      ],
      correctOptionIds: ['opt-3'],
      explanation: 'Atmospheres exceeding 23.5% oxygen are classified as oxygen-enriched, drastically accelerating combustion kinetics.',
      referenceSource: 'OSHA 1910.146 Confined Spaces Standard',
      authorId: 'faculty-004',
    });

    const studentSafe = questionBankService.projectStudentSafeQuestion(version);

    // SECURITY INVARIANTS:
    expect((studentSafe as any).correctOptionIds).toBeUndefined();
    expect((studentSafe as any).explanation).toBeUndefined();
    expect(studentSafe.options.length).toBe(4);
    expect(studentSafe.stem).toBe(version.stem);
  });

  it('QBK-05: Classical Test Theory accurately calculates p-value, discrimination D, and distractor frequencies', async () => {
    const { item } = await questionBankService.createQuestion({
      certificationType: 'ASP',
      title: 'Hearing Conservation 85 dBA Action Level',
      stem: 'At what 8-hour Time-Weighted Average (TWA) noise exposure must an employer implement a formal hearing conservation program?',
      domain: 'Domain 3: Occupational Health and Industrial Hygiene',
      topic: 'Acoustic Hazards & Audiometry',
      options: [
        { id: 'opt-a', text: '80 dBA' },
        { id: 'opt-b', text: '85 dBA' },
        { id: 'opt-c', text: '90 dBA' },
        { id: 'opt-d', text: '95 dBA' },
      ],
      correctOptionIds: ['opt-b'],
      explanation: 'The action level triggering hearing conservation is 85 dBA TWA.',
      referenceSource: '29 CFR 1910.95(c)',
      authorId: 'faculty-005',
    });

    // Simulate 30 examinee responses (sufficient sample size)
    // 20 correct, 10 incorrect
    // High performers (top 27% = 8 students): 8 correct, 0 incorrect (p_upper = 1.0)
    // Low performers (bottom 27% = 8 students): 2 correct, 6 incorrect (p_lower = 0.25)
    // Discrimination D = 1.0 - 0.25 = 0.75
    const responses: AttemptItemResponse[] = [];

    // Top 8 performers
    for (let i = 0; i < 8; i++) {
      responses.push({
        examineeId: `std-top-${i}`,
        overallScorePercent: 95,
        selectedOptionIds: ['opt-b'],
        isCorrect: true,
      });
    }

    // Middle 14 performers: 10 correct, 4 incorrect
    for (let i = 0; i < 10; i++) {
      responses.push({
        examineeId: `std-mid-c-${i}`,
        overallScorePercent: 75,
        selectedOptionIds: ['opt-b'],
        isCorrect: true,
      });
    }
    for (let i = 0; i < 4; i++) {
      responses.push({
        examineeId: `std-mid-w-${i}`,
        overallScorePercent: 65,
        selectedOptionIds: ['opt-c'],
        isCorrect: false,
      });
    }

    // Bottom 8 performers: 2 correct, 6 incorrect (3 on opt-a, 3 on opt-c)
    for (let i = 0; i < 2; i++) {
      responses.push({
        examineeId: `std-low-c-${i}`,
        overallScorePercent: 45,
        selectedOptionIds: ['opt-b'],
        isCorrect: true,
      });
    }
    for (let i = 0; i < 3; i++) {
      responses.push({
        examineeId: `std-low-w1-${i}`,
        overallScorePercent: 40,
        selectedOptionIds: ['opt-a'],
        isCorrect: false,
      });
    }
    for (let i = 0; i < 3; i++) {
      responses.push({
        examineeId: `std-low-w2-${i}`,
        overallScorePercent: 35,
        selectedOptionIds: ['opt-c'],
        isCorrect: false,
      });
    }

    expect(responses.length).toBe(30);

    const analytics = questionBankService.calculateItemAnalytics({
      questionBankItemId: item.id,
      versionNumber: 1,
      responses,
    });

    expect(analytics.totalAttempts).toBe(30);
    expect(analytics.correctAttempts).toBe(20);
    expect(analytics.difficultyPValue).toBe(0.6667); // 20/30 ~ 0.6667
    expect(analytics.discriminationD).toBe(0.75); // 1.0 - 0.25 = 0.75 (Excellent discrimination!)
    expect(analytics.sampleSizeSufficient).toBe(true);

    // Distractor analysis: opt-b = 20 (66.7%), opt-a = 3 (10%), opt-c = 7 (23.3%), opt-d = 0 (0%)
    expect(analytics.distractorFrequencies['opt-b'].count).toBe(20);
    expect(analytics.distractorFrequencies['opt-a'].count).toBe(3);
    expect(analytics.distractorFrequencies['opt-c'].count).toBe(7);
    expect(analytics.distractorFrequencies['opt-d'].count).toBe(0);
  });

  it('QBK-06: Accurately reports sample size insufficient when N < 30', async () => {
    const { item } = await questionBankService.createQuestion({
      certificationType: 'ASP',
      title: 'Sample Size Guard Question',
      stem: 'Stem text',
      domain: 'Domain 1',
      topic: 'Topic 1',
      options: [
        { id: '1', text: 'A' },
        { id: '2', text: 'B' },
      ],
      correctOptionIds: ['1'],
      explanation: 'Exp',
      referenceSource: 'Ref',
      authorId: 'auth',
    });

    const responses: AttemptItemResponse[] = [
      { examineeId: 'u1', overallScorePercent: 90, selectedOptionIds: ['1'], isCorrect: true },
      { examineeId: 'u2', overallScorePercent: 50, selectedOptionIds: ['2'], isCorrect: false },
    ];

    const analytics = questionBankService.calculateItemAnalytics({
      questionBankItemId: item.id,
      versionNumber: 1,
      responses,
    });

    expect(analytics.totalAttempts).toBe(2);
    expect(analytics.sampleSizeSufficient).toBe(false); // N < 30 flagged!
  });
});

