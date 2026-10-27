---
name: clean-code-and-refactoring
description: >-
  Code quality, refactoring patterns, maintainability, and clean architecture guidelines.
  Use this skill when refactoring legacy code, eliminating technical debt, enforcing SOLID principles,
  or standardizing TypeScript/JavaScript codebases.
---

# Clean Code & Refactoring Runbook

This skill defines industry best practices for writing clean, readable, self-documenting, and maintainable TypeScript/JavaScript code, and safely executing refactoring without behavioral regressions.

---

## 1. Core Principles of Clean Code

### Single Responsibility (SRP)
- Every function, component, or module should do **one thing well**.
- If a function exceeds 30-40 lines or handles both data fetching and UI formatting, extract sub-functions or custom hooks.

### Explicit Over Implicit
- Avoid cryptic variable names (`const d = ...`). Use descriptive domain terms (`const deliveryWindowStart = ...`).
- Use strict TypeScript types instead of `any` or loose `unknown` casts.

### Immutability & Pure Functions
- Prefer pure functions without side effects for data transformation.
- Use immutable data patterns (`map`, `filter`, spread operators) rather than mutating input arrays or objects.

### Fail Fast & Guard Clauses
- Return early on invalid inputs or unauthorized states. Avoid deep nesting (`if/else` ladders).

```typescript
// PREFERRED: Guard clauses
function calculateOrderDiscount(order: Order, coupon?: Coupon): number {
  if (!coupon || !coupon.isActive) return 0;
  if (order.subtotal < coupon.minOrderValue) return 0;
  
  return coupon.type === 'percentage' 
    ? (order.subtotal * coupon.value) / 100 
    : coupon.value;
}
```

---

## 2. Refactoring Protocol (Zero Regression)

1. **Establish Baseline**: Ensure automated unit/integration/E2E tests pass before touching code.
2. **Small Atomic Commits**: Make one structural change at a time (e.g., extract method -> rename symbols -> change signature).
3. **Keep Tests Green**: Run tests after each incremental change.
4. **Eliminate Dead Code**: Remove unused functions, obsolete parameters, commented-out code, and unused imports.
5. **Lint & Typecheck**: Verify `tsc --noEmit` and `npm run lint` execute cleanly with zero errors.

---

## 3. Key Refactoring Patterns

- **Extract Custom Hook**: Move stateful logic and side effects out of React UI components into specialized hooks (`useOrderTracking`, `useCartSummary`).
- **Replace Conditional with Strategy/Map**: Replace sprawling `switch/case` statements with typed strategy maps.
- **Introduce Parameter Object**: If a function takes more than 3 arguments, bundle them into a typed configuration or options interface.
- **Encapsulate Collections**: Hide direct manipulation of internal arrays/maps behind meaningful domain methods (e.g., `cart.addItem()`, `cart.clearExpiredItems()`).
