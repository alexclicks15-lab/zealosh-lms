---
name: seo-and-web-vitals
description: >-
  Technical SEO, OpenGraph metadata, JSON-LD structured data, Core Web Vitals, and PWA optimization.
  Use this skill when optimizing pages for search engine ranking, social sharing cards,
  fast Core Web Vitals (LCP, INP, CLS), dynamic sitemaps, and robots.txt.
---

# Technical SEO & Core Web Vitals Runbook

This skill outlines best practices for search engine optimization, structured schema markup, and web performance metrics.

---

## 1. Next.js Dynamic Metadata & OpenGraph

Leverage the Next.js App Router Metadata API for dynamic pages:

```typescript
// app/products/[slug]/page.tsx
import { Metadata } from 'next';

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const product = await getProductBySlug(params.slug);
  if (!product) return { title: 'Product Not Found | CakeToHome' };

  return {
    title: `${product.title} | Artisanal Bakery | CakeToHome`,
    description: product.summary,
    alternates: {
      canonical: `https://caketohome.com/products/${product.slug}`,
    },
    openGraph: {
      title: product.title,
      description: product.summary,
      url: `https://caketohome.com/products/${product.slug}`,
      siteName: 'CakeToHome',
      images: [
        {
          url: product.imageUrl,
          width: 1200,
          height: 630,
          alt: product.title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: product.title,
      description: product.summary,
      images: [product.imageUrl],
    },
  };
}
```

---

## 2. JSON-LD Structured Data

Embed schema.org microdata for Rich Snippets (Product, Breadcrumbs, LocalBusiness):

```tsx
export function ProductJsonLd({ product }: { product: Product }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: product.imageUrl,
    description: product.description,
    sku: product.sku,
    offers: {
      '@type': 'Offer',
      price: (product.priceInCents / 100).toFixed(2),
      priceCurrency: 'USD',
      availability: product.inStock
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `https://caketohome.com/products/${product.slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---

## 3. Core Web Vitals Optimization Checklist

1. **Largest Contentful Paint (LCP < 2.5s)**:
   - Use Next.js `<Image priority sizes="..." />` on hero/product images.
   - Preload critical web fonts using `next/font/google`.
   - Avoid client-side blocking waterfalls before rendering hero content.

2. **Interaction to Next Paint (INP < 200ms)**:
   - Break up heavy JavaScript tasks using `scheduler.yield()` or `requestIdleCallback`.
   - Use React transitions (`useTransition`) for non-urgent state updates.

3. **Cumulative Layout Shift (CLS < 0.1)**:
   - Always define explicit `width` and `height` (or aspect ratio) on images, banners, and video embeds.
   - Reserve space for dynamic elements and banners using skeleton placeholders.
