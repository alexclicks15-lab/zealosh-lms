'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Calendar, 
  Video, 
  BookOpen, 
  CheckCircle2, 
  Plus, 
  Award,
  Clock,
  ArrowRight,
  FileText,
  CheckCircle,
  AlertCircle,
  Send,
  Sliders,
  Filter,
  Bookmark,
  HelpCircle,
  Lock,
  Download,
  ExternalLink
} from 'lucide-react';
import { Batch, Assignment, AssignmentSubmission, ClassRecording } from '@/types';


export default function InstructorDashboard() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [user, setUser] = useState<any>(null);
  const [roster, setRoster] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'batches' | 'grading' | 'schedule' | 'recordings'>('batches');

  
  // Grading State
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [gradingScore, setGradingScore] = useState<number>(85);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({});
  const [gradingSubmitting, setGradingSubmitting] = useState(false);
  const [gradeSuccess, setGradeSuccess] = useState<string | null>(null);

  // New Live Session Schedule State
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionBatchId, setNewSessionBatchId] = useState('');
  const [newSessionDate, setNewSessionDate] = useState('');
  const [schedulingRecurring, setSchedulingRecurring] = useState(false);
  const [scheduleSuccess, setScheduleSuccess] = useState<string | null>(null);

  // Recordings & Doubts State
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [newHlTitle, setNewHlTitle] = useState('');
  const [newHlStart, setNewHlStart] = useState('');
  const [newHlEnd, setNewHlEnd] = useState('');
  const [newHlDesc, setNewHlDesc] = useState('');
  const [newResTitle, setNewResTitle] = useState('');
  const [newResType, setNewResType] = useState<'PDF' | 'SLIDES' | 'URL' | 'CODE' | 'NOTES'>('PDF');
  const [newResUrl, setNewResUrl] = useState('');
  const [activeDoubtId, setActiveDoubtId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [answerRefUrl, setAnswerRefUrl] = useState('');
  const [recordingSuccess, setRecordingSuccess] = useState<string | null>(null);


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
          // Fetch courses to get batches
          fetch('/api/courses')
            .then((r) => r.json())
            .then((cData) => {
              const allBatches: Batch[] = [];
              cData.courses?.forEach((c: any) => {
                if (c.upcomingBatches) allBatches.push(...c.upcomingBatches);
              });
              setBatches(allBatches);
              if (allBatches.length > 0) {
                setNewSessionBatchId(allBatches[0].id);
              }
              setLoading(false);
            });

          // Fetch real cohort enrollments for roster
          fetch('/api/admin/enrollments')
            .then((r) => (r.ok ? r.json() : null))
            .then((enrData) => {
              if (enrData?.enrollments) {
                setRoster(enrData.enrollments);
              }
            })
            .catch(() => {});

          // Fetch assignments and student submissions
          fetch('/api/assignments')
            .then((r) => (r.ok ? r.json() : null))
            .then((asgData) => {
              if (asgData?.assignments) {
                setAssignments(asgData.assignments);
                // Also fetch first assignment's submissions for grading
                if (asgData.assignments.length > 0) {
                  fetch(`/api/assignments/${asgData.assignments[0].id}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then((detail) => {
                      if (detail?.submissions?.length > 0) {
                        setSelectedSubmission(detail.submissions[0]);
                        setGradingScore(detail.submissions[0].score || 85);
                        setGradingFeedback(detail.submissions[0].feedback || '');
                      }
                    });
                }
              }
            })
            .catch(() => {});
          // Fetch recordings
          fetch('/api/recordings')
            .then((r) => (r.ok ? r.json() : null))
            .then((recData) => {
              if (recData?.recordings) {
                setRecordings(recData.recordings);
                if (recData.recordings.length > 0) {
                  fetch(`/api/recordings/${recData.recordings[0].id}`)
                    .then((r) => (r.ok ? r.json() : null))
                    .then((detail) => {
                      if (detail?.recording) setSelectedRecording(detail.recording);
                    });
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));

  }, [router]);

  const handleLaunchLiveAsModerator = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/live/${sessionId}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.joinUrl) {
        router.push(data.joinUrl);
      } else {
        alert(data.error || 'Failed to launch live classroom');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSelectSubmissionForGrading = (sub: any) => {
    setSelectedSubmission(sub);
    setGradingScore(sub.score !== undefined ? sub.score : 85);
    setGradingFeedback(sub.feedback || '');
    setGradeSuccess(null);
  };

  const handleGradeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubmission) return;

    setGradingSubmitting(true);
    setGradeSuccess(null);

    try {
      const res = await fetch(`/api/assignments/${selectedSubmission.assignmentId}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          submissionId: selectedSubmission.id,
          score: Number(gradingScore),
          feedback: gradingFeedback,
          rubricScores: Object.entries(rubricScores).map(([criterionId, score]) => ({
            criterionId,
            score,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit grade');
      }

      setGradeSuccess('Grade and rubric evaluation saved successfully!');
      setSelectedSubmission({ ...selectedSubmission, ...data.submission });
    } catch (err: any) {
      alert(err.message);
    } finally {
      setGradingSubmitting(false);
    }
  };

  const handleCreateLiveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionBatchId || !newSessionTitle) return;

    try {
      const payload: any = {
        session: {
          batchId: newSessionBatchId,
          title: newSessionTitle,
          scheduledStartTime: newSessionDate || new Date(Date.now() + 86400000).toISOString(),
          durationMinutes: 120,
        },
      };

      if (schedulingRecurring) {
        payload.recurringRule = {
          daysOfWeek: [0, 6], // Weekend schedule
          startTime: '19:00',
          durationMinutes: 120,
          timeZone: 'Asia/Kolkata',
        };
        payload.count = 4;
      }

      const res = await fetch('/api/live', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Scheduling failed');
      }

      setScheduleSuccess(
        schedulingRecurring
          ? `Successfully scheduled 4 recurring workshop sessions for batch!`
          : `Session "${newSessionTitle}" scheduled successfully!`
      );
      setNewSessionTitle('');
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading instructor portal...</p>
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#252c41] to-[#3a7536] text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold text-[#99cd92] uppercase tracking-wider mb-1">
              Instructor Operations Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {user?.name || 'Lead Mentor'}
            </h1>
            <p className="text-sm text-gray-200 mt-1 max-w-xl">
              Moderate live WebRTC classrooms, evaluate student coursework against rubrics, and track cohort completion milestones.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLaunchLiveAsModerator('sess-asp-01')}
              className="btn-primary bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold py-2.5 px-5 shadow flex items-center gap-2"
            >
              <Video className="w-4 h-4" />
              <span>Launch Live Room as Host</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-3 border-b border-gray-200 mb-8 pb-1">
        <button
          onClick={() => setActiveTab('batches')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'batches'
              ? 'border-[#4f8c4c] text-[#3a7536]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Assigned Batches ({batches.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('grading')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'grading'
              ? 'border-[#4f8c4c] text-[#3a7536]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Assignment Grading Queue</span>
        </button>

        <button
          onClick={() => setActiveTab('schedule')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'schedule'
              ? 'border-[#4f8c4c] text-[#3a7536]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Plus className="w-4 h-4" />
          <span>Schedule Live Sessions</span>
        </button>

        <button
          onClick={() => setActiveTab('recordings')}
          className={`pb-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'recordings'
              ? 'border-[#4f8c4c] text-[#3a7536]'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Recordings & Doubts ({recordings.length})</span>
        </button>
      </div>


      {/* Tab: Assigned Batches & Student Roster */}
      {activeTab === 'batches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Batches List */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#4f8c4c]" />
                Assigned Cohort Batches
              </h2>
              <span className="text-xs text-gray-500 font-semibold">
                {batches.length} Active Batches
              </span>
            </div>

            <div className="space-y-4">
              {batches.map((batch) => (
                <div
                  key={batch.id}
                  className="card-elevated p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="badge-navy text-[10px]">
                        {batch.status}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        Starts: {new Date(batch.startDate).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-[#252c41]">
                      {batch.name}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {batch.scheduleDescription}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-gray-600 pt-2">
                      <span className="flex items-center gap-1 font-semibold text-gray-800">
                        <Users className="w-3.5 h-3.5 text-[#4f8c4c]" />
                        {batch.enrolledCount} / {batch.capacity} Students Enrolled
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleLaunchLiveAsModerator('sess-asp-01')}
                      className="btn-outline text-xs py-2 px-4 w-full sm:w-auto flex items-center gap-1.5"
                    >
                      <Video className="w-3.5 h-3.5 text-[#4f8c4c]" />
                      <span>Host Session</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Sidebar: Dynamic Student Roster */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
              <h3 className="font-bold text-base text-[#252c41] mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4f8c4c]" />
                Enrolled Cohort Roster ({roster.length})
              </h3>

              <div className="space-y-3 text-xs">
                {roster.length === 0 ? (
                  <p className="text-gray-400 text-xs">No students enrolled yet.</p>
                ) : (
                  roster.map((student) => (
                    <div
                      key={student.id}
                      className="p-3 rounded-lg border border-[#eaedf5] flex items-center justify-between"
                    >
                      <div>
                        <div className="font-bold text-[#252c41]">
                          {student.studentName || 'Learner'}
                        </div>
                        <div className="text-[11px] text-gray-500">
                          {student.courseTitle} • {student.progressPercent || 0}% Completed
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          student.status === 'ACTIVE'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {student.status}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Assignment Grading Queue */}
      {activeTab === 'grading' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Submissions List */}
          <div className="lg:col-span-5 space-y-4">
            <h3 className="font-bold text-base text-[#252c41] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#4f8c4c]" />
              Submitted Coursework
            </h3>

            {selectedSubmission ? (
              <div
                onClick={() => handleSelectSubmissionForGrading(selectedSubmission)}
                className="p-4 rounded-xl border border-[#4f8c4c] bg-green-50/30 cursor-pointer shadow-xs"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm text-[#252c41]">
                    {selectedSubmission.studentName || 'Arjun Menon'}
                  </span>
                  <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
                    {selectedSubmission.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  ASP Industrial Hygiene & Ventilation Report
                </div>
                <div className="text-xs text-gray-700 line-clamp-2">
                  {selectedSubmission.submissionText}
                </div>
                {selectedSubmission.score !== undefined && (
                  <div className="mt-2 text-xs font-bold text-[#3a7536]">
                    Score: {selectedSubmission.score} / 100
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">No student submissions in queue.</p>
            )}
          </div>

          {/* Grading Evaluation Panel */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
            {selectedSubmission ? (
              <form onSubmit={handleGradeSubmit} className="space-y-5">
                <div className="border-b border-gray-100 pb-4">
                  <div className="text-xs font-bold uppercase text-[#4f8c4c] mb-1">
                    Grading Evaluation Form
                  </div>
                  <h3 className="font-bold text-lg text-[#252c41]">
                    Student: {selectedSubmission.studentName || 'Arjun Menon'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Submitted: {new Date(selectedSubmission.submittedAt).toLocaleString()}
                  </p>
                </div>

                {/* Student's Submission Notes & Attachment */}
                <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-2">
                  <span className="font-bold text-gray-700 block">Student Submission Content:</span>
                  <p className="text-gray-800 leading-relaxed">{selectedSubmission.submissionText}</p>
                  {selectedSubmission.attachmentUrl && (
                    <div className="pt-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#4f8c4c]" />
                      <span className="font-mono text-gray-600">{selectedSubmission.attachmentFilename || 'report.pdf'}</span>
                    </div>
                  )}
                </div>

                {/* Rubric Evaluation Sliders */}
                <div className="space-y-4 pt-2">
                  <h4 className="font-bold text-xs uppercase text-gray-500 tracking-wider">
                    Rubric Scoring Criteria
                  </h4>

                  <div className="space-y-3">
                    <div className="p-3 rounded-lg border border-gray-100 bg-white">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-800">Ventilation & Airflow Calculations</span>
                        <span className="font-bold text-[#4f8c4c]">35 max pts</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="35"
                        defaultValue="34"
                        onChange={(e) => setRubricScores({ ...rubricScores, 'crit-1': Number(e.target.value) })}
                        className="w-full accent-[#4f8c4c]"
                      />
                    </div>

                    <div className="p-3 rounded-lg border border-gray-100 bg-white">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-800">TLV / PEL Exposure Margin</span>
                        <span className="font-bold text-[#4f8c4c]">35 max pts</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="35"
                        defaultValue="32"
                        onChange={(e) => setRubricScores({ ...rubricScores, 'crit-2': Number(e.target.value) })}
                        className="w-full accent-[#4f8c4c]"
                      />
                    </div>

                    <div className="p-3 rounded-lg border border-gray-100 bg-white">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-semibold text-gray-800">Duct Layout & Controls Design</span>
                        <span className="font-bold text-[#4f8c4c]">30 max pts</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="30"
                        defaultValue="26"
                        onChange={(e) => setRubricScores({ ...rubricScores, 'crit-3': Number(e.target.value) })}
                        className="w-full accent-[#4f8c4c]"
                      />
                    </div>
                  </div>
                </div>

                {/* Total Score & Feedback Input */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Total Grade Score (0 – 100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={gradingScore}
                      onChange={(e) => setGradingScore(Number(e.target.value))}
                      className="w-full input-field text-sm font-bold text-[#252c41]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Constructive Instructor Feedback
                  </label>
                  <textarea
                    rows={3}
                    value={gradingFeedback}
                    onChange={(e) => setGradingFeedback(e.target.value)}
                    placeholder="Provide constructive feedback explaining calculation nuances or praise..."
                    className="w-full input-field text-xs text-gray-800"
                    required
                  />
                </div>

                {gradeSuccess && (
                  <div className="p-3 rounded bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span>{gradeSuccess}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={gradingSubmitting}
                  className="btn-primary text-xs py-2.5 px-6 shadow"
                >
                  <Send className="w-4 h-4" />
                  <span>{gradingSubmitting ? 'Saving...' : 'Publish Evaluation & Feedback'}</span>
                </button>
              </form>
            ) : (
              <p className="text-xs text-gray-500">Select a submission from the queue to start grading.</p>
            )}
          </div>
        </div>
      )}

      {/* Tab: Schedule Live Sessions */}
      {activeTab === 'schedule' && (
        <div className="max-w-2xl bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
          <h3 className="font-bold text-lg text-[#252c41] mb-2 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#4f8c4c]" />
            Schedule Virtual Classroom Workshop
          </h3>
          <p className="text-xs text-gray-500 mb-6">
            Configure live BigBlueButton workshops for your assigned cohorts, with options for single classes or recurring weekend series.
          </p>

          <form onSubmit={handleCreateLiveSession} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Target Cohort Batch</label>
              <select
                value={newSessionBatchId}
                onChange={(e) => setNewSessionBatchId(e.target.value)}
                className="w-full input-field text-xs"
                required
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.enrolledCount} students)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Session Title</label>
              <input
                type="text"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="e.g. ASP Radiation Physics & Ventilation Problem Solving"
                className="w-full input-field text-xs"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Scheduled Start Date & Time</label>
              <input
                type="datetime-local"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                className="w-full input-field text-xs"
              />
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={schedulingRecurring}
                  onChange={(e) => setSchedulingRecurring(e.target.checked)}
                  className="rounded text-[#4f8c4c] focus:ring-[#4f8c4c]"
                />
                <span>Generate 4-Week Recurring Weekend Workshop Series (Sat & Sun)</span>
              </label>
            </div>

            {scheduleSuccess && (
              <div className="p-3 rounded bg-green-50 border border-green-200 text-xs text-green-700 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>{scheduleSuccess}</span>
              </div>
            )}

            <button type="submit" className="btn-primary text-xs py-2.5 px-6 shadow mt-2">
              <Video className="w-4 h-4" />
              <span>Schedule Live Classroom</span>
            </button>
          </form>
        </div>
      )}

      {/* Tab: Class Recordings, Highlights, Resources & Doubts */}
      {activeTab === 'recordings' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Recordings Selector & Highlights */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
              <h2 className="text-sm font-bold text-[#252c41] mb-3 flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#4f8c4c]" />
                Select Recorded Class
              </h2>

              <div className="space-y-2 mb-4">
                {recordings.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => {
                      fetch(`/api/recordings/${rec.id}`)
                        .then((r) => r.json())
                        .then((d) => d.recording && setSelectedRecording(d.recording));
                    }}
                    className={`w-full text-left p-3 rounded-lg border text-xs transition-colors flex items-center justify-between ${
                      selectedRecording?.id === rec.id
                        ? 'border-[#4f8c4c] bg-green-50/50 font-bold text-[#252c41]'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div>
                      <div className="text-sm font-bold">{rec.title}</div>
                      <div className="text-[10px] text-gray-500">
                        {rec.batchId} • {Math.round(rec.durationSeconds / 60)} Mins • {rec.status}
                      </div>
                    </div>
                    <Link
                      href={`/recordings/${rec.id}`}
                      className="text-[11px] text-[#4f8c4c] hover:underline flex items-center gap-1 font-semibold"
                    >
                      <span>Player</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </button>
                ))}
              </div>

              {selectedRecording && (
                <div className="pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">
                    Add Topic Highlight / Chapter Marker
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch(`/api/recordings/${selectedRecording.id}/highlights`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          title: newHlTitle,
                          startTimestampSeconds: Number(newHlStart),
                          endTimestampSeconds: Number(newHlEnd),
                          description: newHlDesc,
                        }),
                      });
                      const d = await res.json();
                      if (res.ok) {
                        setSelectedRecording({
                          ...selectedRecording,
                          highlights: [...(selectedRecording.highlights || []), d.highlight],
                        });
                        setNewHlTitle('');
                        setNewHlStart('');
                        setNewHlEnd('');
                        setNewHlDesc('');
                        setRecordingSuccess('Highlight chapter added!');
                        setTimeout(() => setRecordingSuccess(null), 3000);
                      } else {
                        alert(d.error);
                      }
                    }}
                    className="space-y-3 text-xs"
                  >
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Highlight Title</label>
                      <input
                        type="text"
                        value={newHlTitle}
                        onChange={(e) => setNewHlTitle(e.target.value)}
                        placeholder="e.g. Radiation Inverse Square Formula"
                        className="w-full p-2 border rounded-lg text-xs"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">Start (Seconds)</label>
                        <input
                          type="number"
                          value={newHlStart}
                          onChange={(e) => setNewHlStart(e.target.value)}
                          placeholder="e.g. 120"
                          className="w-full p-2 border rounded-lg text-xs"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-600 font-semibold mb-1">End (Seconds)</label>
                        <input
                          type="number"
                          value={newHlEnd}
                          onChange={(e) => setNewHlEnd(e.target.value)}
                          placeholder="e.g. 450"
                          className="w-full p-2 border rounded-lg text-xs"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-gray-600 font-semibold mb-1">Description / Revision Notes</label>
                      <input
                        type="text"
                        value={newHlDesc}
                        onChange={(e) => setNewHlDesc(e.target.value)}
                        placeholder="Key formulas and exam derivation tips..."
                        className="w-full p-2 border rounded-lg text-xs"
                      />
                    </div>
                    <button type="submit" className="btn-primary text-xs py-2 px-4 shadow">
                      <span>Add Highlight Marker</span>
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>

          {/* Right: Doubts Triage Queue */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
              <h2 className="text-sm font-bold text-[#252c41] mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-yellow-500" />
                  Student Doubts ({selectedRecording?.doubts?.length || 0})
                </span>
              </h2>

              {(!selectedRecording?.doubts || selectedRecording.doubts.length === 0) ? (
                <p className="text-xs text-gray-400 py-6 text-center">No student doubts pending for this class.</p>
              ) : (
                <div className="space-y-3">
                  {selectedRecording.doubts.map((dbt: any) => (
                    <div key={dbt.id} className="p-3 bg-gray-50 rounded-xl border border-gray-200 text-xs space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-gray-600 font-bold">
                          At {Math.floor(dbt.timestampSeconds / 60)}:{String(dbt.timestampSeconds % 60).padStart(2, '0')}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            dbt.status === 'RESOLVED' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {dbt.status}
                        </span>
                      </div>

                      <p className="text-gray-800 font-medium">{dbt.question}</p>

                      {dbt.answers && dbt.answers.length > 0 && (
                        <div className="bg-white p-2 rounded border border-gray-200 text-[11px] space-y-1">
                          {dbt.answers.map((a: any) => (
                            <div key={a.id}>
                              <span className="font-bold text-[#3a7536]">Your Answer: </span>
                              <span className="text-gray-700">{a.answerText}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Reply Form */}
                      {activeDoubtId === dbt.id ? (
                        <div className="space-y-2 pt-2 border-t border-gray-200">
                          <textarea
                            value={answerText}
                            onChange={(e) => setAnswerText(e.target.value)}
                            placeholder="Type instructor explanation..."
                            rows={2}
                            className="w-full p-2 border rounded text-xs bg-white resize-none"
                          />
                          <input
                            type="text"
                            value={answerRefUrl}
                            onChange={(e) => setAnswerRefUrl(e.target.value)}
                            placeholder="Optional reference URL (formula/slide link)..."
                            className="w-full p-1.5 border rounded text-xs bg-white"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                if (!answerText.trim()) return;
                                const res = await fetch(`/api/recordings/${selectedRecording.id}/doubts/${dbt.id}/answers`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ answerText, referenceUrl: answerRefUrl }),
                                });
                                const d = await res.json();
                                if (res.ok) {
                                  dbt.answers = [...(dbt.answers || []), d.answer];
                                  dbt.status = 'RESOLVED';
                                  setAnswerText('');
                                  setAnswerRefUrl('');
                                  setActiveDoubtId(null);
                                } else {
                                  alert(d.error);
                                }
                              }}
                              className="btn-primary text-[11px] py-1 px-3"
                            >
                              Send Answer
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveDoubtId(null)}
                              className="text-[11px] text-gray-500 hover:underline"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveDoubtId(dbt.id);
                            setAnswerText('');
                          }}
                          className="text-[11px] font-bold text-[#4f8c4c] hover:underline"
                        >
                          {dbt.answers?.length > 0 ? '+ Add Additional Explanation' : 'Reply & Resolve Doubt'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

