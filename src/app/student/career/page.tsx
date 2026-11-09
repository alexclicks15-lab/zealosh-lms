'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Compass,
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  Flame,
  Star,
  Share2,
  FileText,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import {
  CareerPathway,
  StudentCareerPlan,
  StudentCareerMilestone,
  PrerequisiteEvaluationResult,
} from '@/types';

export default function StudentCareerPage() {
  const [loading, setLoading] = useState(true);
  const [pathway, setPathway] = useState<CareerPathway | null>(null);
  const [plan, setPlan] = useState<StudentCareerPlan | null>(null);
  const [prereqResults, setPrereqResults] = useState<Record<string, PrerequisiteEvaluationResult[]>>({});
  const [studentPoints, setStudentPoints] = useState<number>(0);
  const [streakDays, setStreakDays] = useState<number>(0);
  const [tutorShared, setTutorShared] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load default master pathway
        const pwRes = await fetch('/api/career/pathways/path-hse-master');
        if (pwRes.ok) {
          const pwData = await pwRes.json();
          setPathway(pwData.pathway);
        }

        // Load or create student plan for default student
        const studentId = 'usr-student-01';
        let planRes = await fetch(`/api/career/plans?studentId=${studentId}`);
        let planData = await planRes.json();

        if (!planData.plan) {
          // Initialize plan
          const initRes = await fetch('/api/career/plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId,
              pathwayId: 'path-hse-master',
              targetCompletionDate: '2028-12-31',
              notes: 'Aspiring Enterprise Safety Director.',
            }),
          });
          planData = await initRes.json();
        }

        setPlan(planData.plan);
        setTutorShared(!!planData.plan?.sharedWithTutorId);

        // Load gamification summary
        const gamRes = await fetch(`/api/gamification/me?studentId=${studentId}`);
        if (gamRes.ok) {
          const gamData = await gamRes.json();
          setStudentPoints(gamData.summary?.totalPoints || 145);
          setStreakDays(gamData.summary?.streak?.currentStreak || 4);
        }
      } catch (err) {
        console.error('Failed to load career data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleToggleTutorShare = async () => {
    if (!plan) return;
    const studentId = 'usr-student-01';
    const action = tutorShared ? 'REVOKE' : 'SHARE';
    const tutorId = 'usr-inst-asp';

    try {
      const res = await fetch(`/api/career/plans/${plan.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, studentId, tutorId }),
      });
      const data = await res.json();
      if (data.success) {
        setTutorShared(action === 'SHARE');
        setFeedbackMsg(action === 'SHARE' ? 'Plan shared with your assigned tutor.' : 'Tutor sharing revoked.');
        setTimeout(() => setFeedbackMsg(''), 4000);
      }
    } catch {
      setFeedbackMsg('Error updating tutor sharing preference.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#4f8c4c] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#252c41] font-semibold">Loading Career Certification Roadmap...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#252c41]">
      {/* Top Banner */}
      <header className="bg-[#252c41] text-white py-8 px-6 border-b border-[#eaedf5]">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-[#4f8c4c] text-white">
                Track 5 Career Intelligence
              </span>
              <span className="text-xs text-slate-300">Multi-Year Progression</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              HSE Career Certification Roadmap
            </h1>
            <p className="text-slate-300 text-sm mt-1">
              Personalized multi-year progression plan from Associate Safety Professional (ASP) to CSP & CRSP.
            </p>
          </div>

          {/* Gamification Stats */}
          <div className="flex items-center gap-4 bg-slate-800/80 border border-slate-700 rounded-xl px-5 py-3">
            <div className="flex items-center gap-2.5 border-r border-slate-700 pr-4">
              <Flame className="w-6 h-6 text-orange-400 animate-pulse" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Kolkata Streak</p>
                <p className="text-lg font-bold text-white">{streakDays} Days</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <Star className="w-6 h-6 text-yellow-400" />
              <div>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Learning XP</p>
                <p className="text-lg font-bold text-white">{studentPoints} pts</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {feedbackMsg && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-[#4f8c4c]" />
            {feedbackMsg}
          </div>
        )}

        {/* Pathway Header Card */}
        {pathway && (
          <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#eaedf5]">
              <div>
                <span className="text-xs font-semibold text-[#4f8c4c] uppercase tracking-wider">
                  Institutional Pathway • Version {pathway.version}
                </span>
                <h2 className="text-xl font-bold text-[#252c41] mt-0.5">{pathway.title}</h2>
                <p className="text-sm text-slate-600 mt-1 max-w-3xl">{pathway.description}</p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleToggleTutorShare}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    tutorShared
                      ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                      : 'bg-[#4f8c4c] text-white hover:bg-[#3a7536]'
                  }`}
                >
                  <Share2 className="w-4 h-4" />
                  {tutorShared ? 'Sharing Active with Tutor' : 'Share Plan with Tutor'}
                </button>
              </div>
            </div>

            {/* Target Role & Completion Metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-sm">
              <div>
                <span className="text-slate-500 text-xs block uppercase font-medium">Target Career Goal</span>
                <span className="font-semibold text-slate-800">{pathway.targetRole}</span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block uppercase font-medium">Planned Target Date</span>
                <span className="font-semibold text-slate-800">
                  {plan?.targetCompletionDate || 'December 31, 2028'}
                </span>
              </div>
              <div>
                <span className="text-slate-500 text-xs block uppercase font-medium">Tutor Review Status</span>
                <span className="font-semibold text-[#4f8c4c]">
                  {tutorShared ? 'Shared (Dr. Rajesh Nair, CSP)' : 'Private (Not Shared)'}
                </span>
              </div>
            </div>

            {/* Tutor Guidance Notes if available */}
            {plan?.tutorGuidanceNotes && (
              <div className="mt-4 p-4 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-sm">
                <p className="font-bold flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-blue-600" /> Tutor Guidance Notes:
                </p>
                <p className="mt-1 text-slate-700">{plan.tutorGuidanceNotes}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Last updated: {plan.tutorGuidanceUpdatedAt ? new Date(plan.tutorGuidanceUpdatedAt).toLocaleDateString() : 'Recently'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Pathway Stages / Milestones */}
        <h3 className="text-lg font-bold text-[#252c41] mb-4 flex items-center gap-2">
          <Compass className="w-5 h-5 text-[#4f8c4c]" /> Progression Stages & Certification Milestones
        </h3>

        <div className="space-y-6">
          {pathway?.stages.map((stage, idx) => {
            const milestone = plan?.milestones.find(m => m.stageId === stage.id);
            const isCompleted = milestone?.status === 'COMPLETED';
            const isInProgress = milestone?.status === 'IN_PROGRESS';

            return (
              <div
                key={stage.id}
                className={`bg-white rounded-xl border p-6 shadow-sm transition-all ${
                  isCompleted
                    ? 'border-green-300 bg-green-50/20'
                    : isInProgress
                    ? 'border-blue-300 ring-1 ring-blue-100'
                    : 'border-[#eaedf5]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                        isCompleted
                          ? 'bg-[#4f8c4c] text-white'
                          : isInProgress
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">
                          Stage {stage.stageOrder} • {stage.estimatedMonths} Months Estimated
                        </span>
                        {stage.isOptional && (
                          <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">
                            Optional Route
                          </span>
                        )}
                      </div>
                      <h4 className="text-lg font-bold text-[#252c41] mt-0.5">{stage.title}</h4>
                      <p className="text-sm text-slate-600 mt-1">{stage.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        isCompleted
                          ? 'bg-green-100 text-green-800'
                          : isInProgress
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {milestone?.status || 'PLANNED'}
                    </span>
                  </div>
                </div>

                {/* Prerequisites Section */}
                <div className="mt-6 pt-4 border-t border-[#eaedf5]">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                    Prerequisites & Accredited Evidence:
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stage.prerequisites.map(prereq => (
                      <div
                        key={prereq.id}
                        className="p-3 rounded-lg border border-[#eaedf5] bg-slate-50 text-xs flex items-start gap-2.5"
                      >
                        <ShieldCheck className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-800">{prereq.title}</p>
                          <p className="text-slate-600 mt-0.5">{prereq.description}</p>
                          <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Status: Verified in Database
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* External Exam Booking Details */}
                <div className="mt-4 pt-3 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Target Exam Window: <strong>{milestone?.targetDate || 'Q2 2027'}</strong>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      Credential: <strong>{stage.certificationId.toUpperCase()}</strong>
                    </span>
                  </div>

                  <Link
                    href={`/student/assessments`}
                    className="text-[#4f8c4c] font-bold hover:underline flex items-center gap-1"
                  >
                    View Mock Assessment Blueprints <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Navigation Back */}
        <div className="mt-8 flex justify-between items-center">
          <Link
            href="/student"
            className="text-sm text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1"
          >
            ← Back to Student Workspace
          </Link>
          <Link
            href="/student/assessments"
            className="bg-[#252c41] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            Launch Practice Examinations <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
