---
name: image-and-media-optimization
description: >-
  Image and media optimization, WebP/AVIF encoding, responsive picture/srcset markup, blurhash placeholders, and layout stability.
  Use this skill when optimizing page load speed, resolving Cumulative Layout Shift (CLS), configuring Next.js Image components,
  compressing media assets, or building responsive media pipelines.
---

# Image & Media Performance Optimization Runbook

This skill establishes production techniques for encoding, delivering, and rendering high-fidelity visual media with minimal bandwidth consumption, fast Largest Contentful Paint (LCP), and zero Cumulative Layout Shift (CLS).

---

## 1. Modern Format Selection Matrix

| Format | Best For | Typical Savings vs JPEG/PNG | Browser Support |
| :--- | :--- | :--- | :--- |
| **AVIF** | High-detail photographs, heroes, banners | 50% – 60% smaller | 94%+ modern browsers |
| **WebP** | Broad replacement for JPEG/PNG photos | 25% – 35% smaller | 97%+ all browsers |
| **SVG** | Logos, icons, vector illustrations | Infinite scaling, tiny bytes | 100% |
| **MP4 / WebM** | Animated sequences, background loops | 80% – 90% smaller than GIF | 98%+ |

> **Rule:** Never use `.gif` for animated video clips or UI loops. Use `<video muted autoplay loop playsinline>` with WebM/MP4.

---

## 2. Responsive Image Markup (`<picture>` & `srcset`)

Provide modern format fallbacks and multiple resolution tiers:

```html
<picture>
  <!-- AVIF for supporting browsers -->
  <source 
    type="image/avif" 
    srcset="/images/hero-400.avif 400w, /images/hero-800.avif 800w, /images/hero-1200.avif 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 1200px"
  />
  <!-- WebP fallback -->
  <source 
    type="image/webp" 
    srcset="/images/hero-400.webp 400w, /images/hero-800.webp 800w, /images/hero-1200.webp 1200w"
    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 1200px"
  />
  <!-- Default fallback image -->
  <img 
    src="/images/hero-800.jpg" 
    alt="Product showcase banner" 
    width="1200" 
    height="675" 
    loading="eager"
    fetchpriority="high"
    decoding="async"
    class="w-full h-auto object-cover"
  />
</picture>
```

---

## 3. Eliminating Cumulative Layout Shift (CLS)

1. **Explicit Dimensions**: Always specify `width` and `height` attributes on `<img>` tags. Modern browsers calculate the aspect ratio before image bytes arrive.
2. **CSS Aspect Ratio**:
   ```css
   .media-card {
     aspect-ratio: 16 / 9;
     width: 100%;
     object-fit: cover;
   }
   ```
3. **LQIP / Blurhash Placeholders**: Render a lightweight blurred canvas or base64 data URI while high-resolution media streams in.

---

## 4. Priority Loading Strategies

- **Above the Fold (LCP Candidate)**:
  - `loading="eager"`
  - `fetchpriority="high"`
  - Preload in `<head>`: `<link rel="preload" as="image" href="/images/hero.avif" type="image/avif">`
- **Below the Fold**:
  - `loading="lazy"`
  - `fetchpriority="auto"` or `"low"`
  - `decoding="async"`

---

## 5. Node.js Sharp Optimization Pipeline

```typescript
import sharp from 'sharp';

export async function processImageDerivative(inputBuffer: Buffer, outputDir: string, filename: string) {
  const image = sharp(inputBuffer);
  const metadata = await image.metadata();

  const widths = [400, 800, 1200, 1600];

  for (const width of widths) {
    if (metadata.width && metadata.width >= width) {
      // Generate AVIF
      await image
        .resize(width, null, { withoutEnlargement: true })
        .avif({ quality: 65, effort: 4 })
        .toFile(`${outputDir}/${filename}-${width}.avif`);

      // Generate WebP
      await image
        .resize(width, null, { withoutEnlargement: true })
        .webp({ quality: 75, effort: 4 })
        .toFile(`${outputDir}/${filename}-${width}.webp`);
    }
  }
}
```

---

## 6. Media Optimization Checklist

- [ ] All images have descriptive `alt` tags.
- [ ] No image served without explicit `width` and `height` or `aspect-ratio` container.
- [ ] Above-the-fold hero image configured with `fetchpriority="high"` and no lazy loading.
- [ ] Below-the-fold images lazy-loaded.
- [ ] Animated GIFs replaced with looping HTML5 videos (`<video autoplay loop muted playsinline>`).
- [ ] SVGs stripped of redundant editor metadata via SVGO.
