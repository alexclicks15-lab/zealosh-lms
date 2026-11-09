// Zealosh LMS — Default Seed Templates & Reusable Sections
// Standards: Official Zealosh Green & White, WebJET CMS wj-page-builder hierarchy

import { CmsPageNode } from '@/types/cms';
import { generateNodeId } from './tree-engine';

/**
 * Generates the Canonical Zealosh Homepage node tree
 */
export function createHomepageStarterNodes(versionId: string): CmsPageNode[] {
  const nodes: CmsPageNode[] = [];

  // SECTION 1: HERO SECTION
  const secHeroId = generateNodeId('section');
  const contHeroId = generateNodeId('container');
  const rowHeroId = generateNodeId('row');
  const colHeroId = generateNodeId('column');
  const heroComponentId = generateNodeId('hero');
  const statsComponentId = generateNodeId('stats_counter');

  nodes.push(
    {
      id: secHeroId,
      pageVersionId: versionId,
      parentId: null,
      nodeType: 'SECTION',
      componentType: 'section',
      position: 0,
      props: { tag: 'section', fullWidth: false, anchorId: 'hero' },
      styles: {
        backgroundColor: '#f4f9f3',
        padding: '3rem 1rem',
      },
      responsiveStyles: {
        desktop: { padding: '4rem 2rem' },
        tablet: { padding: '3rem 1.5rem' },
        mobile: { padding: '2rem 1rem' },
      },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: contHeroId,
      pageVersionId: versionId,
      parentId: secHeroId,
      nodeType: 'CONTAINER',
      componentType: 'container',
      position: 0,
      props: { fluid: false, maxWidth: '1280px' },
      styles: { margin: '0 auto', padding: '0 1rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: rowHeroId,
      pageVersionId: versionId,
      parentId: contHeroId,
      nodeType: 'ROW',
      componentType: 'row',
      position: 0,
      props: { justify: 'center', align: 'center', gap: '1.5rem', wrap: true },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: colHeroId,
      pageVersionId: versionId,
      parentId: rowHeroId,
      nodeType: 'COLUMN',
      componentType: 'column',
      position: 0,
      props: { colSpan: 12 },
      styles: { padding: '0.75rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: heroComponentId,
      pageVersionId: versionId,
      parentId: colHeroId,
      nodeType: 'COMPONENT',
      componentType: 'hero',
      position: 0,
      props: {
        badge: 'OFFICIAL ZEALOSH HSE CERTIFICATION ACADEMY',
        headline: 'Master Your ASP, CSP, CRSP & CIT Examinations',
        subtitle:
          'Accelerate your safety career with elite mentorship from Vishnu Rajendran. Real-time live classes, comprehensive calculation workshops, high-yield formula sheets, and authoritative blueprint mock exam simulations.',
        primaryCtaText: 'View Upcoming Batches',
        primaryCtaHref: '/courses',
        secondaryCtaText: 'Launch Mock Exam Engine',
        secondaryCtaHref: '/exams',
      },
      styles: { padding: '1rem 0' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: statsComponentId,
      pageVersionId: versionId,
      parentId: colHeroId,
      nodeType: 'COMPONENT',
      componentType: 'stats_counter',
      position: 1,
      props: {
        stats: [
          { value: '98.4%', label: 'First-Time Pass Rate' },
          { value: '1,250+', label: 'HSE Professionals Mentored' },
          { value: '12+ Nations', label: 'Global Alumni Network' },
        ],
      },
      styles: { padding: '1.5rem 0' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  // SECTION 2: ACCREDITED COURSES SECTION
  const secCoursesId = generateNodeId('section');
  const contCoursesId = generateNodeId('container');
  const rowCoursesId = generateNodeId('row');
  const colCoursesId = generateNodeId('column');
  const headingCoursesId = generateNodeId('heading');
  const courseCardsId = generateNodeId('course_cards');

  nodes.push(
    {
      id: secCoursesId,
      pageVersionId: versionId,
      parentId: null,
      nodeType: 'SECTION',
      componentType: 'section',
      position: 1,
      props: { tag: 'section', fullWidth: false, anchorId: 'courses' },
      styles: { backgroundColor: '#ffffff', padding: '4rem 1rem' },
      responsiveStyles: {
        desktop: { padding: '4rem 2rem' },
        tablet: { padding: '3rem 1.5rem' },
        mobile: { padding: '2.5rem 1rem' },
      },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: contCoursesId,
      pageVersionId: versionId,
      parentId: secCoursesId,
      nodeType: 'CONTAINER',
      componentType: 'container',
      position: 0,
      props: { fluid: false, maxWidth: '1280px' },
      styles: { margin: '0 auto', padding: '0 1rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: rowCoursesId,
      pageVersionId: versionId,
      parentId: contCoursesId,
      nodeType: 'ROW',
      componentType: 'row',
      position: 0,
      props: { justify: 'start', align: 'stretch', gap: '1.5rem', wrap: true },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: colCoursesId,
      pageVersionId: versionId,
      parentId: rowCoursesId,
      nodeType: 'COLUMN',
      componentType: 'column',
      position: 0,
      props: { colSpan: 12 },
      styles: { padding: '0.75rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: headingCoursesId,
      pageVersionId: versionId,
      parentId: colCoursesId,
      nodeType: 'COMPONENT',
      componentType: 'heading',
      position: 0,
      props: {
        text: 'Accredited HSE Certification Programs',
        level: 'h2',
      },
      styles: { textColor: '#0f172a', textAlign: 'center', margin: '0 0 2rem 0' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: courseCardsId,
      pageVersionId: versionId,
      parentId: colCoursesId,
      nodeType: 'COMPONENT',
      componentType: 'course_cards',
      position: 1,
      props: { filterCertification: 'ALL', limit: 6 },
      styles: { padding: '1rem 0' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  // SECTION 3: FAQ & ACCORDION SECTION
  const secFaqId = generateNodeId('section');
  const contFaqId = generateNodeId('container');
  const rowFaqId = generateNodeId('row');
  const colFaqId = generateNodeId('column');
  const headingFaqId = generateNodeId('heading');
  const accordionId = generateNodeId('accordion');

  nodes.push(
    {
      id: secFaqId,
      pageVersionId: versionId,
      parentId: null,
      nodeType: 'SECTION',
      componentType: 'section',
      position: 2,
      props: { tag: 'section', fullWidth: false, anchorId: 'faq' },
      styles: { backgroundColor: '#f8fafc', padding: '4rem 1rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: contFaqId,
      pageVersionId: versionId,
      parentId: secFaqId,
      nodeType: 'CONTAINER',
      componentType: 'container',
      position: 0,
      props: { fluid: false, maxWidth: '1024px' },
      styles: { margin: '0 auto', padding: '0 1rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: rowFaqId,
      pageVersionId: versionId,
      parentId: contFaqId,
      nodeType: 'ROW',
      componentType: 'row',
      position: 0,
      props: { justify: 'start', align: 'stretch', gap: '1rem', wrap: true },
      styles: {},
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: colFaqId,
      pageVersionId: versionId,
      parentId: rowFaqId,
      nodeType: 'COLUMN',
      componentType: 'column',
      position: 0,
      props: { colSpan: 12 },
      styles: { padding: '0.75rem' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: headingFaqId,
      pageVersionId: versionId,
      parentId: colFaqId,
      nodeType: 'COMPONENT',
      componentType: 'heading',
      position: 0,
      props: {
        text: 'Frequently Asked Questions',
        level: 'h2',
      },
      styles: { textColor: '#0f172a', textAlign: 'center', margin: '0 0 2rem 0' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: accordionId,
      pageVersionId: versionId,
      parentId: colFaqId,
      nodeType: 'COMPONENT',
      componentType: 'accordion',
      position: 1,
      props: {
        items: [
          {
            id: 'faq-1',
            title: 'How long do I get access to recorded sessions and formula sheets?',
            content:
              'Students receive 12 months of continuous access to all class recordings, calculations, and formula sheets from the date of enrollment.',
          },
          {
            id: 'faq-2',
            title: 'Are the mock exams timed according to official BCSP/BCRSP rules?',
            content:
              'Yes, our mock exam engine exactly simulates the 5-hour BCSP examination deadline with real-time countdown, domain diagnostics, and anti-cheat protection.',
          },
          {
            id: 'faq-3',
            title: 'What happens if I miss a live classroom session?',
            content:
              'All live WebRTC classes are recorded with attendance tracking and published automatically to your student portal within 2 hours of session conclusion.',
          },
        ],
      },
      styles: { padding: '1rem 0' },
      responsiveStyles: {},
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  );

  return nodes;
}

