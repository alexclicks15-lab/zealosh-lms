// Zealosh LMS — CMS Component Registry & Hierarchy Validation Tests
// Standards: WebJET CMS wj-page-builder structural versus content separation

import { describe, it, expect } from 'vitest';
import { COMPONENT_REGISTRY, isValidChild, isValidParent } from '@/lib/cms/component-registry';

describe('Zealosh CMS — Component Registry & Structural Hierarchy Suite', () => {
  it('1. should enforce that only SECTION is permitted as page root', () => {
    expect(isValidChild(null, 'section')).toBe(true);
    expect(isValidChild(undefined, 'section')).toBe(true);

    // Other structural and content components cannot be placed at root
    expect(isValidChild(null, 'container')).toBe(false);
    expect(isValidChild(null, 'row')).toBe(false);
    expect(isValidChild(null, 'column')).toBe(false);
    expect(isValidChild(null, 'heading')).toBe(false);
    expect(isValidChild(null, 'button')).toBe(false);
    expect(isValidChild(null, 'hero')).toBe(false);
  });

  it('2. should enforce valid parent-child nesting contracts (Section -> Container -> Row -> Column)', () => {
    // Section -> Container
    expect(isValidChild('section', 'container')).toBe(true);
    expect(isValidChild('section', 'row')).toBe(false);
    expect(isValidChild('section', 'column')).toBe(false);
    expect(isValidChild('section', 'heading')).toBe(false);

    // Container -> Row
    expect(isValidChild('container', 'row')).toBe(true);
    expect(isValidChild('container', 'section')).toBe(false);

    // Row -> Column
    expect(isValidChild('row', 'column')).toBe(true);
    expect(isValidChild('row', 'heading')).toBe(false);
    expect(isValidChild('row', 'section')).toBe(false);
  });

  it('3. should allow columns to host content, presentation, academic, and interactive leaf components', () => {
    const allowedInColumn = [
      'content_region',
      'heading',
      'paragraph',
      'rich_text',
      'button',
      'image',
      'quote',
      'list',
      'tabs',
      'accordion',
      'hero',
      'course_cards',
      'course_hero',
      'curriculum_accordion',
      'batch_selector',
      'instructor_card',
      'testimonial_grid',
      'feature_grid',
      'stats_counter',
    ];

    allowedInColumn.forEach((childType) => {
      expect(isValidChild('column', childType)).toBe(true);
    });
  });

  it('4. should reject nesting an entire section inside an ordinary column (wj-page-builder invariant)', () => {
    expect(isValidChild('column', 'section')).toBe(false);
    expect(isValidChild('row', 'section')).toBe(false);
    expect(isValidChild('content_region', 'section')).toBe(false);
  });

  it('5. should provide complete default properties, styles, and responsive schemas for all registered components', () => {
    Object.entries(COMPONENT_REGISTRY).forEach(([type, def]) => {
      expect(def.type).toBe(type);
      expect(def.name).toBeDefined();
      expect(def.category).toBeDefined();
      expect(def.nodeType).toBeDefined();
      expect(def.defaultProps).toBeDefined();
      expect(def.defaultStyles).toBeDefined();
      expect(def.defaultResponsiveStyles).toBeDefined();
      expect(Array.isArray(def.allowedParents)).toBe(true);
      expect(Array.isArray(def.allowedChildren)).toBe(true);
    });
  });
});

