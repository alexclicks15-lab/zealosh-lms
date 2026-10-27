'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Award, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  PlayCircle, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  BookOpen,
  Lock,
  ArrowRight
} from 'lucide-react';
import { ExamBlueprint } from '@/types';

export default function ExamsHubPage() {
  const router = useRouter();
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/exams')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.blueprints) setBlueprints(data.blueprints);
        if (data?.attempts) setAttempts(data.attempts);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStartExam = async (blueprintId: string) => {
    try {
      const res = await fetch(`/api/exams/${blueprintId}/start`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error(data.error || 'Failed to start exam');
      }
      // Route to attempt screen
      router.push(`/exams/${blueprintId}?attemptId=${data.attemptId}`);
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading examination blueprints...</p>
      </div>
    );
  }

  return (
    <div className="py-12 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-10 text-center sm:text-left">
        <div className="inline-flex items-center gap-2 bg-[#e1f0df] text-[#3a7536] text-xs font-bold px-3 py-1 rounded-full mb-3">
          <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
          <span>AUTHORITATIVE CERTIFICATION ENGINE</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#252c41] tracking-tight">
          HSE Certification Mock Examination Engine
        </h1>
        <p className="text-gray-600 mt-2 text-base max-w-3xl">
          Test your readiness under authentic BCSP and BCRSP examination conditions. Featuring server-enforced countdown timers, domain blueprint weighting, formula references, and diagnostic reports.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Available Blueprints */}
        <div className="lg:col-span-8 space-y-6">
          <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#4f8c4c]" />
            Official Examination Blueprints
          </h2>

          <div className="space-y-5">
            {blueprints.map((bp: any) => {
              const isPassed = Boolean(bp.passedAttempt?.passed);
              const isLocked = !bp.isUnlocked;

              return (
                <div
                  key={bp.id}
                  className={`card-elevated p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition-all ${
                    isPassed
                      ? 'border-l-4 border-l-[#4f8c4c]'
                      : isLocked
                      ? 'border-l-4 border-l-amber-400 bg-gray-50/50'
                      : 'border-l-4 border-l-[#252c41]'
                  }`}
                >
                  <div className="space-y-3 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-[#252c41] text-white text-xs font-bold px-2.5 py-0.5 rounded">
                        {bp.certificationType}
                      </span>
                      <span className="badge-green text-[11px]">
                        Passing Threshold: {bp.passingScorePercent}%
                      </span>

                      {/* Gating & Status Badges */}
                      {isPassed ? (
                        <span className="bg-green-100 text-[#2e5e2b] text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#4f8c4c]" />
                          <span>PASSED ({bp.passedAttempt.totalScore}%) • CREDENTIAL ISSUED</span>
                        </span>
                      ) : isLocked ? (
                        <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {bp.lockReason === 'UNENROLLED'
                              ? 'LOCKED: ENROLLMENT REQUIRED'
                              : bp.lockReason === 'PROGRESS_INSUFFICIENT'
                              ? `LOCKED: ${bp.currentProgressPercent}% / ${bp.requiredProgressPercent}% COURSEWORK COMPLETED`
                              : 'LOGIN REQUIRED'}
                          </span>
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>ELIGIBLE • COURSEWORK UNLOCKED</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-[#252c41]">
                      {bp.title}
                    </h3>

                    {/* Lock Context / Guidance */}
                    {isLocked && bp.lockReason === 'PROGRESS_INSUFFICIENT' && (
                      <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200/60 text-xs text-amber-900 space-y-1.5">
                        <div className="font-semibold flex items-center justify-between text-[11px]">
                          <span>Prerequisite Lesson Progression</span>
                          <span>{bp.currentProgressPercent}% / {bp.requiredProgressPercent}% Minimum</span>
                        </div>
                        <div className="w-full bg-amber-200 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#4f8c4c] h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(100, (bp.currentProgressPercent / bp.requiredProgressPercent) * 100)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-amber-800">
                          Complete at least 80% of module lessons in <strong>{bp.courseTitle || 'the course'}</strong> to unlock the authoritative examination simulation.
                        </p>
                      </div>
                    )}

                    {isLocked && bp.lockReason === 'UNENROLLED' && (
                      <p className="text-xs text-gray-500 bg-white p-2.5 rounded-lg border border-gray-200">
                        Enrollment in <strong>{bp.courseTitle || 'the masterclass'}</strong> is required before sitting for the official mock certification exam.
                      </p>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-gray-600 pt-2 border-t border-[#eaedf5]">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Questions</span>
                        <span className="font-bold text-gray-800">{bp.totalQuestions} Questions</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Time Limit</span>
                        <span className="font-bold text-gray-800">{bp.durationMinutes} Minutes</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Scoring</span>
                        <span className="font-bold text-gray-800">Domain Weighted</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase font-bold">Integrity</span>
                        <span className="font-bold text-[#3a7536]">Server Enforced</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-col sm:flex-row md:flex-col gap-2 shrink-0 w-full md:w-auto">
                    {isPassed ? (
                      <>
                        {bp.certificate && (
                          <Link
                            href={`/verify/${encodeURIComponent(bp.certificate.certificateCode)}`}
                            className="btn-primary text-xs py-2.5 px-5 shadow flex items-center justify-center gap-1.5"
                          >
                            <Award className="w-4 h-4" />
                            <span>View Credential</span>
                          </Link>
                        )}
                        <button
                          onClick={() => handleStartExam(bp.id)}
                          className="btn-outline text-xs py-2 px-4 flex items-center justify-center gap-1.5"
                        >
                          <PlayCircle className="w-4 h-4 text-[#4f8c4c]" />
                          <span>Retake Mock Exam</span>
                        </button>
                      </>
                    ) : bp.isUnlocked ? (
                      <button
                        onClick={() => handleStartExam(bp.id)}
                        className="btn-primary text-xs py-3 px-6 shadow flex items-center justify-center gap-1.5"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Start Timed Exam</span>
                      </button>
                    ) : bp.lockReason === 'PROGRESS_INSUFFICIENT' ? (
                      <Link
                        href={`/learn/${bp.courseSlug || bp.courseId || 'asp-examination-prep'}`}
                        className="btn-primary text-xs py-2.5 px-5 shadow flex items-center justify-center gap-1.5"
                      >
                        <span>Continue Lessons</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : bp.lockReason === 'UNENROLLED' ? (
                      <Link
                        href={`/courses/${bp.courseSlug || 'asp-examination-prep'}`}
                        className="btn-primary text-xs py-2.5 px-5 shadow flex items-center justify-center gap-1.5"
                      >
                        <span>Enroll in Course</span>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    ) : (
                      <Link
                        href="/login"
                        className="btn-outline text-xs py-2.5 px-5 flex items-center justify-center gap-1.5"
                      >
                        <span>Log In to Unlock</span>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Sidebar: Historical Attempts & Rules */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
            <h3 className="font-bold text-base text-[#252c41] mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#4f8c4c]" />
              Recent Exam Attempts
            </h3>

            {attempts.length === 0 ? (
              <p className="text-xs text-gray-500">
                You have not taken any mock exams yet. Start a blueprint above to see your diagnostic score trends.
              </p>
            ) : (
              <div className="space-y-3">
                {attempts.map((att) => (
                  <div
                    key={att.id}
                    className="p-3 rounded-lg border border-[#eaedf5] flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-[#252c41]">
                        {att.certificationType} Mock Exam
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {new Date(att.startTime).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-black text-sm ${att.passed ? 'text-[#3a7536]' : 'text-red-600'}`}>
                        {att.totalScore}%
                      </div>
                      <span className={`text-[10px] font-bold ${att.passed ? 'text-green-700' : 'text-red-600'}`}>
                        {att.passed ? 'PASSED' : 'RETRY'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Exam Rules & Anti-Cheat Notice */}
          <div className="bg-[#f7f9fc] rounded-xl border border-[#eaedf5] p-5 text-xs text-gray-600 space-y-2.5">
            <div className="font-bold text-[#252c41] flex items-center gap-1.5 text-xs">
              <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
              <span>Examination Integrity Guidelines</span>
            </div>
            <p>
              • The examination timer runs on the Zealosh server. Any attempt to modify client clocks will not extend your test deadline.
            </p>
            <p>
              • Answers are auto-saved to the database every 30 seconds and upon question navigation.
            </p>
            <p>
              • At expiration, the server will automatically seal and grade all answers received.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
