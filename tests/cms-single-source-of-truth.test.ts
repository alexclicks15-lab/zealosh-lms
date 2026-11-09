// Zealosh LMS — CMS Database Single Source of Truth & Dual-Write Elimination Tests
// Standards: SS-01 through SS-16 deterministic single-source-of-truth test suite
// Enforces that in Supabase mode, PostgreSQL is authoritative and local disk dual-writes are eliminated

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, DatabasePersistenceError } from '@/lib/store/db';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { CmsPage, CmsPageVersion, CmsPageNode, CmsTemplate, CmsReusableBlock } from '@/types/cms';

describe('Zealosh CMS — Database Single Source of Truth & Dual-Write Elimination (SS-01 to SS-16)', () => {
  const samplePage: CmsPage = {
    id: 'page-ssot-01',
    slug: 'ssot-course-landing',
    title: 'SSOT Course Landing Page',
    pageType: 'COURSE_LANDING',
    status: 'DRAFT',
    currentDraftVersionId: 'ver-ssot-01',
    seoMetadata: { title: 'SSOT Course Landing' },
    createdBy: 'usr-admin-01',
    updatedBy: 'usr-admin-01',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  };

  const sampleVersion: CmsPageVersion = {
    id: 'ver-ssot-01',
    pageId: 'page-ssot-01',
    versionNumber: 1,
    status: 'DRAFT',
    createdBy: 'usr-admin-01',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  };

  const sampleNodes: CmsPageNode[] = [
    {
      id: 'node-ssot-01',
      pageVersionId: 'ver-ssot-01',
      parentId: null,
      nodeType: 'SECTION',
      componentType: 'section',
      position: 0,
      props: { padding: 'large' },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: '2026-11-04T00:00:00Z',
      updatedAt: '2026-11-04T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    db.cmsPages.delete(samplePage.id);
    db.cmsPageVersions.delete(sampleVersion.id);
    db.cmsPageNodes.delete(sampleVersion.id);
    db.setStorageModeOverride('supabase');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.setStorageModeOverride(undefined);
  });

  it('SS-01: Supabase page save does NOT call persistToDisk() (dual-write eliminated)', async () => {
    const persistSpy = vi.spyOn(db, 'persistToDisk');
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockResolvedValue(samplePage);

    const result = await db.saveCmsPage(samplePage);

    expect(result.id).toBe(samplePage.id);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('SS-02: Supabase page save returns database result even if memory-map set encounters an issue', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockResolvedValue(samplePage);
    vi.spyOn(db.cmsPages, 'set').mockImplementationOnce(() => {
      throw new Error('Cache synchronization warning');
    });

    const result = await db.saveCmsPage(samplePage);

    expect(result.id).toBe(samplePage.id);
    expect(result.title).toBe(samplePage.title);
  });

  it('SS-03: Supabase version save avoids local disk write', async () => {
    const persistSpy = vi.spyOn(db, 'persistToDisk');
    vi.spyOn(supabaseAdapter, 'saveCmsPageVersion').mockResolvedValue(sampleVersion);

    const result = await db.saveCmsPageVersion(sampleVersion);

    expect(result.id).toBe(sampleVersion.id);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('SS-04: Supabase node save avoids local disk write', async () => {
    const persistSpy = vi.spyOn(db, 'persistToDisk');
    vi.spyOn(supabaseAdapter, 'saveCmsPageNodes').mockResolvedValue(sampleNodes);

    const result = await db.saveCmsPageNodes(sampleVersion.id, sampleNodes);

    expect(result).toHaveLength(1);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('SS-05: Supabase publishing avoids local disk write', async () => {
    const persistSpy = vi.spyOn(db, 'persistToDisk');
    vi.spyOn(supabaseAdapter, 'getCmsPageById').mockResolvedValue(samplePage);
    vi.spyOn(supabaseAdapter, 'getCmsPageVersionById').mockResolvedValue(sampleVersion);
    vi.spyOn(supabaseAdapter, 'getCmsPageNodes').mockResolvedValue(sampleNodes);
    vi.spyOn(supabaseAdapter, 'publishCmsPage').mockResolvedValue(true);

    const result = await db.publishCmsPageVersion(samplePage.id, sampleVersion.id, 'usr-admin-01');

    expect(result.success).toBe(true);
    expect(result.checksum).toBeDefined();
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('SS-06: Supabase rollback avoids local disk write', async () => {
    const persistSpy = vi.spyOn(db, 'persistToDisk');
    vi.spyOn(supabaseAdapter, 'getCmsPageById').mockResolvedValue(samplePage);
    vi.spyOn(supabaseAdapter, 'getCmsPageVersionById').mockResolvedValue(sampleVersion);
    vi.spyOn(supabaseAdapter, 'getCmsPageNodes').mockResolvedValue(sampleNodes);
    vi.spyOn(supabaseAdapter, 'getCmsPageVersions').mockResolvedValue([sampleVersion]);
    vi.spyOn(supabaseAdapter, 'saveCmsPageVersion').mockImplementation(async (v) => v);
    vi.spyOn(supabaseAdapter, 'saveCmsPageNodes').mockImplementation(async (vId, nodes) => nodes);
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockImplementation(async (p) => p);

    const result = await db.rollbackCmsPageVersion(samplePage.id, sampleVersion.id, 'usr-admin-01');

    expect(result.versionNumber).toBe(2);
    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('SS-07: Supabase error object detection propagates typed DatabasePersistenceError', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockRejectedValue(
      new Error('Supabase error saving cms page: violates unique constraint "cms_pages_slug_key"')
    );

    await expect(db.saveCmsPage(samplePage)).rejects.toMatchObject({
      name: 'DatabasePersistenceError',
      category: 'CONSTRAINT_VIOLATION',
      retryable: false,
    });
  });

  it('SS-08: Zero-row update detection in Supabase publish throws error when target record not found', async () => {
    // Create mock supabase client where update returns empty data array (0 rows updated)
    const mockUpdateBuilder = {
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const mockClient = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue(mockUpdateBuilder),
      }),
    };
    vi.spyOn(supabaseAdapter as any, 'getClient').mockReturnValue(mockClient);

    await expect(
      supabaseAdapter.publishCmsPage('non-existent-page', 'non-existent-ver', 'usr-admin-01', 'chk123')
    ).rejects.toThrow(/zero-row update/i);
  });

  it('SS-09: Database commit followed by cache update failure preserves database success', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockResolvedValue(samplePage);
    // Simulate cache mutation throwing an unexpected exception
    vi.spyOn(db.cmsPages, 'set').mockImplementationOnce(() => {
      throw new TypeError('Cannot set property on frozen cache');
    });

    const result = await db.saveCmsPage(samplePage);

    // Save must succeed because PostgreSQL commit was confirmed
    expect(result.id).toBe(samplePage.id);
  });

  it('SS-10: Database commit followed by disk failure is isolated and persistToDisk returns false in Supabase mode', () => {
    db.setStorageModeOverride('supabase');
    const result = db.persistToDisk();
    expect(result).toBe(false);
  });

  it('SS-11: Failed database write does not update in-memory cache', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockRejectedValue(new Error('Network timeout'));

    await expect(db.saveCmsPage(samplePage)).rejects.toThrow(DatabasePersistenceError);

    expect(db.cmsPages.has(samplePage.id)).toBe(false);
  });

  it('SS-12: Ambiguous commit retry safety — idempotent save operations succeed consistently', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockResolvedValue(samplePage);

    const first = await db.saveCmsPage(samplePage);
    const second = await db.saveCmsPage(samplePage);

    expect(first.id).toBe(second.id);
    expect(first.slug).toBe(second.slug);
  });

  it('SS-13: Read cache and database consistency — stale cache not returned on database failure', async () => {
    db.cmsPages.set(samplePage.id, { ...samplePage, title: 'Old Stale Cached Version' });
    vi.spyOn(supabaseAdapter, 'getCmsPageById').mockRejectedValue(new Error('Database unavailable'));

    await expect(db.getCmsPageById(samplePage.id)).rejects.toThrow(DatabasePersistenceError);
    db.cmsPages.delete(samplePage.id);
  });

  it('SS-14: Explicit memory mode preserved for unit tests — calls persistToDisk() as expected', async () => {
    db.setStorageModeOverride('in_memory');
    const persistSpy = vi.spyOn(db, 'persistToDisk');

    const result = await db.saveCmsPage(samplePage);

    expect(result.id).toBe(samplePage.id);
    expect(persistSpy).toHaveBeenCalledTimes(1);
    db.cmsPages.delete(samplePage.id);
  });

  it('SS-15: Cross-module regression safety — templates and reusable blocks avoid disk writes in Supabase mode', async () => {
    const persistSpy = vi.spyOn(db, 'persistToDisk');
    const sampleTemplate: CmsTemplate = {
      id: 'tpl-ssot-01',
      name: 'SSOT Template',
      description: 'Template for testing',
      category: 'GENERAL',
      templateType: 'PAGE',
      nodesSnapshot: sampleNodes,
      createdBy: 'usr-admin-01',
      createdAt: '2026-11-04T00:00:00Z',
    };
    const sampleBlock: CmsReusableBlock = {
      id: 'blk-ssot-01',
      name: 'SSOT Block',
      category: 'HERO',
      nodesSnapshot: sampleNodes,
      createdBy: 'usr-admin-01',
      createdAt: '2026-11-04T00:00:00Z',
    };

    vi.spyOn(supabaseAdapter, 'saveCmsTemplate').mockResolvedValue(sampleTemplate);
    vi.spyOn(supabaseAdapter, 'saveCmsReusableBlock').mockResolvedValue(sampleBlock);

    await db.saveCmsTemplate(sampleTemplate);
    await db.saveCmsReusableBlock(sampleBlock);

    expect(persistSpy).not.toHaveBeenCalled();
  });

  it('SS-16: Publishing side-effect separation — ancillary publication log failure does not fail publication', async () => {
    vi.spyOn(supabaseAdapter, 'getCmsPageById').mockResolvedValue(samplePage);
    vi.spyOn(supabaseAdapter, 'getCmsPageVersionById').mockResolvedValue(sampleVersion);
    vi.spyOn(supabaseAdapter, 'getCmsPageNodes').mockResolvedValue(sampleNodes);
    vi.spyOn(supabaseAdapter, 'publishCmsPage').mockResolvedValue(true);
    // Simulate publication record push throwing
    vi.spyOn(db.cmsPublicationRecords, 'push').mockImplementationOnce(() => {
      throw new Error('Audit table memory full');
    });

    const result = await db.publishCmsPageVersion(samplePage.id, sampleVersion.id, 'usr-admin-01');

    expect(result.success).toBe(true);
    expect(result.checksum).toBeDefined();
  });
});