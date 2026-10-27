---
name: analytics-and-cro
description: >-
  Product analytics, conversion rate optimization (CRO), funnel analysis, event taxonomy design, and A/B experimentation.
  Use this skill when implementing analytics tracking (GA4, PostHog, Plausible), analyzing conversion drop-offs,
  designing event schemas, instrumenting Core Web Vitals RUM, or configuring A/B testing splits.
---

# Product Analytics & Conversion Rate Optimization (CRO) Runbook

This skill establishes event tracking taxonomies, multi-step funnel telemetry, conversion rate optimization frameworks, and privacy-compliant experimentation architectures.

---

## 1. Standard Event Taxonomy (Object-Action Standard)

Enforce strict naming conventions across all tracking layers: `[noun]_[past_tense_verb]`.

```
E-Commerce & User Journey Core Events:
├── page_viewed
├── account_registered
├── search_performed
├── product_viewed
├── product_added_to_cart
├── cart_viewed
├── checkout_initiated
├── shipping_method_selected
├── payment_info_submitted
└── order_completed
```

### Standard Property Payload Schema:
```typescript
// analytics/types.ts
export interface BaseEventProperties {
  timestamp: string;
  path: string;
  referrer?: string;
  userId?: string;
  anonymousId: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export interface ProductAddedToCartPayload extends BaseEventProperties {
  productId: string;
  productName: string;
  category: string;
  price: number;
  currency: string;
  quantity: number;
  cartTotalValue: number;
}
```

---

## 2. Type-Safe Client Analytics Dispatcher

```typescript
// analytics/tracker.ts
export class AnalyticsTracker {
  private static instance: AnalyticsTracker;

  public static getInstance(): AnalyticsTracker {
    if (!AnalyticsTracker.instance) {
      AnalyticsTracker.instance = new AnalyticsTracker();
    }
    return AnalyticsTracker.instance;
  }

  public track<T extends Record<string, any>>(eventName: string, properties: T): void {
    if (typeof window === 'undefined') return;

    // Dispatch to PostHog / GA4 / Plausible
    if (window.gtag) {
      window.gtag('event', eventName, properties);
    }
    if (window.posthog) {
      window.posthog.capture(eventName, properties);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 [Analytics] ${eventName}:`, properties);
    }
  }
}

export const analytics = AnalyticsTracker.getInstance();
```

---

## 3. Checkout Funnel Telemetry & Drop-Off Analysis

Measure conversion rate and friction at every milestone of the purchase funnel:

```
[ Step 1: Cart View ] ────────────── (100% baseline)
       │ Drop-off: High shipping cost or surprise fees
       ▼
[ Step 2: Shipping Details ] ──────── (Target: > 75%)
       │ Drop-off: Complex form fields / address validation errors
       ▼
[ Step 3: Payment Method ] ────────── (Target: > 60%)
       │ Drop-off: Missing preferred payment gateway / 3DS failure
       ▼
[ Step 4: Order Completed ] ───────── (Target: > 45% of Cart)
```

---

## 4. Real User Monitoring (RUM) for Core Web Vitals

Capture real user performance and pipe directly to telemetry backends:

```typescript
// analytics/vitals.ts
import { onCLS, onINP, onLCP } from 'web-vitals';
import { analytics } from './tracker';

function sendToAnalytics(metric: { name: string; value: number; id: string; rating: string }) {
  analytics.track('web_vital_measured', {
    metric_name: metric.name,
    metric_value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
    metric_rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    metric_id: metric.id,
  });
}

export function initWebVitalsTelemetry() {
  onLCP(sendToAnalytics);
  onINP(sendToAnalytics);
  onCLS(sendToAnalytics);
}
```

---

## 5. Edge-Based A/B Experimentation (Next.js Middleware)

Assign variants with zero cumulative layout shift before rendering:

```typescript
// middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_EXPERIMENT = 'exp_checkout_layout';

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  let variant = req.cookies.get(COOKIE_EXPERIMENT)?.value;

  if (!variant) {
    // 50/50 randomized split
    variant = Math.random() < 0.5 ? 'control' : 'single_page_checkout';
    res.cookies.set(COOKIE_EXPERIMENT, variant, { maxAge: 60 * 60 * 24 * 30 }); // 30 days
  }

  // Pass variant as header to server components
  res.headers.set('x-experiment-variant', variant);
  return res;
}
```

---

## 6. Analytics & CRO Quality Checklist

- [ ] All critical business transactions emit structured server-side or client-side telemetry events.
- [ ] No personally identifiable information (PII such as raw credit cards, passwords, un-hashed emails) passed in event properties.
- [ ] Cookie consent banners respect user privacy settings (`consent_mode: denied` when unapproved).
- [ ] Funnels configured with baseline, step conversion rates, and abandonment tracking.
- [ ] Core Web Vitals RUM metrics captured continuously.
