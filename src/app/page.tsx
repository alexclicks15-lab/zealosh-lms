'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  ShieldCheck, 
  Award, 
  Users, 
  Video, 
  BookOpen, 
  Clock, 
  ArrowRight, 
  CheckCircle, 
  FileSpreadsheet, 
  Laptop,
  Check,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { Course } from '@/types';
import { CmsPage, CmsPageNode } from '@/types/cms';
import { buildTree } from '@/lib/cms/tree-engine';
import { CmsComponentRenderer } from '@/components/cms/CmsComponentRenderer';

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [cmsNodes, setCmsNodes] = useState<CmsPageNode[]>([]);

  useEffect(() => {
    fetch('/api/courses')
      .then((res) => res.json())
      .then((data) => {
        if (data.courses) setCourses(data.courses);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Inspect if a published CMS homepage version is active
    fetch('/api/cms/pages/home')
      .then((res) => (res.ok ? res.json() : null))
      .then(async (data) => {
        if (data?.page?.status === 'PUBLISHED' && data.page.publishedVersionId) {
          const verRes = await fetch(`/api/cms/pages/${data.page.id}/versions/${data.page.publishedVersionId}`);
          if (verRes.ok) {
            const verData = await verRes.json();
            if (verData.nodes && verData.nodes.length > 0) {
              setCmsNodes(verData.nodes);
            }
          }
        }
      })
      .catch(() => {});
  }, []);

  // If a published CMS homepage exists, render the versioned CMS layout
  if (cmsNodes.length > 0) {
    const hierarchicalTree = buildTree(cmsNodes);
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <main className="flex-1 w-full">
          {hierarchicalTree.map((secNode) => (
            <CmsComponentRenderer
              key={secNode.id}
              node={secNode}
              isEditorMode={false}
            />
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section — Luminous Zealosh Green & White */}
      <section className="relative bg-gradient-to-b from-[#f4f9f3] via-white to-white py-12 sm:py-20 px-4 sm:px-8 overflow-hidden border-b border-[#e2efe1]">
        {/* Subtle decorative emerald ambient glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#4f8c4c]/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-10 w-80 h-80 bg-[#2ea033]/6 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          <div className="lg:col-span-7 min-w-0 space-y-6">
            <div className="inline-flex items-center gap-1.5 sm:gap-2 bg-[#e8f3e7] border border-emerald-300 text-[#245921] text-[10px] sm:text-xs font-bold px-3 sm:px-3.5 py-1.5 rounded-full shadow-xs max-w-full">
              <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#4f8c4c] shrink-0" />
              <span className="truncate sm:whitespace-normal">OFFICIAL ZEALOSH HSE CERTIFICATION ACADEMY</span>
            </div>

            <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight break-words">
              Master Your <span className="text-[#4f8c4c]">ASP, CSP, CRSP & CIT</span> Certification Exams
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl leading-relaxed break-words">
              Accelerate your safety career with elite mentorship from <strong>Vishnu Rajendran</strong>. Real-time live classes, comprehensive calculation workshops, high-yield formula sheets, and authoritative blueprint mock exam simulations.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 w-full">
              <Link href="/courses" className="btn-primary w-full sm:w-auto text-sm sm:text-base px-6 py-3 shadow-md hover:shadow-lg justify-center">
                <span>View Upcoming Batches</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link href="/exams" className="btn-secondary w-full sm:w-auto text-sm sm:text-base px-6 py-3 shadow-xs justify-center">
                <span>Launch Mock Exam Engine</span>
              </Link>
            </div>

            {/* Quick Metrics in Frosted Glass Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-6 border-t border-[#e2efe1] w-full">
              <div className="glass-card-subtle min-w-0 p-3.5 text-center">
                <div className="text-2xl sm:text-3xl font-black text-slate-900">98.4%</div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">First-Time Pass Rate</div>
              </div>
              <div className="glass-card-subtle min-w-0 p-3.5 text-center">
                <div className="text-2xl sm:text-3xl font-black text-[#4f8c4c]">1,250+</div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">HSE Leaders Mentored</div>
              </div>
              <div className="glass-card-subtle min-w-0 p-3.5 text-center">
                <div className="text-2xl sm:text-3xl font-black text-[#3a7536]">4 Modes</div>
                <div className="text-xs text-slate-500 mt-1 font-semibold">Hybrid, Live & Notes</div>
              </div>
            </div>
          </div>

          {/* Lead Instructor Feature Box — Frosted Glass Card */}
          <div className="lg:col-span-5 min-w-0 w-full">
            <div className="glass-card p-5 sm:p-8 shadow-xl relative border border-emerald-500/20 max-w-full">
              <div className="flex items-center gap-3 sm:gap-4 mb-6">
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden relative border-2 border-[#4f8c4c] shrink-0 shadow-sm">
                  <Image
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80"
                    alt="Vishnu Rajendran"
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate">Vishnu Rajendran</h3>
                  <p className="text-xs text-[#245921] font-bold break-words">
                    CSP (USA) • CRSP (Canada) • NEBOSH IDip
                  </p>
                  <p className="text-xs text-slate-500 font-medium">Founder & Lead Safety Mentor</p>
                </div>
              </div>

              <div className="space-y-3 text-xs sm:text-sm text-slate-700">
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span className="leading-snug">Interactive problem-solving workshops for complex safety math.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span className="leading-snug">Authoritative blueprint alignment with BCSP & BCRSP scoring domains.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span className="leading-snug">Small cohort sizes ensuring 1-on-1 doubt clarification and mock interviews.</span>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-[#e2efe1] flex flex-wrap justify-between items-center gap-2 text-xs">
                <span className="text-slate-600 font-medium">Next Cohort Orientation:</span>
                <span className="bg-[#4f8c4c] text-white px-3 py-1 rounded-lg font-bold shadow-xs">
                  Nov 1, 2026 (Live)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flagship Curricula Section */}
      <section className="py-14 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="badge-green mb-3 inline-block">Flagship Curricula</span>
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight break-words">
            Comprehensive Certification Preparatory Programs
          </h2>
          <p className="text-slate-600 mt-3 text-xs sm:text-base leading-relaxed break-words">
            Engineered specifically to conquer BCSP and BCRSP certification blueprints through structured batches, recorded modules, and question banks.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-emerald-50/60 rounded-2xl border border-emerald-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {courses.map((course) => (
              <div
                key={course.id}
                className="glass-card min-w-0 flex flex-col justify-between overflow-hidden group hover-lift"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    <Image
                      src={
                        course.coverImage && course.coverImage !== '/images/cover.jpg'
                          ? course.coverImage
                          : '/logo.png'
                      }
                      alt={course.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-white/95 text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-md shadow-xs border border-slate-200">
                      {course.certificationType}
                    </div>
                    <div className="absolute top-3 right-3 bg-[#4f8c4c] text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-xs">
                      {course.deliveryModel}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-base text-slate-900 line-clamp-2 mb-2 group-hover:text-[#4f8c4c] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                      {course.headline}
                    </p>

                    <div className="space-y-1.5 text-xs text-slate-600 border-t border-[#e2efe1] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#4f8c4c]" />
                          Duration:
                        </span>
                        <span className="font-semibold text-slate-800">{course.durationWeeks} Weeks</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#4f8c4c]" />
                          Curriculum:
                        </span>
                        <span className="font-semibold text-slate-800">{course.totalLessons} Lessons</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <div className="flex items-center justify-between pt-3 border-t border-[#e2efe1] mb-4">
                    <div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Course Fee</div>
                      <div className="text-lg font-black text-slate-900">
                        ₹{course.priceInr.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Global</div>
                      <div className="text-sm font-bold text-slate-600">${course.priceUsd} USD</div>
                    </div>
                  </div>

                  <Link
                    href={`/courses/${course.slug}`}
                    className="w-full btn-brand-outline text-xs py-2.5 shadow-xs flex items-center justify-center gap-1 group-hover:bg-[#4f8c4c] group-hover:text-white"
                  >
                    <span>View Cohort & Enroll</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4 Delivery Models Section — Unified Green & White */}
      <section className="bg-[#f4f9f3] py-20 px-4 sm:px-8 border-y border-[#e2efe1]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="badge-green mb-3 inline-block">Flexible Formats</span>
            <h2 className="text-3xl font-black text-slate-900">
              Engineered for Working HSE Professionals
            </h2>
            <p className="text-slate-600 mt-2 text-sm leading-relaxed">
              We recognize that safety professionals work across rotational shifts and industrial sites. Choose your optimal delivery format.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            <div className="glass-card min-w-0 p-6 hover-lift">
              <div className="w-12 h-12 rounded-xl bg-[#e8f3e7] flex items-center justify-center text-[#245921] mb-4 border border-emerald-200 shadow-xs">
                <Laptop className="w-6 h-6 text-[#4f8c4c]" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Hybrid Programs</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                The ultimate prep: pre-recorded core theory chapters paired with weekend live problem-solving classes and tutor office hours.
              </p>
            </div>

            <div className="glass-card min-w-0 p-6 hover-lift">
              <div className="w-12 h-12 rounded-xl bg-[#e8f3e7] flex items-center justify-center text-[#245921] mb-4 border border-emerald-200 shadow-xs">
                <Video className="w-6 h-6 text-[#4f8c4c]" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Live-Only Bootcamps</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Intensive live cohort schedules via Zealosh VC Live Classroom with real-time audio, video, multi-user whiteboard, and instant doubt resolution.
              </p>
            </div>

            <div className="glass-card min-w-0 p-6 hover-lift">
              <div className="w-12 h-12 rounded-xl bg-[#e8f3e7] flex items-center justify-center text-[#245921] mb-4 border border-emerald-200 shadow-xs">
                <Clock className="w-6 h-6 text-[#4f8c4c]" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Self-Paced Recorded</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Full on-demand library with adaptive streaming, chapter index, progress tracking, and forensic dynamic watermarking.
              </p>
            </div>

            <div className="glass-card min-w-0 p-6 hover-lift">
              <div className="w-12 h-12 rounded-xl bg-[#e8f3e7] flex items-center justify-center text-[#245921] mb-4 border border-emerald-200 shadow-xs">
                <FileSpreadsheet className="w-6 h-6 text-[#4f8c4c]" />
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-2">Materials & Quick Cards</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                High-yield formula cheat sheets, radiation math guides, industrial ventilation tables, and quick cards for last-mile revision.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Examination Engine Callout — Deep Forest Green to Brand Green */}
      <section className="bg-gradient-to-r from-[#1e481c] via-[#245921] to-[#3a7536] text-white py-14 sm:py-16 px-4 sm:px-8 border-b border-emerald-900">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-8">
          <div>
            <span className="bg-white/20 text-white text-[11px] sm:text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider backdrop-blur-xs">
              High-Stakes Examination Engine
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-black mt-3 break-words">
              Practice Under Authentic BCSP & BCRSP Exam Conditions
            </h2>
            <p className="text-emerald-100 text-xs sm:text-sm mt-2 max-w-xl leading-relaxed break-words">
              Server-enforced countdown timers, domain blueprint weighting, formula reference calculators, and instant diagnostic feedback.
            </p>
          </div>

          <Link href="/exams" className="btn-secondary bg-white text-[#245921] hover:bg-emerald-50 border-white font-bold px-6 sm:px-8 py-3.5 w-full sm:w-auto text-center justify-center shrink-0 shadow-lg hover:shadow-xl transition-all">
            <span>Launch Exam Engine</span>
            <ArrowRight className="w-4 h-4 text-[#4f8c4c]" />
          </Link>
        </div>
      </section>
    </div>
  );
}
