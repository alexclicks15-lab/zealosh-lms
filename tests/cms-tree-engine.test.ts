// Zealosh LMS — Component Tree Engine & Duplication Integrity Tests
// Standards: WebJET CMS wj-page-builder recursive safety, unique ID remapping

import { describe, it, expect } from 'vitest';
import {
  buildTree,
  flattenTree,
  insertNode,
  moveNode,
  duplicateNode,
  deleteNode,
  validateTree,
  isDescendant,
  generateNodeId,
} from '@/lib/cms/tree-engine';
import { CmsPageNode } from '@/types/cms';

describe('Zealosh CMS — Tree Engine & Hierarchy Manipulation Suite', () => {
  const versionId = 'ver-test-01';

  const createSampleTree = (): CmsPageNode[] => {
    return [
      {
        id: 'sec-1',
        pageVersionId: versionId,
        parentId: null,
        nodeType: 'SECTION',
        componentType: 'section',
        position: 0,
        props: { anchorId: 'hero' },
        styles: { backgroundColor: '#ffffff' },
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'cont-1',
        pageVersionId: versionId,
        parentId: 'sec-1',
        nodeType: 'CONTAINER',
        componentType: 'container',
        position: 0,
        props: { fluid: false },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'row-1',
        pageVersionId: versionId,
        parentId: 'cont-1',
        nodeType: 'ROW',
        componentType: 'row',
        position: 0,
        props: { wrap: true },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'col-1',
        pageVersionId: versionId,
        parentId: 'row-1',
        nodeType: 'COLUMN',
        componentType: 'column',
        position: 0,
        props: { colSpan: 6 },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'col-2',
        pageVersionId: versionId,
        parentId: 'row-1',
        nodeType: 'COLUMN',
        componentType: 'column',
        position: 1,
        props: { colSpan: 6 },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'h-1',
        pageVersionId: versionId,
        parentId: 'col-1',
        nodeType: 'COMPONENT',
        componentType: 'heading',
        position: 0,
        props: { text: 'ASP Preparation', level: 'h1' },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
      {
        id: 'p-1',
        pageVersionId: versionId,
        parentId: 'col-1',
        nodeType: 'COMPONENT',
        componentType: 'paragraph',
        position: 1,
        props: { text: 'Course description here' },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
  };

  it('1. should construct a hierarchical tree and flatten it back without data loss', () => {
    const flatNodes = createSampleTree();
    const tree = buildTree(flatNodes);

    expect(tree.length).toBe(1); // 1 root section
    expect(tree[0].id).toBe('sec-1');
    expect(tree[0].children?.length).toBe(1); // 1 container
    expect(tree[0].children![0].id).toBe('cont-1');
    expect(tree[0].children![0].children![0].id).toBe('row-1');
    expect(tree[0].children![0].children![0].children?.length).toBe(2); // 2 columns

    // Flatten tree back
    const flattened = flattenTree(tree, versionId);
    expect(flattened.length).toBe(flatNodes.length);
    expect(flattened.find((n) => n.id === 'h-1')?.parentId).toBe('col-1');
  });

  it('2. should accept valid node insertion and reject invalid hierarchy placement', () => {
    const nodes = createSampleTree();

    // Valid: Insert button into column
    const validBtn: CmsPageNode = {
      id: 'btn-1',
      pageVersionId: versionId,
      parentId: null,
      nodeType: 'COMPONENT',
      componentType: 'button',
      position: 0,
      props: { label: 'Enroll Now', href: '/courses' },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const validRes = insertNode(nodes, validBtn, 'col-1');
    expect(validRes.success).toBe(true);
    expect(validRes.nodes.find((n) => n.id === 'btn-1')?.position).toBe(2); // Positioned after h-1 and p-1

    // Invalid: Attempt to insert section inside a column
    const invalidSec: CmsPageNode = {
      id: 'sec-2',
      pageVersionId: versionId,
      parentId: null,
      nodeType: 'SECTION',
      componentType: 'section',
      position: 0,
      props: {},
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    const invalidRes = insertNode(nodes, invalidSec, 'col-1');
    expect(invalidRes.success).toBe(false);
    expect(invalidRes.error).toContain('Cannot insert section into column');
  });

  it('3. should prevent cyclic hierarchy when moving nodes', () => {
    const nodes = createSampleTree();

    // Attempt to move sec-1 inside its own child cont-1
    const res = moveNode(nodes, 'sec-1', 'cont-1', 0);
    expect(res.success).toBe(false);
    expect(res.error).toContain('Cannot move node into its own descendant');
  });

  it('4. should safely duplicate a component subtree with fresh IDs and remapped interactive anchors', () => {
    let nodes = createSampleTree();

    // Add an interactive tabs component to col-1
    const tabsNode: CmsPageNode = {
      id: 'tabs-1',
      pageVersionId: versionId,
      parentId: 'col-1',
      nodeType: 'COMPONENT',
      componentType: 'tabs',
      position: 2,
      props: {
        activeTab: 0,
        tabs: [
          { id: 'tab-overview', title: 'Overview', content: 'Text 1' },
          { id: 'tab-schedule', title: 'Schedule', content: 'Text 2' },
        ],
      },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    nodes.push(tabsNode);

    // Duplicate the tabs component
    const dupRes = duplicateNode(nodes, 'tabs-1');
    expect(dupRes.success).toBe(true);
    expect(dupRes.newRootId).toBeDefined();

    const clonedNode = dupRes.nodes.find((n) => n.id === dupRes.newRootId);
    expect(clonedNode).toBeDefined();
    expect(clonedNode?.id).not.toBe('tabs-1');

    // Verify that internal tab IDs were remapped so they do not collide with original tab anchors!
    expect(clonedNode?.props.tabs[0].id).not.toBe('tab-overview');
    expect(clonedNode?.props.tabs[0].id).toContain('tab-overview-copy-');
  });

  it('5. should recursively delete a node and all of its descendants, re-indexing remaining siblings', () => {
    const nodes = createSampleTree();

    // Delete cont-1 (should cascade delete row-1, col-1, col-2, h-1, p-1)
    const delRes = deleteNode(nodes, 'cont-1');
    expect(delRes.success).toBe(true);
    expect(delRes.nodes.length).toBe(1); // Only sec-1 remains
    expect(delRes.nodes[0].id).toBe('sec-1');
  });

  it('6. should validate tree integrity, reporting orphan nodes or illegal parent-child relationships', () => {
    const validNodes = createSampleTree();
    const validReport = validateTree(validNodes);
    expect(validReport.isValid).toBe(true);
    expect(validReport.errors.length).toBe(0);

    // Create an orphan node
    const invalidNodes = [
      ...validNodes,
      {
        id: 'orphan-1',
        pageVersionId: versionId,
        parentId: 'missing-parent-id',
        nodeType: 'COMPONENT' as const,
        componentType: 'heading',
        position: 0,
        props: { text: 'Orphan' },
        styles: {},
        responsiveStyles: {},
        enabled: true,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ];
    const invalidReport = validateTree(invalidNodes);
    expect(invalidReport.isValid).toBe(false);
    expect(invalidReport.errors.some((e) => e.includes('missing parent'))).toBe(true);
  });
});

