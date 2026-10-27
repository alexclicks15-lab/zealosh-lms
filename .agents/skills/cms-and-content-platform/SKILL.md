---
name: cms-and-content-platform
description: >-
  Headless CMS architecture, content modeling, page builder schemas, media asset pipelines, draft/publish lifecycles, and ISR revalidation.
  Use this skill when designing content schemas, building modular page builders, integrating headless CMS platforms (Sanity, Strapi, Contentful, Payload),
  implementing live preview modes, or configuring on-demand cache revalidation.
---

# Headless CMS & Content Platform Architecture Runbook

This skill provides architectural patterns, content modeling guidelines, preview workflows, and cache revalidation strategies for modern headless CMS implementations.

---

## 1. Headless CMS Architectural Paradigm

```
┌────────────────────────────────────────────────────────┐
│                   HEADLESS CMS BACKEND                 │
│  (Content Schemas, Media Assets, Draft/Publish State,  │
│   Editorial Workflows, Role-Based Access Control)      │
└───────────────────────────┬────────────────────────────┘
                            │ Webhooks / GraphQL / REST API
┌───────────────────────────▼────────────────────────────┐
│                  FRONTEND RENDERING ENGINE             │
│  (Next.js App Router, React Server Components, ISR,    │
│   Draft Mode Live Preview, Dynamic Page Assembler)     │
└────────────────────────────────────────────────────────┘
```

---

## 2. Modular Content Modeling (Page Builder Pattern)

Avoid rigid, monolithic page schemas. Adopt a **Block-Based Modular Content Architecture** where pages are composed of dynamic slices/blocks:

```typescript
// types/cms.ts
export type PageSection = 
  | HeroSection
  | FeatureGridSection
  | TestimonialCarouselSection
  | CallToActionSection
  | FAQAccordionSection
  | RichTextBlockSection;

export interface PageDocument {
  id: string;
  slug: string;
  title: string;
  metaDescription?: string;
  ogImage?: string;
  sections: PageSection[];
  publishedAt?: string;
  status: 'draft' | 'published' | 'archived';
}
```

### Dynamic Section Dispatcher (React Component Assembler):
```tsx
// components/cms/SectionRenderer.tsx
import { Hero } from './sections/Hero';
import { FeatureGrid } from './sections/FeatureGrid';
import { TestimonialCarousel } from './sections/TestimonialCarousel';
import { CallToAction } from './sections/CallToAction';
import { FAQAccordion } from './sections/FAQAccordion';
import { PageSection } from '@/types/cms';

const SECTION_MAP: Record<string, React.FC<any>> = {
  hero: Hero,
  feature_grid: FeatureGrid,
  testimonial_carousel: TestimonialCarousel,
  call_to_action: CallToAction,
  faq_accordion: FAQAccordion,
};

export function SectionRenderer({ sections }: { sections: PageSection[] }) {
  return (
    <>
      {sections.map((section, index) => {
        const Component = SECTION_MAP[section._type];
        if (!Component) {
          console.warn(`Unrecognized CMS block type: ${section._type}`);
          return null;
        }
        return <Component key={section._key || index} data={section} />;
      })}
    </>
  );
}
```

---

## 3. Media Asset Pipeline & Responsive Deliveries

1. **Focal Point Cropping**: Store hot-spot/focal coordinates `(x, y)` so images crop cleanly across desktop (16:9), tablet (4:3), and mobile portrait (9:16).
2. **Modern Format Negotiation**: Serve WebP and AVIF automatically based on browser `Accept` header.
3. **Accessibility**: Enforce non-empty `alt` text on all image assets before permitting publish.
4. **Dimensions & Placeholders**: Always store intrinsic `width`, `height`, and `blurhash` / `lqip` base64 string to eliminate Cumulative Layout Shift (CLS).

---

## 4. Live Visual Preview & Draft Mode (Next.js)

Enable real-time editorial preview before publishing:

```typescript
// app/api/draft/route.ts
import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  const slug = searchParams.get('slug') || '/';

  if (secret !== process.env.CMS_PREVIEW_SECRET) {
    return new Response('Invalid preview token', { status: 401 });
  }

  // Enable Draft Mode in Next.js cookies
  draftMode().enable();

  redirect(slug);
}
```

---

## 5. On-Demand Incremental Static Regeneration (ISR) via Webhooks

Configure CMS webhooks to trigger instantaneous cache invalidation upon content publish/update:

```typescript
// app/api/revalidate/route.ts
import { revalidatePath, revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-cms-signature');

  // Verify HMAC Webhook signature
  const expectedSignature = crypto
    .createHmac('sha256', process.env.CMS_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (signature !== expectedSignature) {
    return NextResponse.json({ message: 'Invalid signature' }, { status: 401 });
  }

  const payload = JSON.parse(rawBody);
  const { tag, slug } = payload;

  if (tag) {
    revalidateTag(tag);
  }
  if (slug) {
    revalidatePath(slug);
  }

  return NextResponse.json({ revalidated: true, now: Date.now() });
}
```

---

## 6. Headless CMS Quality Checklist

- [ ] All page templates consume modular, reusable block schemas.
- [ ] Draft Mode authenticated securely via HMAC preview secret.
- [ ] On-demand ISR revalidation configured with webhook cryptographic signature check.
- [ ] Structured meta tags (`title`, `description`, `canonical`, `og:image`) populated dynamically from CMS fields.
- [ ] Image assets include responsive `srcset`, intrinsic dimensions, and descriptive alt text.
