---
name: api-design-and-security
description: >-
  RESTful API design, schema validation, rate limiting, authentication, RBAC, and error handling.
  Use this skill when building backend APIs, route handlers, webhook receivers, authentication flows,
  CORS configurations, or securing public and private endpoints.
---

# API Design & Security Runbook

This skill outlines best practices for designing scalable, resilient, and secure APIs with strict schema validation, predictable error handling, and robust authentication.

---

## 1. RESTful API Design Standards

- **Resource Naming**: Use plural nouns (`/api/v1/orders`, `/api/v1/customers`).
- **HTTP Methods**:
  - `GET`: Idempotent read operations.
  - `POST`: Creation or complex non-idempotent operations.
  - `PUT`: Complete resource replacement (idempotent).
  - `PATCH`: Partial resource update (idempotent).
  - `DELETE`: Resource removal (idempotent).
- **Pagination**: Use cursor-based (`?cursor=xyz&limit=50`) or limit-offset (`?limit=20&offset=0`).
- **Standardized Response Envelope**:

```json
{
  "success": true,
  "data": {
    "id": "ord_123",
    "status": "confirmed",
    "total": 4500
  },
  "meta": {
    "timestamp": "2026-08-14T23:50:00Z"
  }
}
```

---

## 2. Input Validation with Zod

Every API route must validate body, query params, and headers:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
    customMessage: z.string().max(200).optional(),
  })).min(1),
  deliveryDate: z.string().datetime(),
});

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const validated = CreateOrderSchema.parse(json);

    // Business Logic Execution
    const order = await orderService.createOrder(validated);

    return NextResponse.json({ success: true, data: order }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation Failed', issues: error.errors },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

---

## 3. Security Controls & Defensive Hardening

1. **Rate Limiting**: Apply token bucket or sliding window rate limiting (e.g., Upstash / Redis / memory rate limiter) to all public and auth endpoints.
2. **CORS Configuration**: Restrict `Access-Control-Allow-Origin` to authorized domain origins only. Never use wildcard `*` with `credentials: true`.
3. **Security Headers**: Always set `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, and `Content-Security-Policy`.
4. **Idempotency Keys**: For billing or order placement routes, require `Idempotency-Key` header and store results in a 24-hour cache/database table to prevent double-charges.
