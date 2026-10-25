'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  Video, 
  BookOpen, 
  Award, 
  Clock, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  PlayCircle,
  FileText
} from 'lucide-react';
import { Enrollment, Course, LiveSession } from '@/types';

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          // Enrich enrollments
          fetch('/api/courses')
            .then((r) => r.json())
            .then((cData) => {
              const enrolled = data.enrollments.map((enr: any) => {
                const course = cData.courses?.find((c: any) => c.id === enr.courseId);
                return { ...enr, course };
              });
              setEnrollments(enrolled);
              setLoading(false);
            });
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleJoinLive = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/live/${sessionId}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.joinUrl) {
        router.push(data.joinUrl);
      } else {
        alert(data.error || 'Failed to join live session');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading student portal...</p>
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#252c41] to-[#3a7536] text-white rounded-2xl p-6 sm:p-8 mb-10 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold text-[#99cd92] uppercase tracking-wider mb-1">
              Zealosh Student Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.name || 'Student'}!
            </h1>
            <p className="text-sm text-gray-200 mt-1 max-w-xl">
              Track your certified course progression, attend upcoming live cohorts, and test your exam readiness with official mock blueprints.
            </p>
          </div>

          <Link
            href="/exams"
            className="btn-primary bg-white text-[#252c41] hover:bg-gray-100 hover:text-[#252c41] text-xs font-bold py-2.5 px-5 shadow"
          >
            <Award className="w-4 h-4 text-[#4f8c4c]" />
            <span>Launch Exam Simulation</span>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Enrolled Courses */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#4f8c4c]" />
              Active Enrolled Programs
            </h2>
            <Link href="/courses" className="text-xs font-bold text-[#4f8c4c] hover:underline">
              Browse More Courses
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-10 text-center">
              <p className="text-gray-500 text-sm mb-4">You have not enrolled in any programs yet.</p>
              <Link href="/courses" className="btn-primary text-xs inline-flex">
                Explore Available Cohorts
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {enrollments.map((enr) => (
                <div
                  key={enr.id}
                  className="card-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-gray-100 border border-gray-200">
                      <Image
                        src={enr.course?.coverImage || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400'}
                        alt="Course"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="badge-green text-[10px]">
                          {enr.course?.certificationType || 'HSE'}
                        </span>
                        <span className="text-[11px] text-gray-500">
                          Expires: {new Date(enr.expiresAt).toLocaleDateString()}
                        </span>
                      </div>
                      <h3 className="font-bold text-base text-[#252c41]">
                        {enr.course?.title || 'Certification Course'}
                      </h3>

                      {/* Progress Bar */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="w-36 sm:w-48 bg-gray-200 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-[#4f8c4c] h-2 rounded-full"
                            style={{ width: `${enr.progressPercent || 35}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-gray-600">
                          {enr.progressPercent || 35}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <Link
                    href={`/learn/${enr.courseId}`}
                    className="btn-primary text-xs py-2 px-4 shrink-0 w-full sm:w-auto"
                  >
                    <PlayCircle className="w-4 h-4" />
                    <span>Continue Learning</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Sidebar: Upcoming Live Classroom & Resources */}
        <div className="lg:col-span-4 space-y-6">
          {/* Live Session Alert Box */}
          <div className="bg-white rounded-xl border-2 border-[#4f8c4c] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                SCHEDULED LIVE CLASS
              </span>
              <span className="text-xs text-gray-500 font-semibold">BigBlueButton</span>
            </div>

            <h3 className="font-bold text-sm text-[#252c41] mb-2 leading-snug">
              Live Workshop: ASP Math & Ventilation Problem-Solving
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Lead Mentor: Vishnu Rajendran • 120 Minutes
            </p>

            <button
              onClick={() => handleJoinLive('sess-asp-01')}
              className="w-full btn-primary text-xs py-2.5 shadow-sm"
            >
              <Video className="w-4 h-4" />
              <span>Join Live Classroom</span>
            </button>
          </div>

          {/* Quick Study Aids */}
          <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-[#252c41] mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4f8c4c]" />
              Downloadable Quick Cards
            </h3>
            <ul className="space-y-2.5 text-xs text-gray-700">
              <li className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span>Zealosh ASP Formula Cheat Sheet</span>
                <span className="text-[11px] font-bold text-[#4f8c4c]">PDF</span>
              </li>
              <li className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span>Radiation Inverse Square Law Card</span>
                <span className="text-[11px] font-bold text-[#4f8c4c]">PDF</span>
              </li>
              <li className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                <span>Industrial Ventilation Equations</span>
                <span className="text-[11px] font-bold text-[#4f8c4c]">PDF</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
