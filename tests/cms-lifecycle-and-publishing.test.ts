// Zealosh LMS — CMS Lifecycle, Review Workflow, Publishing & Rollback Tests
// Standards: Immutability of published records, state machine transitions, atomic publishing

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { cmsService } from '@/lib/cms/cms-service';

describe('Zealosh CMS — Lifecycle, Approval, Publishing & Rollback Suite', () => {
  const actorId = 'usr-admin-01';
  let createdPageId: string;
  let createdVersionId: string;

  beforeEach(async () => {
    // Reset seed to guarantee clean test state
    db.ensureCmsSeedDefaults();

    // Create a fresh test page
    const result = await cmsService.createPage(
      {
        slug: `test-cert-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        title: 'Industrial Safety Engineering',
        pageType: 'STANDARD',
      },
      actorId
    );
    createdPageId = result.page.id;
    createdVersionId = result.version.id;
  });

  it('1. should create a page in DRAFT status with an initial Version 1 draft', async () => {
    const page = await cmsService.getPageById(createdPageId);
    expect(page).toBeDefined();
    expect(page?.status).toBe('DRAFT');
    expect(page?.currentDraftVersionId).toBe(createdVersionId);

    const version = await db.getCmsPageVersion(createdVersionId);
    expect(version).toBeDefined();
    expect(version?.versionNumber).toBe(1);
    expect(version?.status).toBe('DRAFT');
  });

  it('2. should transition through approval lifecycle: DRAFT -> PENDING_REVIEW -> APPROVED', async () => {
    // 1. Submit for review
    const submitted = await cmsService.submitForReview(
      createdPageId,
      createdVersionId,
      'Ready for compliance review',
      actorId
    );
    expect(submitted.status).toBe('PENDING_REVIEW');
    expect(submitted.changeSummary).toBe('Ready for compliance review');

    const pageAfterSubmit = await cmsService.getPageById(createdPageId);
    expect(pageAfterSubmit?.status).toBe('PENDING_REVIEW');

    // 2. Approve
    const approved = await cmsService.approveVersion(createdPageId, createdVersionId, 'usr-reviewer-01');
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('usr-reviewer-01');

    const pageAfterApprove = await cmsService.getPageById(createdPageId);
    expect(pageAfterApprove?.status).toBe('APPROVED');
  });

  it('3. should reject a version with a mandatory rejection reason and update status to REJECTED', async () => {
    await cmsService.submitForReview(createdPageId, createdVersionId, 'Submitting', actorId);

    // Reject without reason should fail
    await expect(cmsService.rejectVersion(createdPageId, createdVersionId, '', actorId)).rejects.toThrow(
      /rejection reason is mandatory/i
    );

    // Reject with reason
    const rejected = await cmsService.rejectVersion(
      createdPageId,
      createdVersionId,
      'Heading hierarchy missing H1 tag for accessibility compliance',
      actorId
    );
    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toContain('accessibility compliance');
  });

  it('4. should atomically publish an approved version, generating checksum and updating page pointer', async () => {
    await cmsService.submitForReview(createdPageId, createdVersionId, 'Review', actorId);
    await cmsService.approveVersion(createdPageId, createdVersionId, actorId);

    const pubResult = await cmsService.publishVersion(createdPageId, createdVersionId, actorId);
    expect(pubResult.success).toBe(true);
    expect(pubResult.checksum).toBeDefined();
    expect(pubResult.checksum).toMatch(/^[a-f0-9]{64}$/); // Deterministic SHA-256 hash format

    const publishedPage = await cmsService.getPageById(createdPageId);
    expect(publishedPage?.status).toBe('PUBLISHED');
    expect(publishedPage?.publishedVersionId).toBe(createdVersionId);

    const publishedVer = await db.getCmsPageVersion(createdVersionId);
    expect(publishedVer?.status).toBe('PUBLISHED');
    expect(publishedVer?.publishedAt).toBeDefined();
  });

  it('5. should execute rollback safely by generating a new DRAFT based on historical version snapshot', async () => {
    // 1. Publish Version 1
    await cmsService.submitForReview(createdPageId, createdVersionId, 'V1 ready', actorId);
    await cmsService.approveVersion(createdPageId, createdVersionId, actorId);
    await cmsService.publishVersion(createdPageId, createdVersionId, actorId);

    // 2. Create and publish Version 2
    const v2Nodes = await db.getCmsPageNodes(createdVersionId);
    // Modify v2 node
    v2Nodes[0].styles.backgroundColor = '#000000';

    const v2 = await db.saveCmsPageVersion(
      {
        id: `ver-2-${Date.now()}`,
        pageId: createdPageId,
        versionNumber: 2,
        status: 'PUBLISHED',
        changeSummary: 'Version 2 with black background',
        createdBy: actorId,
        publishedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      actorId
    );
    await db.saveCmsPageNodes(v2.id, v2Nodes, actorId);
    const page = await cmsService.getPageById(createdPageId);
    page!.publishedVersionId = v2.id;
    await db.saveCmsPage(page!, actorId);

    // 3. Rollback to Version 1
    const rollbackDraft = await cmsService.rollbackVersion(createdPageId, createdVersionId, actorId);
    expect(rollbackDraft.versionNumber).toBe(3); // Next sequential version
    expect(rollbackDraft.status).toBe('DRAFT');
    expect(rollbackDraft.changeSummary).toContain('Rollback restoration from Version 1');

    // Historical Version 1 and 2 must remain intact and immutable!
    const v1Check = await db.getCmsPageVersion(createdVersionId);
    const v2Check = await db.getCmsPageVersion(v2.id);
    expect(v1Check?.status).toBe('PUBLISHED');
    expect(v2Check?.status).toBe('PUBLISHED');
  });

  it('6. should prevent self-approval by non-super-admin authors', async () => {
    const authorId = 'usr-author-01';
    const draftResult = await cmsService.createPage(
      {
        slug: `author-page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: 'Author Draft',
        pageType: 'STANDARD',
      },
      authorId
    );

    await cmsService.submitForReview(draftResult.page.id, draftResult.version.id, 'Submitting', authorId);

    // Same author attempting to self-approve with INSTRUCTOR or COURSE_MANAGER role must be rejected
    await expect(
      cmsService.approveVersion(draftResult.page.id, draftResult.version.id, authorId, 'INSTRUCTOR')
    ).rejects.toThrow(/Self-approval forbidden/i);

    // Independent reviewer can approve
    const approved = await cmsService.approveVersion(
      draftResult.page.id,
      draftResult.version.id,
      'usr-independent-reviewer',
      'COURSE_MANAGER'
    );
    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe('usr-independent-reviewer');
  });

  it('7. should enforce optimistic concurrency and reject stale draft updates with conflict', async () => {
    const nodes = await db.getCmsPageNodes(createdVersionId);
    const initialVersion = await db.getCmsPageVersion(createdVersionId);
    const staleTimestamp = new Date(Date.now() - 60000).toISOString(); // 1 minute in the past

    // Save with a stale timestamp must throw conflict
    await expect(
      cmsService.saveDraftNodes(createdVersionId, nodes, actorId, staleTimestamp)
    ).rejects.toThrow(/Conflict: Draft has been modified/i);

    // Save with the current or newer timestamp succeeds
    const saveResult = await cmsService.saveDraftNodes(
      createdVersionId,
      nodes,
      actorId,
      initialVersion!.updatedAt
    );
    expect(saveResult.success).toBe(true);
  });
});

