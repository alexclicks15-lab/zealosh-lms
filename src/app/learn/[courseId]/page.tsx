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
  AlertCircle
} from 'lucide-react';
import WatermarkOverlay from '@/components/WatermarkOverlay';
import { Assignment, AssignmentSubmission } from '@/types';

export default function LearnPlayerPage({ params }: { params: { courseId: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [activeLesson, setActiveLesson] = useState<any>(null);
  const [completedLessonIds, setCompletedLessonIds] = useState<string[]>([]);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'lessons' | 'assignments' | 'materials'>('lessons');
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<any>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    <div className="min-h-screen bg-[#1a1f2e] text-white flex flex-col">
      {/* Player Header */}
      <div className="bg-[#252c41] px-4 sm:px-8 py-3 flex items-center justify-between border-b border-gray-700">
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
                              ? 'bg-[#252c41] border-[#4f8c4c] shadow-md'
                              : 'bg-white/5 border-white/10 hover:bg-white/10'
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
                    <div className="md:col-span-7 bg-[#252c41] rounded-xl border border-gray-700 p-6 space-y-5">
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
          </div>
        </div>

        {/* Lesson Curriculum Sidebar */}
        <div className="w-full lg:w-96 bg-[#252c41] border-t lg:border-t-0 lg:border-l border-gray-700 flex flex-col shrink-0">
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
