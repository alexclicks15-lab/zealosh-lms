// Zealosh LMS — SEO & Structured Data Engine
// Implements Next.js Metadata, OpenGraph, and Schema.org Course/Breadcrumb JSON-LD

import { Metadata } from 'next';
import { CmsPage } from '@/types/cms';
import { ResolvedCourseData } from './dynamic-bindings';

export const ZEALOSH_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.zealosh.com';

/**
 * Builds standard Next.js Metadata from a CMS Page record
 */
export function buildNextMetadata(page: CmsPage): Metadata {
  const meta = page.seoMetadata || {};
  const pageTitle = meta.title || `${page.title} — Zealosh HSE Training & Consultants`;
  const description =
    meta.description ||
    'India’s Premier HSE Professional Academy. Accredited preparation for ASP, CSP, CRSP, and CIT certification examinations.';
  const canonicalUrl = meta.canonicalUrl || `${ZEALOSH_BASE_URL}/${page.slug === 'home' ? '' : page.slug}`;
  const ogImage = meta.ogImage || `${ZEALOSH_BASE_URL}/logo.png`;

  return {
    title: pageTitle,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonicalUrl,
      siteName: 'Zealosh Training & Consultants',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: pageTitle,
        },
      ],
      type: 'website',
    },
    robots: {
      index: !meta.noIndex && page.status === 'PUBLISHED',
      follow: !meta.noIndex && page.status === 'PUBLISHED',
      googleBot: {
        index: !meta.noIndex && page.status === 'PUBLISHED',
        follow: !meta.noIndex && page.status === 'PUBLISHED',
      },
    },
  };
}

/**
 * Generates Schema.org Course structured data JSON-LD for course landing pages
 */
export function buildCourseJsonLd(course: ResolvedCourseData) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    name: course.title,
    description: course.description || course.headline,
    provider: {
      '@type': 'Organization',
      name: 'Zealosh Training & Consultants',
      sameAs: ZEALOSH_BASE_URL,
    },
    instructor: {
      '@type': 'Person',
      name: course.leadInstructorName || 'Vishnu Rajendran',
      jobTitle: 'Principal HSE Mentor',
    },
    offers: {
      '@type': 'Offer',
      price: course.priceInr.toString(),
      priceCurrency: 'INR',
      availability: 'https://schema.org/InStock',
      url: `${ZEALOSH_BASE_URL}/courses/${course.slug}`,
    },
    hasCourseInstance: (course.batches || []).map((b) => ({
      '@type': 'CourseInstance',
      name: b.name,
      startDate: b.startDate,
      endDate: b.endDate,
      courseMode: 'online',
    })),
  };
}

/**
 * Generates Schema.org BreadcrumbList structured data
 */
export function buildBreadcrumbJsonLd(items: Array<{ name: string; url: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url.startsWith('http') ? item.url : `${ZEALOSH_BASE_URL}${item.url}`,
    })),
  };
}

