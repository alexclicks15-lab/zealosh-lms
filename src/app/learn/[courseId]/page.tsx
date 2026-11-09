'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Play, 
  CheckCircle, 
  Circle, 
  Download, 
  FileText, 
  Video, 
  ShieldAlert,
  ChevronRight,
  Maximize2,
  Upload,
  Send,
  Award,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  RefreshCw,
  MessageSquare,
  Sparkles,
  TrendingUp,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';
import WatermarkOverlay from '@/components/WatermarkOverlay';
import { Assignment, AssignmentSubmission, StudentCourseProgression } from '@/types';

export default function LearnPlayerPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'assignments' | 'recordings' | 'progression' | 'tutor'>('lessons');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Phase 6: Student Detailed Course Progression State
  const [progression, setProgression] = useState<StudentCourseProgression | null>(null);
  const [progressionLoading, setProgressionLoading] = useState<boolean>(false);

  // Phase 6: Course-Grounded AI Tutor State
  const [tutorQuery, setTutorQuery] = useState<string>('');
  const [tutorHistory, setTutorHistory] = useState<any[]>([]);
  const [tutorLoading, setTutorLoading] = useState<boolean>(false);
  const [tutorError, setTutorError] = useState<string | null>(null);

  // Class Recordings State
  const [recordings, setRecordings] = useState<any[]>([]);
  const [recordingsLoading, setRecordingsLoading] = useState(true);
  const [recordingEntitlement, setRecordingEntitlement] = useState<string>('ENROLLED');
  const [recordingsError, setRecordingsError] = useState<string | null>(null);

  const fetchProgression = (targetCourseId: string) => {
    setProgressionLoading(true);
    fetch(`/api/student/progression/${targetCourseId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.progression) {
          setProgression(data.progression);
        }
      })
      .catch(() => {})
      .finally(() => setProgressionLoading(false));
  };

  const handleSendTutorQuery = async (queryText?: string) => {
    const q = queryText || tutorQuery;
    if (!q.trim()) return;
    const targetCourse = course?.id || params.courseId;
    setTutorLoading(true);
    setTutorError(null);

    const userMessage = { role: 'user', content: q.trim(), createdAt: new Date().toISOString() };
    setTutorHistory((prev) => [...prev, userMessage]);
    setTutorQuery('');

    try {
      const res = await fetch('/api/ai/tutor/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: targetCourse,
          query: q.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'AI_EXAM_LOCKOUT_ACTIVE') {
          setTutorError('AI Tutor is automatically suspended while a formal certification examination is active.');
        } else {
          setTutorError(data.error || 'Failed to resolve tutor response.');
        }
        return;
      }

      if (data.response) {
        const assistantMessage = {
          role: 'assistant',
          content: data.response.answer,
          citations: data.response.citations,
          modelUsed: data.response.modelUsed,
          confidence: data.response.confidence,
          createdAt: data.response.generatedAt,
        };
        setTutorHistory((prev) => [...prev, assistantMessage]);
      }
    } catch (e: any) {
      setTutorError(e.message || 'Network error communicating with AI tutor');
    } finally {
      setTutorLoading(false);
    }
  };

  const fetchRecordings = (courseIdOrSlug: string) => {
    setRecordingsLoading(true);
    setRecordingsError(null);
    fetch(`/api/courses/${courseIdOrSlug}/recordings`, { cache: 'no-store' })
      .then(async (res) => {
        if (res.status === 401) {
          setRecordingEntitlement('UNAUTHENTICATED');
          setRecordingsLoading(false);
          return null;
        }
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}));
          setRecordingEntitlement('UNAUTHORIZED_TENANT');
          setRecordingsError(errData.error || 'Access denied by tenant isolation policy');
          setRecordingsLoading(false);
          return null;
        }
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || 'Failed to load course recordings');
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setRecordings(data.recordings || []);
          setRecordingEntitlement(data.entitlementStatus || 'ENROLLED');
        }
        setRecordingsLoading(false);
      })
      .catch((err: any) => {
        setRecordingsError(err.message || 'Unable to connect to recording service');
        setRecordingsLoading(false);
      });
  };

  useEffect(() => {
    const targetCourse = params.courseId || 'asp-examination-prep';

    // 1. Fetch user session and enrollment progress
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (data.enrollments) {
            const currentEnrollment = data.enrollments.find(
              (e: any) => e.courseId === targetCourse || e.courseId === 'crs-asp-01'
            );
            if (currentEnrollment) {
              setCompletedLessonIds(currentEnrollment.completedLessonIds || []);
              setProgressPercent(currentEnrollment.progressPercent || 0);
            }
          }
        }
      });

    // 2. Fetch course details and associated coursework
    fetch(`/api/courses/${targetCourse}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.course) {
          setCourse(data.course);
          if (data.course.lessons?.length > 0) {
            setActiveLesson(data.course.lessons[0]);
          }

          // 3. Fetch assignments for this specific course
          const courseIdQuery = data.course.id || targetCourse;
          fetch(`/api/assignments?courseId=${courseIdQuery}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((asgData) => {
              if (asgData?.assignments) {
                setAssignments(asgData.assignments);
                if (asgData.assignments.length > 0) {
                  setSelectedAssignment(asgData.assignments[0]);
                }
              }
            })
            .catch(() => {});

          // 4. Fetch authorized class recordings for this course
          fetchRecordings(courseIdQuery);
        } else {
          fetchRecordings(targetCourse);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.courseId]);

  const toggleLessonComplete = async (lessonId: string) => {
    const isCompleted = completedLessonIds.includes(lessonId);
    const targetCourse = params.courseId || 'asp-examination-prep';

    try {
      const res = await fetch(`/api/courses/${targetCourse}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, completed: !isCompleted }),
      });

      if (res.ok) {
        const data = await res.json();
        setCompletedLessonIds(data.completedLessonIds || []);
        setProgressPercent(data.progressPercent || 0);
      } else {
        // Fallback local toggle
        if (isCompleted) {
          setCompletedLessonIds(completedLessonIds.filter((id) => id !== lessonId));
        } else {
          setCompletedLessonIds([...completedLessonIds, lessonId]);
        }
      }
    } catch {
      if (isCompleted) {
        setCompletedLessonIds(completedLessonIds.filter((id) => id !== lessonId));
      } else {
        setCompletedLessonIds([...completedLessonIds, lessonId]);
      }
    }
  };

  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment) return;

    setSubmitting(true);
    setSubmissionFeedback(null);

    try {
      const res = await fetch(`/api/assignments/${selectedAssignment.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionText,
          attachmentUrl: attachmentUrl || '/uploads/student-submission.pdf',
          attachmentFilename: 'student-submission.pdf',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Submission failed');
      }

      setSubmissionFeedback('Assignment submitted successfully! Instructor will evaluate with rubric criteria.');
      // Refresh assignment state
      const updatedAssignments = assignments.map((a) =>
        a.id === selectedAssignment.id ? { ...a, submission: data.submission } : a
      );
      setAssignments(updatedAssignments);
      setSelectedAssignment({ ...selectedAssignment, submission: data.submission });
    } catch (err: any) {
      setSubmissionFeedback(`Error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading secure player...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f9f3] text-slate-900 flex flex-col">
      {/* Player Header — Deep Forest Green */}
      <div className="bg-[#1e481c] px-4 sm:px-8 py-3 flex items-center justify-between border-b border-emerald-900 text-white">
        <div className="flex items-center gap-4">
          <Link
            href="/student"
            className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </Link>
          <span className="text-gray-600 hidden sm:inline">|</span>
          <span className="text-xs font-semibold text-[#99cd92] truncate max-w-md">
            {course?.title || 'ASP Preparation'}
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <Link
            href={`/courses/${course?.slug || params.courseId}/classroom`}
            className="hidden sm:flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-[#99cd92] hover:text-white px-3 py-1 rounded-full border border-white/10 transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Classroom Workspace</span>
          </Link>

          {/* Progress Indicator */}
          <div className="hidden sm:flex items-center gap-2 bg-black/30 px-3 py-1 rounded-full border border-white/10">
            <span className="text-gray-400 text-[11px]">Course Progress:</span>
            <span className="font-bold text-[#99cd92] text-[11px]">{progressPercent}%</span>
          </div>

          <span className="bg-[#4f8c4c] text-white px-2.5 py-1 rounded text-[10px] font-bold">
            SECURE ADAPTIVE STREAM
          </span>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Video & Content Column */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {/* Protected Video Stage with Dynamic Watermark */}
          <div className="relative aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-800 flex items-center justify-center">
            {/* Dynamic Forensic Watermark Overlay */}
            <WatermarkOverlay
              userName={user?.name || 'Arjun Menon'}
              userEmail={user?.email || 'student@zealosh.com'}
            />

            {/* Video Element */}
            <video
              key={activeLesson?.id}
              controls
              className="w-full h-full object-contain"
              poster="https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200"
            >
              <source
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                type="video/mp4"
              />
              Your browser does not support the video tag.
            </video>
          </div>

          {/* Lesson Details & Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-800 pb-6">
            <div>
              <span className="text-xs text-[#99cd92] font-semibold">
                {activeLesson?.moduleTitle}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold mt-1">
                {activeLesson?.title}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleLessonComplete(activeLesson?.id)}
                className={`btn-primary text-xs py-2 px-4 flex items-center gap-1.5 transition-all ${
                  completedLessonIds.includes(activeLesson?.id)
                    ? 'bg-[#3a7536] hover:bg-[#2e5e2b]'
                    : 'bg-[#4f8c4c] hover:bg-[#3a7536]'
                }`}
              >
                <CheckCircle className="w-4 h-4" />
                <span>
                  {completedLessonIds.includes(activeLesson?.id)
                    ? 'Completed ✓'
                    : 'Mark as Complete'}
                </span>
              </button>
            </div>
          </div>

          {/* Tabs for Materials, Assignments, and Notes */}
          <div className="mt-6">
            <div className="flex items-center gap-3 border-b border-gray-800 pb-2 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('lessons')}
                className={`pb-2 px-1 border-b-2 transition-colors ${
                  activeTab === 'lessons'
                    ? 'border-[#4f8c4c] text-[#99cd92]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                Downloadable Materials
              </button>
              <button
                onClick={() => setActiveTab('assignments')}
                className={`pb-2 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'assignments'
                    ? 'border-[#4f8c4c] text-[#99cd92]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Award className="w-3.5 h-3.5" />
                <span>Coursework & Assignments ({assignments.length})</span>
              </button>
              <button
                onClick={() => setActiveTab('recordings')}
                className={`pb-2 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'recordings'
                    ? 'border-[#4f8c4c] text-[#99cd92]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Class Recordings ({recordings.length})</span>
              </button>
              <button
                onClick={() => {
                  setActiveTab('progression');
                  const targetCourse = course?.id || params.courseId;
                  fetchProgression(targetCourse);
                }}
                className={`pb-2 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'progression'
                    ? 'border-[#4f8c4c] text-[#99cd92]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Course Progression</span>
              </button>
              <button
                onClick={() => setActiveTab('tutor')}
                className={`pb-2 px-1 border-b-2 transition-colors flex items-center gap-1.5 ${
                  activeTab === 'tutor'
                    ? 'border-[#4f8c4c] text-[#99cd92]'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>AI Tutor Assistant</span>
              </button>
            </div>

            {/* Tab: Downloadable Materials */}
            {activeTab === 'lessons' && (
              <div className="mt-4 bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-bold flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-[#4f8c4c]" />
                  Downloadable Lesson Materials & Quick Cards
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <div>
                      <div className="font-semibold text-gray-200">
                        Zealosh ASP Formula Sheet & Quick Reference Card
                      </div>
                      <div className="text-[11px] text-gray-400">PDF • 1.2 MB</div>
                    </div>
                    <button
                      onClick={() => alert('Downloading official Zealosh formula reference card...')}
                      className="p-2 text-gray-400 hover:text-white"
                      title="Download File"
                    >
                      <Download className="w-4 h-4 text-[#4f8c4c]" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/5">
                    <div>
                      <div className="font-semibold text-gray-200">
                        Module 1 Study Notes & Problem Set Solutions
                      </div>
                      <div className="text-[11px] text-gray-400">PDF • 3.4 MB</div>
                    </div>
                    <button
                      onClick={() => alert('Downloading study notes...')}
                      className="p-2 text-gray-400 hover:text-white"
                      title="Download File"
                    >
                      <Download className="w-4 h-4 text-[#4f8c4c]" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Assignments & Projects */}
            {activeTab === 'assignments' && (
              <div className="mt-4 space-y-6">
                {assignments.length === 0 ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-xs text-gray-400">
                    No assignments posted for this course yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Assignment Selector */}
                    <div className="md:col-span-5 space-y-3">
                      {assignments.map((asg) => (
                        <div
                          key={asg.id}
                          onClick={() => setSelectedAssignment(asg)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all ${
                            selectedAssignment?.id === asg.id
                              ? 'bg-[#f1f8f0] border-[#4f8c4c] shadow-md text-slate-900'
                              : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold uppercase text-[#99cd92]">
                              Max Score: {asg.maxScore} Pts
                            </span>
                            {asg.submission ? (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  asg.submission.status === 'GRADED'
                                    ? 'bg-green-900/60 text-green-300'
                                    : 'bg-amber-900/60 text-amber-300'
                                }`}
                              >
                                {asg.submission.status}
                              </span>
                            ) : (
                              <span className="text-[10px] text-gray-400 font-semibold">
                                Pending Submission
                              </span>
                            )}
                          </div>
                          <h4 className="font-bold text-sm text-white mb-1">
                            {asg.title}
                          </h4>
                          <p className="text-[11px] text-gray-400 line-clamp-2 mb-2">
                            {asg.description}
                          </p>
                          <div className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#4f8c4c]" />
                            <span>Due: {new Date(asg.dueDate).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Selected Assignment Details & Submission Box */}
                    <div className="md:col-span-7 bg-white rounded-xl border border-[#e2efe1] p-6 space-y-5 text-slate-800 shadow-sm">
                      {selectedAssignment ? (
                        <>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-bold text-base text-white">
                                {selectedAssignment.title}
                              </h3>
                              <span className="text-xs bg-[#4f8c4c]/20 text-[#99cd92] font-bold px-2.5 py-1 rounded">
                                Due: {new Date(selectedAssignment.dueDate).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-xs text-gray-300">
                              {selectedAssignment.description}
                            </p>
                            {selectedAssignment.instructionsHtml && (
                              <div
                                className="mt-3 p-3 rounded-lg bg-black/20 border border-white/5 text-xs text-gray-300"
                                dangerouslySetInnerHTML={{ __html: selectedAssignment.instructionsHtml }}
                              />
                            )}
                          </div>

                          {/* Rubric Criteria Breakdown */}
                          {selectedAssignment.rubric && (
                            <div className="p-4 rounded-lg bg-white/5 border border-white/10 space-y-2">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Award className="w-4 h-4 text-[#4f8c4c]" />
                                <span>Grading Rubric Criteria</span>
                              </div>
                              <div className="divide-y divide-white/5">
                                {selectedAssignment.rubric.criteria?.map((crit: any) => (
                                  <div key={crit.id} className="py-2 flex items-center justify-between text-xs">
                                    <div>
                                      <div className="font-semibold text-gray-200">{crit.title}</div>
                                      <div className="text-[11px] text-gray-400">{crit.description}</div>
                                    </div>
                                    <span className="font-bold text-[#99cd92] shrink-0 ml-4">
                                      {crit.maxPoints} pts
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Existing Submission Status / Form */}
                          {selectedAssignment.submission ? (
                            <div className="p-4 rounded-lg bg-green-950/40 border border-green-800/40 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-green-300 flex items-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                                  <span>Submission Status: {selectedAssignment.submission.status}</span>
                                </span>
                                {selectedAssignment.submission.score !== undefined && (
                                  <span className="text-sm font-extrabold text-[#99cd92]">
                                    Score: {selectedAssignment.submission.score} / {selectedAssignment.maxScore}
                                  </span>
                                )}
                              </div>

                              {selectedAssignment.submission.feedback && (
                                <div className="text-xs bg-black/30 p-3 rounded border border-white/5 text-gray-200">
                                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">
                                    Instructor Feedback:
                                  </div>
                                  <p>{selectedAssignment.submission.feedback}</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <form onSubmit={handleAssignmentSubmit} className="space-y-4 pt-2">
                              <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1">
                                  Solution Notes & Summary
                                </label>
                                <textarea
                                  rows={4}
                                  value={submissionText}
                                  onChange={(e) => setSubmissionText(e.target.value)}
                                  placeholder="Summarize your engineering calculations and findings..."
                                  className="w-full bg-black/30 border border-gray-600 rounded-lg p-3 text-xs text-white focus:outline-none focus:border-[#4f8c4c]"
                                  required
                                />
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-gray-300 mb-1">
                                  Attached Document / PDF Link
                                </label>
                                <input
                                  type="text"
                                  value={attachmentUrl}
                                  onChange={(e) => setAttachmentUrl(e.target.value)}
                                  placeholder="e.g. /uploads/ventilation-report.pdf"
                                  className="w-full bg-black/30 border border-gray-600 rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-[#4f8c4c]"
                                />
                              </div>

                              {submissionFeedback && (
                                <div className="text-xs p-2.5 rounded bg-blue-900/40 text-blue-200 border border-blue-700/50">
                                  {submissionFeedback}
                                </div>
                              )}

                              <button
                                type="submit"
                                disabled={submitting}
                                className="btn-primary text-xs py-2.5 px-5 bg-[#4f8c4c] hover:bg-[#3a7536] flex items-center gap-1.5 shadow"
                              >
                                <Send className="w-4 h-4" />
                                <span>{submitting ? 'Submitting...' : 'Submit Solution for Evaluation'}</span>
                              </button>
                            </form>
                          )}
                        </>
                      ) : (
                        <p className="text-xs text-gray-400">Select an assignment to inspect instructions and submit coursework.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Class Recordings */}
            {activeTab === 'recordings' && (
              <div className="mt-4 space-y-4">
                {/* Header with Title and Refresh button */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2 text-white">
                      <Video className="w-4 h-4 text-[#4f8c4c]" />
                      <span>Interactive Class Recordings & Replays</span>
                    </h3>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Archived live workshops, doubt discussions, and exam review sessions for this course cohort.
                    </p>
                  </div>
                  <button
                    onClick={() => fetchRecordings(course?.id || params.courseId || 'asp-examination-prep')}
                    disabled={recordingsLoading}
                    className="flex items-center gap-1.5 text-[11px] text-[#99cd92] hover:text-white bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/10 transition-colors"
                  >
                    <RefreshCw className={`w-3 h-3 ${recordingsLoading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Loading State */}
                {recordingsLoading && (
                  <div className="py-12 text-center bg-white/5 border border-white/10 rounded-xl">
                    <div className="animate-spin w-6 h-6 border-2 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
                    <p className="text-gray-400 text-xs mt-2">Loading authorized class recordings...</p>
                  </div>
                )}

                {/* Error State */}
                {!recordingsLoading && recordingsError && (
                  <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 text-xs">
                      <p className="font-semibold text-red-300">Recording Access Notice</p>
                      <p className="text-red-200/80 mt-0.5">{recordingsError}</p>
                    </div>
                  </div>
                )}

                {/* Empty State: Not Enrolled */}
                {!recordingsLoading && !recordingsError && recordingEntitlement === 'NOT_ENROLLED' && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-xs text-gray-400">
                    <ShieldAlert className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
                    <p className="font-semibold text-gray-200">Cohort Enrollment Required</p>
                    <p className="mt-1 max-w-md mx-auto text-gray-400">
                      You do not have an active cohort enrollment in this course to access live recordings.
                    </p>
                  </div>
                )}

                {/* Empty State: Enrollment Expired */}
                {!recordingsLoading && !recordingsError && recordingEntitlement === 'ENROLLMENT_EXPIRED' && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-xs text-gray-400">
                    <Clock className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
                    <p className="font-semibold text-gray-200">Enrollment Window Expired</p>
                    <p className="mt-1 max-w-md mx-auto text-gray-400">
                      Your access period for this course cohort has concluded. Contact support to renew access.
                    </p>
                  </div>
                )}

                {/* Empty State: Enrolled but no recordings */}
                {!recordingsLoading && !recordingsError && (recordingEntitlement === 'ENROLLED' || recordingEntitlement === 'STAFF_AUTHORIZED') && recordings.length === 0 && (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-8 text-center text-xs text-gray-400">
                    <Video className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="font-semibold text-gray-200">No Class Recordings Published Yet</p>
                    <p className="mt-1 max-w-md mx-auto text-gray-400">
                      Live sessions will appear here once recordings are published and processed for your cohort.
                    </p>
                  </div>
                )}

                {/* Recordings Grid */}
                {!recordingsLoading && !recordingsError && recordings.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {recordings.map((rec: any) => (
                      <div
                        key={rec.id}
                        className="p-4 rounded-xl bg-white border border-[#e2efe1] hover:border-[#4f8c4c] transition-all flex flex-col justify-between shadow-xs text-slate-800"
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                rec.lifecycleState === 'READY'
                                  ? 'bg-green-900/60 text-green-300'
                                  : rec.lifecycleState === 'PROCESSING'
                                  ? 'bg-amber-900/60 text-amber-300'
                                  : 'bg-gray-800 text-gray-400'
                              }`}
                            >
                              {rec.lifecycleState === 'READY'
                                ? 'AVAILABLE'
                                : rec.lifecycleState === 'PROCESSING'
                                ? 'PROCESSING'
                                : 'UNAVAILABLE'}
                            </span>
                            {rec.isCrossBatchGrant && (
                              <span className="text-[10px] bg-blue-900/40 text-blue-300 font-semibold px-2 py-0.5 rounded border border-blue-700/40">
                                Cross-Cohort Access
                              </span>
                            )}
                            <span className="text-[10px] text-gray-400 flex items-center gap-1 ml-auto">
                              <Clock className="w-3 h-3 text-[#4f8c4c]" />
                              <span>{Math.round((rec.durationSeconds || 0) / 60)} min</span>
                            </span>
                          </div>

                          <h4 className="font-bold text-sm text-white mb-1 line-clamp-1">
                            {rec.title}
                          </h4>
                          {rec.description && (
                            <p className="text-[11px] text-gray-300 line-clamp-2 mb-3">
                              {rec.description}
                            </p>
                          )}

                          <div className="text-[10px] text-gray-400 space-y-0.5 mb-4">
                            {rec.sessionTitle && <div>Session: {rec.sessionTitle}</div>}
                            {rec.batchName && <div>Cohort: {rec.batchName}</div>}
                            {rec.availableFrom && (
                              <div>Published: {new Date(rec.availableFrom).toLocaleDateString()}</div>
                            )}
                          </div>
                        </div>

                        <div>
                          {rec.canPlay && rec.playbackUrl ? (
                            <Link
                              href={rec.playbackUrl}
                              className="w-full btn-primary text-xs py-2 px-3 bg-[#4f8c4c] hover:bg-[#3a7536] flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-all shadow"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>Watch Class Recording</span>
                            </Link>
                          ) : rec.lifecycleState === 'PROCESSING' ? (
                            <div className="w-full text-center text-xs py-2 px-3 bg-amber-900/20 text-amber-300/80 rounded-lg border border-amber-800/30 flex items-center justify-center gap-1.5 font-medium cursor-not-allowed">
                              <Clock className="w-3.5 h-3.5 animate-pulse" />
                              <span>Replay In Processing</span>
                            </div>
                          ) : (
                            <div className="w-full text-center text-xs py-2 px-3 bg-white/5 text-gray-500 rounded-lg border border-white/5 flex items-center justify-center gap-1.5 font-medium cursor-not-allowed">
                              <Lock className="w-3.5 h-3.5" />
                              <span>Recording Unavailable</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Course Progression */}
            {activeTab === 'progression' && (
              <div className="mt-4 space-y-6">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-[#4f8c4c]" />
                        <span>Curriculum Progression & Exam Eligibility</span>
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Verified student syllabus completion records across modules, topics, and practical coursework.
                      </p>
                    </div>

                    <div>
                      {progression?.isCourseEligibleForCompletion ? (
                        <div className="bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 shadow-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Certification Exam Eligible</span>
                        </div>
                      ) : (
                        <div className="bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 px-3 py-1.5 rounded-full text-xs flex items-center gap-1.5 shadow-xs">
                          <Lock className="w-4 h-4 text-amber-400" />
                          <span>Exam Locked: Requires 80%+ Syllabus Completion</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Overall Metric Bars */}
                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-xs font-semibold text-gray-300">
                      <span>Overall Syllabus Completion</span>
                      <span>{progression?.progressPercent ?? progressPercent}%</span>
                    </div>
                    <div className="w-full bg-black/40 rounded-full h-3 overflow-hidden border border-white/10">
                      <div
                        className="bg-gradient-to-r from-[#4f8c4c] to-[#2ea033] h-full transition-all duration-500"
                        style={{ width: `${progression?.progressPercent ?? progressPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-400">
                      <span>Completed Lessons: {progression?.completedLessonsCount ?? completedLessonIds.length} / {progression?.totalLessonsCount ?? course?.lessons?.length ?? 3}</span>
                      <span>Minimum Exam Threshold: 80%</span>
                    </div>
                  </div>

                  {/* Modules Breakdown */}
                  {progressionLoading ? (
                    <div className="py-8 text-center text-xs text-gray-400">Loading verified progression breakdown...</div>
                  ) : progression?.modules && progression.modules.length > 0 ? (
                    <div className="space-y-4">
                      {progression.modules.map((mod) => (
                        <div key={mod.moduleId} className="p-4 rounded-lg bg-black/30 border border-white/10 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-white">{mod.title}</span>
                            <span className="text-xs font-bold text-[#99cd92]">
                              {mod.isCompleted ? 'Completed ✓' : `${mod.completedTopics}/${mod.totalTopics} Topics Completed`}
                            </span>
                          </div>

                          <div className="space-y-2 pt-2 border-t border-white/5">
                            {mod.topics?.map((top) => (
                              <div key={top.topicId} className="space-y-1.5">
                                <div className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                                  <span>{top.title}</span>
                                  <span className="text-[10px] text-gray-500">({top.completedLessons}/{top.totalLessons})</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-2">
                                  {top.lessons?.map((les) => (
                                    <div key={les.lessonId} className="text-xs flex items-center gap-2 p-1.5 rounded bg-white/5 text-gray-200">
                                      {les.isCompleted ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      ) : (
                                        <Circle className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                                      )}
                                      <span className="truncate">{les.title}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">Progression details will update as coursework is completed.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Course-Grounded AI Tutor */}
            {activeTab === 'tutor' && (
              <div className="mt-4 space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-emerald-400" />
                      <span>Zealosh AI Curriculum Assistant</span>
                    </h3>
                    <p className="text-xs text-gray-300 mt-1">
                      Ask questions grounded strictly to your verified syllabus modules, lecture recordings, and approved reading materials.
                    </p>
                  </div>

                  {/* Staging-Gate & ADR-003 Compliance Notice */}
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-xs text-emerald-200/90 flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-emerald-100">Course-Grounded Context & Integrity Firewall:</span>
                      <span>Answers are drawn directly from verified syllabus excerpts. Raw exam answer keys are strictly isolated, and active certification examinations trigger an automatic lockout (ADR-003).</span>
                    </div>
                  </div>

                  {tutorError && (
                    <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-200 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                      <span>{tutorError}</span>
                    </div>
                  )}

                  {/* Quick Question Prompts */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-[11px] text-gray-400 self-center">Try asking:</span>
                    {[
                      'Explain OSHA local exhaust ventilation principles',
                      'What are the core containment steps for chemical hazards?',
                      'Summarize workplace TLV and PEL exposure limits',
                    ].map((prompt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleSendTutorQuery(prompt)}
                        className="text-[11px] bg-white/10 hover:bg-white/20 text-gray-200 px-2.5 py-1 rounded-full border border-white/10 transition-colors"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>

                  {/* Conversation History */}
                  <div className="space-y-3 max-h-96 overflow-y-auto p-4 rounded-xl bg-black/40 border border-white/10">
                    {tutorHistory.length === 0 ? (
                      <div className="text-center py-8 text-xs text-gray-400">
                        No queries sent yet. Ask a question about your course materials above.
                      </div>
                    ) : (
                      tutorHistory.map((msg, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg text-xs space-y-2 ${
                            msg.role === 'user'
                              ? 'bg-[#3a7536]/30 border border-[#4f8c4c]/40 text-white ml-8'
                              : 'bg-white/10 border border-white/15 text-gray-200 mr-8'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[10px] text-gray-400">
                            <span className="font-bold uppercase tracking-wider text-emerald-400">
                              {msg.role === 'user' ? 'Candidate Query' : 'Zealosh AI Assistant'}
                            </span>
                            <span>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>

                          {/* Source Citations */}
                          {msg.citations && msg.citations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10 text-[11px] space-y-1">
                              <span className="font-semibold text-emerald-300 block">
                                Grounding Citations from Course Syllabus:
                              </span>
                              <div className="space-y-1 pl-1">
                                {msg.citations.map((c: any, cIdx: number) => (
                                  <div key={cIdx} className="text-gray-300 bg-black/30 p-1.5 rounded border border-white/5">
                                    <span className="text-emerald-400 font-medium">[{c.moduleTitle} &gt; {c.lessonTitle || c.materialName}]:</span> {c.excerpt}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                    {tutorLoading && (
                      <div className="p-3 bg-white/10 rounded-lg text-xs text-gray-300 animate-pulse flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                        <span>Grounding curriculum context from course syllabus...</span>
                      </div>
                    )}
                  </div>

                  {/* Input Form */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendTutorQuery();
                    }}
                    className="flex gap-2"
                  >
                    <input
                      type="text"
                      value={tutorQuery}
                      onChange={(e) => setTutorQuery(e.target.value)}
                      placeholder="Ask a question about this course's syllabus, ventilation formulas, safety protocols..."
                      className="flex-1 bg-black/40 border border-white/20 rounded-lg px-4 py-2.5 text-xs text-white placeholder-gray-400 focus:outline-hidden focus:border-[#4f8c4c]"
                    />
                    <button
                      type="submit"
                      disabled={tutorLoading || !tutorQuery.trim()}
                      className="btn-primary bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Ask AI</span>
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Lesson Curriculum Sidebar */}
        <div className="w-full lg:w-96 bg-[#1e481c] border-t lg:border-t-0 lg:border-l border-emerald-900 flex flex-col shrink-0 text-white">
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white">Course Syllabus</h3>
            <span className="text-xs text-gray-400">
              {completedLessonIds.length} / {course?.lessons?.length || 3} Completed
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-700/60">
            {course?.lessons?.map((lesson: any) => {
              const isActive = activeLesson?.id === lesson.id;
              const isCompleted = completedLessonIds.includes(lesson.id);

              return (
                <div
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  className={`p-4 cursor-pointer transition-colors flex items-start gap-3 ${
                    isActive ? 'bg-[#3a7536]/30 border-l-4 border-[#4f8c4c]' : 'hover:bg-white/5'
                  }`}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLessonComplete(lesson.id);
                    }}
                    className="mt-0.5 text-gray-400 hover:text-[#4f8c4c]"
                  >
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-[#4f8c4c]" />
                    ) : (
                      <Circle className="w-4 h-4 text-gray-500" />
                    )}
                  </button>

                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white">
                      {lesson.title}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Video className="w-3 h-3" />
                        {lesson.durationMinutes}m
                      </span>
                      <span>•</span>
                      <span>{lesson.moduleTitle}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
