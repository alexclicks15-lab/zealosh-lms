// Zealosh LMS — Website Studio WS-01: Institutional Templates Foundation Unit Test Suite
// Verifies all 17 system templates, node structure, parent-child relational tree integrity, and starter generators

import { describe, it, expect } from 'vitest';
import {
  getCanonicalSystemTemplates,
  getStarterNodesForPageType,
  createStandardStarterNodes,
} from '@/lib/cms/templates-seed';
import { CANONICAL_PUBLIC_PAGE_TYPES } from '@/lib/cms/page-type-registry';
import { CmsPageNode } from '@/types/cms';

describe('Zealosh Website Studio — Institutional Templates Foundation', () => {
  it('1. should generate exactly 17 canonical system templates', () => {
    const templates = getCanonicalSystemTemplates();
    expect(templates).toHaveLength(17);

    // Verify all canonical page types have a corresponding system template
    const templatePageTypes = templates.map((t) => t.pageType);
    CANONICAL_PUBLIC_PAGE_TYPES.forEach((pt) => {
      expect(templatePageTypes).toContain(pt);
    });
  });

  it('2. should enforce system immutable template invariants', () => {
    const templates = getCanonicalSystemTemplates();

    templates.forEach((tpl) => {
      expect(tpl.isSystem).toBe(true);
      expect(tpl.id).toMatch(/^tpl-canonical-/);
      expect(tpl.name).toBeTruthy();
      expect(tpl.description).toBeTruthy();
      expect(tpl.category).toBeTruthy();
      expect(tpl.pageType).toBeDefined();
      expect(Array.isArray(tpl.nodesSnapshot)).toBe(true);
      expect(tpl.nodesSnapshot.length).toBeGreaterThan(0);
      expect(tpl.createdBy).toBe('system');
    });
  });

  it('3. should verify parent-child relational tree integrity in all 17 system templates', () => {
    const templates = getCanonicalSystemTemplates();

    templates.forEach((tpl) => {
      const nodeMap = new Map<string, CmsPageNode>();
      tpl.nodesSnapshot.forEach((n) => nodeMap.set(n.id, n));

      let rootCount = 0;
      tpl.nodesSnapshot.forEach((node) => {
        if (node.parentId === null) {
          rootCount++;
          expect(node.nodeType).toBe('SECTION');
        } else if (node.parentId) {
          // If child node, its parent MUST exist in the snapshot
          const parent = nodeMap.get(node.parentId);
          expect(parent).toBeDefined();
        }
      });

      expect(rootCount).toBeGreaterThanOrEqual(1);
    });
  });

  it('4. should generate starter nodes for any canonical page type with specified versionId', () => {
    const testVersionId = 'ver-unit-test-123';

    CANONICAL_PUBLIC_PAGE_TYPES.forEach((pt) => {
      const nodes = getStarterNodesForPageType(pt, testVersionId, `Test Page for ${pt}`);
      expect(nodes.length).toBeGreaterThan(0);

      nodes.forEach((node) => {
        expect(node.pageVersionId).toBe(testVersionId);
        expect(node.id).toBeTruthy();
        expect(node.nodeType).toBeTruthy();
        expect(node.componentType).toBeTruthy();
      });

      // Root section check
      const roots = nodes.filter((n) => n.parentId === null);
      expect(roots.length).toBeGreaterThanOrEqual(1);
      expect(roots[0].nodeType).toBe('SECTION');
    });
  });

  it('5. should preserve the backward-compatible Section -> Container -> Row -> Column -> heading + paragraph hierarchy for STANDARD pages', () => {
    const testVersionId = 'ver-standard-compat-456';
    const nodes = createStandardStarterNodes(testVersionId, 'Standard Article Title');

    expect(nodes.length).toBe(6);

    const section = nodes.find((n) => n.componentType === 'section');
    const container = nodes.find((n) => n.componentType === 'container');
    const row = nodes.find((n) => n.componentType === 'row');
    const column = nodes.find((n) => n.componentType === 'column');
    const heading = nodes.find((n) => n.componentType === 'heading');
    const paragraph = nodes.find((n) => n.componentType === 'paragraph');

    expect(section).toBeDefined();
    expect(container).toBeDefined();
    expect(row).toBeDefined();
    expect(column).toBeDefined();
    expect(heading).toBeDefined();
    expect(paragraph).toBeDefined();

    expect(section?.parentId).toBeNull();
    expect(container?.parentId).toBe(section?.id);
    expect(row?.parentId).toBe(container?.id);
    expect(column?.parentId).toBe(row?.id);
    expect(heading?.parentId).toBe(column?.id);
    expect(paragraph?.parentId).toBe(column?.id);
  });
});
