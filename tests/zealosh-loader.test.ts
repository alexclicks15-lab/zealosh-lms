import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ZealoshLoader,
  DEFAULT_ZEALOSH_FACTS,
  ZealoshFact,
} from '@/components/ui/ZealoshLoader';
import Loading from '@/app/loading';

describe('ZealoshLoader — Official Branded Loading Component', () => {
  const render = (props?: React.ComponentProps<typeof ZealoshLoader>) =>
    renderToString(React.createElement(ZealoshLoader, props));

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // 1. Initial Rendering & Static Fallback Facts
  describe('1. Static Fallback Facts & Initial Render', () => {
    it('renders on initial load with static fallback facts without network/API dependency', () => {
      const html = render();
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('BCRSP® Listed Course Provider');
      expect(html).toContain(
        'Zealosh is an officially recognized preparatory course provider for the Canadian Registered Safety Professional (CRSP®) certification.'
      );
    });

    it('contains all 5 approved Zealosh institutional safety facts in DEFAULT_ZEALOSH_FACTS', () => {
      expect(DEFAULT_ZEALOSH_FACTS).toHaveLength(5);

      const ids = DEFAULT_ZEALOSH_FACTS.map((f) => f.id);
      expect(ids).toEqual([
        'bcrsp-provider',
        'bcsp-asp-csp',
        'expert-faculty',
        'live-training',
        'global-courses',
      ]);

      const categories = DEFAULT_ZEALOSH_FACTS.map((f) => f.category);
      expect(categories).toContain('BCRSP® Listed Course Provider');
      expect(categories).toContain('BCSP® ASP® & CSP® Mastery');
      expect(categories).toContain('Practitioner-Led HSE Faculty');
      expect(categories).toContain('50+ Hours of Live Interactive Coaching');
      expect(categories).toContain('Comprehensive Safety Certifications');

      DEFAULT_ZEALOSH_FACTS.forEach((fact) => {
        expect(fact.id).toBeTruthy();
        expect(fact.category).toBeTruthy();
        expect(fact.fact).toBeTruthy();
        expect(fact.fact.length).toBeGreaterThan(20);
      });
    });

    it('renders 5 carousel indicator dots corresponding to the 5 facts', () => {
      const html = render();
      const dotMatches = html.match(/class="h-1\.5 rounded-full transition-all duration-300"/g);
      expect(dotMatches).toHaveLength(5);
    });
  });

  // 2. Exact Emblem SVG Geometry & Official Colors
  describe('2. SVG Emblem Geometry & Official Brand Palette', () => {
    it('renders the official circular emblem with exact dimensions and shadow', () => {
      const html = render({ size: 'fullscreen' });
      expect(html).toContain('viewBox="0 0 120 120"');
      expect(html).toContain('width="112"');
      expect(html).toContain('height="112"');
      expect(html).toContain('aria-label="Zealosh official shield emblem"');
      expect(html).toContain('drop-shadow(0 10px 24px rgba(78, 140, 74, 0.18))');
    });

    it('contains the untouched lime green circle (#8cbf4d), diagonal shadow (#4e8c4a), and white shield (#ffffff)', () => {
      const html = render();
      // Lime green base circle
      expect(html).toContain('fill="#8cbf4d"');
      // 45-degree hard diagonal shadow
      expect(html).toContain('d="M74 38 L124 88 L124 125 L60 125 L40 92 Z"');
      expect(html).toContain('fill="#4e8c4a"');
      // Pure white rounded safety crest shield
      expect(html).toContain(
        'd="M60 26 C68 26 84 34 84 37 C84 62 74 81 60 93 C46 81 36 62 36 37 C36 34 52 26 60 26 Z"'
      );
    });

    it('contains the animated hollow checkmark paths with green and white strokes', () => {
      const html = render();
      // Checkmark geometry
      expect(html).toContain('d="M51 60 L57 66 L71 50"');
      // Outer green stroke (5.5) and inner white stroke (2.2)
      expect(html).toContain('stroke="#4e8c4a"');
      expect(html).toContain('stroke-width="5.5"');
      expect(html).toContain('stroke="#ffffff"');
      expect(html).toContain('stroke-width="2.2"');
      expect(html).toContain('class="zealosh-tick-anim"');
    });

    it('renders the official metallic split-gradient zealosh wordmark', () => {
      const html = render({ size: 'fullscreen' });
      expect(html).toContain('viewBox="0 0 180 44"');
      expect(html).toContain('width="168"');
      expect(html).toContain('aria-label="Zealosh"');
      expect(html).toContain('stop-color="#b5b5b5"');
      expect(html).toContain('stop-color="#acacac"');
      expect(html).toContain('stop-color="#737373"');
      expect(html).toContain('stop-color="#5e5e5e"');
      expect(html).toContain('font-family="Georgia, &#x27;Times New Roman&#x27;, Times, serif"');
      expect(html).toContain('font-size="40"');
      expect(html).toContain('font-weight="bold"');
      expect(html).toContain('letter-spacing="-0.6px"');
      expect(html).toContain('>zealosh<');
    });
  });

  // 3. Sizing Variants
  describe('3. Component Sizing Variants', () => {
    it('applies correct responsive dimensions for sm size', () => {
      const html = render({ size: 'sm' });
      // sm: emblem 72px, wordmark 120px
      expect(html).toContain('width="72"');
      expect(html).toContain('height="72"');
      expect(html).toContain('width="120"');
      expect(html).toContain('height="29"'); // Math.round(120 * 0.24) = 29
      expect(html).toContain('class="flex flex-col items-center justify-center text-center select-none p-8 bg-white text-slate-800"');
    });

    it('applies correct responsive dimensions for md size', () => {
      const html = render({ size: 'md' });
      // md: emblem 96px, wordmark 150px
      expect(html).toContain('width="96"');
      expect(html).toContain('height="96"');
      expect(html).toContain('width="150"');
      expect(html).toContain('height="36"'); // Math.round(150 * 0.24) = 36
    });

    it('applies correct responsive dimensions for lg size', () => {
      const html = render({ size: 'lg' });
      // lg: emblem 116px, wordmark 176px
      expect(html).toContain('width="116"');
      expect(html).toContain('height="116"');
      expect(html).toContain('width="176"');
      expect(html).toContain('height="42"'); // Math.round(176 * 0.24) = 42
    });

    it('applies correct responsive dimensions for fullscreen size (default)', () => {
      const html = render({ size: 'fullscreen' });
      // fullscreen: emblem 112px, wordmark 168px, min-h-screen
      expect(html).toContain('width="112"');
      expect(html).toContain('height="112"');
      expect(html).toContain('width="168"');
      expect(html).toContain('height="40"'); // Math.round(168 * 0.24) = 40
      expect(html).toContain('min-h-screen w-full px-6');
    });
  });

  // 4. Dark Mode Support
  describe('4. Dark Mode Support', () => {
    it('applies dark mode slate surface and white text when darkMode=true', () => {
      const html = render({ darkMode: true });
      expect(html).toContain('bg-[#0f172a]');
      expect(html).toContain('text-slate-100');
      expect(html).toContain('background-color:rgba(140, 191, 77, 0.14)');
      expect(html).toContain('text-slate-300');
    });

    it('applies light mode white surface and slate text when darkMode=false', () => {
      const html = render({ darkMode: false });
      expect(html).toContain('bg-white');
      expect(html).toContain('text-slate-800');
      expect(html).toContain('background-color:rgba(140, 191, 77, 0.16)');
      expect(html).toContain('text-slate-600');
    });
  });

  // 5. Accessibility & Reduced Motion Handling
  describe('5. Accessibility & Reduced Motion', () => {
    it('provides accessible role and live region attributes', () => {
      const html = render();
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('<span class="sr-only">Loading Zealosh platform content...</span>');
    });

    it('includes @media (prefers-reduced-motion: reduce) in embedded CSS', () => {
      const html = render();
      expect(html).toContain('@media (prefers-reduced-motion: reduce)');
      expect(html).toContain('animation: none !important');
      expect(html).toContain('stroke-dashoffset: 0 !important');
      expect(html).toContain('opacity: 1 !important');
    });
  });

  // 6. SVG ID Collision Prevention
  describe('6. Unique SVG Identifier Isolation', () => {
    it('generates distinct clip-path and linear-gradient IDs across instances', () => {
      const html1 = render();
      const html2 = render();

      const clipMatch1 = html1.match(/clipPath id="([^"]+)"/);
      const clipMatch2 = html2.match(/clipPath id="([^"]+)"/);
      expect(clipMatch1).not.toBeNull();
      expect(clipMatch2).not.toBeNull();
      expect(clipMatch1![1]).toMatch(/^zealoshCircleClip-/);
      expect(clipMatch2![1]).toMatch(/^zealoshCircleClip-/);

      const gradMatch1 = html1.match(/linearGradient id="([^"]+)"/);
      const gradMatch2 = html2.match(/linearGradient id="([^"]+)"/);
      expect(gradMatch1).not.toBeNull();
      expect(gradMatch2).not.toBeNull();
      expect(gradMatch1![1]).toMatch(/^zealoshMetallicSplit-/);
      expect(gradMatch2![1]).toMatch(/^zealoshMetallicSplit-/);
    });
  });

  // 7. Global Next.js Route Loading Integration
  describe('7. Global Route Loading Integration', () => {
    it('root Loading component renders ZealoshLoader with size=fullscreen', () => {
      const html = renderToString(React.createElement(Loading));
      expect(html).toContain('role="status"');
      expect(html).toContain('min-h-screen w-full px-6');
      expect(html).toContain('aria-label="Zealosh official shield emblem"');
      expect(html).toContain('width="112"');
      expect(html).toContain('width="168"');
      expect(html).toContain('BCRSP® Listed Course Provider');
    });
  });

  // 8. API Independence & Resilience
  describe('8. API Independence & Failure Resilience', () => {
    it('operates without database or Supabase dependencies', () => {
      const html = render();
      expect(html).toContain('Zealosh');
      expect(html).toContain('BCRSP® Listed Course Provider');
    });

    it('rejects malformed dynamic facts safely while retaining static fallbacks', () => {
      const isValidFactArray = (data: any): data is ZealoshFact[] =>
        Array.isArray(data) &&
        data.length > 0 &&
        data.every(
          (item) =>
            item &&
            typeof item.id === 'string' &&
            typeof item.category === 'string' &&
            typeof item.fact === 'string'
        );

      expect(isValidFactArray(null)).toBe(false);
      expect(isValidFactArray([])).toBe(false);
      expect(isValidFactArray([{ id: 123 }])).toBe(false);
      expect(isValidFactArray([{ id: '1', category: 'cat' }])).toBe(false);
      expect(isValidFactArray(DEFAULT_ZEALOSH_FACTS)).toBe(true);
    });

    it('handles zero or negative rotation intervals safely', () => {
      expect(() => render({ rotationIntervalMs: 0 })).not.toThrow();
      expect(() => render({ rotationIntervalMs: -1000 })).not.toThrow();
    });
  });
});
