// Zealosh LMS — Component Registry & Structural Hierarchy Engine
// Standards: WebJET CMS wj-page-builder separation of structure and leaf content

import { ComponentDefinition } from '@/types/cms';

export const COMPONENT_REGISTRY: Record<string, ComponentDefinition> = {
  // --------------------------------------------------------------------------
  // LAYOUT COMPONENTS (Structural Grid)
  // --------------------------------------------------------------------------
  section: {
    type: 'section',
    name: 'Section',
    category: 'layout',
    description: 'Top-level page section with background styling and padding',
    iconName: 'Layers',
    nodeType: 'SECTION',
    allowedParents: [], // Root only
    allowedChildren: ['container'],
    isRootAllowed: true,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      tag: 'section',
      fullWidth: false,
      anchorId: '',
    },
    defaultStyles: {
      backgroundColor: '#ffffff',
      padding: '4rem 1rem',
      margin: '0',
    },
    defaultResponsiveStyles: {
      desktop: { padding: '4rem 2rem' },
      tablet: { padding: '3rem 1.5rem' },
      mobile: { padding: '2rem 1rem' },
    },
  },

  container: {
    type: 'container',
    name: 'Container',
    category: 'layout',
    description: 'Responsive centered container adhering to grid boundaries',
    iconName: 'Box',
    nodeType: 'CONTAINER',
    allowedParents: ['section'],
    allowedChildren: ['row', 'tabs', 'accordion', 'content_region'],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      fluid: false,
      maxWidth: '1280px',
    },
    defaultStyles: {
      margin: '0 auto',
      padding: '0 1rem',
    },
    defaultResponsiveStyles: {
      desktop: { padding: '0 1.5rem' },
      tablet: { padding: '0 1rem' },
      mobile: { padding: '0 0.75rem' },
    },
  },

  row: {
    type: 'row',
    name: 'Row',
    category: 'layout',
    description: 'Horizontal flex row organizing responsive columns',
    iconName: 'Columns',
    nodeType: 'ROW',
    allowedParents: ['container'],
    allowedChildren: ['column'],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      justify: 'start',
      align: 'stretch',
      gap: '1.5rem',
      wrap: true,
    },
    defaultStyles: {
      margin: '0 -0.75rem',
    },
    defaultResponsiveStyles: {},
  },

  column: {
    type: 'column',
    name: 'Column',
    category: 'layout',
    description: 'Responsive grid column containing protected column-content',
    iconName: 'LayoutGrid',
    nodeType: 'COLUMN',
    allowedParents: ['row'],
    allowedChildren: [
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
    ],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      colSpan: 12, // Default 12-column span
    },
    defaultStyles: {
      padding: '0.75rem',
    },
    defaultResponsiveStyles: {
      desktop: { colSpan: 12 },
      tablet: { colSpan: 12 },
      mobile: { colSpan: 12 },
    },
  },

  content_region: {
    type: 'content_region',
    name: 'Content Region',
    category: 'layout',
    description: 'Protected leaf-content wrapper isolating editing from layout',
    iconName: 'FileText',
    nodeType: 'CONTENT_REGION',
    allowedParents: ['column', 'container'],
    allowedChildren: ['heading', 'paragraph', 'rich_text', 'button', 'image', 'quote', 'list'],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {},
    defaultStyles: {
      padding: '0',
    },
    defaultResponsiveStyles: {},
  },

  // --------------------------------------------------------------------------
  // CONTENT & TYPOGRAPHY COMPONENTS
  // --------------------------------------------------------------------------
  heading: {
    type: 'heading',
    name: 'Heading',
    category: 'content',
    description: 'Accessible semantic heading (H1 - H4)',
    iconName: 'Heading',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      text: 'Excellence in HSE Professional Training',
      level: 'h2', // h1, h2, h3, h4
    },
    defaultStyles: {
      textColor: '#0f172a',
      textAlign: 'left',
      margin: '0 0 1rem 0',
    },
    defaultResponsiveStyles: {},
  },

  paragraph: {
    type: 'paragraph',
    name: 'Paragraph',
    category: 'content',
    description: 'Lead or body paragraph text',
    iconName: 'AlignLeft',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      text: 'Zealosh Training & Consultants provides rigorous preparation for international health, safety, and environment examinations.',
      lead: false,
    },
    defaultStyles: {
      textColor: '#475569',
      textAlign: 'left',
      margin: '0 0 1rem 0',
    },
    defaultResponsiveStyles: {},
  },

  rich_text: {
    type: 'rich_text',
    name: 'Rich Text',
    category: 'content',
    description: 'Sanitized rich HTML content with formatting and links',
    iconName: 'Code',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      html: '<p>Comprehensive HSE preparation designed for working safety professionals across India and the Middle East.</p>',
    },
    defaultStyles: {
      textColor: '#334155',
    },
    defaultResponsiveStyles: {},
  },

  button: {
    type: 'button',
    name: 'Call to Action Button',
    category: 'content',
    description: 'Action button with validated safe destination URL',
    iconName: 'MousePointerClick',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      label: 'Explore Accredited Courses',
      href: '/courses',
      variant: 'primary', // 'primary' | 'secondary' | 'outline'
      size: 'md',
    },
    defaultStyles: {
      backgroundColor: '#4f8c4c',
      textColor: '#ffffff',
      borderRadius: '0.5rem',
      padding: '0.75rem 1.5rem',
      margin: '0.5rem 0',
    },
    defaultResponsiveStyles: {},
  },

  quote: {
    type: 'quote',
    name: 'Blockquote',
    category: 'content',
    description: 'Stylized editorial quote with attribution',
    iconName: 'Quote',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      quote: 'The calculation workshops and formula sheets were decisive in clearing my ASP examination on the first attempt.',
      author: 'K. S. Narayanan, CSP',
      role: 'Lead Safety Specialist, Larsen & Toubro',
    },
    defaultStyles: {
      padding: '1.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: '0.5rem',
      border: '1px solid #e2e8f0',
    },
    defaultResponsiveStyles: {},
  },

  list: {
    type: 'list',
    name: 'Feature List',
    category: 'content',
    description: 'Bullet list with verified icon markers',
    iconName: 'CheckSquare',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      items: [
        'Live interactive WebRTC calculation sessions',
        'Direct mentorship from certified HSE practitioners',
        'Realistic blueprint mock exams with in-flight scoring',
        'Official course completion credential verification',
      ],
      ordered: false,
    },
    defaultStyles: {
      margin: '1rem 0',
    },
    defaultResponsiveStyles: {},
  },

  // --------------------------------------------------------------------------
  // MEDIA
  // --------------------------------------------------------------------------
  image: {
    type: 'image',
    name: 'Image',
    category: 'media',
    description: 'Responsive image with fixed aspect ratio and verified alt text',
    iconName: 'Image',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'content_region'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      url: '/logo.png',
      alt: 'Zealosh Training & Consultants HSE Academy',
      caption: '',
      aspectRatio: '16/9',
      objectFit: 'cover',
    },
    defaultStyles: {
      borderRadius: '0.5rem',
      margin: '1rem 0',
    },
    defaultResponsiveStyles: {},
  },

  // --------------------------------------------------------------------------
  // PRESENTATION & BRANDING
  // --------------------------------------------------------------------------
  hero: {
    type: 'hero',
    name: 'Hero Showcase',
    category: 'presentation',
    description: 'Hero block with headline, badge, subtitle, and dual action CTAs',
    iconName: 'Sparkles',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      badge: 'OFFICIAL ZEALOSH HSE CERTIFICATION ACADEMY',
      headline: 'Master Your ASP, CSP, CRSP & CIT Examinations',
      subtitle: 'Accelerate your occupational safety career with elite mentorship from Vishnu Rajendran. Real-time live classes, calculation workshops, and authoritative blueprint mock exam simulations.',
      primaryCtaText: 'View Upcoming Batches',
      primaryCtaHref: '/courses',
      secondaryCtaText: 'Launch Mock Exam Engine',
      secondaryCtaHref: '/exams',
    },
    defaultStyles: {
      padding: '2rem 0',
    },
    defaultResponsiveStyles: {},
  },

  feature_grid: {
    type: 'feature_grid',
    name: 'Feature Grid',
    category: 'presentation',
    description: 'Three-column grid showcasing core platform advantages',
    iconName: 'Grid',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      title: 'Engineered for High-Stakes HSE Certification',
      subtitle: 'Everything you need to master complex technical concepts and exam blueprints.',
      features: [
        {
          title: 'Live Interactive Masterclasses',
          description: 'High-definition sessions covering ventilation, noise dB, industrial hygiene, and risk management.',
          icon: 'Video',
        },
        {
          title: 'Authoritative Question Banks',
          description: 'Over 2,500 psychometrically calibrated questions aligned with BCSP & BCRSP blueprints.',
          icon: 'CheckCircle2',
        },
        {
          title: 'Diagnostic Performance Analytics',
          description: 'Pinpoint weak sub-domains and track question-by-question response accuracy in real time.',
          icon: 'BarChart3',
        },
      ],
    },
    defaultStyles: {
      padding: '2rem 0',
    },
    defaultResponsiveStyles: {},
  },

  stats_counter: {
    type: 'stats_counter',
    name: 'Key Metrics & Stats',
    category: 'presentation',
    description: 'Key performance statistics in frosted glass cards',
    iconName: 'Award',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      stats: [
        { value: '98.4%', label: 'First-Time Pass Rate' },
        { value: '1,250+', label: 'HSE Professionals Mentored' },
        { value: '12+ Nations', label: 'Global Alumni Network' },
      ],
    },
    defaultStyles: {
      padding: '1.5rem 0',
    },
    defaultResponsiveStyles: {},
  },

  testimonial_grid: {
    type: 'testimonial_grid',
    name: 'Student Testimonials',
    category: 'presentation',
    description: 'Student success testimonials with real credentials',
    iconName: 'Users',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      testimonials: [
        {
          name: 'Arun Kumar',
          role: 'HSE Manager, Qatar Petroleum',
          credential: 'CSP Certified',
          quote: 'Vishnu sir’s formula sheet and calculation workshops broke down the toughest equations into simple logic.',
        },
        {
          name: 'Sneha Mohan',
          role: 'Safety Officer, Saudi Aramco',
          credential: 'ASP Certified',
          quote: 'The simulated exam environment prepared me mentally for the actual 5-hour test fatigue.',
        },
      ],
    },
    defaultStyles: {
      padding: '2rem 0',
    },
    defaultResponsiveStyles: {},
  },

  // --------------------------------------------------------------------------
  // ACADEMIC DYNAMIC BINDINGS (Authoritative Database Projections)
  // --------------------------------------------------------------------------
  course_cards: {
    type: 'course_cards',
    name: 'Dynamic Course Grid',
    category: 'academic',
    description: 'Dynamic grid populated directly from authoritative Courses database',
    iconName: 'BookOpen',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      filterCertification: 'ALL',
      limit: 6,
    },
    defaultStyles: {
      padding: '1.5rem 0',
    },
    defaultResponsiveStyles: {},
  },

  course_hero: {
    type: 'course_hero',
    name: 'Course Detail Hero',
    category: 'academic',
    description: 'Hero presentation for a single course linked dynamically to course records',
    iconName: 'GraduationCap',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      courseSlug: 'asp-examination-preparation',
    },
    defaultStyles: {
      padding: '2rem 0',
    },
    defaultResponsiveStyles: {},
  },

  curriculum_accordion: {
    type: 'curriculum_accordion',
    name: 'Curriculum & Modules',
    category: 'academic',
    description: 'Dynamic syllabus showing course modules, topics, and lesson hours',
    iconName: 'ListOrdered',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      courseSlug: 'asp-examination-preparation',
    },
    defaultStyles: {
      padding: '1.5rem 0',
    },
    defaultResponsiveStyles: {},
  },

  batch_selector: {
    type: 'batch_selector',
    name: 'Upcoming Batches & Enrollment',
    category: 'academic',
    description: 'Real-time schedule and seat capacity display for a specific course',
    iconName: 'Calendar',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      courseSlug: 'asp-examination-preparation',
    },
    defaultStyles: {
      padding: '1.5rem 0',
    },
    defaultResponsiveStyles: {},
  },

  instructor_card: {
    type: 'instructor_card',
    name: 'Lead Instructor Profile',
    category: 'academic',
    description: 'Dynamic instructor profile card with verified credentials and bio',
    iconName: 'UserCheck',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      instructorName: 'Vishnu Rajendran',
      designation: 'Principal HSE Mentor & Lead Consultant',
      credentials: 'CSP, ASP, CRSP, NEBOSH IDip',
      bio: 'Over 12 years of global safety engineering and HSE exam coaching experience, having mentored 1,200+ safety officers across the globe.',
    },
    defaultStyles: {
      padding: '1.5rem',
      backgroundColor: '#f8fafc',
      borderRadius: '0.75rem',
      border: '1px solid #e2e8f0',
    },
    defaultResponsiveStyles: {},
  },

  // --------------------------------------------------------------------------
  // INTERACTIVE BLOCKS (wj-page-builder interactive references)
  // --------------------------------------------------------------------------
  tabs: {
    type: 'tabs',
    name: 'Interactive Tabs',
    category: 'interactive',
    description: 'Accessible tab group with auto-generated unique IDs and active state management',
    iconName: 'FolderKanban',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      activeTab: 0,
      tabs: [
        {
          id: 'tab-overview',
          title: 'Overview',
          content: 'Detailed course overview and curriculum structure designed to help candidates prepare efficiently.',
        },
        {
          id: 'tab-eligibility',
          title: 'Eligibility Criteria',
          content: 'BCSP requires an associate or bachelor degree in safety or an accredited STEM qualification plus 1 year safety experience.',
        },
        {
          id: 'tab-schedule',
          title: 'Session Schedule',
          content: 'Live online classes held on weekend evenings (Saturdays & Sundays 7:00 PM - 9:30 PM IST).',
        },
      ],
    },
    defaultStyles: {
      padding: '1.5rem 0',
    },
    defaultResponsiveStyles: {},
  },

  accordion: {
    type: 'accordion',
    name: 'Accordion / FAQ',
    category: 'interactive',
    description: 'Collapsible accordion with unique trigger and panel IDs and full ARIA support',
    iconName: 'HelpCircle',
    nodeType: 'COMPONENT',
    allowedParents: ['column', 'container'],
    allowedChildren: [],
    isRootAllowed: false,
    isDuplicable: true,
    isDeletable: true,
    defaultProps: {
      items: [
        {
          id: 'acc-item-1',
          title: 'How long do I get access to recorded sessions and formula sheets?',
          content: 'Students receive 12 months of continuous access to all class recordings, calculations, and formula sheets from the date of enrollment.',
        },
        {
          id: 'acc-item-2',
          title: 'Are the mock exams timed according to official BCSP/BCRSP rules?',
          content: 'Yes, our mock exam engine exactly simulates the 5-hour BCSP examination deadline with real-time countdown, domain diagnostics, and anti-cheat protection.',
        },
        {
          id: 'acc-item-3',
          title: 'What happens if I miss a live classroom session?',
          content: 'All live WebRTC classes are recorded with attendance tracking and published automatically to your student portal within 2 hours of session conclusion.',
        },
      ],
    },
    defaultStyles: {
      padding: '1.5rem 0',
    },
    defaultResponsiveStyles: {},
  },
};

/**
 * Validates whether childType is allowed to be inserted into parentType
 */
export function isValidChild(parentType: string | null | undefined, childType: string): boolean {
  const childDef = COMPONENT_REGISTRY[childType];
  if (!childDef) return false;

  // Root level check
  if (!parentType) {
    return childDef.isRootAllowed;
  }

  const parentDef = COMPONENT_REGISTRY[parentType];
  if (!parentDef) return false;

  return parentDef.allowedChildren.includes(childType);
}

/**
 * Validates whether childType can have parentType as its parent
 */
export function isValidParent(parentType: string | null | undefined, childType: string): boolean {
  return isValidChild(parentType, childType);
}

