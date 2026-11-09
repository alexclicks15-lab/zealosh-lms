"use client";

import React, { useEffect, useState, useId } from "react";

export interface ZealoshFact {
  id: string;
  category: string;
  fact: string;
}

export const DEFAULT_ZEALOSH_FACTS: ZealoshFact[] = [
  {
    id: "bcrsp-provider",
    category: "BCRSP® Listed Course Provider",
    fact: "Zealosh is an officially recognized preparatory course provider for the Canadian Registered Safety Professional (CRSP®) certification.",
  },
  {
    id: "bcsp-asp-csp",
    category: "BCSP® ASP® & CSP® Mastery",
    fact: "Our flagship ASP and CSP training programs are built around the latest BCSP examination blueprints, safety math, and domain mastery.",
  },
  {
    id: "expert-faculty",
    category: "Practitioner-Led HSE Faculty",
    fact: "Learn directly from globally accredited safety consultants holding CSP, CRSP, CMIOSH, CIT, and NEBOSH International Diploma credentials.",
  },
  {
    id: "live-training",
    category: "50+ Hours of Live Interactive Coaching",
    fact: "Every cohort includes over 50 hours of live virtual classroom instruction, engineering control calculations, and mentorship.",
  },
  {
    id: "global-courses",
    category: "Comprehensive Safety Certifications",
    fact: "Explore specialized training across ASP, CSP, CRSP, NEBOSH IGC, IOSH Managing Safely, and industrial occupational health standards.",
  },
];

export interface ZealoshLoaderProps {
  size?: "sm" | "md" | "lg" | "fullscreen";
  rotationIntervalMs?: number;
  darkMode?: boolean;
}

export const ZealoshLoader: React.FC<ZealoshLoaderProps> = ({
  size = "fullscreen",
  rotationIntervalMs = 3800,
  darkMode = false,
}) => {
  const reactId = useId();
  const cleanId = reactId.replace(/:/g, "");
  const clipId = `zealoshCircleClip-${cleanId}`;
  const gradId = `zealoshMetallicSplit-${cleanId}`;

  const [facts, setFacts] = useState<ZealoshFact[]>(DEFAULT_ZEALOSH_FACTS);
  const [activeIndex, setActiveIndex] = useState(0);
  const [fade, setFade] = useState(true);

  // Optional dynamic facts fetch (non-blocking, client-side only, preserving fallback)
  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function loadDynamicFacts() {
      try {
        if (typeof window === "undefined" || !window.fetch) return;
        const res = await fetch("/api/lms/facts", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (
          Array.isArray(data) &&
          data.length > 0 &&
          data.every(
            (item) =>
              item &&
              typeof item.id === "string" &&
              typeof item.category === "string" &&
              typeof item.fact === "string"
          )
        ) {
          if (isMounted) {
            setFacts(data);
          }
        }
      } catch {
        // Silently preserve static fallback facts without throwing errors or breaking UI
      }
    }

    loadDynamicFacts();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

  // Safe timer management for fact rotation
  useEffect(() => {
    if (!rotationIntervalMs || rotationIntervalMs <= 0 || facts.length <= 1) {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const intervalId = setInterval(() => {
      setFade(false);
      timeoutId = setTimeout(() => {
        setActiveIndex((prev) => (prev + 1) % facts.length);
        setFade(true);
      }, 250);
    }, rotationIntervalMs);

    return () => {
      clearInterval(intervalId);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [facts.length, rotationIntervalMs]);

  const badgeSize =
    size === "sm" ? 72 : size === "md" ? 96 : size === "lg" ? 116 : 112;

  const wordmarkWidth =
    size === "sm" ? 120 : size === "md" ? 150 : size === "lg" ? 176 : 168;

  const wordmarkHeight = Math.round(wordmarkWidth * 0.24);

  const currentFact = facts[activeIndex] || facts[0] || DEFAULT_ZEALOSH_FACTS[0];

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center text-center select-none ${
        size === "fullscreen" ? "min-h-screen w-full px-6" : "p-8"
      } ${darkMode ? "bg-[#0f172a] text-slate-100" : "bg-white text-slate-800"}`}
    >
      <span className="sr-only">Loading Zealosh platform content...</span>
      <style>{`
        @keyframes zealoshShieldBreathe {
          0%, 100% { transform: scale(0.97); }
          50% { transform: scale(1.02); }
        }

        @keyframes zealoshTickDraw {
          0%, 12% { stroke-dashoffset: 46; opacity: 0; }
          45%, 82% { stroke-dashoffset: 0; opacity: 1; }
          96%, 100% { stroke-dashoffset: 0; opacity: 0; }
        }

        .zealosh-emblem-breathe {
          transform-origin: 60px 60px;
          animation: zealoshShieldBreathe 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        .zealosh-tick-anim {
          stroke-dasharray: 46;
          stroke-dashoffset: 46;
          animation: zealoshTickDraw 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .zealosh-emblem-breathe {
            animation: none !important;
            transform: none !important;
          }
          .zealosh-tick-anim {
            animation: none !important;
            stroke-dasharray: none !important;
            stroke-dashoffset: 0 !important;
            opacity: 1 !important;
          }
        }
      `}</style>

      {/* 1. TOP: Official Untouched Circular Emblem */}
      <div className="mb-3">
        <svg
          viewBox="0 0 120 120"
          width={badgeSize}
          height={badgeSize}
          style={{
            overflow: "visible",
            filter: "drop-shadow(0 10px 24px rgba(78, 140, 74, 0.18))",
          }}
          role="img"
          aria-label="Zealosh official shield emblem"
        >
          <defs>
            <clipPath id={clipId}>
              <circle cx="60" cy="60" r="50" />
            </clipPath>
          </defs>

          <g className="zealosh-emblem-breathe">
            <g clipPath={`url(#${clipId})`}>
              {/* Base Lime Green Circle (#8cbf4d) */}
              <circle cx="60" cy="60" r="50" fill="#8cbf4d" />

              {/* 45-Degree Hard Diagonal Shadow (#4e8c4a) */}
              <path
                d="M74 38 L124 88 L124 125 L60 125 L40 92 Z"
                fill="#4e8c4a"
              />

              {/* Pure White Rounded Safety Crest Shield (#ffffff) */}
              <path
                d="M60 26 C68 26 84 34 84 37 C84 62 74 81 60 93 C46 81 36 62 36 37 C36 34 52 26 60 26 Z"
                fill="#ffffff"
              />
            </g>

            {/* Animated Hollow Outlined Checkmark */}
            <path
              className="zealosh-tick-anim"
              d="M51 60 L57 66 L71 50"
              fill="none"
              stroke="#4e8c4a"
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              className="zealosh-tick-anim"
              d="M51 60 L57 66 L71 50"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        </svg>
      </div>

      {/* 2. MIDDLE: Official zealosh Wordmark */}
      <div className="mb-6">
        <svg
          viewBox="0 0 180 44"
          width={wordmarkWidth}
          height={wordmarkHeight}
          role="img"
          aria-label="Zealosh"
        >
          <defs>
            <linearGradient
              id={gradId}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#b5b5b5" />
              <stop offset="49%" stopColor="#acacac" />
              <stop offset="50%" stopColor="#737373" />
              <stop offset="100%" stopColor="#5e5e5e" />
            </linearGradient>
          </defs>
          <text
            x="90"
            y="34"
            textAnchor="middle"
            fill={`url(#${gradId})`}
            fontFamily="Georgia, 'Times New Roman', Times, serif"
            fontSize="40"
            fontWeight="bold"
            letterSpacing="-0.6px"
          >
            zealosh
          </text>
        </svg>
      </div>

      {/* 3. BOTTOM: Rotating Facts */}
      <div
        className={`max-w-md transition-all duration-300 ${
          fade ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
      >
        <span
          className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-2"
          style={{
            color: "#4e8c4a",
            backgroundColor: darkMode
              ? "rgba(140, 191, 77, 0.14)"
              : "rgba(140, 191, 77, 0.16)",
          }}
        >
          {currentFact.category}
        </span>
        <p
          className={`text-sm leading-relaxed font-medium ${
            darkMode ? "text-slate-300" : "text-slate-600"
          }`}
        >
          {currentFact.fact}
        </p>
      </div>

      {/* Subtle Fact Carousel Dots */}
      <div className="flex items-center gap-1.5 mt-5" aria-hidden="true">
        {facts.map((item, idx) => (
          <span
            key={item.id}
            className="h-1.5 rounded-full transition-all duration-300"
            style={{
              width: idx === activeIndex ? "18px" : "6px",
              backgroundColor: idx === activeIndex ? "#4e8c4a" : "#acacac",
              opacity: idx === activeIndex ? 1 : 0.4,
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default ZealoshLoader;
