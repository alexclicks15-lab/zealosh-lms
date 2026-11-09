// Zealosh LMS — Public Dynamic CMS Page Renderer
// Route: /p/[...slug] — Server-side rendered with Next.js Metadata, Structured Data JSON-LD & Fallbacks

import React from 'react';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
import { db } from '@/lib/store/db';
import { buildTree } from '@/lib/cms/tree-engine';
import { buildNextMetadata, buildCourseJsonLd, buildBreadcrumbJsonLd } from '@/lib/cms/seo';
import { resolveCourseData } from '@/lib/cms/dynamic-bindings';
import { CmsComponentRenderer } from '@/components/cms/CmsComponentRenderer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface DynamicPageProps {
  params: {
    slug: string[];
  };
}

export async function generateMetadata({ params }: DynamicPageProps): Promise<Metadata> {
  const fullSlug = (params.slug || []).join('/');
  const page = await db.getCmsPageBySlug(fullSlug);
  if (!page || page.status !== 'PUBLISHED' || !page.publishedVersionId) {
    notFound();
  }
  return buildNextMetadata(page);
}

export default async function DynamicCmsPage({ params }: DynamicPageProps) {
  const fullSlug = (params.slug || []).join('/');
  const page = await db.getCmsPageBySlug(fullSlug);

  if (!page || page.status !== 'PUBLISHED' || !page.publishedVersionId) {
    notFound();
  }

  const nodes = await db.getCmsPageNodes(page.publishedVersionId);
  const hierarchicalTree = buildTree(nodes);

  // If this is a course landing page, prepare course structured data
  let courseStructuredData = null;
  if (page.pageType === 'COURSE_LANDING') {
    const course = await resolveCourseData(page.slug);
    if (course) {
      courseStructuredData = buildCourseJsonLd(course);
    }
  }

  const breadcrumbs = [
    { name: 'Home', url: '/' },
    { name: page.title, url: `/p/${page.slug}` },
  ];
  const breadcrumbStructuredData = buildBreadcrumbJsonLd(breadcrumbs);

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Schema.org JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbStructuredData) }}
      />
      {courseStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(courseStructuredData) }}
        />
      )}

      {/* Main Canonical Page Content */}
      <main className="flex-1 w-full">
        {hierarchicalTree.map((secNode) => (
          <CmsComponentRenderer
            key={secNode.id}
            node={secNode}
            isEditorMode={false}
          />
        ))}
      </main>
    </div>
  );
}

