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
  ChevronRight
} from 'lucide-react';
import { Course } from '@/types';

export default function HomePage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/courses')
      .then((res) => res.json())
      .then((data) => {
        if (data.courses) setCourses(data.courses);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#252c41] via-[#1a1f2e] to-[#252c41] text-white py-20 px-4 sm:px-8 overflow-hidden">
        {/* Subtle geometric pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#4f8c4c_1px,transparent_1px)] [background-size:16px_16px]" />

        <div className="max-w-7xl mx-auto relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 bg-[#4f8c4c]/20 border border-[#4f8c4c]/40 text-[#99cd92] text-xs font-semibold px-3 py-1.5 rounded-full">
              <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
              <span>ZEALOSH HSE CERTIFICATION ACADEMY</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
              Master Your <span className="text-[#4f8c4c]">ASP, CSP, CRSP & CIT</span> Certification Exams
            </h1>

            <p className="text-lg text-gray-300 max-w-2xl leading-relaxed">
              Accelerate your safety career with elite mentorship from <strong>Vishnu Rajendran</strong>. Real-time live classes, comprehensive calculation workshops, high-yield formula sheets, and authoritative blueprint mock exam simulations.
            </p>

            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/courses" className="btn-primary text-base px-6 py-3 shadow-lg hover:shadow-xl">
                <span>View Upcoming Batches</span>
                <ArrowRight className="w-5 h-5" />
              </Link>

              <Link href="/exams" className="btn-secondary border border-gray-700 text-base px-6 py-3 hover:border-gray-500">
                <span>Launch Mock Exam Engine</span>
              </Link>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-800">
              <div>
                <div className="text-3xl font-black text-white">98.4%</div>
                <div className="text-xs text-gray-400 mt-1 font-medium">First-Time Pass Rate</div>
              </div>
              <div>
                <div className="text-3xl font-black text-[#4f8c4c]">1,250+</div>
                <div className="text-xs text-gray-400 mt-1 font-medium">HSE Leaders Mentored</div>
              </div>
              <div>
                <div className="text-3xl font-black text-white">4 Modes</div>
                <div className="text-xs text-gray-400 mt-1 font-medium">Hybrid, Live & Notes</div>
              </div>
            </div>
          </div>

          {/* Lead Instructor Feature Box */}
          <div className="lg:col-span-5">
            <div className="bg-white/10 backdrop-blur-md border border-white/15 rounded-2xl p-6 sm:p-8 text-white shadow-2xl relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full overflow-hidden relative border-2 border-[#4f8c4c] shrink-0">
                  <Image
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80"
                    alt="Vishnu Rajendran"
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold">Vishnu Rajendran</h3>
                  <p className="text-xs text-[#99cd92] font-semibold">
                    CSP (USA) • CRSP (Canada) • NEBOSH IDip
                  </p>
                  <p className="text-xs text-gray-300">Lead Safety Consultant & Mentor</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-gray-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span>Interactive problem-solving workshops for complex safety math.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span>Authoritative blueprint alignment with BCSP & BCRSP scoring domains.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span>Small cohort sizes ensuring 1-on-1 doubt clarification and mock interviews.</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 flex justify-between items-center text-xs">
                <span className="text-gray-300">Next Cohort Orientation:</span>
                <span className="bg-[#4f8c4c] text-white px-2.5 py-1 rounded-md font-bold">
                  Nov 1, 2026 (Live)
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Courses Section */}
      <section className="py-20 px-4 sm:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="badge-green mb-3 inline-block">Flagship Curricula</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#252c41] tracking-tight">
            Comprehensive Certification Preparatory Programs
          </h2>
          <p className="text-gray-600 mt-3 text-base">
            Engineered specifically to conquer BCSP and BCRSP certification blueprints through structured batches, recorded modules, and question banks.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-96 bg-gray-200 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {courses.map((course) => (
              <div
                key={course.id}
                className="card-elevated flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  <div className="relative h-44 w-full overflow-hidden bg-gray-100">
                    <Image
                      src={course.coverImage}
                      alt={course.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 bg-[#252c41]/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-xs">
                      {course.certificationType}
                    </div>
                    <div className="absolute top-3 right-3 bg-[#4f8c4c] text-white text-[11px] font-bold px-2.5 py-1 rounded-md shadow-xs">
                      {course.deliveryModel}
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="font-bold text-base text-[#252c41] line-clamp-2 mb-2 group-hover:text-[#4f8c4c] transition-colors">
                      {course.title}
                    </h3>
                    <p className="text-xs text-gray-500 line-clamp-2 mb-4">
                      {course.headline}
                    </p>

                    <div className="space-y-1.5 text-xs text-gray-600 border-t border-[#eaedf5] pt-3">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          Duration:
                        </span>
                        <span className="font-semibold text-gray-800">{course.durationWeeks} Weeks</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                          Curriculum:
                        </span>
                        <span className="font-semibold text-gray-800">{course.totalLessons} Lessons</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 pt-0">
                  <div className="flex items-center justify-between pt-3 border-t border-[#eaedf5] mb-4">
                    <div>
                      <div className="text-[10px] text-gray-400 font-semibold uppercase">Course Fee</div>
                      <div className="text-lg font-black text-[#252c41]">
                        ₹{course.priceInr.toLocaleString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 font-semibold uppercase">Global</div>
                      <div className="text-sm font-bold text-gray-600">${course.priceUsd} USD</div>
                    </div>
                  </div>

                  <Link
                    href={`/courses/${course.slug}`}
                    className="w-full btn-outline text-xs py-2.5 group-hover:bg-[#4f8c4c] group-hover:text-white"
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

      {/* 4 Delivery Models Section */}
      <section className="bg-white py-20 px-4 sm:px-8 border-y border-[#eaedf5]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="badge-navy mb-3 inline-block">Flexible Learning</span>
            <h2 className="text-3xl font-extrabold text-[#252c41]">
              Engineered for Working HSE Professionals
            </h2>
            <p className="text-gray-600 mt-2 text-sm">
              We recognize that safety professionals work across rotational shifts and industrial sites. Choose your optimal delivery format.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-6 rounded-xl border border-[#eaedf5] bg-[#f7f9fc] hover:border-[#4f8c4c] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-[#e1f0df] flex items-center justify-center text-[#3a7536] mb-4">
                <Laptop className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#252c41] mb-2">Hybrid Programs</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                The ultimate prep: pre-recorded core theory chapters paired with weekend live problem-solving classes and tutor office hours.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#eaedf5] bg-[#f7f9fc] hover:border-[#4f8c4c] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700 mb-4">
                <Video className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#252c41] mb-2">Live-Only Bootcamps</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Intensive live cohort schedules via BigBlueButton with real-time audio, video, multi-user whiteboard, and instant doubt resolution.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#eaedf5] bg-[#f7f9fc] hover:border-[#4f8c4c] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700 mb-4">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#252c41] mb-2">Self-Paced Recorded</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Full on-demand library with adaptive streaming, chapter index, progress tracking, and forensic dynamic watermarking.
              </p>
            </div>

            <div className="p-6 rounded-xl border border-[#eaedf5] bg-[#f7f9fc] hover:border-[#4f8c4c] transition-colors">
              <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center text-orange-700 mb-4">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-base text-[#252c41] mb-2">Materials & Quick Cards</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                High-yield formula cheat sheets, radiation math guides, industrial ventilation tables, and quick cards for last-mile revision.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Examination Engine Callout */}
      <section className="bg-gradient-to-r from-[#252c41] to-[#3a7536] text-white py-16 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div>
            <span className="bg-white/20 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              High-Stakes Examination Engine
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold mt-3">
              Practice Under Authentic BCSP & BCRSP Exam Conditions
            </h2>
            <p className="text-gray-200 text-sm mt-2 max-w-xl">
              Server-enforced countdown timers, domain blueprint weighting, formula reference calculators, and instant diagnostic feedback.
            </p>
          </div>

          <Link href="/exams" className="btn-primary bg-white text-[#252c41] hover:bg-gray-100 hover:text-[#252c41] font-bold px-8 py-3.5 shrink-0 shadow-lg">
            <span>Launch Exam Engine</span>
            <ArrowRight className="w-4 h-4 text-[#4f8c4c]" />
          </Link>
        </div>
      </section>
    </div>
  );
}
