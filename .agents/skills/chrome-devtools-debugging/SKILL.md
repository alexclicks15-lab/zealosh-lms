---
name: chrome-devtools-debugging
description: >-
  Chrome DevTools deep inspection, runtime debugging, network analysis, performance profiling, and memory leak analysis.
  Use this skill when investigating browser console errors, profiling web performance bottlenecks, analyzing network requests/HAR,
  detecting memory leaks, inspecting application storage, or conducting Lighthouse audits.
---

# Chrome DevTools & Browser Runtime Debugging Runbook

This skill provides comprehensive workflows, diagnostic commands, and investigative procedures across the Google Chrome DevTools suite for diagnosing frontend, backend-integration, memory, and performance issues.

---

## 1. Console Panel & Runtime Exception Analysis

### A. High-Signal Logging & Grouping
```javascript
// Grouped context logging
console.groupCollapsed('🔄 Checkout Flow: Cart Validation');
console.log('Cart Items:', items);
console.table(items, ['id', 'title', 'price', 'quantity']);
console.time('Validation Duration');
// run validation logic...
console.timeEnd('Validation Duration');
console.groupEnd();
```

### B. Live Debugging & Trace Points
- **`console.trace()`**: Print stack trace without triggering an error.
- **Conditional Breakpoints**: Set breakpoint in Sources panel with expression: `quantity < 0 || price === undefined`.
- **Logpoints**: Log variable values to console without modifying source files or pausing execution: `x` $\to$ `console.log('Current state:', state)`.
- **DOM Breakpoints**: Right-click element $\to$ *Break on* $\to$ *Subtree modifications*, *Attribute modifications*, or *Node removal*.

---

## 2. Network Panel & Request Analysis

### A. Request Waterfall & Timing Breakdown
- **Queueing / Stalled**: High wait times indicate connection limits (HTTP/1.1 limits to 6 TCP connections per domain) or proxy latency.
- **DNS Lookup / Initial Connection / SSL**: Identify DNS resolution delays or SSL handshake overhead.
- **TTFB (Time to First Byte)**: Time waiting for the server to process request and begin streaming response. If TTFB > 200ms, profile backend/database queries.
- **Content Download**: Duration to transfer payload. If slow, check payload size, compression (Gzip/Brotli), and CDN edge caching.

### B. Network Throttling & Offline Simulation
- Use **Throttling Presets** (*Fast 3G*, *Slow 3G*, *Offline*) to test:
  - Skeleton loading states and progressive hydration.
  - Offline fallback behavior and retry buttons.
  - Optimistic UI updates under high latency.

### C. Payload & Header Inspection
- Filter requests by type: `Fetch/XHR`, `Doc`, `CSS`, `JS`, `Img`, `Media`, `WS` (WebSocket).
- Inspect `Request Headers`: `Authorization`, `Cookie`, `Content-Type`, `Idempotency-Key`, `Origin`.
- Inspect `Response Headers`: `Cache-Control`, `Set-Cookie`, `Access-Control-Allow-Origin` (CORS), `Content-Security-Policy`.

---

## 3. Performance Panel & Flamegraph Profiling

### A. Recording a Performance Trace
1. Open DevTools $\to$ **Performance** tab.
2. Check **Screenshots** and set CPU Throttling to **4x or 6x slowdown** (to simulate average mobile hardware).
3. Click **Record** (or Cmd+E / Ctrl+E) $\to$ Perform user interaction $\to$ Stop recording.

### B. Analyzing Core Bottlenecks
- **Long Tasks (Red flagged > 50ms)**: Identify JavaScript execution that blocks the main thread, causing UI freezes and poor INP (Interaction to Next Paint).
- **Flamegraph Navigation**:
  - Top-down: What root function triggered the execution?
  - Bottom-up: Which leaf functions consumed the most self-time?
- **Layout Thrashing (Forced Synchronous Layout)**:
  - Occurs when JavaScript reads layout properties (`offsetWidth`, `clientHeight`, `getBoundingClientRect`) immediately after modifying DOM styles in the same frame.
  - *Fix*: Batch all DOM reads together before performing DOM writes.

---

## 4. Memory Panel & Memory Leak Detection

### A. Three-Snapshot Technique for Detached DOM Leaks
1. Open **Memory** tab $\to$ Select **Heap snapshot** $\to$ Take Snapshot 1 (Baseline).
2. Perform the user action (e.g., open and close a modal, navigate to a page and back).
3. Take Snapshot 2 $\to$ Repeat action $\to$ Take Snapshot 3.
4. Filter Snapshot 3 by **Objects allocated between Snapshot 1 and 2**.
5. Search for `Detached HTMLDivElement` or `Detached DOM tree`:
   - Inspect the **Retainers** tree at the bottom to find the closure, global event listener, or singleton holding the reference.

### B. Common Memory Leak Sources in Modern Frontends
- Uncleaned event listeners (`window.addEventListener` without `removeEventListener` in `useEffect`).
- Uncanceled timers (`setInterval` without `clearInterval`).
- Retained references in global caches or event emitters.
- Closures capturing large outer scopes unintentionally.

---

## 5. Application Panel & Client Storage

- **Storage Breakdown**: Inspect quota usage across LocalStorage, SessionStorage, IndexedDB, Cache Storage, and Web SQL.
- **Cookies**: Verify attributes for session security: `Secure` (true over HTTPS), `HttpOnly` (inaccessible to JS), `SameSite` (`Lax` or `Strict`).
- **Service Workers**: Test registration, update lifecycles, push notifications, and background sync.
- **Clear Site Data**: One-click reset for local development cache, cookies, and indexed databases.

---

## 6. Lighthouse Audit & Optimization Workflow

1. Run Lighthouse in **Mobile** and **Desktop** modes with simulated throttling.
2. Focus on Core Web Vitals thresholds:
   - **LCP (Largest Contentful Paint)**: $\le 2.5\text{s}$
   - **INP (Interaction to Next Paint)**: $\le 200\text{ms}$
   - **CLS (Cumulative Layout Shift)**: $\le 0.1$
3. Address specific Lighthouse diagnostics:
   - Eliminate render-blocking resources.
   - Defer non-critical CSS/JS.
   - Properly size images and provide explicit `width` & `height` attributes.
   - Serve static assets with efficient cache policies.
