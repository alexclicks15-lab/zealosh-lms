---
name: performance-engineering
description: >-
  Full-stack performance optimization, Core Web Vitals, bundle analysis, database tuning, and caching.
  Use this skill when optimizing frontend bundle size, profiling slow API endpoints, reducing database query latency,
  implementing multi-tier caching (memory/Redis/CDN), or resolving memory leaks.
---

# Full-Stack Performance Engineering Runbook

This skill outlines profiling techniques, optimization patterns, and architectural rules for high-throughput, low-latency web applications.

---

## 1. Frontend Performance & Bundle Optimization

### Bundle Analysis & Code Splitting
- Run `@next/bundle-analyzer` to detect oversized dependencies.
- Use `React.lazy()` or Next.js `dynamic()` for heavy widgets (e.g., chart libraries, rich text editors, 3D viewers).
- Replace bloated libraries with lightweight alternatives (e.g., `date-fns` instead of `moment.js`, native `fetch` over `axios`).

### Asset & Image Optimization
- Use `next/image` with WebP/AVIF formats, responsive `sizes` attribute, and proper aspect ratios.
- Avoid layout thrashing: reserve space for images and dynamic blocks to achieve `CLS = 0`.

---

## 2. Backend & API Latency Optimization

### Caching Tiers
1. **Edge / CDN Caching**: Cache public static assets and cacheable GET responses with `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400`.
2. **In-Memory / Redis Caching**: Cache read-heavy entity lookups (e.g., product catalog, store hours, city delivery zones) with TTL.
3. **Database Cache**: Utilize PostgreSQL query caching and prepared statements.

### Caching Safety Rule:
- **NEVER** cache volatile transactional data (live inventory levels, real-time pricing, cart items, payment statuses, active order coordinates).

---

## 3. Database Query Tuning

1. **N+1 Query Elimination**: Use joined queries or batch fetching (e.g., DataLoader pattern) instead of looping queries inside application code.
2. **Explain Analyze**: Profile slow queries using `EXPLAIN (ANALYZE, BUFFERS)` to identify full table scans and unindexed foreign keys.
3. **Pagination Limit**: Restrict max query limits (`LIMIT 50` or `LIMIT 100`) to prevent runaway memory consumption.
4. **Connection Pooling**: Use PgBouncer or Supabase connection pooling in transaction mode for serverless environments.

---

## 4. Performance Audit Metrics

| Metric | Target | Warning Threshold | Tool |
| :--- | :--- | :--- | :--- |
| **LCP (Largest Contentful Paint)** | < 2.5s | > 4.0s | Lighthouse / Web Vitals |
| **INP (Interaction to Next Paint)** | < 200ms | > 500ms | Chrome DevTools |
| **CLS (Cumulative Layout Shift)** | < 0.1 | > 0.25 | Lighthouse |
| **API Response Time (p95)** | < 250ms | > 800ms | Server Profiler / APM |
| **Database Query Latency (p95)**| < 50ms | > 200ms | pg_stat_statements |
