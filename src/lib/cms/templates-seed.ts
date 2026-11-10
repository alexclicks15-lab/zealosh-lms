// Zealosh LMS — Default Seed Templates & Reusable Sections
// Standards: Official Zealosh Green & White, WebJET CMS wj-page-builder hierarchy
// Supports all 17 canonical institutional page types with responsive layouts

import { CmsPageNode, CmsTemplate, CmsPageType } from '@/types/cms';
import { generateNodeId } from './tree-engine';

/**
 * Helper to construct a standard responsive Section -> Container -> Row -> Column tree
 */
function createSectionStructure(
  versionId: string,
  sectionProps: { anchorId: string; fullWidth?: boolean; backgroundColor?: string; padding?: string }
): {
  sectionNode: CmsPageNode;
  containerNode: CmsPageNode;
  rowNode: CmsPageNode;
  columnNode: CmsPageNode;
} {
  const sectionId = generateNodeId('section');
  const containerId = generateNodeId('container');
  const rowId = generateNodeId('row');
  const columnId = generateNodeId('column');
  const now = new Date().toISOString();

  const sectionNode: CmsPageNode = {
    id: sectionId,
    pageVersionId: versionId,
    parentId: null,
    nodeType: 'SECTION',
    componentType: 'section',
    position: 0,
    props: {
      tag: 'section',
      fullWidth: sectionProps.fullWidth ?? false,
      anchorId: sectionProps.anchorId,
    },
    styles: {
      backgroundColor: sectionProps.backgroundColor || '#ffffff',
      padding: sectionProps.padding || '3rem 1rem',
    },
    responsiveStyles: {
      desktop: { padding: '4rem 2rem' },
      tablet: { padding: '3rem 1.5rem' },
      mobile: { padding: '2rem 1rem' },
    },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  const containerNode: CmsPageNode = {
    id: containerId,
    pageVersionId: versionId,
    parentId: sectionId,
    nodeType: 'CONTAINER',
    componentType: 'container',
    position: 0,
    props: { maxWidth: '1200px', centered: true },
    styles: { maxWidth: '1200px', margin: '0 auto', width: '100%' },
    responsiveStyles: {
      desktop: { maxWidth: '1200px' },
      tablet: { maxWidth: '100%', padding: '0 1rem' },
      mobile: { maxWidth: '100%', padding: '0 0.5rem' },
    },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  const rowNode: CmsPageNode = {
    id: rowId,
    pageVersionId: versionId,
    parentId: containerId,
    nodeType: 'ROW',
    componentType: 'row',
    position: 0,
    props: { gutter: 24, wrap: true },
    styles: { display: 'flex', flexWrap: 'wrap', gap: '1.5rem' },
    responsiveStyles: {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  const columnNode: CmsPageNode = {
    id: columnId,
    pageVersionId: versionId,
    parentId: rowId,
    nodeType: 'COLUMN',
    componentType: 'column',
    position: 0,
    props: { span: 12 },
    styles: { flex: '1 1 100%', width: '100%' },
    responsiveStyles: {
      desktop: { width: '100%' },
      tablet: { width: '100%' },
      mobile: { width: '100%' },
    },
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  return { sectionNode, containerNode, rowNode, columnNode };
}

/**
 * 1. HOMEPAGE: Canonical Zealosh Homepage node tree
 */
export function createHomepageStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  // SECTION 1: HERO
  const sec1 = createSectionStructure(versionId, {
    anchorId: 'hero',
    backgroundColor: '#f4f9f3',
    padding: '4rem 1.5rem',
  });
  const heroId = generateNodeId('hero');
  const statsId = generateNodeId('stats_counter');

  sec1.sectionNode.position = 0;
  nodes.push(sec1.sectionNode, sec1.containerNode, sec1.rowNode, sec1.columnNode);

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec1.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Master Your ASP, CSP, CRSP & CIT Examinations',
        subtitle:
          "India's Premier HSE Professional Academy. Accredited live cohorts, rigorous diagnostic mock exams, and personalized technical mentorship from industry leaders.",
        primaryCtaLabel: 'Explore Accredited Courses',
        primaryCtaUrl: '/courses',
        secondaryCtaLabel: 'Attend Live Orientation',
        secondaryCtaUrl: '/p/admissions',
        badgeText: 'BCSP & BCRSP Aligned Curriculum',
        badgeColor: '#4f8c4c',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: statsId,
      pageVersionId: versionId,
      parentId: sec1.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'stats_counter',
      position: 1,
      props: {
        stats: [
          { value: '1,250+', label: 'Certified HSE Alumni' },
          { value: '98.4%', label: 'First-Attempt Pass Rate' },
          { value: '15+ Years', label: 'Safety Training Excellence' },
          { value: '100%', label: 'Direct Faculty Mentorship' },
        ],
      },
      styles: { marginTop: '1.5rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  // SECTION 2: FEATURED COURSES
  const sec2 = createSectionStructure(versionId, { anchorId: 'courses', backgroundColor: '#ffffff' });
  sec2.sectionNode.position = 1;
  const courseCardsId = generateNodeId('course_cards');
  nodes.push(sec2.sectionNode, sec2.containerNode, sec2.rowNode, sec2.columnNode);
  nodes.push({
    id: courseCardsId,
    pageVersionId: versionId,
    parentId: sec2.columnNode.id,
    nodeType: 'COMPONENT',
    componentType: 'course_cards',
    position: 0,
    props: { title: 'Flagship HSE Certification Programs', limit: 4 },
    dynamicBinding: { source: 'course', field: 'all', queryParams: { limit: 4, featured: true } },
    styles: {},
    responsiveStyles: {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });

  return nodes;
}

/**
 * 2. ABOUT US: Institutional Profile & Quality Policy
 */
export function createAboutStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'about-hero', backgroundColor: '#f4f9f3' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'About Zealosh Training & Consultants',
        subtitle:
          'Founded in Kollam, Kerala, Zealosh is dedicated to elevating occupational health, safety, and environmental standards worldwide through accredited professional education.',
        badgeText: 'Institutional Profile',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>Our Institutional Mission</h3>
          <p>Zealosh Training & Consultants provides rigorous, industry-recognized training in health, safety, and environmental disciplines. We prepare safety professionals for prestigious global certifications including ASP (Associate Safety Professional), CSP (Certified Safety Professional), CRSP (Canadian Registered Safety Professional), and CIT (Certified Instructional Trainer).</p>
          <h3>World-Class Facility in Kollam, Kerala</h3>
          <p>Our modern training center combines in-person interactive seminar facilities with state-of-the-art WebRTC live virtual classrooms, ensuring candidates across India and the Gulf region receive uncompromising instruction.</p>
        `,
      },
      styles: { maxWidth: '800px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 3. FEATURES: Platform Capabilities
 */
export function createFeaturesStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'features', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const gridId = generateNodeId('feature_grid');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Enterprise Learning & Assessment Technology',
        subtitle: 'Designed specifically for high-stakes HSE education with verifiable academic integrity.',
        badgeText: 'Platform Architecture',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: gridId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'feature_grid',
      position: 1,
      props: {
        features: [
          { title: 'Live Interactive WebRTC Classroom', description: 'Crystal-clear audio, shared whiteboards, breakout doubt rooms, and automated attendance logging.' },
          { title: 'HSE Certification Exam Engine', description: 'Server-enforced deadline timers, webcam proctoring hooks, and Item Response Theory psychometrics.' },
          { title: 'Tamper-Evident Ed25519 Certificates', description: 'Cryptographically signed completion credentials verifiable online via instant QR code or offline manifests.' },
          { title: 'Progressive Web App (PWA)', description: 'Full mobile offline lesson progress synchronization with background outbox uploads.' },
        ],
      },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 4. SOLUTIONS: Corporate & Industrial Solutions
 */
export function createSolutionsStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'solutions', backgroundColor: '#f4f9f3' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Industrial HSE Solutions & Corporate Training',
        subtitle: 'Customized occupational health, safety, and environmental compliance programs for enterprises across India and the GCC.',
        badgeText: 'Corporate Services',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>Enterprise Safety Compliance</h3>
          <p>Zealosh partners with leading industrial organizations in oil and gas, heavy manufacturing, logistics, and construction to train dedicated safety teams. We tailor curriculum modules to specific site hazards and statutory requirements.</p>
          <h3>Bespoke Corporate Cohorts</h3>
          <p>Dedicated cohorts with private live class schedules, branded enterprise analytics dashboards, and executive attendance reports.</p>
        `,
      },
      styles: { maxWidth: '800px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 5. PRICING: Fee Schedule & Plans
 */
export function createPricingStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'pricing', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const cardsId = generateNodeId('course_cards');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Transparent Investment in Your HSE Career',
        subtitle: 'All program fees include comprehensive curriculum access, live interactive sessions, diagnostic mock exams, and certification verification.',
        badgeText: 'Official Tuition Schedule',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: cardsId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'course_cards',
      position: 1,
      props: { title: 'Program Fees & Enrolment Packages', showPricing: true },
      dynamicBinding: { source: 'course', field: 'all', queryParams: { withPricing: true } },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 6. COURSES: Public Course Catalogue
 */
export function createCoursesStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'course-catalogue', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const cardsId = generateNodeId('course_cards');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Accredited HSE Certification Directory',
        subtitle: 'Explore preparatory courses for global safety credentials. Select from Live Interactive, Blended, or E-Learning modes.',
        badgeText: 'Course Catalog',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: cardsId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'course_cards',
      position: 1,
      props: { title: 'All Available Courses', limit: 12 },
      dynamicBinding: { source: 'course', field: 'all', queryParams: { limit: 12 } },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 7. COURSE DETAILS: Individual Course Landing
 */
export function createCourseDetailsStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'course-details', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('course_hero');
  const accordId = generateNodeId('curriculum_accordion');
  const batchId = generateNodeId('batch_selector');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'course_hero',
      position: 0,
      props: {},
      dynamicBinding: { source: 'course', field: 'details' },
      styles: { marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: accordId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'curriculum_accordion',
      position: 1,
      props: {},
      dynamicBinding: { source: 'course', field: 'details' },
      styles: { marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: batchId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'batch_selector',
      position: 2,
      props: {},
      dynamicBinding: { source: 'batch', field: 'schedule' },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 8. INSTRUCTORS: Faculty Directory
 */
export function createInstructorsStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'instructors', backgroundColor: '#f4f9f3' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const cardId = generateNodeId('instructor_card');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Learn from Certified Safety Experts',
        subtitle: 'Our faculty members are certified CSP, CRSP, and CIT practitioners with decades of active industrial leadership.',
        badgeText: 'Academic Faculty',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: cardId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'instructor_card',
      position: 1,
      props: {},
      dynamicBinding: { source: 'instructor', field: 'profile' },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 9. INSTRUCTOR PROFILE: Individual Faculty Bio
 */
export function createInstructorProfileStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'instructor-profile', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const cardId = generateNodeId('instructor_card');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: cardId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'instructor_card',
      position: 0,
      props: {},
      dynamicBinding: { source: 'instructor', field: 'profile' },
      styles: { marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>Professional Biography & Industry Experience</h3>
          <p>Certified HSE consultant with expertise in high-risk plant safety, hazard identification, and quantitative risk modeling. Conducts weekly live technical mentorship sessions for ASP and CSP examination candidates.</p>
        `,
      },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 10. CONTACT: Campus Location & Enquiry
 */
export function createContactStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'contact', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Connect with Zealosh Campus',
        subtitle: 'Our admissions counselors and academic advisors are available to guide your certification journey.',
        badgeText: 'Kollam, Kerala Campus',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>Campus Address</h3>
          <p><strong>Zealosh Training & Consultants</strong><br/>Main Campus, Kollam, Kerala, India — 691001</p>
          <p><strong>Email:</strong> admissions@zealosh.com | info@zealosh.com<br/><strong>Hours:</strong> Monday – Saturday: 9:00 AM – 6:00 PM IST</p>
        `,
      },
      styles: { maxWidth: '700px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 11. FAQ: Frequently Asked Questions
 */
export function createFaqStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'faq', backgroundColor: '#f4f9f3' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const accordId = generateNodeId('accordion');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Frequently Asked Questions',
        subtitle: 'Find answers regarding course eligibility, mock examinations, certificate verification, and fee plans.',
        badgeText: 'Knowledge Base',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: accordId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'accordion',
      position: 1,
      props: {
        items: [
          { title: 'What are the eligibility requirements for ASP and CSP exams?', content: 'Candidates for ASP typically require a minimum of a bachelor’s degree in any field or an associate degree in safety, plus 1 year of safety experience. CSP requires an approved credential (such as ASP) plus 4 years of professional safety experience.' },
          { title: 'Are the live sessions recorded for later review?', content: 'Yes, every live WebRTC session is recorded, transcribed, and indexed into your student portal within 2 hours of class termination, complete with synchronized doubt submission tools.' },
          { title: 'How are Zealosh digital certificates verified?', content: 'Every Zealosh certificate contains an asymmetric Ed25519 cryptographic signature and a unique QR verification code verifiable on our public verification portal or offline.' },
          { title: 'What installment payment options are available?', content: 'We offer flexible payment schedules with zero-interest installments for enrolled students across all flagship programs.' },
        ],
      },
      styles: { maxWidth: '800px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 12. BLOG: Article Directory
 */
export function createBlogStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'blog', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'HSE Insights, Regulatory Digests & Study Guides',
        subtitle: 'Expert articles from practicing certified safety professionals on examination tactics, industrial safety trends, and regulatory compliance.',
        badgeText: 'Industry Publications',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div class="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-xs font-bold text-[#4f8c4c] uppercase">Exam Tactics</span>
              <h4 class="text-lg font-bold mt-1 text-slate-900">How to Master Math Formulas in the ASP Examination</h4>
              <p class="text-sm text-slate-600 mt-2">Essential ventilation, radiation, and decibel formula shortcuts for first-attempt success.</p>
            </div>
            <div class="p-6 bg-slate-50 border border-slate-200 rounded-xl">
              <span class="text-xs font-bold text-[#4f8c4c] uppercase">Industry Update</span>
              <h4 class="text-lg font-bold mt-1 text-slate-900">2026 Occupational Exposure Limits Overview</h4>
              <p class="text-sm text-slate-600 mt-2">A technical review of newly updated chemical threshold limit values (TLVs).</p>
            </div>
          </div>
        `,
      },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 13. BLOG DETAILS: Single Article View
 */
export function createBlogDetailsStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'article', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Article Headline Placeholder',
        subtitle: 'Published by Zealosh Technical Editorial Board · 8 min read',
        badgeText: 'Technical Publication',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <p>Full article body content begins here. Use the sanitized Rich Text Editor to format paragraphs, callouts, and technical diagrams.</p>
        `,
      },
      styles: { maxWidth: '750px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 14. TESTIMONIALS: Verified Student Reviews
 */
export function createTestimonialsStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'testimonials', backgroundColor: '#f4f9f3' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const gridId = generateNodeId('testimonial_grid');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Verified Graduate Success Stories',
        subtitle: 'Hear from certified safety professionals who achieved certification through Zealosh training cohorts.',
        badgeText: 'Alumni Testimonials',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: gridId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'testimonial_grid',
      position: 1,
      props: {},
      dynamicBinding: { source: 'platform_settings', field: 'testimonials' },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 15. CAREERS: Faculty & Staff Recruitment
 */
export function createCareersStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'careers', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Join the Zealosh Educational Mission',
        subtitle: 'We are continually seeking experienced certified safety professionals to serve as lead instructors, question bank contributors, and mentors.',
        badgeText: 'Career Opportunities',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>Current Openings</h3>
          <ul>
            <li><strong>Lead Instructor — ASP/CSP Preparatory Cohorts:</strong> Minimum CSP certification with 5+ years industrial leadership experience.</li>
            <li><strong>Psychometric Assessment Specialist:</strong> Experience in Item Response Theory (IRT) and technical question drafting.</li>
          </ul>
          <p>Interested candidates can email their CV and certification credentials to <strong>careers@zealosh.com</strong>.</p>
        `,
      },
      styles: { maxWidth: '750px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 16. PRIVACY POLICY: Data Protection Disclosures
 */
export function createPrivacyStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'privacy', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Institutional Privacy Policy',
        subtitle: 'Last updated: November 2026 · Zealosh Training & Consultants, Kollam, Kerala',
        badgeText: 'Data Protection & Governance',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>1. Data We Collect</h3>
          <p>Zealosh Training & Consultants collects personal information including candidate name, contact email, telephone, professional safety credentials, and examination progress strictly to deliver accredited educational training.</p>
          <h3>2. Examination Proctoring & Integrity</h3>
          <p>High-stakes certification mock examinations may capture webcam snapshots strictly for server-side integrity verification. Such data is never shared with third parties.</p>
          <h3>3. Zero Third-Party Advertising</h3>
          <p>We do not monetize student data or embed third-party advertising tracking pixels.</p>
        `,
      },
      styles: { maxWidth: '800px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * 17. TERMS & CONDITIONS: Service & Examination Rules
 */
export function createTermsStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];
  const now = new Date().toISOString();

  const sec = createSectionStructure(versionId, { anchorId: 'terms', backgroundColor: '#ffffff' });
  nodes.push(sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode);

  const heroId = generateNodeId('hero');
  const richId = generateNodeId('rich_text');

  nodes.push(
    {
      id: heroId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        headline: 'Terms of Service & Academic Regulations',
        subtitle: 'Official institutional regulations governing course enrolment, exam integrity, and certifications.',
        badgeText: 'Institutional Terms',
      },
      styles: { textAlign: 'center', marginBottom: '2rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: richId,
      pageVersionId: versionId,
      parentId: sec.columnNode.id,
      nodeType: 'COMPONENT',
      componentType: 'rich_text',
      position: 1,
      props: {
        content: `
          <h3>1. Course Enrolment & Batch Participation</h3>
          <p>Enrolment grants candidate access to the designated batch live virtual classroom, curriculum materials, and assessment modules for the approved duration.</p>
          <h3>2. Academic Integrity & Anti-Cheating Code</h3>
          <p>All candidates must abide by the Zealosh Honor Code. Any unauthorized collusion or recording of examination questions results in immediate disqualification.</p>
          <h3>3. Refund & Cancellation Policy</h3>
          <p>Tuition refunds follow our statutory refund schedule prior to the orientation session. Once batch coursework commences, course fees are non-refundable.</p>
        `,
      },
      styles: { maxWidth: '800px', margin: '0 auto' },
      responsiveStyles: {},
      enabled: true,
      createdAt: now,
      updatedAt: now,
    }
  );

  return nodes;
}

/**
 * Standard blank starter: Section -> Container -> Row -> Column -> Heading + Paragraph
 */
export function createStandardStarterNodes(versionId: string, title?: string): CmsPageNode[] {
  const sec = createSectionStructure(versionId, { anchorId: 'main-content', backgroundColor: '#ffffff' });
  const hId = generateNodeId('heading');
  const pId = generateNodeId('paragraph');
  const now = new Date().toISOString();

  const headingNode: CmsPageNode = {
    id: hId,
    pageVersionId: versionId,
    parentId: sec.columnNode.id,
    nodeType: 'COMPONENT',
    componentType: 'heading',
    position: 0,
    props: { text: title || 'Page Title', level: 'h1' },
    styles: { textColor: '#0f172a', textAlign: 'left', margin: '0 0 1rem 0' },
    responsiveStyles: {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  const paragraphNode: CmsPageNode = {
    id: pId,
    pageVersionId: versionId,
    parentId: sec.columnNode.id,
    nodeType: 'COMPONENT',
    componentType: 'paragraph',
    position: 1,
    props: {
      text: 'Welcome to this page. Add components from the left sidebar to build your layout.',
    },
    styles: { textColor: '#475569', textAlign: 'left', margin: '0 0 1rem 0' },
    responsiveStyles: {},
    enabled: true,
    createdAt: now,
    updatedAt: now,
  };

  return [sec.sectionNode, sec.containerNode, sec.rowNode, sec.columnNode, headingNode, paragraphNode];
}

/**
 * Universal dispatcher to generate starter node tree for any page type
 */
export function getStarterNodesForPageType(pageType: CmsPageType, versionId: string, title?: string): CmsPageNode[] {
  switch (pageType) {
    case 'HOMEPAGE':
      return createHomepageStarterNodes(versionId);
    case 'ABOUT':
      return createAboutStarterNodes(versionId);
    case 'FEATURES':
      return createFeaturesStarterNodes(versionId);
    case 'SOLUTIONS':
      return createSolutionsStarterNodes(versionId);
    case 'PRICING':
      return createPricingStarterNodes(versionId);
    case 'COURSES':
      return createCoursesStarterNodes(versionId);
    case 'COURSE_DETAILS':
    case 'COURSE_LANDING':
      return createCourseDetailsStarterNodes(versionId);
    case 'INSTRUCTORS':
      return createInstructorsStarterNodes(versionId);
    case 'INSTRUCTOR_PROFILE':
      return createInstructorProfileStarterNodes(versionId);
    case 'CONTACT':
      return createContactStarterNodes(versionId);
    case 'FAQ':
      return createFaqStarterNodes(versionId);
    case 'BLOG':
      return createBlogStarterNodes(versionId);
    case 'BLOG_DETAILS':
      return createBlogDetailsStarterNodes(versionId);
    case 'TESTIMONIALS':
      return createTestimonialsStarterNodes(versionId);
    case 'CAREERS':
      return createCareersStarterNodes(versionId);
    case 'PRIVACY_POLICY':
      return createPrivacyStarterNodes(versionId);
    case 'TERMS':
      return createTermsStarterNodes(versionId);
    case 'STANDARD':
    case 'ADMISSIONS':
    case 'CAMPAIGN':
    default:
      return createStandardStarterNodes(versionId, title);
  }
}

/**
 * Returns all 17 canonical institutional system templates
 */
export function getCanonicalSystemTemplates(): CmsTemplate[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'tpl-canonical-home',
      name: 'Zealosh Official Homepage Template',
      description: 'Pre-styled institutional homepage with hero, accredited statistics, and course carousel.',
      category: 'MARKETING',
      templateType: 'PAGE',
      pageType: 'HOMEPAGE',
      isSystem: true,
      nodesSnapshot: createHomepageStarterNodes('tpl-ver-home'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-about',
      name: 'About Zealosh Institutional Profile',
      description: 'Institutional history, director message, and Kollam campus overview.',
      category: 'INFORMATIONAL',
      templateType: 'PAGE',
      pageType: 'ABOUT',
      isSystem: true,
      nodesSnapshot: createAboutStarterNodes('tpl-ver-about'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-features',
      name: 'Platform Features & Academic Tech',
      description: 'Showcase of WebRTC live class, AI Tutor, PWA, and tamper-evident certificates.',
      category: 'MARKETING',
      templateType: 'PAGE',
      pageType: 'FEATURES',
      isSystem: true,
      nodesSnapshot: createFeaturesStarterNodes('tpl-ver-features'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-solutions',
      name: 'Corporate & Industrial HSE Solutions',
      description: 'B2B safety compliance programs and customized enterprise cohorts.',
      category: 'MARKETING',
      templateType: 'PAGE',
      pageType: 'SOLUTIONS',
      isSystem: true,
      nodesSnapshot: createSolutionsStarterNodes('tpl-ver-solutions'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-pricing',
      name: 'Tuition Fees & Payment Plans',
      description: 'Transparent fee schedule with GST breakdown and installment plans.',
      category: 'MARKETING',
      templateType: 'PAGE',
      pageType: 'PRICING',
      isSystem: true,
      nodesSnapshot: createPricingStarterNodes('tpl-ver-pricing'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-courses',
      name: 'Public Course Directory',
      description: 'Searchable directory with delivery mode filters and course cards.',
      category: 'ACADEMIC',
      templateType: 'PAGE',
      pageType: 'COURSES',
      isSystem: true,
      nodesSnapshot: createCoursesStarterNodes('tpl-ver-courses'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-course-details',
      name: 'Dynamic Course Details & Syllabus',
      description: 'Authoritative course landing page bound dynamically to live syllabus and batch dates.',
      category: 'ACADEMIC',
      templateType: 'PAGE',
      pageType: 'COURSE_DETAILS',
      isSystem: true,
      nodesSnapshot: createCourseDetailsStarterNodes('tpl-ver-course-details'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-instructors',
      name: 'Faculty & Safety Mentors Directory',
      description: 'Instructor bios, safety certifications, and mentorship availability.',
      category: 'COMMUNITY',
      templateType: 'PAGE',
      pageType: 'INSTRUCTORS',
      isSystem: true,
      nodesSnapshot: createInstructorsStarterNodes('tpl-ver-instructors'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-instructor-profile',
      name: 'Individual Faculty Member Profile',
      description: 'Detailed instructor biography and assigned courses.',
      category: 'COMMUNITY',
      templateType: 'PAGE',
      pageType: 'INSTRUCTOR_PROFILE',
      isSystem: true,
      nodesSnapshot: createInstructorProfileStarterNodes('tpl-ver-instructor-profile'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-contact',
      name: 'Campus Location & Contact Enquiry',
      description: 'Campus address in Kollam, Kerala, support telephone/email, and interactive enquiry form.',
      category: 'INFORMATIONAL',
      templateType: 'PAGE',
      pageType: 'CONTACT',
      isSystem: true,
      nodesSnapshot: createContactStarterNodes('tpl-ver-contact'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-faq',
      name: 'Frequently Asked Questions & Knowledge Base',
      description: 'Categorized accordion knowledge base covering exam rules and certificates.',
      category: 'INFORMATIONAL',
      templateType: 'PAGE',
      pageType: 'FAQ',
      isSystem: true,
      nodesSnapshot: createFaqStarterNodes('tpl-ver-faq'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-blog',
      name: 'HSE Insights & Articles Directory',
      description: 'Safety industry articles, regulatory updates, and study tips.',
      category: 'INFORMATIONAL',
      templateType: 'PAGE',
      pageType: 'BLOG',
      isSystem: true,
      nodesSnapshot: createBlogStarterNodes('tpl-ver-blog'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-blog-details',
      name: 'Individual Article Post',
      description: 'Sanitized article view with author bio and social share links.',
      category: 'INFORMATIONAL',
      templateType: 'PAGE',
      pageType: 'BLOG_DETAILS',
      isSystem: true,
      nodesSnapshot: createBlogDetailsStarterNodes('tpl-ver-blog-details'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-testimonials',
      name: 'Student Reviews & Success Stories',
      description: 'Verified student success stories, pass-rate celebrations, and legal consent badges.',
      category: 'COMMUNITY',
      templateType: 'PAGE',
      pageType: 'TESTIMONIALS',
      isSystem: true,
      nodesSnapshot: createTestimonialsStarterNodes('tpl-ver-testimonials'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-careers',
      name: 'Careers & Faculty Recruitment',
      description: 'Trainer recruitment opportunities and application guidelines.',
      category: 'INFORMATIONAL',
      templateType: 'PAGE',
      pageType: 'CAREERS',
      isSystem: true,
      nodesSnapshot: createCareersStarterNodes('tpl-ver-careers'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-privacy',
      name: 'Institutional Privacy Policy',
      description: 'Comprehensive student data protection and proctoring disclosures.',
      category: 'LEGAL',
      templateType: 'PAGE',
      pageType: 'PRIVACY_POLICY',
      isSystem: true,
      nodesSnapshot: createPrivacyStarterNodes('tpl-ver-privacy'),
      createdBy: 'system',
      createdAt: now,
    },
    {
      id: 'tpl-canonical-terms',
      name: 'Terms & Conditions & Academic Regulations',
      description: 'Course enrolment rules, exam honor code, and refund policies.',
      category: 'LEGAL',
      templateType: 'PAGE',
      pageType: 'TERMS',
      isSystem: true,
      nodesSnapshot: createTermsStarterNodes('tpl-ver-terms'),
      createdBy: 'system',
      createdAt: now,
    },
  ];
}
