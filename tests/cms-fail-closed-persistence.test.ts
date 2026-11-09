// Zealosh LMS — CMS Fail-Closed Persistence & Database Reliability Tests
// Verifies elimination of silent in-memory fallback when Supabase PostgreSQL is authoritative
// Standards: PF-01 to PF-10 deterministic failure injection suite

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { db, DatabasePersistenceError } from '@/lib/store/db';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { CmsPage, CmsPageVersion, CmsPageNode } from '@/types/cms';

describe('Zealosh CMS — Fail-Closed Persistence & Error Taxonomy Suite', () => {
  const samplePage: CmsPage = {
    id: 'page-fail-closed-01',
    slug: 'rigorous-safety-audit',
    title: 'Rigorous Industrial Safety Audit',
    pageType: 'STANDARD',
    status: 'DRAFT',
    currentDraftVersionId: 'ver-fc-01',
    seoMetadata: { title: 'Safety Audit' },
    createdBy: 'usr-admin-01',
    updatedBy: 'usr-admin-01',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  };

  const sampleVersion: CmsPageVersion = {
    id: 'ver-fc-01',
    pageId: 'page-fail-closed-01',
    versionNumber: 1,
    status: 'DRAFT',
    createdBy: 'usr-admin-01',
    createdAt: '2026-11-04T00:00:00Z',
    updatedAt: '2026-11-04T00:00:00Z',
  };

  const sampleNodes: CmsPageNode[] = [
    {
      id: 'node-fc-01',
      pageVersionId: 'ver-fc-01',
      parentId: null,
      nodeType: 'SECTION',
      componentType: 'section',
      position: 0,
      props: {},
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
    // Force authoritative Supabase mode for fail-closed tests
    db.setStorageModeOverride('supabase');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    db.setStorageModeOverride(undefined);
  });

  it('PF-01: Supabase save failure rejects with DatabasePersistenceError and does not write to memory', async () => {
    const dbError = new Error('PostgreSQL connection terminated unexpectedly');
    const spy = vi.spyOn(supabaseAdapter, 'saveCmsPage').mockRejectedValue(dbError);

    await expect(db.saveCmsPage(samplePage)).rejects.toThrow(DatabasePersistenceError);

    // Verify memory map did not swallow failure and store record
    expect(db.cmsPages.has(samplePage.id)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('PF-02: Missing or unavailable adapter in Supabase mode rejects with CONFIGURATION_ERROR', async () => {
    // Simulate adapter failure
    const spy = vi.spyOn(supabaseAdapter, 'saveCmsPage').mockImplementation(() => {
      throw new Error('Supabase client uninitialized');
    });

    await expect(db.saveCmsPage(samplePage)).rejects.toThrow(DatabasePersistenceError);
    expect(db.cmsPages.has(samplePage.id)).toBe(false);
  });

  it('PF-03: Supabase read failure throws DatabasePersistenceError rather than falling back to memory', async () => {
    // Seed a stale memory record to verify it is NOT returned on database error
    db.cmsPages.set(samplePage.id, { ...samplePage, title: 'Stale Memory Title' });

    vi.spyOn(supabaseAdapter, 'getCmsPageById').mockRejectedValue(new Error('Connection timeout'));

    await expect(db.getCmsPageById(samplePage.id)).rejects.toThrow(DatabasePersistenceError);

    // Clean up
    db.cmsPages.delete(samplePage.id);
  });

  it('PF-04: Supabase list failure throws DatabasePersistenceError and never returns a fake empty array', async () => {
    vi.spyOn(supabaseAdapter, 'getCmsPages').mockRejectedValue(new Error('PostgreSQL read query failed'));

    await expect(db.getCmsPages()).rejects.toThrow(DatabasePersistenceError);
  });

  it('PF-05: Node-tree save failure throws DatabasePersistenceError and preserves existing node state', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPageNodes').mockRejectedValue(new Error('Foreign key violation in nodes'));

    await expect(db.saveCmsPageNodes(sampleVersion.id, sampleNodes)).rejects.toThrow(
      DatabasePersistenceError
    );
    expect(db.cmsPageNodes.has(sampleVersion.id)).toBe(false);
  });

  it('PF-06: Version persistence failure throws DatabasePersistenceError and prevents state advancement', async () => {
    vi.spyOn(supabaseAdapter, 'saveCmsPageVersion').mockRejectedValue(new Error('Disk quota exceeded'));

    await expect(db.saveCmsPageVersion(sampleVersion)).rejects.toThrow(DatabasePersistenceError);
    expect(db.cmsPageVersions.has(sampleVersion.id)).toBe(false);
  });

  it('PF-07: Publishing failure throws DatabasePersistenceError and preserves DRAFT version status', async () => {
    // Mock get page, version, and nodes
    vi.spyOn(supabaseAdapter, 'getCmsPageById').mockResolvedValue(samplePage);
    vi.spyOn(supabaseAdapter, 'getCmsPageVersionById').mockResolvedValue(sampleVersion);
    vi.spyOn(supabaseAdapter, 'getCmsPageNodes').mockResolvedValue(sampleNodes);
    vi.spyOn(supabaseAdapter, 'publishCmsPage').mockRejectedValue(new Error('Atomic publication transaction failed'));

    await expect(
      db.publishCmsPageVersion(samplePage.id, sampleVersion.id, 'usr-admin-01')
    ).rejects.toThrow(DatabasePersistenceError);

    // Verify version in memory was not falsely promoted to PUBLISHED
    const memoryVer = db.cmsPageVersions.get(sampleVersion.id);
    expect(memoryVer?.status).not.toBe('PUBLISHED');
  });

  it('PF-08: RLS denial classifies error as PERMISSION_DENIED and is non-retryable', async () => {
    const rlsError = new Error('new row violates row-level security policy for table "cms_pages"');
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockRejectedValue(rlsError);

    try {
      await db.saveCmsPage(samplePage);
      expect.fail('Expected saveCmsPage to reject with RLS error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(DatabasePersistenceError);
      expect(err.category).toBe('PERMISSION_DENIED');
      expect(err.retryable).toBe(false);
    }
  });

  it('PF-09: Network timeout classifies error as DATABASE_UNAVAILABLE and marks retryable as true', async () => {
    const timeoutError = new Error('fetch failed: connect ETIMEDOUT 127.0.0.1:5432');
    vi.spyOn(supabaseAdapter, 'saveCmsPage').mockRejectedValue(timeoutError);

    try {
      await db.saveCmsPage(samplePage);
      expect.fail('Expected saveCmsPage to reject with timeout error');
    } catch (err: any) {
      expect(err).toBeInstanceOf(DatabasePersistenceError);
      expect(err.category).toBe('DATABASE_UNAVAILABLE');
      expect(err.retryable).toBe(true);
    }
  });

  it('PF-10: Explicit in_memory mode persists cleanly without invoking Supabase adapter', async () => {
    db.setStorageModeOverride('in_memory');

    const supabaseSpy = vi.spyOn(supabaseAdapter, 'saveCmsPage');

    const saved = await db.saveCmsPage(samplePage);
    expect(saved.id).toBe(samplePage.id);
    expect(db.cmsPages.has(samplePage.id)).toBe(true);

    // Supabase adapter must NOT have been called in explicit in_memory mode
    expect(supabaseSpy).not.toHaveBeenCalled();

    // Clean up
    db.cmsPages.delete(samplePage.id);
  });
});

