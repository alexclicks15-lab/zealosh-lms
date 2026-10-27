---
name: typescript-development
description: >-
  Advanced TypeScript patterns, strict type-safety, generics, discriminated unions, type narrowing, and runtime validation.
  Use this skill when designing complex TypeScript types, configuring strict tsconfig settings, implementing branded types,
  building type-safe APIs with Zod, or optimizing TypeScript compilation performance.
---

# Advanced TypeScript Engineering Runbook

This skill establishes strict type-safety standards, advanced generic modeling, runtime validation synergy, and performance-minded TypeScript architecture.

---

## 1. Strict Configuration Standard (`tsconfig.json`)

Always enable strict type-checking flags in modern projects:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true
  }
}
```

---

## 2. Advanced Type Patterns

### A. Discriminated Unions & Exhaustiveness Checking
```typescript
type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

// Exhaustiveness assertion helper
function assertNever(x: never): never {
  throw new Error(`Unexpected object: ${JSON.stringify(x)}`);
}

function renderState<T>(state: AsyncState<T>): string {
  switch (state.status) {
    case 'idle':
      return 'Ready';
    case 'loading':
      return 'Loading...';
    case 'success':
      return `Loaded: ${JSON.stringify(state.data)}`;
    case 'error':
      return `Error: ${state.error.message}`;
    default:
      return assertNever(state); // Compile error if a case is missed
  }
}
```

### B. Branded / Nominal Types
Prevent accidental mixing of primitive IDs (e.g., passing a `CustomerId` where an `OrderId` is expected):

```typescript
declare const brand: unique symbol;

export type Brand<T, B> = T & { readonly [brand]: B };

export type CustomerId = Brand<string, 'CustomerId'>;
export type OrderId = Brand<string, 'OrderId'>;

export function makeCustomerId(id: string): CustomerId {
  return id as CustomerId;
}

export function makeOrderId(id: string): OrderId {
  return id as OrderId;
}
```

---

## 3. Type Narrowing & Custom Type Predicates

```typescript
export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Custom type predicate function
export function isApiError(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof (value as Record<string, unknown>)['code'] === 'string' &&
    'message' in value &&
    typeof (value as Record<string, unknown>)['message'] === 'string'
  );
}
```

---

## 4. Runtime Validation & Type Inference Synergy (Zod)

Infer static TypeScript types directly from runtime schemas to ensure zero type-schema drift:

```typescript
import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'guest']),
  metadata: z.record(z.unknown()).optional(),
  createdAt: z.coerce.date(),
});

// Single source of truth for the type
export type User = z.infer<typeof UserSchema>;
export type UserInput = z.input<typeof UserSchema>;
```

---

## 5. Result Pattern for Error Handling (Zero Unhandled Exceptions)

```typescript
export type Result<T, E = Error> =
  | { success: true; value: T }
  | { success: false; error: E };

export function Ok<T>(value: T): Result<T, never> {
  return { success: true, value };
}

export function Err<E>(error: E): Result<never, E> {
  return { success: false, error };
}

// Usage without throwing exceptions
export async function safeFetchJson<T>(url: string): Promise<Result<T, Error>> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return Err(new Error(`HTTP ${res.status}: ${res.statusText}`));
    }
    const data = (await res.json()) as T;
    return Ok(data);
  } catch (err) {
    return Err(err instanceof Error ? err : new Error(String(err)));
  }
}
```

---

## 6. TypeScript Quality Checklist

- [ ] `tsc --noEmit` completes with zero diagnostics or errors.
- [ ] No explicit `any` types used (use `unknown` and narrow safely).
- [ ] All union switches contain exhaustive check assertions (`assertNever`).
- [ ] Runtime boundary data (API inputs, form submissions, webhooks) validated with Zod.
