// Zealosh LMS — Website Studio WS-01: Canonical Page Type Registry Unit Test Suite
// Verifies all 17 canonical page types, legacy compatibility aliases, slug generation, and operation guards

import { describe, it, expect } from 'vitest';
import {
  CANONICAL_PUBLIC_PAGE_TYPES,
  CANONICAL_PAGE_TYPE_REGISTRY,
  getAllPageTypes,
  getCanonicalPublicPageTypes,
  isCanonicalPageType,
  isValidPageType,
  getPageTypeDefinition,
  getPageTypesByCategory,
  suggestSlugForPageType,
  getPermittedOperationsForPageType,
} from '@/lib/cms/page-type-registry';
import { CmsPageType } from '@/types/cms';

describe('Zealosh Website Studio — Page Type Registry & Canonical Architecture', () => {
  it('1. should register exactly 17 canonical institutional page types', () => {
    expect(CANONICAL_PUBLIC_PAGE_TYPES).toHaveLength(17);
    expect(CANONICAL_PUBLIC_PAGE_TYPES).toEqual([
      'HOMEPAGE',
      'ABOUT',
      'FEATURES',
      'SOLUTIONS',
      'PRICING',
      'COURSES',
      'COURSE_DETAILS',
      'INSTRUCTORS',
      'INSTRUCTOR_PROFILE',
      'CONTACT',
      'FAQ',
      'BLOG',
      'BLOG_DETAILS',
      'TESTIMONIALS',
      'CAREERS',
      'PRIVACY_POLICY',
      'TERMS',
    ]);
  });

  it('2. should provide comprehensive definitions for every canonical page type', () => {
    const canonicalDefs = getCanonicalPublicPageTypes();
    expect(canonicalDefs).toHaveLength(17);

    canonicalDefs.forEach((def) => {
      expect(def.type).toBeDefined();
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
      expect(def.category).toBeTruthy();
      expect(def.defaultTemplateId).toMatch(/^tpl-canonical-/);
      expect(Array.isArray(def.permittedOperations)).toBe(true);
      expect(def.permittedOperations.length).toBeGreaterThan(0);
      expect(isCanonicalPageType(def.type)).toBe(true);
    });
  });

  it('3. should support legacy types with isCanonicalPageType returning false', () => {
    const legacyTypes: CmsPageType[] = ['STANDARD', 'COURSE_LANDING', 'ADMISSIONS', 'CAMPAIGN'];

    legacyTypes.forEach((lt) => {
      expect(isValidPageType(lt)).toBe(true);
      expect(isCanonicalPageType(lt)).toBe(false);
      const def = getPageTypeDefinition(lt);
      expect(def).toBeDefined();
    });
  });

  it('4. should correctly classify types by category', () => {
    const marketingPages = getPageTypesByCategory('MARKETING');
    expect(marketingPages.some((p) => p.type === 'HOMEPAGE')).toBe(true);
    expect(marketingPages.some((p) => p.type === 'FEATURES')).toBe(true);
    expect(marketingPages.some((p) => p.type === 'SOLUTIONS')).toBe(true);
    expect(marketingPages.some((p) => p.type === 'PRICING')).toBe(true);

    const infoPages = getPageTypesByCategory('INFORMATIONAL');
    expect(infoPages.some((p) => p.type === 'ABOUT')).toBe(true);
    expect(infoPages.some((p) => p.type === 'CONTACT')).toBe(true);
    expect(infoPages.some((p) => p.type === 'FAQ')).toBe(true);
    expect(infoPages.some((p) => p.type === 'BLOG')).toBe(true);
    expect(infoPages.some((p) => p.type === 'CAREERS')).toBe(true);

    const legalPages = getPageTypesByCategory('LEGAL');
    expect(legalPages.some((p) => p.type === 'PRIVACY_POLICY')).toBe(true);
    expect(legalPages.some((p) => p.type === 'TERMS')).toBe(true);

    const academicPages = getPageTypesByCategory('ACADEMIC');
    expect(academicPages.some((p) => p.type === 'COURSES')).toBe(true);
    expect(academicPages.some((p) => p.type === 'COURSE_DETAILS')).toBe(true);

    const communityPages = getPageTypesByCategory('COMMUNITY');
    expect(communityPages.some((p) => p.type === 'INSTRUCTORS')).toBe(true);
    expect(communityPages.some((p) => p.type === 'INSTRUCTOR_PROFILE')).toBe(true);
    expect(communityPages.some((p) => p.type === 'TESTIMONIALS')).toBe(true);
  });

  it('5. should reject unknown or invalid page types', () => {
    expect(isValidPageType('UNKNOWN_RANDOM_TYPE')).toBe(false);
    expect(isValidPageType('')).toBe(false);
    expect(isValidPageType('HOMEPAGE_V2')).toBe(false);
    expect(getPageTypeDefinition('INVALID_TYPE')).toBeUndefined();
  });

  it('6. should auto-suggest institutional slugs based on page type and title', () => {
    // Fixed canonical slugs
    expect(suggestSlugForPageType('HOMEPAGE')).toBe('home');
    expect(suggestSlugForPageType('ABOUT')).toBe('about');
    expect(suggestSlugForPageType('FEATURES')).toBe('features');
    expect(suggestSlugForPageType('SOLUTIONS')).toBe('solutions');
    expect(suggestSlugForPageType('PRICING')).toBe('pricing');
    expect(suggestSlugForPageType('COURSES')).toBe('courses');
    expect(suggestSlugForPageType('INSTRUCTORS')).toBe('instructors');
    expect(suggestSlugForPageType('CONTACT')).toBe('contact');
    expect(suggestSlugForPageType('FAQ')).toBe('faq');
    expect(suggestSlugForPageType('BLOG')).toBe('blog');
    expect(suggestSlugForPageType('TESTIMONIALS')).toBe('testimonials');
    expect(suggestSlugForPageType('CAREERS')).toBe('careers');
    expect(suggestSlugForPageType('PRIVACY_POLICY')).toBe('privacy-policy');
    expect(suggestSlugForPageType('TERMS')).toBe('terms');

    // Dynamic parameterized slugs
    expect(suggestSlugForPageType('COURSE_DETAILS', 'ASP Examination Preparation')).toBe(
      'courses/asp-examination-preparation'
    );
    expect(suggestSlugForPageType('INSTRUCTOR_PROFILE', 'Dr. Rajesh Pillai CSP')).toBe(
      'instructors/dr-rajesh-pillai-csp'
    );
    expect(suggestSlugForPageType('BLOG_DETAILS', 'How to Pass the CRSP Exam First Try')).toBe(
      'blog/how-to-pass-the-crsp-exam-first-try'
    );
    expect(suggestSlugForPageType('STANDARD', 'Special Institutional Announcement')).toBe(
      'special-institutional-announcement'
    );
  });

  it('7. should return permitted operations for page types', () => {
    const homeOps = getPermittedOperationsForPageType('HOMEPAGE');
    expect(homeOps).toContain('EDIT');
    expect(homeOps).toContain('PUBLISH');
    expect(homeOps).toContain('ROLLBACK');

    const privacyOps = getPermittedOperationsForPageType('PRIVACY_POLICY');
    expect(privacyOps).toContain('EDIT');
    expect(privacyOps).toContain('PUBLISH');
  });
});
