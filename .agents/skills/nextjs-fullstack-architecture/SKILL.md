---
name: nextjs-fullstack-architecture
description: >-
  Next.js 14+ App Router, React Server Components (RSC), Server Actions, and SSR architecture.
  Use this skill when building modern full-stack web applications with Next.js, optimizing
  server/client component boundaries, route handlers, middleware, and caching layers.
---

# Next.js Full-Stack Architecture Runbook

This skill provides comprehensive architectural guidelines and patterns for building scalable, high-performance applications with Next.js App Router.

---

## 1. Server vs. Client Component Boundaries

Follow the principle: **Server Components by default; Client Components only at the leaf nodes.**

```
[ Layout (Server Component) ]
  ├── [ Page (Server Component) ] ── Fetches data directly via ORM/Fetch
  │     ├── [ Server Child View ] ── Pure HTML + Streaming SSR
  │     └── [ Interactive Widget ('use client') ] ── Handles onClick, useState, animations
```

### When to use Server Components:
- Direct database or ORM access.
- Keeping sensitive API keys, secrets, or heavy libraries off the client bundle.
- Streaming rendering with `<Suspense>` fallbacks.

### When to use `'use client'`:
- Interactive UI elements (buttons with `onClick`, forms with live validation).
- React hooks (`useState`, `useEffect`, `useReducer`, custom hooks).
- Browser APIs (`window`, `localStorage`, `IntersectionObserver`).

---

## 2. Server Actions & Mutations

Use Server Actions for form submissions and mutations with optimistic updates:

```typescript
// app/actions/cart.ts
'use server'

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const AddToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export async function addToCartAction(formData: FormData) {
  const parsed = AddToCartSchema.safeParse({
    productId: formData.get('productId'),
    quantity: Number(formData.get('quantity')),
  });

  if (!parsed.success) {
    return { error: 'Invalid cart payload', details: parsed.error.flatten() };
  }

  // Perform database mutation
  await db.cart.addItem(parsed.data);

  revalidatePath('/cart');
  return { success: true };
}
```

---

## 3. Route Handlers & Middleware

### Middleware (`middleware.ts`)
- Use for edge auth token validation, session verification, geo-routing, and security headers.
- Keep middleware lightweight; avoid heavy database queries inside middleware.

### Route Handlers (`app/api/.../route.ts`)
- Use `NextRequest` and `NextResponse`.
- Always validate input schemas using Zod.
- Standardize JSON error formats (`{ error: string, code: string, status: number }`).

---

## 4. Next.js Caching & Revalidation Strategy

- **Static Data**: `fetch(url, { next: { revalidate: 3600 } })` for ISR.
- **Dynamic Real-Time Data**: `fetch(url, { cache: 'no-store' })` or `export const dynamic = 'force-dynamic'` for inventory, pricing, cart, and authentication.
- **On-Demand Revalidation**: `revalidatePath('/dashboard')` or `revalidateTag('products')` after mutations.
