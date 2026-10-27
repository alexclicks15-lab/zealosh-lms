---
name: frontend-design-system
description: >-
  Modern UI/UX design systems, component architecture, Tailwind CSS, accessibility, and micro-interactions.
  Use this skill when crafting stunning, responsive web interfaces, dark/light themes, design tokens,
  accessible UI components (WCAG 2.1 AA), and fluid user animations.
---

# Modern Frontend Design System & UI/UX Runbook

This skill establishes visual excellence, responsive design, component hierarchy, and accessibility standards for enterprise web applications.

---

## 1. Visual Hierarchy & Aesthetic Standards

- **Color Palette**: Use curated semantic HSL/OKLCH color tokens (Primary, Secondary, Accent, Neutral, Destructive, Success, Warning). Avoid raw primary colors (`#ff0000`, `#00ff00`).
- **Modern Typography**: Use distinct typographic scales with high readability (e.g., Outfit, Inter, Plus Jakarta Sans) with proper font weights (400, 500, 600, 700).
- **Depth & Surfaces**: Employ subtle elevation, layered glassmorphism (`backdrop-blur-md bg-white/80 dark:bg-zinc-900/80`), smooth borders (`border-border/50`), and soft drop shadows (`shadow-sm`, `shadow-md`, `shadow-xl`).
- **Micro-Animations**: Add subtle transitions (`transition-all duration-200 ease-out`), hover scales (`hover:-translate-y-0.5`), and active press states (`active:scale-95`).

---

## 2. Component Design Tokens & Tailwind Standard

Ensure all components leverage unified design tokens:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --primary: 346 77% 49.8%;
    --primary-foreground: 355 100% 97.3%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --border: 240 5.9% 90%;
    --radius: 0.75rem;
  }
  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --primary: 346 77% 49.8%;
    --primary-foreground: 355 100% 97.3%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --border: 240 3.7% 15.9%;
  }
}
```

---

## 3. Responsive & Multi-Device Checklist

- **Mobile First**: Design layouts starting from 320px up to 1920px.
- **Breakpoints**:
  - `sm` (640px): Single-column stack to 2-column grid.
  - `md` (768px): Tablet layout, slide-over navigation.
  - `lg` (1024px): Desktop layout with persistent sidebars.
  - `xl` (1280px+): High-density dashboards and multi-pane views.
- **Touch Targets**: Minimum 44x44px for touchable interactive elements.

---

## 4. Accessibility (WCAG 2.1 AA) Standards

1. **Color Contrast**: Minimum 4.5:1 for normal text, 3:1 for large text and UI components.
2. **Keyboard Navigation**: All interactive elements must be focusable with visible focus rings (`focus-visible:ring-2 focus-visible:ring-primary`).
3. **Screen Readers**: Provide `aria-label`, `aria-expanded`, `aria-live`, and semantic HTML (`<main>`, `<nav>`, `<aside>`, `<header>`, `<footer>`).
4. **Form Accessibility**: Every input must have an associated `<label>` or `aria-labelledby` with inline error descriptions linked via `aria-describedby`.
