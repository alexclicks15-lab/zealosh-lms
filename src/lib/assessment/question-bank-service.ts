// Zealosh LMS — Central Authoritative Question Bank & Item Analytics Engine
// File: src/lib/assessment/question-bank-service.ts
// Adheres strictly to Zealosh Assessment Intelligence standards, ADR-003, and Classical Test Theory.

import {
  QuestionBankItem,
  QuestionVersion,
  QuestionVersionStatus,
  StudentSafeQuestion,
  ItemAnalytics,
  TaxonomyDomain,
  CognitiveLevel,
  QuestionType,
  QuestionDifficulty,
} from '@/types';
import { db } from '@/lib/store/db';

// In-memory collections for local execution / tests
export const inMemoryQuestionBankItems: Map<string, QuestionBankItem> = new Map();
export const inMemoryQuestionVersions: Map<string, QuestionVersion[]> = new Map(); // questionBankItemId -> versions
export const inMemoryItemAnalytics: Map<string, ItemAnalytics> = new Map(); // questionBankItemId:versionNumber -> analytics
export const inMemoryTaxonomyDomains: Map<string, TaxonomyDomain> = new Map();

export interface CreateQuestionParams {
  code?: string;
  certificationType: string;
  title: string;
  stem: string;
  type?: QuestionType;
  difficulty?: QuestionDifficulty;
  cognitiveLevel?: CognitiveLevel;
  domain: string;
  topic: string;
  options: { id: string; text: string }[];
  correctOptionIds: string[];
  explanation: string;
  referenceSource: string;
  points?: number;
  rubricCriteria?: { id: string; maxPoints: number; description?: string }[];
  authorId: string;
  authorName?: string;
  tags?: string[];
}

export interface AttemptItemResponse {
  examineeId: string;
  overallScorePercent: number; // For upper/lower quartile grouping
  selectedOptionIds: string[];
  isCorrect: boolean;
}

export class QuestionBankService {
  /**
   * Generates a standard question bank code, e.g. "QBK-ASP-1001".
   */
  public generateQuestionCode(certType: string): string {
    const cleanCert = (certType || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const randNum = Math.floor(1000 + Math.random() * 9000);
    return `QBK-${cleanCert}-${randNum}`;
  }

  /**
   * Creates a new Question Bank Item with initial Version 1 in 'DRAFT' status.
   */
  public async createQuestion(params: CreateQuestionParams): Promise<{
    item: QuestionBankItem;
    version: QuestionVersion;
  }> {
    if (!params.stem || !params.options || params.options.length < 2) {
      throw new Error('INVALID_QUESTION_DATA: Stem and at least two options are required.');
    }
    if (!params.correctOptionIds || params.correctOptionIds.length === 0) {
      throw new Error('INVALID_QUESTION_DATA: At least one correct option must be specified.');
    }

    const itemId = `qitem-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const versionId = `qver-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const code = params.code || this.generateQuestionCode(params.certificationType);

    const item: QuestionBankItem = {
      id: itemId,
      code,
      certificationType: params.certificationType,
      title: params.title || params.stem.substring(0, 60),
      currentVersionNumber: 1,
      status: 'DRAFT',
      authorId: params.authorId,
      authorName: params.authorName || 'Faculty Question Author',
      tags: params.tags || [],
      createdAt: now,
      updatedAt: now,
    };

    const version: QuestionVersion = {
      id: versionId,
      questionBankItemId: itemId,
      versionNumber: 1,
      stem: params.stem,
      type: params.type || 'MULTIPLE_CHOICE',
      difficulty: params.difficulty || 'MODERATE',
      cognitiveLevel: params.cognitiveLevel || 'APPLICATION',
      domain: params.domain,
      topic: params.topic,
      options: params.options,
      correctOptionIds: params.correctOptionIds,
      explanation: params.explanation,
      referenceSource: params.referenceSource,
      points: params.points ?? 1.0,
      rubricCriteria: params.rubricCriteria,
      status: 'DRAFT',
      createdAt: now,
    };

    inMemoryQuestionBankItems.set(itemId, item);
    inMemoryQuestionVersions.set(itemId, [version]);

    // Initial empty analytics
    const analyticsKey = `${itemId}:1`;
    inMemoryItemAnalytics.set(analyticsKey, {
      questionBankItemId: itemId,
      versionNumber: 1,
      totalAttempts: 0,
      correctAttempts: 0,
      difficultyPValue: 0.0,
      discriminationD: 0.0,
      distractorFrequencies: {},
      sampleSizeSufficient: false,
      lastCalculatedAt: now,
    });

    await db.recordAudit({
      actorUserId: params.authorId,
      actorEmail: 'author@zealosh.com',
      actorRole: 'INSTRUCTOR',
      action: 'QUESTION_BANK_ITEM_CREATED',
      entityType: 'QUESTION_BANK_ITEM',
      entityId: itemId,
      details: { code, certificationType: params.certificationType, versionNumber: 1 },
    });

    return { item, version };
  }

  /**
   * Advances the status of a question version adhering to strict state transitions:
   * DRAFT -> IN_REVIEW -> APPROVED -> PUBLISHED -> ARCHIVED
   */
  public async transitionVersionStatus(params: {
    questionBankItemId: string;
    versionNumber: number;
    newStatus: QuestionVersionStatus;
    actorId: string;
    changeSummary?: string;
  }): Promise<QuestionVersion> {
    const { questionBankItemId, versionNumber, newStatus, actorId, changeSummary } = params;
    const versions = inMemoryQuestionVersions.get(questionBankItemId) || [];
    const version = versions.find((v) => v.versionNumber === versionNumber);

    if (!version) {
      throw new Error(`QUESTION_VERSION_NOT_FOUND: Version ${versionNumber} of item "${questionBankItemId}" not found.`);
    }

    const currentStatus = version.status;

    // Strict state transitions
    const validTransitions: Record<QuestionVersionStatus, QuestionVersionStatus[]> = {
      DRAFT: ['IN_REVIEW', 'ARCHIVED'],
      IN_REVIEW: ['APPROVED', 'DRAFT', 'ARCHIVED'],
      APPROVED: ['PUBLISHED', 'DRAFT', 'ARCHIVED'],
      PUBLISHED: ['ARCHIVED'], // Immutable once published! Cannot revert to DRAFT.
      ARCHIVED: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(
        `INVALID_STATUS_TRANSITION: Cannot transition question version from "${currentStatus}" to "${newStatus}". Immutable once published.`
      );
    }

    version.status = newStatus;
    if (changeSummary) version.changeSummary = changeSummary;

    if (newStatus === 'APPROVED') {
      version.approvedBy = actorId;
    }
    if (newStatus === 'PUBLISHED') {
      version.publishedAt = new Date().toISOString();
      // Update parent item's active status and version pointer
      const item = inMemoryQuestionBankItems.get(questionBankItemId);
      if (item) {
        item.status = 'PUBLISHED';
        item.currentVersionNumber = versionNumber;
        item.updatedAt = new Date().toISOString();
      }
    }

    await db.recordAudit({
      actorUserId: actorId,
      actorEmail: 'admin@zealosh.com',
      actorRole: 'SUPER_ADMIN',
      action: 'QUESTION_VERSION_STATUS_TRANSITIONED',
      entityType: 'QUESTION_VERSION',
      entityId: version.id,
      details: { questionBankItemId, versionNumber, from: currentStatus, to: newStatus },
    });

    return version;
  }

  /**
   * Creates a new draft version forked from an existing published question.
   * Enforces immutability: published questions can never be overwritten in place.
   */
  public async forkNewVersion(params: {
    questionBankItemId: string;
    authorId: string;
    updates?: Partial<Omit<QuestionVersion, 'id' | 'questionBankItemId' | 'versionNumber' | 'createdAt' | 'status'>>;
    changeSummary: string;
  }): Promise<QuestionVersion> {
    const { questionBankItemId, authorId, updates, changeSummary } = params;
    const item = inMemoryQuestionBankItems.get(questionBankItemId);
    if (!item) {
      throw new Error(`QUESTION_ITEM_NOT_FOUND: Question item "${questionBankItemId}" not found.`);
    }

    const versions = inMemoryQuestionVersions.get(questionBankItemId) || [];
    const latestVersion = versions[versions.length - 1];

    if (!latestVersion) {
      throw new Error(`NO_VERSIONS_FOUND: Item "${questionBankItemId}" has no versions to fork.`);
    }

    const nextVersionNum = latestVersion.versionNumber + 1;
    const now = new Date().toISOString();
    const versionId = `qver-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newVersion: QuestionVersion = {
      ...latestVersion,
      id: versionId,
      versionNumber: nextVersionNum,
      status: 'DRAFT',
      stem: updates?.stem || latestVersion.stem,
      type: updates?.type || latestVersion.type,
      difficulty: updates?.difficulty || latestVersion.difficulty,
      cognitiveLevel: updates?.cognitiveLevel || latestVersion.cognitiveLevel,
      domain: updates?.domain || latestVersion.domain,
      topic: updates?.topic || latestVersion.topic,
      options: updates?.options ? [...updates.options] : [...latestVersion.options],
      correctOptionIds: updates?.correctOptionIds ? [...updates.correctOptionIds] : [...latestVersion.correctOptionIds],
      explanation: updates?.explanation || latestVersion.explanation,
      referenceSource: updates?.referenceSource || latestVersion.referenceSource,
      points: updates?.points ?? latestVersion.points,
      rubricCriteria: updates?.rubricCriteria || latestVersion.rubricCriteria,
      changeSummary,
      approvedBy: undefined,
      publishedAt: undefined,
      createdAt: now,
    };

    versions.push(newVersion);
    inMemoryQuestionVersions.set(questionBankItemId, versions);

    item.currentVersionNumber = nextVersionNum;
    item.updatedAt = now;

    // Initialize analytics for this new version
    const analyticsKey = `${questionBankItemId}:${nextVersionNum}`;
    inMemoryItemAnalytics.set(analyticsKey, {
      questionBankItemId,
      versionNumber: nextVersionNum,
      totalAttempts: 0,
      correctAttempts: 0,
      difficultyPValue: 0.0,
      discriminationD: 0.0,
      distractorFrequencies: {},
      sampleSizeSufficient: false,
      lastCalculatedAt: now,
    });

    return newVersion;
  }

  /**
   * Produces a student-safe projection of a question.
   * STRICT SECURITY INVARIANT:
   * Strips correctOptionIds, explanation, scoringModel, and rubric answers
   * to guarantee zero answer key leakage.
   */
  public projectStudentSafeQuestion(version: QuestionVersion): StudentSafeQuestion {
    return {
      id: version.id,
      questionBankItemId: version.questionBankItemId,
      versionNumber: version.versionNumber,
      stem: version.stem,
      type: version.type,
      difficulty: version.difficulty,
      cognitiveLevel: version.cognitiveLevel,
      domain: version.domain,
      topic: version.topic,
      options: version.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
      })),
      points: version.points,
      referenceSource: version.referenceSource,
    };
  }

  /**
   * Classical Test Theory Item Analytics Engine.
   * Computes Difficulty p-value, Item Discrimination Index D, and distractor frequencies.
   */
  public calculateItemAnalytics(params: {
    questionBankItemId: string;
    versionNumber: number;
    responses: AttemptItemResponse[];
  }): ItemAnalytics {
    const { questionBankItemId, versionNumber, responses } = params;
    const versions = inMemoryQuestionVersions.get(questionBankItemId) || [];
    const version = versions.find((v) => v.versionNumber === versionNumber);

    if (!version) {
      throw new Error(`QUESTION_VERSION_NOT_FOUND: Version ${versionNumber} not found.`);
    }

    const total = responses.length;
    if (total === 0) {
      const emptyAnalytics: ItemAnalytics = {
        questionBankItemId,
        versionNumber,
        totalAttempts: 0,
        correctAttempts: 0,
        difficultyPValue: 0.0,
        discriminationD: 0.0,
        distractorFrequencies: {},
        sampleSizeSufficient: false,
        lastCalculatedAt: new Date().toISOString(),
      };
      inMemoryItemAnalytics.set(`${questionBankItemId}:${versionNumber}`, emptyAnalytics);
      return emptyAnalytics;
    }

    const correct = responses.filter((r) => r.isCorrect).length;
    const pValue = Number((correct / total).toFixed(4));

    // Item Discrimination Index D calculation
    // Sort examinees by overall exam performance
    const sorted = [...responses].sort((a, b) => b.overallScorePercent - a.overallScorePercent);
    const groupSize = Math.max(1, Math.floor(sorted.length * 0.27)); // Standard top/bottom 27% split

    const upperGroup = sorted.slice(0, groupSize);
    const lowerGroup = sorted.slice(sorted.length - groupSize);

    const upperCorrect = upperGroup.filter((r) => r.isCorrect).length;
    const lowerCorrect = lowerGroup.filter((r) => r.isCorrect).length;

    const pUpper = upperCorrect / groupSize;
    const pLower = lowerCorrect / groupSize;
    const discriminationD = Number((pUpper - pLower).toFixed(4));

    // Distractor selection frequency
    const distractorFrequencies: Record<string, { count: number; percentage: number }> = {};
    for (const opt of version.options) {
      distractorFrequencies[opt.id] = { count: 0, percentage: 0.0 };
    }

    for (const resp of responses) {
      for (const selId of resp.selectedOptionIds) {
        if (distractorFrequencies[selId]) {
          distractorFrequencies[selId].count += 1;
        }
      }
    }

    for (const optId of Object.keys(distractorFrequencies)) {
      const count = distractorFrequencies[optId].count;
      distractorFrequencies[optId].percentage = Number(((count / total) * 100).toFixed(1));
    }

    // Flag sample size sufficiency (standard psychometric threshold N >= 30)
    const sampleSizeSufficient = total >= 30;

    const analytics: ItemAnalytics = {
      questionBankItemId,
      versionNumber,
      totalAttempts: total,
      correctAttempts: correct,
      difficultyPValue: pValue,
      discriminationD,
      distractorFrequencies,
      sampleSizeSufficient,
      lastCalculatedAt: new Date().toISOString(),
    };

    inMemoryItemAnalytics.set(`${questionBankItemId}:${versionNumber}`, analytics);
    return analytics;
  }

  /**
   * Retrieves an item by ID, with all its versions.
   */
  public async getQuestionItem(id: string): Promise<{
    item: QuestionBankItem;
    versions: QuestionVersion[];
    activeVersion?: QuestionVersion;
  } | null> {
    const item = inMemoryQuestionBankItems.get(id);
    if (!item) return null;
    const versions = inMemoryQuestionVersions.get(id) || [];
    const activeVersion = versions.find((v) => v.versionNumber === item.currentVersionNumber);
    return { item, versions, activeVersion };
  }

  /**
   * Lists question items filtered by certification, status, or search query.
   */
  public async listQuestions(filters?: {
    certificationType?: string;
    status?: QuestionVersionStatus;
    search?: string;
  }): Promise<QuestionBankItem[]> {
    let items = Array.from(inMemoryQuestionBankItems.values());

    if (filters?.certificationType) {
      items = items.filter((i) => i.certificationType === filters.certificationType);
    }
    if (filters?.status) {
      items = items.filter((i) => i.status === filters.status);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter((i) => i.title.toLowerCase().includes(q) || i.code.toLowerCase().includes(q));
    }

    return items;
  }

  /**
   * Registers a taxonomy domain hierarchy.
   */
  public registerTaxonomyDomain(domain: TaxonomyDomain): void {
    inMemoryTaxonomyDomains.set(`${domain.certificationType}:${domain.code}`, domain);
  }

  /**
   * Retrieves taxonomy domains for a certification type.
   */
  public getTaxonomyDomains(certificationType: string): TaxonomyDomain[] {
    return Array.from(inMemoryTaxonomyDomains.values()).filter(
      (d) => d.certificationType === certificationType
    );
  }
}

export const questionBankService = new QuestionBankService();
