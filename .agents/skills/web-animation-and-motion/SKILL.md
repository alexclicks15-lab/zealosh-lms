---
name: web-animation-and-motion
description: >-
  Fluid web animations, Framer Motion, CSS transforms/transitions, spring physics, scroll-driven motion, and accessible micro-interactions.
  Use this skill when designing fluid UI animations, implementing page transitions with Framer Motion, optimizing 60fps render performance,
  or ensuring prefers-reduced-motion accessibility compliance.
---

# Web Animation & Motion Systems Runbook

This skill establishes performance principles, spring physics models, gesture choreography, and accessibility standards for modern web animations.

---

## 1. The 60fps / 120fps Performance Rule (GPU Acceleration)

Only animate properties that composite on the GPU without triggering **Layout** or **Paint**:

| Safe to Animate (GPU Composite) | Expensive / Avoid Animating (Triggers Layout/Paint) |
| :--- | :--- |
| `transform: translate3d(x, y, z)` | `top`, `left`, `right`, `bottom`, `margin`, `padding` |
| `transform: scale(x, y)` | `width`, `height` |
| `transform: rotate(...)` | `border-width`, `border-radius` |
| `opacity: 0..1` | `box-shadow`, `filter` (blur) |

> **Warning:** Never animate CSS `height` or `margin` directly. For accordion collapse/expand, use CSS Grid `grid-template-rows: 0fr` $\to$ `1fr` or Framer Motion `layout`.

---

## 2. Framer Motion Architecture Patterns

### A. Spring Physics vs. Linear Durations
Spring physics provide organic, tactile feedback. Avoid robotic linear easing curves:

```tsx
import { motion, AnimatePresence } from 'framer-motion';

export const springTransition = {
  type: 'spring',
  stiffness: 300,
  damping: 30,
};

export function NotificationToast({ id, message, onClose }: { id: string; message: string; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
      transition={springTransition}
      className="p-4 bg-white shadow-xl rounded-lg border flex items-center justify-between"
    >
      <span>{message}</span>
      <button onClick={onClose} className="ml-4 text-gray-400 hover:text-gray-600">✕</button>
    </motion.div>
  );
}
```

### B. Shared Element Transitions (`layoutId`)
Morph components seamlessly between different views (e.g., card to full modal):

```tsx
export function ProductCard({ product, isSelected, onSelect }: { product: Product; isSelected: boolean; onSelect: () => void }) {
  return (
    <motion.div
      layoutId={`card-container-${product.id}`}
      onClick={onSelect}
      className="cursor-pointer rounded-xl bg-white p-4 shadow"
    >
      <motion.img
        layoutId={`card-image-${product.id}`}
        src={product.thumbnail}
        alt={product.title}
        className="w-full h-48 object-cover rounded-lg"
      />
      <motion.h3 layoutId={`card-title-${product.id}`} className="mt-2 text-lg font-bold">
        {product.title}
      </motion.h3>
    </motion.div>
  );
}
```

---

## 3. Scroll-Driven Animations

Use `IntersectionObserver` or CSS `animation-timeline` for reveal animations:

```tsx
// hooks/useScrollReveal.ts
import { useEffect, useRef, useState } from 'react';

export function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el); // Reveal once
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -50px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, isVisible };
}
```

---

## 4. Accessibility: `prefers-reduced-motion`

Respect user OS accessibility preferences for reduced motion:

```css
/* CSS Fallback */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

In Framer Motion:
```tsx
import { useReducedMotion, motion } from 'framer-motion';

export function AccessibleWidget() {
  const shouldReduceMotion = useReducedMotion();

  const animationVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <motion.div initial="hidden" animate="visible" variants={animationVariants}>
      Content
    </motion.div>
  );
}
```

---

## 5. Animation Quality Checklist

- [ ] All animated properties restricted to `transform` and `opacity`.
- [ ] No layout thrashing caused by reading DOM geometry inside animation loops.
- [ ] Staggered child reveals capped at $\le 0.05\text{s}$ per item to avoid sluggish page perception.
- [ ] Interactive buttons include micro-scale feedback (`whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.98 }}`).
- [ ] `prefers-reduced-motion` accessibility hook or media query fully supported.
