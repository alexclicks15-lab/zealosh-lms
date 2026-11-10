// Zealosh LMS — Central CMS & PageBuilder Business Service
// Coordinates persistence, lifecycle transitions, validation, and atomic publishing

import { db } from '@/lib/store/db';
import {
  CmsPage,
  CmsPageVersion,
  CmsPageNode,
  CmsPageType,
  CmsVersionStatus,
  CmsSeoMetadata,
  CmsScheduledPublicationJob,
  CmsPublicationJobStatus,
} from '@/types/cms';
import { isReservedSlug, normalizeSlug } from './sanitizer';
import { validateTree, generateNodeId } from './tree-engine';
import { createHomepageStarterNodes, getStarterNodesForPageType } from './templates-seed';

export class CmsService {
  /**
   * Retrieves all CMS pages matching optional filters
   */
  public async getPages(filter?: { pageType?: string; status?: string }): Promise<CmsPage[]> {
    return await db.getCmsPages(filter);
  }

  /**
   * Retrieves page by unique ID
   */
  public async getPageById(id: string): Promise<CmsPage | undefined> {
    return await db.getCmsPageById(id);
  }

  /**
   * Retrieves page by URL slug (handles root homepage and subpaths)
   */
  public async getPageBySlug(slug: string): Promise<CmsPage | undefined> {
    const normalized = normalizeSlug(slug || 'home');
    return await db.getCmsPageBySlug(normalized);
  }

  /**
   * Validates if a slug is available and not reserved
   */
  public async validateSlug(
    slug: string,
    excludePageId?: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const normalized = normalizeSlug(slug);
    if (!normalized) {
      return { valid: false, reason: 'Slug cannot be empty' };
    }

    if (isReservedSlug(normalized) && normalized !== 'home') {
      return {
        valid: false,
        reason: `"${normalized}" is a reserved application route (student portal, admin, auth, or classroom)`,
      };
    }

    const existing = await db.getCmsPageBySlug(normalized);
    if (existing && existing.id !== excludePageId) {
      return { valid: false, reason: `Slug "${normalized}" is already in use by page "${existing.title}"` };
    }

    return { valid: true };
  }

  /**
   * Creates a new CMS page with an initial Draft version
   */
  public async createPage(
    params: {
      slug: string;
      title: string;
      pageType?: CmsPageType;
      templateId?: string;
      seoMetadata?: CmsSeoMetadata;
    },
    actorId: string = 'usr-admin-01'
  ): Promise<{ page: CmsPage; version: CmsPageVersion }> {
    const slugValidation = await this.validateSlug(params.slug);
    if (!slugValidation.valid) {
      throw new Error(slugValidation.reason || 'Invalid slug');
    }

    const pageId = `page-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const versionId = `ver-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const normalizedSlug = normalizeSlug(params.slug);

    const initialVersion: CmsPageVersion = {
      id: versionId,
      pageId,
      versionNumber: 1,
      status: 'DRAFT',
      changeSummary: 'Initial page creation',
      createdBy: actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const initialPage: CmsPage = {
      id: pageId,
      slug: normalizedSlug,
      title: params.title.trim(),
      pageType: params.pageType || 'STANDARD',
      status: 'DRAFT',
      currentDraftVersionId: versionId,
      seoMetadata: params.seoMetadata || {
        title: `${params.title.trim()} — Zealosh HSE Academy`,
        description: `Learn more about ${params.title.trim()} at Zealosh Training & Consultants.`,
      },
      createdBy: actorId,
      updatedBy: actorId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Instantiate starter nodes
    let initialNodes: CmsPageNode[] = [];
    if (params.templateId) {
      const templates = await db.getCmsTemplates();
      const tpl = templates.find((t) => t.id === params.templateId);
      if (tpl && tpl.nodesSnapshot && tpl.nodesSnapshot.length > 0) {
        initialNodes = tpl.nodesSnapshot.map((n) => ({
          ...n,
          id: generateNodeId(n.componentType),
          pageVersionId: versionId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));
      }
    }

    if (initialNodes.length === 0) {
      initialNodes = getStarterNodesForPageType(initialPage.pageType, versionId, initialPage.title);
    }

    const savedPage = await db.saveCmsPage(initialPage, actorId);
    const savedVersion = await db.saveCmsPageVersion(initialVersion, actorId);
    await db.saveCmsPageNodes(versionId, initialNodes, actorId);

    return { page: savedPage, version: savedVersion };
  }

  /**
   * Updates page metadata (title, slug, pageType, SEO)
   */
  public async updatePageMetadata(
    pageId: string,
    updates: {
      title?: string;
      slug?: string;
      pageType?: CmsPageType;
      seoMetadata?: CmsSeoMetadata;
    },
    actorId: string = 'usr-admin-01'
  ): Promise<CmsPage> {
    const page = await db.getCmsPageById(pageId);
    if (!page) throw new Error('Page not found');

    if (updates.slug && updates.slug !== page.slug) {
      const validation = await this.validateSlug(updates.slug, pageId);
      if (!validation.valid) {
        throw new Error(validation.reason || 'Invalid slug');
      }
      page.slug = normalizeSlug(updates.slug);
    }

    if (updates.title) page.title = updates.title.trim();
    if (updates.pageType) page.pageType = updates.pageType;
    if (updates.seoMetadata) page.seoMetadata = { ...page.seoMetadata, ...updates.seoMetadata };

    return await db.saveCmsPage(page, actorId);
  }

  /**
   * Deletes a CMS page
   */
  public async deletePage(pageId: string, actorId: string = 'usr-admin-01'): Promise<boolean> {
    const page = await db.getCmsPageById(pageId);
    if (!page) throw new Error('Page not found');
    if (page.slug === 'home') {
      throw new Error('The canonical Homepage cannot be deleted');
    }
    return await db.deleteCmsPage(pageId, actorId);
  }

  /**
   * Gets version history for a page
   */
  public async getVersions(pageId: string): Promise<CmsPageVersion[]> {
    return await db.getCmsPageVersions(pageId);
  }

  /**
   * Gets version details and component nodes
   */
  public async getVersionDetails(
    versionId: string
  ): Promise<{ version: CmsPageVersion; nodes: CmsPageNode[] } | null> {
    const version = await db.getCmsPageVersion(versionId);
    if (!version) return null;
    const nodes = await db.getCmsPageNodes(versionId);
    return { version, nodes };
  }

  /**
   * Saves updated draft nodes (autosave or explicit save with optimistic concurrency guard)
   */
  public async saveDraftNodes(
    versionId: string,
    nodes: CmsPageNode[],
    actorId: string = 'usr-admin-01',
    expectedUpdatedAt?: string
  ): Promise<{ success: boolean; nodes: CmsPageNode[] }> {
    const version = await db.getCmsPageVersion(versionId);
    if (!version) throw new Error('Version not found');

    if (version.status === 'PUBLISHED') {
      throw new Error('Cannot edit an immutable published version. Create a new draft or restore.');
    }

    // Optimistic Concurrency Check: Stale edit detection
    if (expectedUpdatedAt && new Date(version.updatedAt).getTime() > new Date(expectedUpdatedAt).getTime()) {
      throw new Error('Conflict: Draft has been modified by another session. Please reload or reconcile before overwriting.');
    }

    // Validate tree hierarchy
    const validation = validateTree(nodes);
    if (!validation.isValid) {
      throw new Error(`Invalid component tree structure: ${validation.errors.join('; ')}`);
    }

    const savedNodes = await db.saveCmsPageNodes(versionId, nodes, actorId);

    version.updatedAt = new Date().toISOString();
    await db.saveCmsPageVersion(version, actorId);

    return { success: true, nodes: savedNodes };
  }

  /**
   * Transitions version from DRAFT to PENDING_REVIEW
   */
  public async submitForReview(
    pageId: string,
    versionId: string,
    changeSummary?: string,
    actorId: string = 'usr-admin-01'
  ): Promise<CmsPageVersion> {
    const version = await db.getCmsPageVersion(versionId);
    if (!version) throw new Error('Version not found');

    const nodes = await db.getCmsPageNodes(versionId);
    if (nodes.length === 0) {
      throw new Error('Cannot submit an empty page version for review');
    }

    version.status = 'PENDING_REVIEW';
    if (changeSummary) version.changeSummary = changeSummary;
    version.updatedAt = new Date().toISOString();

    const saved = await db.saveCmsPageVersion(version, actorId);

    const page = await db.getCmsPageById(pageId);
    if (page) {
      page.status = 'PENDING_REVIEW';
      await db.saveCmsPage(page, actorId);
    }

    return saved;
  }

  /**
   * Approves a submitted version with independent reviewer verification
   */
  public async approveVersion(
    pageId: string,
    versionId: string,
    approverId: string = 'usr-admin-01',
    approverRole: string = 'SUPER_ADMIN'
  ): Promise<CmsPageVersion> {
    const version = await db.getCmsPageVersion(versionId);
    if (!version) throw new Error('Version not found');

    if (version.status !== 'PENDING_REVIEW') {
      throw new Error('Only versions pending review can be approved');
    }

    // Peer Review Policy: Authors cannot approve their own submission unless SUPER_ADMIN
    if (version.createdBy === approverId && approverRole !== 'SUPER_ADMIN') {
      throw new Error('Self-approval forbidden: Drafts must be approved by an independent reviewer.');
    }

    version.status = 'APPROVED';
    version.approvedBy = approverId;
    version.updatedAt = new Date().toISOString();

    const saved = await db.saveCmsPageVersion(version, approverId);

    const page = await db.getCmsPageById(pageId);
    if (page) {
      page.status = 'APPROVED';
      await db.saveCmsPage(page, approverId);
    }

    return saved;
  }

  /**
   * Rejects a submitted version with reason
   */
  public async rejectVersion(
    pageId: string,
    versionId: string,
    rejectionReason: string,
    actorId: string = 'usr-admin-01'
  ): Promise<CmsPageVersion> {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('A rejection reason is mandatory');
    }

    const version = await db.getCmsPageVersion(versionId);
    if (!version) throw new Error('Version not found');

    version.status = 'REJECTED';
    version.rejectionReason = rejectionReason.trim();
    version.updatedAt = new Date().toISOString();

    const saved = await db.saveCmsPageVersion(version, actorId);

    const page = await db.getCmsPageById(pageId);
    if (page) {
      page.status = 'REJECTED';
      await db.saveCmsPage(page, actorId);
    }

    return saved;
  }

  /**
   * Atomically publishes an approved version with role verification
   */
  public async publishVersion(
    pageId: string,
    versionId: string,
    publisherId: string = 'usr-admin-01',
    publisherRole: string = 'SUPER_ADMIN'
  ): Promise<{ success: boolean; checksum: string }> {
    const version = await db.getCmsPageVersion(versionId);
    if (!version) throw new Error('Version not found');

    if (version.status !== 'APPROVED' && publisherRole !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Only APPROVED versions can be published to the live platform.');
    }

    return await db.publishCmsPageVersion(pageId, versionId, publisherId);
  }

  /**
   * Rolls back a page to a historical version by creating a new DRAFT version cloned from it
   */
  public async rollbackVersion(
    pageId: string,
    targetVersionId: string,
    actorId: string = 'usr-admin-01'
  ): Promise<CmsPageVersion> {
    return await db.rollbackCmsPageVersion(pageId, targetVersionId, actorId);
  }

  /**
   * Schedules an approved version for future publication
   */
  public async schedulePagePublication(
    pageId: string,
    versionId: string,
    scheduledAt: string,
    actorId: string = 'usr-admin-01',
    actorRole: string = 'SUPER_ADMIN'
  ): Promise<{ job: CmsScheduledPublicationJob; page: CmsPage }> {
    const scheduledTime = new Date(scheduledAt).getTime();
    if (isNaN(scheduledTime) || scheduledTime <= Date.now()) {
      throw new Error('Invalid scheduled publication time: must be a valid future ISO timestamp.');
    }

    const page = await db.getCmsPageById(pageId);
    if (!page) throw new Error('Page not found');

    const version = await db.getCmsPageVersion(versionId);
    if (!version) throw new Error('Version not found');

    if (version.status !== 'APPROVED' && actorRole !== 'SUPER_ADMIN') {
      throw new Error('Forbidden: Only APPROVED versions can be scheduled for publication.');
    }

    // Cancel any previous queued job for this page
    await db.cancelCmsScheduledPublication(pageId, actorId);

    const jobId = `job-pub-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const job: CmsScheduledPublicationJob = {
      id: jobId,
      pageId,
      versionId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      scheduledBy: actorId,
      status: 'QUEUED',
      attemptCount: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedJob = await db.saveCmsScheduledPublication(job, actorId);

    // Update page pointers
    page.scheduledPublishAt = job.scheduledAt;
    page.scheduledVersionId = versionId;
    page.updatedBy = actorId;
    page.updatedAt = new Date().toISOString();
    const updatedPage = await db.saveCmsPage(page, actorId);

    // Update version
    version.scheduledPublishAt = job.scheduledAt;
    version.updatedAt = new Date().toISOString();
    await db.saveCmsPageVersion(version, actorId);

    return { job: savedJob, page: updatedPage };
  }

  /**
   * Cancels a pending scheduled publication
   */
  public async cancelScheduledPublication(
    pageId: string,
    actorId: string = 'usr-admin-01'
  ): Promise<{ success: boolean; page: CmsPage }> {
    const page = await db.getCmsPageById(pageId);
    if (!page) throw new Error('Page not found');

    await db.cancelCmsScheduledPublication(pageId, actorId);

    page.scheduledPublishAt = undefined;
    page.scheduledVersionId = undefined;
    page.updatedBy = actorId;
    page.updatedAt = new Date().toISOString();
    const updatedPage = await db.saveCmsPage(page, actorId);

    return { success: true, page: updatedPage };
  }

  /**
   * Retrieves scheduled publication jobs matching optional filters
   */
  public async getScheduledPublications(filter?: {
    pageId?: string;
    status?: CmsPublicationJobStatus;
  }): Promise<CmsScheduledPublicationJob[]> {
    return await db.getCmsScheduledPublications(filter);
  }
}

export const cmsService = new CmsService();

