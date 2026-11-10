// Zealosh LMS — Canonical Website Studio Page Type Registry
// Authoritative single-source-of-truth for all 17 public page types and legacy page types
// Standards: Fail-closed typing, metadata enforcement, dynamic academic binding flags

import {
  CmsPageType,
  CmsCanonicalPageType,
  PageTypeDefinition,
} from '@/types/cms';

export const CANONICAL_PAGE_TYPE_REGISTRY: Record<CmsPageType, PageTypeDefinition> = {
  // --------------------------------------------------------------------------
  // 1. HOME
  // --------------------------------------------------------------------------
  HOMEPAGE: {
    type: 'HOMEPAGE',
    label: 'Institutional Home Page',
    description: 'Main public institutional homepage featuring hero banner, accredited statistics, featured programs, and testimonials.',
    category: 'MARKETING',
    defaultTemplateId: 'tpl-canonical-home',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description', 'ogImage'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: '',
  },

  // --------------------------------------------------------------------------
  // 2. ABOUT US
  // --------------------------------------------------------------------------
  ABOUT: {
    type: 'ABOUT',
    label: 'About Zealosh Academy',
    description: 'Institutional profile, founder message, HSE accreditation milestones, quality policy, and Kollam training facility overview.',
    category: 'INFORMATIONAL',
    defaultTemplateId: 'tpl-canonical-about',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'about',
  },

  // --------------------------------------------------------------------------
  // 3. FEATURES
  // --------------------------------------------------------------------------
  FEATURES: {
    type: 'FEATURES',
    label: 'Platform Features & Capabilities',
    description: 'Demonstration of Zealosh digital learning capabilities: WebRTC live classes, AI diagnostic assessments, offline PWA, tamper-evident certs.',
    category: 'MARKETING',
    defaultTemplateId: 'tpl-canonical-features',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'features',
  },

  // --------------------------------------------------------------------------
  // 4. SOLUTIONS
  // --------------------------------------------------------------------------
  SOLUTIONS: {
    type: 'SOLUTIONS',
    label: 'Corporate & Industrial Solutions',
    description: 'Tailored occupational health and safety training programs for oil & gas, construction, manufacturing, and international infrastructure.',
    category: 'MARKETING',
    defaultTemplateId: 'tpl-canonical-solutions',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'solutions',
  },

  // --------------------------------------------------------------------------
  // 5. PRICING
  // --------------------------------------------------------------------------
  PRICING: {
    type: 'PRICING',
    label: 'Course Fees & Payment Plans',
    description: 'Transparent fee schedule for ASP, CSP, CRSP, and CIT certification programs with statutory GST breakdown and corporate discounts.',
    category: 'MARKETING',
    defaultTemplateId: 'tpl-canonical-pricing',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'pricing',
  },

  // --------------------------------------------------------------------------
  // 6. COURSES (Public Directory)
  // --------------------------------------------------------------------------
  COURSES: {
    type: 'COURSES',
    label: 'Course Directory & Catalogue',
    description: 'Searchable public course catalog with filters for certification level, delivery mode (Live/Blended/E-Learning), and batch dates.',
    category: 'ACADEMIC',
    defaultTemplateId: 'tpl-canonical-courses',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'courses',
  },

  // --------------------------------------------------------------------------
  // 7. COURSE DETAILS (Authoritative Course Landing)
  // --------------------------------------------------------------------------
  COURSE_DETAILS: {
    type: 'COURSE_DETAILS',
    label: 'Course Syllabus & Enrollment Details',
    description: 'Dedicated course landing page bound dynamically to PostgreSQL syllabus modules, instructor credentials, fee schedule, and upcoming batches.',
    category: 'ACADEMIC',
    defaultTemplateId: 'tpl-canonical-course-details',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description', 'ogImage'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'courses',
    legacyAlias: 'COURSE_LANDING',
  },

  // --------------------------------------------------------------------------
  // 8. INSTRUCTORS
  // --------------------------------------------------------------------------
  INSTRUCTORS: {
    type: 'INSTRUCTORS',
    label: 'Faculty & Safety Experts Directory',
    description: 'Directory of certified HSE mentors, certified CSP/CRSP practitioners, and industrial safety consultants.',
    category: 'COMMUNITY',
    defaultTemplateId: 'tpl-canonical-instructors',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'instructors',
  },

  // --------------------------------------------------------------------------
  // 9. INSTRUCTOR PROFILE
  // --------------------------------------------------------------------------
  INSTRUCTOR_PROFILE: {
    type: 'INSTRUCTOR_PROFILE',
    label: 'Faculty Member Bio & Background',
    description: 'Individual mentor profile detailing certified credentials, assigned courses, office hours availability, and student reviews.',
    category: 'COMMUNITY',
    defaultTemplateId: 'tpl-canonical-instructor-profile',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'instructors',
  },

  // --------------------------------------------------------------------------
  // 10. CONTACT
  // --------------------------------------------------------------------------
  CONTACT: {
    type: 'CONTACT',
    label: 'Campus Location & Contact Enquiry',
    description: 'Campus address in Kollam, Kerala, customer support telephone/email channels, office hours, and interactive enquiry form.',
    category: 'INFORMATIONAL',
    defaultTemplateId: 'tpl-canonical-contact',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'contact',
  },

  // --------------------------------------------------------------------------
  // 11. FAQ
  // --------------------------------------------------------------------------
  FAQ: {
    type: 'FAQ',
    label: 'Frequently Asked Questions',
    description: 'Categorized knowledge base covering exam eligibility, class attendance policies, mock exam rules, and certificate verification.',
    category: 'INFORMATIONAL',
    defaultTemplateId: 'tpl-canonical-faq',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'faq',
  },

  // --------------------------------------------------------------------------
  // 12. BLOG
  // --------------------------------------------------------------------------
  BLOG: {
    type: 'BLOG',
    label: 'HSE Insights & Articles Directory',
    description: 'Index of published educational articles, regulatory compliance digests, study guides, and safety industry analysis.',
    category: 'INFORMATIONAL',
    defaultTemplateId: 'tpl-canonical-blog',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'blog',
  },

  // --------------------------------------------------------------------------
  // 13. BLOG DETAILS
  // --------------------------------------------------------------------------
  BLOG_DETAILS: {
    type: 'BLOG_DETAILS',
    label: 'Individual Article Post',
    description: 'Detailed article view with sanitized rich text, author credentials, citation notes, and social share links.',
    category: 'INFORMATIONAL',
    defaultTemplateId: 'tpl-canonical-blog-details',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description', 'ogImage'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'blog',
  },

  // --------------------------------------------------------------------------
  // 14. TESTIMONIALS
  // --------------------------------------------------------------------------
  TESTIMONIALS: {
    type: 'TESTIMONIALS',
    label: 'Student Reviews & Success Stories',
    description: 'Verified student success stories, pass-rate celebrations, legal consent badges, and dynamic promotional posters.',
    category: 'COMMUNITY',
    defaultTemplateId: 'tpl-canonical-testimonials',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'testimonials',
  },

  // --------------------------------------------------------------------------
  // 15. CAREERS
  // --------------------------------------------------------------------------
  CAREERS: {
    type: 'CAREERS',
    label: 'Institutional Careers & Recruitment',
    description: 'Employment opportunities for certified HSE instructors, curriculum designers, and educational counselors at Zealosh.',
    category: 'INFORMATIONAL',
    defaultTemplateId: 'tpl-canonical-careers',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'careers',
  },

  // --------------------------------------------------------------------------
  // 16. PRIVACY POLICY
  // --------------------------------------------------------------------------
  PRIVACY_POLICY: {
    type: 'PRIVACY_POLICY',
    label: 'Institutional Privacy Policy',
    description: 'Institutional data governance, candidate personal identification handling, exam proctoring disclosures, and cookie compliance.',
    category: 'LEGAL',
    defaultTemplateId: 'tpl-canonical-privacy',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'privacy-policy',
  },

  // --------------------------------------------------------------------------
  // 17. TERMS & CONDITIONS
  // --------------------------------------------------------------------------
  TERMS: {
    type: 'TERMS',
    label: 'Terms of Service & Examination Rules',
    description: 'Enrollment regulations, fee refund schedules, intellectual property protections, and examination code of conduct.',
    category: 'LEGAL',
    defaultTemplateId: 'tpl-canonical-terms',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'terms',
  },

  // --------------------------------------------------------------------------
  // LEGACY & SPECIALIZED PRESERVED TYPES
  // --------------------------------------------------------------------------
  STANDARD: {
    type: 'STANDARD',
    label: 'Custom Standard Page',
    description: 'General-purpose customizable content page supporting modular containers, sections, and custom rich-text blocks.',
    category: 'SYSTEM',
    defaultTemplateId: 'tpl-canonical-home',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: false,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'p',
  },

  COURSE_LANDING: {
    type: 'COURSE_LANDING',
    label: 'Course Landing Page (Legacy Alias)',
    description: 'Legacy identifier for Course Details page with authoritative course syllabus linkage.',
    category: 'ACADEMIC',
    defaultTemplateId: 'tpl-canonical-course-details',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'courses',
    legacyAlias: 'COURSE_DETAILS',
  },

  ADMISSIONS: {
    type: 'ADMISSIONS',
    label: 'Admissions Portal Landing',
    description: 'Admissions intake campaign page with direct application submission form integration.',
    category: 'MARKETING',
    defaultTemplateId: 'tpl-canonical-solutions',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'admissions',
  },

  CAMPAIGN: {
    type: 'CAMPAIGN',
    label: 'Special Campaign / Seminar Landing',
    description: 'Time-limited promotional landing page for webinars, orientation seminars, or seasonal discounts.',
    category: 'MARKETING',
    defaultTemplateId: 'tpl-canonical-home',
    permittedOperations: ['CREATE', 'EDIT', 'PREVIEW', 'PUBLISH', 'SCHEDULE', 'ROLLBACK', 'DELETE'],
    defaultPublishingBehavior: 'MANUAL',
    requiredMetadata: ['title', 'description'],
    hasDynamicBindings: true,
    isPublic: true,
    isCreatable: true,
    canonicalSlugPrefix: 'campaign',
  },
};

/**
 * Array of all 17 canonical public page type keys
 */
export const CANONICAL_PUBLIC_PAGE_TYPES: CmsCanonicalPageType[] = [
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
];

/**
 * Retrieve definition for any page type key (canonical or legacy)
 */
export function getPageTypeDefinition(type: string): PageTypeDefinition | undefined {
  return CANONICAL_PAGE_TYPE_REGISTRY[type as CmsPageType];
}

/**
 * Returns all registered page type definitions
 */
export function getAllPageTypes(): PageTypeDefinition[] {
  return Object.values(CANONICAL_PAGE_TYPE_REGISTRY);
}

/**
 * Returns the 17 canonical public page type definitions
 */
export function getCanonicalPublicPageTypes(): PageTypeDefinition[] {
  return CANONICAL_PUBLIC_PAGE_TYPES.map((t) => CANONICAL_PAGE_TYPE_REGISTRY[t]);
}

/**
 * Type guard for CmsCanonicalPageType
 */
export function isCanonicalPageType(type: string): type is CmsCanonicalPageType {
  return CANONICAL_PUBLIC_PAGE_TYPES.includes(type as CmsCanonicalPageType);
}

/**
 * Type guard for CmsPageType
 */
export function isValidPageType(type: string): type is CmsPageType {
  return Object.prototype.hasOwnProperty.call(CANONICAL_PAGE_TYPE_REGISTRY, type);
}

/**
 * Returns all page type definitions matching a category
 */
export function getPageTypesByCategory(category: string): PageTypeDefinition[] {
  return getAllPageTypes().filter((p) => p.category === category);
}

/**
 * Returns permitted operations for a page type
 */
export function getPermittedOperationsForPageType(type: CmsPageType): string[] {
  const def = getPageTypeDefinition(type);
  return def ? def.permittedOperations : ['EDIT'];
}

/**
 * Normalizes legacy aliases to canonical keys if needed, while preserving valid legacy types
 */
export function normalizePageType(type: string): CmsPageType {
  if (type === 'COURSE_LANDING') return 'COURSE_DETAILS';
  if (isValidPageType(type)) return type;
  return 'STANDARD';
}

/**
 * Auto-suggests a clean canonical URL slug for a given page type and title
 */
export function suggestSlugForPageType(type: CmsPageType, title?: string): string {
  const def = getPageTypeDefinition(type);
  if (!def) return 'new-page';

  if (type === 'HOMEPAGE') return 'home';

  const prefix = def.canonicalSlugPrefix;
  if (!title || title.trim().toLowerCase() === def.label.toLowerCase()) {
    return prefix || 'page';
  }

  const cleanTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!prefix || prefix === 'p') return cleanTitle || 'page';
  if (cleanTitle.startsWith(prefix)) return cleanTitle;
  return `${prefix}/${cleanTitle}`;
}
