---
name: react-development
description: >-
  Modern React component architecture, custom hooks, state management patterns, render optimization, and Suspense concurrency.
  Use this skill when building React applications, designing reusable component libraries, writing custom hooks,
  optimizing re-renders with useMemo/useCallback/React.memo, or managing complex client state.
---

# Modern React Architecture & Performance Runbook

This skill establishes component composition patterns, custom hook design principles, state management strategies, and render optimization techniques for modern React 18+ / 19 applications.

---

## 1. Component Composition & Polymorphism

### A. Compound Component Pattern
```tsx
import React, { createContext, useContext, useState } from 'react';

interface AccordionContextType {
  openIndex: number | null;
  toggleIndex: (index: number) => void;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

export function Accordion({ children }: { children: React.ReactNode }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const toggleIndex = (index: number) => {
    setOpenIndex(prev => (prev === index ? null : index));
  };

  return (
    <AccordionContext.Provider value={{ openIndex, toggleIndex }}>
      <div className="divide-y rounded-lg border">{children}</div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error('AccordionItem must be used within Accordion');

  const isOpen = ctx.openIndex === index;

  return (
    <div>
      <button
        onClick={() => ctx.toggleIndex(index)}
        aria-expanded={isOpen}
        className="flex w-full justify-between p-4 font-medium text-left"
      >
        <span>{title}</span>
        <span>{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <div className="p-4 text-sm">{children}</div>}
    </div>
  );
}
```

---

## 2. Custom Hook Engineering

Encapsulate reusable lifecycle and state logic cleanly:

```typescript
// hooks/useDebounce.ts
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
```

---

## 3. Render Optimization Rules

1. **Avoid Unnecessary Effects**: Do not use `useEffect` to calculate state that can be derived directly during render (`const fullName = `${first} ${last}``).
2. **Context Splitting**: Split high-frequency state from low-frequency actions into separate Context Providers to prevent unnecessary subscriber re-renders.
3. **List Virtualization**: For lists exceeding 100 items, use virtualization (`@tanstack/react-virtual`) rather than rendering 1000s of DOM nodes simultaneously.
4. **Transition Concurrency**: Use `useTransition` for non-urgent UI updates (e.g., search filtering, tab switching) to keep user typing and clicks responsive.

```tsx
function SearchableList({ allItems }: { allItems: string[] }) {
  const [query, setQuery] = useState('');
  const [filtered, setFiltered] = useState(allItems);
  const [isPending, startTransition] = useTransition();

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextQuery = e.target.value;
    setQuery(nextQuery); // Immediate input response

    startTransition(() => {
      // Non-blocking filter execution
      setFiltered(allItems.filter(item => item.toLowerCase().includes(nextQuery.toLowerCase())));
    });
  };

  return (
    <div>
      <input value={query} onChange={handleInput} placeholder="Filter items..." />
      {isPending && <span className="opacity-50">Updating list...</span>}
      <List items={filtered} />
    </div>
  );
}
```

---

## 4. Error Boundaries & Fallback States

Wrap feature sections in React Error Boundaries to prevent a single widget error from crashing the whole page:

```tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  fallback?: ReactNode;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-50 text-red-700 rounded-md">
          <p className="font-semibold">Something went wrong.</p>
          <button onClick={() => this.setState({ hasError: false })} className="mt-2 text-sm underline">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## 5. React Quality Checklist

- [ ] Keys in lists are stable and unique IDs (never array indexes for mutable lists).
- [ ] Cleanup functions returned from `useEffect` for all timers, subscriptions, and DOM listeners.
- [ ] No state mutations (`state.push()` $\to$ `[...state, item]`).
- [ ] Components wrapped in Error Boundaries and `<Suspense>` boundaries where async loading occurs.
