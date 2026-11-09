// Zealosh LMS — CMS Database Persistence & Adapter Conformance Tests
// Standards: ADR-002 (RLS) & ADR-004 (PostgreSQL Sole Source of Truth)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import {
  mapDomainCmsPageToDb,
  mapDbCmsPageToDomain,
  mapDomainCmsPageVersionToDb,
  mapDbCmsPageVersionToDomain,
  mapDomainCmsPageNodeToDb,
  mapDbCmsPageNodeToDomain,
  mapDomainCmsTemplateToDb,
  mapDbCmsTemplateToDomain,
  mapDomainCmsReusableBlockToDb,
  mapDbCmsReusableBlockToDomain,
} from '@/lib/store/supabase-adapter';
import { CmsPage, CmsPageVersion, CmsPageNode, CmsTemplate, CmsReusableBlock } from '@/types/cms';

describe('Zealosh CMS — Database Persistence & Mapping Suite', () => {
  beforeEach(() => {
    db.ensureCmsSeedDefaults();
  });

  it('1. should bidirectionally map CmsPage between TypeScript camelCase and PostgreSQL snake_case', () => {
    const domainPage: CmsPage = {
      id: 'page-map-01',
      slug: 'bcrsp-ohs-mastery',
      title: 'BCRSP Occupational Health & Safety Mastery',
      pageType: 'COURSE_LANDING',
      status: 'PUBLISHED',
      currentDraftVersionId: 'ver-01',
      publishedVersionId: 'ver-01',
      seoMetadata: { title: 'BCRSP Certification', description: 'Canadian Safety' },
      createdBy: 'usr-admin-01',
      updatedBy: 'usr-admin-01',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const dbRow = mapDomainCmsPageToDb(domainPage);
    expect(dbRow.id).toBe('page-map-01');
    expect(dbRow.page_type).toBe('COURSE_LANDING');
    expect(dbRow.published_version_id).toBe('ver-01');
    expect(dbRow.seo_metadata.title).toBe('BCRSP Certification');

    const mappedBack = mapDbCmsPageToDomain(dbRow);
    expect(mappedBack.id).toBe(domainPage.id);
    expect(mappedBack.pageType).toBe(domainPage.pageType);
    expect(mappedBack.publishedVersionId).toBe(domainPage.publishedVersionId);
    expect(mappedBack.seoMetadata.title).toBe(domainPage.seoMetadata.title);
  });

  it('2. should bidirectionally map CmsPageVersion and preserve version metadata', () => {
    const domainVer: CmsPageVersion = {
      id: 'ver-map-01',
      pageId: 'page-map-01',
      versionNumber: 2,
      status: 'PENDING_REVIEW',
      changeSummary: 'Updated pricing and course schedule',
      rejectionReason: undefined,
      createdBy: 'usr-editor-01',
      approvedBy: undefined,
      publishedAt: undefined,
      createdAt: '2026-01-02T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
    };

    const dbRow = mapDomainCmsPageVersionToDb(domainVer);
    expect(dbRow.version_number).toBe(2);
    expect(dbRow.change_summary).toBe('Updated pricing and course schedule');

    const mappedBack = mapDbCmsPageVersionToDomain(dbRow);
    expect(mappedBack.versionNumber).toBe(2);
    expect(mappedBack.changeSummary).toBe(domainVer.changeSummary);
  });

  it('3. should bidirectionally map CmsPageNode preserving props, styles, and responsive configurations', () => {
    const domainNode: CmsPageNode = {
      id: 'node-map-01',
      pageVersionId: 'ver-map-01',
      parentId: 'col-1',
      nodeType: 'COMPONENT',
      componentType: 'button',
      position: 3,
      props: { label: 'Register Now', href: '/checkout' },
      styles: { backgroundColor: '#4f8c4c', textColor: '#ffffff' },
      responsiveStyles: {
        desktop: { colSpan: 12 },
        mobile: { colSpan: 12, padding: '1rem' },
      },
      dynamicBinding: { source: 'course', field: 'priceInr' },
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const dbRow = mapDomainCmsPageNodeToDb(domainNode);
    expect(dbRow.component_type).toBe('button');
    expect(dbRow.props.label).toBe('Register Now');
    expect(dbRow.responsive_styles.mobile.padding).toBe('1rem');
    expect(dbRow.dynamic_binding.field).toBe('priceInr');

    const mappedBack = mapDbCmsPageNodeToDomain(dbRow);
    expect(mappedBack.componentType).toBe(domainNode.componentType);
    expect(mappedBack.props.label).toBe(domainNode.props.label);
    expect(mappedBack.responsiveStyles.mobile?.padding).toBe('1rem');
    expect(mappedBack.dynamicBinding?.field).toBe('priceInr');
  });

  it('4. should persist and retrieve pages, versions, and nodes through the authoritative db facade', async () => {
    const testPageId = `page-persist-${Date.now()}`;
    const testVerId = `ver-persist-${Date.now()}`;

    const page: CmsPage = {
      id: testPageId,
      slug: `audit-standards-${Date.now()}`,
      title: 'HSE Safety Audit Standards',
      pageType: 'STANDARD',
      status: 'DRAFT',
      currentDraftVersionId: testVerId,
      seoMetadata: {},
      createdBy: 'usr-admin-01',
      updatedBy: 'usr-admin-01',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const savedPage = await db.saveCmsPage(page);
    expect(savedPage.id).toBe(testPageId);

    const fetchedBySlug = await db.getCmsPageBySlug(page.slug);
    expect(fetchedBySlug).toBeDefined();
    expect(fetchedBySlug?.title).toBe(page.title);

    // Save nodes
    const testNodes: CmsPageNode[] = [
      {
        id: `node-${Date.now()}`,
        pageVersionId: testVerId,
        parentId: null,
        nodeType: 'SECTION',
        componentType: 'section',
        position: 0,
        props: {},
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    const savedNodes = await db.saveCmsPageNodes(testVerId, testNodes);
    expect(savedNodes.length).toBe(1);

    const fetchedNodes = await db.getCmsPageNodes(testVerId);
    expect(fetchedNodes.length).toBe(1);
    expect(fetchedNodes[0].id).toBe(testNodes[0].id);
  });

  it('5. should persist and retrieve reusable templates and blocks', async () => {
    const tpl: CmsTemplate = {
      id: `tpl-${Date.now()}`,
      name: 'Custom HSE Landing Template',
      description: 'Template for corporate safety audits',
      category: 'AUDIT',
      templateType: 'PAGE',
      nodesSnapshot: [],
      createdBy: 'usr-admin-01',
      createdAt: new Date().toISOString(),
    };

    await db.saveCmsTemplate(tpl);
    const templates = await db.getCmsTemplates();
    expect(templates.some((t) => t.id === tpl.id)).toBe(true);

    const block: CmsReusableBlock = {
      id: `blk-${Date.now()}`,
      name: 'Custom Metric Block',
      category: 'METRICS',
      nodesSnapshot: [],
      createdBy: 'usr-admin-01',
      createdAt: new Date().toISOString(),
    };

    await db.saveCmsReusableBlock(block);
    const blocks = await db.getCmsReusableBlocks();
    expect(blocks.some((b) => b.id === block.id)).toBe(true);
  });
});

