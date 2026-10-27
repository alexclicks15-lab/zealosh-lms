---
name: zealosh-ui-system
description: Authoritative Design System and UI Component runbook for Zealosh LMS. Use this skill when building or styling web interfaces, forms, exam players, dashboards, live classrooms, or course cards. Enforces Zealosh HSE brand identity, WCAG 2.1 AA accessibility, and strictly forbids leakage of unrelated e-commerce or bakery design elements.
---

# Zealosh LMS — Design System & Visual Identity Runbook

## 1. Brand Philosophy & Identity Isolation

Zealosh Training & Consultants is an enterprise Health, Safety & Environment (HSE) educational and certification consultancy. The visual language must communicate **academic rigor, corporate authority, professional trust, and environmental stewardship**.

> [!CAUTION]
> **Strict Asset & Style Isolation:** Under no circumstances should unrelated consumer e-commerce, bakery, food, or retail styling (e.g., CakeToHome, pastel confection colors, luxury pastry typography) ever be imported, referenced, or applied to Zealosh LMS. Zealosh is an enterprise engineering and compliance platform.

---

## 2. Color Palette & Design Tokens

```css
:root {
  /* Primary Authority: Deep Navy / Slate */
  --zealosh-navy-950: #030712;
  --zealosh-navy-900: #0a192f;
  --zealosh-navy-800: #112240;
  --zealosh-navy-700: #233554;

  /* Accent & Sustainability: HSE Emerald & Forest */
  --zealosh-emerald-600: #059669;
  --zealosh-emerald-500: #10b981;
  --zealosh-emerald-400: #34d399;
  --zealosh-emerald-100: #d1fae5;

  /* Credential Accent: Academic Amber & Gold */
  --zealosh-amber-600: #d97706;
  --zealosh-amber-500: #f59e0b;
  --zealosh-amber-400: #fbbf24;

  /* Surfaces & Neutrals */
  --zealosh-slate-50: #f8fafc;
  --zealosh-slate-100: #f1f5f9;
  --zealosh-slate-200: #e2e8f0;
  --zealosh-slate-400: #94a3b8;
  --zealosh-slate-700: #334155;
  --zealosh-slate-900: #0f172a;

  /* Semantic Alerts */
  --zealosh-error: #ef4444;
  --zealosh-warning: #f59e0b;
  --zealosh-success: #10b981;
  --zealosh-info: #3b82f6;
}
```

---

## 3. Typography Hierarchy

- **Primary Sans Font**: `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`.
- **Heading Display Font**: `Outfit` or `Inter` with semi-bold / bold weight.
- **Monospace Code/Math**: `JetBrains Mono`, `ui-monospace`, `monospace` (for ventilation/chemical formulas, noise dB calculations).

### Typographic Scale
- `display-hero`: 48px / 1.15 line-height / -0.025em tracking (Bold)
- `h1`: 32px / 1.2 line-height / -0.02em tracking (Bold)
- `h2`: 24px / 1.3 line-height / -0.015em tracking (Semi-Bold)
- `h3`: 20px / 1.4 line-height (Medium)
- `body-large`: 18px / 1.6 line-height (Regular)
- `body-base`: 16px / 1.6 line-height (Regular)
- `body-small`: 14px / 1.5 line-height (Regular)
- `label-caps`: 12px / 1.2 line-height / +0.05em tracking (Semi-Bold Uppercase)

---

## 4. Key Component Blueprints

### A. HSE Certification Course Card
- Deep Navy container (`bg-[#0a192f]` or `bg-slate-900/90`) with emerald border accent (`border-emerald-500/20`).
- Badge indicating certification body: `BCSP ASP`, `BCSP CSP`, `BCRSP CRSP`, `NEBOSH IGC`.
- Delivery mode pill: `LIVE VIRTUAL`, `SELF-PACED`, or `HYBRID COHORT`.
- Progress indicator showing percentage complete with emerald fill bar.

### B. Timed Exam Simulator Interface
- Top bar: Fixed countdown clock with amber/red urgency threshold (< 10 minutes turns red).
- Left navigation drawer: Question index palette with visual states:
  - White/Gray: Unanswered
  - Emerald: Answered
  - Amber Bookmark: Flagged for review
  - Blue outline: Current active question
- Center panel: Clear stem, randomized radio button options, formula sheet reference modal.
- Bottom bar: "Previous", "Next", "Flag for Review", and "Submit Exam" buttons.

### C. Live Virtual Classroom Stage
- Dark-mode stage (`bg-slate-950`) optimized for low-latency WebRTC streams.
- Floating whiteboard toolbar: drawing tools, text notes, laser pointer.
- Roster sidebar: attendee status, hand-raising queue, live chat transcript.

---

## 5. Accessibility & Performance Benchmarks

1. **WCAG 2.1 AA Compliance:** Minimum 4.5:1 text-to-background contrast ratio on all primary elements; 3:1 on large text (> 24px).
2. **Keyboard Navigation:** Full tab order navigation across all interactive elements, modals, exam questions, and radio selectors. Focus rings must be clearly visible (`ring-2 ring-emerald-500`).
3. **Responsive Breakpoints:**
   - Desktop: `1280px+` (Multi-column dashboard with sidebars)
   - Tablet: `768px – 1024px` (Collapsible drawers, single-column exam player)
   - Mobile: `375px – 430px` (Touch-friendly 44px+ tap targets, bottom navigation bar)
