'use client';

import React, { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  BookOpen,
  Calendar,
  Clock,
  FileText,
  Video,
  Award,
  CheckCircle2,
  AlertCircle,
  Plus,
  Send,
  Download,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Pin,
  Trash2,
  ChevronRight,
  Filter,
  RefreshCw,
  Sliders,
  ShieldCheck,
  UserCheck,
  ChevronDown,
  PlayCircle,
  HelpCircle,
  ArrowRight,
  Users,
  CheckSquare,
  Layers,
  Lock,
  Unlock,
  Eye,
  FileCheck2,
  AlertTriangle,
} from 'lucide-react';
import {
  ClassroomAnnouncement,
  Assignment,
  AssignmentSubmission,
  RubricCriterion,
  AiReviewSuggestion,
  LearningMaterial,
  Quiz,
  ClassroomComment,
} from '@/types';
import { ZealoshLoader } from '@/components/ui/ZealoshLoader';

function ClassroomContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);

  // Cohort state
  const [availableCohorts, setAvailableCohorts] = useState<any[]>([]);
  const [selectedCohort, setSelectedCohort] = useState<any>(null);
  const [course, setCourse] = useState<any>(null);
  const [batch, setBatch] = useState<any>(null);
  const [effectiveDeliveryMode, setEffectiveDeliveryMode] = useState<'LIVE' | 'RECORDED' | 'HYBRID'>('HYBRID');

  // Active workspace tab
  const [activeTab, setActiveTab] = useState<'stream' | 'classwork' | 'live' | 'people' | 'calendar' | 'todo' | 'grades' | 'doubts' | 'messages'>('stream');

  // In-App Messaging State
  const [cohortMessages, setCohortMessages] = useState<any[]>([]);
  const [newMsgContent, setNewMsgContent] = useState('');
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Stream & Announcements
  const [announcements, setAnnouncements] = useState<ClassroomAnnouncement[]>([]);
  const [showAnnounceComposer, setShowAnnounceComposer] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementAttachmentUrl, setAnnouncementAttachmentUrl] = useState('');
  const [announcementIsPinned, setAnnouncementIsPinned] = useState(false);
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [commentInputMap, setCommentInputMap] = useState<Record<string, string>>({});
  const [submittingCommentId, setSubmittingCommentId] = useState<string | null>(null);

  // Classwork State
  const [assignments, setAssignments] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [classworkFilter, setClassworkFilter] = useState<'all' | 'modules' | 'materials' | 'assignments' | 'quizzes'>('all');
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false);
  const [newAsgTitle, setNewAsgTitle] = useState('');
  const [newAsgDesc, setNewAsgDesc] = useState('');
  const [newAsgDueDate, setNewAsgDueDate] = useState('');
  const [newAsgMaxScore, setNewAsgMaxScore] = useState(100);
  const [creatingAssignment, setCreatingAssignment] = useState(false);

  // Preloaded Live Material Release State
  const [releasingMaterialId, setReleasingMaterialId] = useState<string | null>(null);

  // Live Sessions (Zealosh VC)
  const [liveSessions, setLiveSessions] = useState<any[]>([]);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  // People State
  const [people, setPeople] = useState<{ teachers: any[]; students: any[] }>({ teachers: [], students: [] });

  // Academic Calendar State
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  const [calendarFilter, setCalendarFilter] = useState<'all' | 'live' | 'assignments' | 'quizzes'>('all');

  // To-Do (Student) / To-Review (Instructor) State
  const [todoTasks, setTodoTasks] = useState<{
    upcoming: any[];
    overdue: any[];
    completed: any[];
    needsGrading: any[];
    unansweredDoubts: any[];
  }>({ upcoming: [], overdue: [], completed: [], needsGrading: [], unansweredDoubts: [] });
  const [todoTab, setTodoTab] = useState<'upcoming' | 'overdue' | 'completed' | 'needsGrading' | 'unansweredDoubts'>('upcoming');

  // Student Assignment Submission Modal
  const [activeAssignmentModal, setActiveAssignmentModal] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [submittingAssignment, setSubmittingAssignment] = useState(false);
  const [submissionSuccessMsg, setSubmissionSuccessMsg] = useState<string | null>(null);

  // Instructor Grading State & Gradebook
  const [allSubmissions, setAllSubmissions] = useState<any[]>([]);
  const [gradingSubmission, setGradingSubmission] = useState<any | null>(null);
  const [gradingScore, setGradingScore] = useState<number>(85);
  const [gradingFeedback, setGradingFeedback] = useState<string>('');
  const [rubricScoresInput, setRubricScoresInput] = useState<Record<string, number>>({});
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [gradeSuccessMsg, setGradeSuccessMsg] = useState<string | null>(null);

  // Doubts State
  const [doubts, setDoubts] = useState<any[]>([]);
  const [doubtQuestion, setDoubtQuestion] = useState('');
  const [doubtIsPublic, setDoubtIsPublic] = useState(true);
  const [postingDoubt, setPostingDoubt] = useState(false);
  const [doubtReplyMap, setDoubtReplyMap] = useState<Record<string, string>>({});
  const [submittingDoubtReplyId, setSubmittingDoubtReplyId] = useState<string | null>(null);

  // Load Classroom Hub Data
  const loadClassroomData = useCallback(async (courseId?: string, batchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (courseId) queryParams.set('courseId', courseId);
      if (batchId) queryParams.set('batchId', batchId);

      const res = await fetch(`/api/classroom?${queryParams.toString()}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login');
          return;
        }
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to load classroom');
      }

      const data = await res.json();
      setUser(data.user);
      setAvailableCohorts(data.availableCohorts || []);
      setSelectedCohort(data.selectedCohort || null);
      setCourse(data.course || null);
      setBatch(data.batch || null);
      setEffectiveDeliveryMode(data.effectiveDeliveryMode || 'HYBRID');
      setAnnouncements(data.announcements || []);
      setAssignments(data.assignments || []);
      setMaterials(data.materials || []);
      setQuizzes(data.quizzes || []);
      setLiveSessions(data.liveSessions || []);
      setPeople(data.people || { teachers: [], students: [] });
      setCalendarEvents(data.calendarEvents || []);
      setTodoTasks(data.todoTasks || { upcoming: [], overdue: [], completed: [], needsGrading: [], unansweredDoubts: [] });
      setDoubts(data.doubts || []);
      setCohortMessages(data.messages || []);
      if (data.submissions) {
        setAllSubmissions(data.submissions);
      }
    } catch (err: any) {
      setError(err.message || 'Error connecting to classroom workspace');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const qCourse = searchParams.get('courseId') || undefined;
    const qBatch = searchParams.get('batchId') || undefined;
    const qTab = searchParams.get('tab') as any;
    if (qTab && ['stream', 'classwork', 'live', 'people', 'calendar', 'todo', 'grades', 'doubts', 'messages'].includes(qTab)) {
      setActiveTab(qTab);
    }
    loadClassroomData(qCourse, qBatch);
  }, [searchParams, loadClassroomData]);

  // Handle Send Direct/Cohort Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMsgContent.trim() || !course?.id) return;

    setSendingMsg(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: course.id,
          batchId: selectedCohort?.batchId,
          subject: newMsgSubject.trim() || undefined,
          content: newMsgContent.trim(),
        }),
      });
      if (res.ok) {
        setNewMsgSubject('');
        setNewMsgContent('');
        await loadClassroomData(course?.id, selectedCohort?.batchId);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to send message');
      }
    } catch {
      alert('Network error sending message');
    } finally {
      setSendingMsg(false);
    }
  };

  // Handle Cohort Change
  const handleCohortChange = (cohort: any) => {
    setSelectedCohort(cohort);
    loadClassroomData(cohort.courseId, cohort.batchId);
  };

  // Handle Join Live Classroom
  const handleJoinLive = async (sessionId: string) => {
    setJoinError(null);
    setJoiningSessionId(sessionId);
    try {
      const res = await fetch(`/api/live/${encodeURIComponent(sessionId)}/join`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.joinUrl) {
        router.push(data.joinUrl);
      } else {
        setJoinError(data.error || 'Unable to connect to Zealosh Live Classroom.');
      }
    } catch {
      setJoinError('Network error connecting to Zealosh Live Classroom.');
    } finally {
      setJoiningSessionId(null);
    }
  };

  // Handle Announcement Post
  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementTitle.trim() || !announcementContent.trim()) return;

    setPostingAnnouncement(true);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_announcement',
          courseId: course.id,
          batchId: selectedCohort?.batchId,
          title: announcementTitle.trim(),
          content: announcementContent.trim(),
          isPinned: announcementIsPinned,
          attachments: announcementAttachmentUrl.trim()
            ? [{ title: 'Resource Document', url: announcementAttachmentUrl.trim(), type: 'DOCUMENT' }]
            : [],
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to post announcement');
      }

      setAnnouncementTitle('');
      setAnnouncementContent('');
      setAnnouncementAttachmentUrl('');
      setAnnouncementIsPinned(false);
      setShowAnnounceComposer(false);
      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error posting announcement');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  // Handle Add Announcement Comment
  const handleAddComment = async (announcementId: string) => {
    const text = commentInputMap[announcementId]?.trim();
    if (!text) return;

    setSubmittingCommentId(announcementId);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_comment',
          announcementId,
          content: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to add comment');
      }

      setCommentInputMap((prev) => ({ ...prev, [announcementId]: '' }));
      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error posting comment');
    } finally {
      setSubmittingCommentId(null);
    }
  };

  // Handle Create Assignment
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgTitle.trim() || !newAsgDueDate) return;

    setCreatingAssignment(true);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_assignment',
          courseId: course.id,
          batchId: selectedCohort?.batchId,
          title: newAsgTitle.trim(),
          description: newAsgDesc.trim(),
          dueDate: new Date(newAsgDueDate).toISOString(),
          maxScore: newAsgMaxScore,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create assignment');
      }

      setShowCreateAssignmentModal(false);
      setNewAsgTitle('');
      setNewAsgDesc('');
      setNewAsgDueDate('');
      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error creating assignment');
    } finally {
      setCreatingAssignment(false);
    }
  };

  // Handle Assignment Submission
  const handleSubmitAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeAssignmentModal) return;

    setSubmittingAssignment(true);
    setSubmissionSuccessMsg(null);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_assignment',
          assignmentId: activeAssignmentModal.id,
          submissionText: submissionText.trim(),
          attachmentUrl: attachmentUrl.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Submission failed');
      }

      setSubmissionSuccessMsg('Your assignment work has been submitted successfully.');
      setTimeout(() => {
        setActiveAssignmentModal(null);
        setSubmissionSuccessMsg(null);
        setSubmissionText('');
        setAttachmentUrl('');
      }, 1500);

      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error submitting coursework');
    } finally {
      setSubmittingAssignment(false);
    }
  };

  // Handle 1-Click Material Release
  const handleReleaseMaterial = async (materialId: string) => {
    setReleasingMaterialId(materialId);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_material',
          materialId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to release material');
      }

      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error releasing material');
    } finally {
      setReleasingMaterialId(null);
    }
  };

  // Handle Instructor Grading
  const handleGradeSubmission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setSubmittingGrade(true);
    setGradeSuccessMsg(null);
    try {
      const rubricScores = gradingSubmission.assignment?.rubric?.criteria?.map((c: RubricCriterion) => ({
        criterionId: c.id,
        score: rubricScoresInput[c.id] || c.maxPoints,
      })) || [];

      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grade_submission',
          submissionId: gradingSubmission.id,
          score: gradingScore,
          feedback: gradingFeedback.trim(),
          rubricScores,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Grading failed');
      }

      setGradeSuccessMsg('Evaluation and feedback published to candidate.');
      setTimeout(() => {
        setGradingSubmission(null);
        setGradeSuccessMsg(null);
      }, 1200);

      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error publishing evaluation');
    } finally {
      setSubmittingGrade(false);
    }
  };

  // Handle Ask Academic Doubt
  const handlePostDoubt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doubtQuestion.trim()) return;

    setPostingDoubt(true);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask_doubt',
          courseId: course?.id,
          question: doubtQuestion.trim(),
          isPublic: doubtIsPublic,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit question');
      }

      setDoubtQuestion('');
      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error posting academic question');
    } finally {
      setPostingDoubt(false);
    }
  };

  // Handle Reply to Academic Doubt
  const handleReplyDoubt = async (doubtId: string) => {
    const text = doubtReplyMap[doubtId]?.trim();
    if (!text) return;

    setSubmittingDoubtReplyId(doubtId);
    try {
      const res = await fetch('/api/classroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reply_doubt',
          doubtId,
          answerText: text,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to submit response');
      }

      setDoubtReplyMap((prev) => ({ ...prev, [doubtId]: '' }));
      await loadClassroomData(course?.id, selectedCohort?.batchId);
    } catch (err: any) {
      alert(err.message || 'Error answering question');
    } finally {
      setSubmittingDoubtReplyId(null);
    }
  };

  const isInstructor = user?.role === 'INSTRUCTOR' || user?.role === 'SUPER_ADMIN' || user?.role === 'ORG_ADMIN';

  if (loading) {
    return <ZealoshLoader size="fullscreen" />;
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] p-6 max-w-4xl mx-auto flex flex-col justify-center">
        <div className="card-elevated p-8 text-center border-red-200 bg-red-50/50">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 mb-2">Classroom Access Error</h2>
          <p className="text-sm text-gray-600 mb-6">{error || 'No active course cohort selected or available.'}</p>
          <div className="flex justify-center gap-3">
            <button onClick={() => loadClassroomData()} className="btn-primary">
              <RefreshCw className="w-4 h-4" />
              <span>Retry Connection</span>
            </button>
            <Link href="/courses" className="btn-outline">
              Browse Course Catalog
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-16">
      {/* Institutional Classroom Header — Official Zealosh Green & White */}
      <div className="bg-gradient-to-r from-[#1e481c] via-[#245921] to-[#3a7536] text-white pt-8 pb-4 px-4 sm:px-6 lg:px-8 border-b border-emerald-900 shadow-sm">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="badge-green text-[10px] tracking-wide font-bold bg-white/90 text-[#245921]">
                  {effectiveDeliveryMode === 'LIVE' ? 'ONLINE / LIVE COHORT' : effectiveDeliveryMode === 'RECORDED' ? 'PRERECORDED MASTERCLASS' : 'HYBRID DUAL-TRACK'}
                </span>
                <span className="text-xs text-emerald-200 font-mono">
                  ID: {course.id} &bull; {selectedCohort?.batchName || 'Standard Cohort'}
                </span>
                {selectedCohort?.status && (
                  <span className="text-[10px] bg-white/10 text-emerald-100 px-2 py-0.5 rounded border border-white/20">
                    Status: {selectedCohort.status}
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-1">
                {course.title}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/90 max-w-3xl">
                {course.headline || course.description}
              </p>
            </div>

            {/* Cohort Switcher */}
            {availableCohorts.length > 1 && (
              <div className="bg-white/10 p-3 rounded-xl border border-white/20 max-w-xs w-full self-start md:self-auto backdrop-blur-md shadow-xs">
                <label className="text-[10px] uppercase tracking-wider text-emerald-200 font-bold block mb-1">
                  Active Enrolled Cohort
                </label>
                <select
                  value={selectedCohort?.batchId || ''}
                  onChange={(e) => {
                    const found = availableCohorts.find((c) => c.batchId === e.target.value);
                    if (found) handleCohortChange(found);
                  }}
                  className="w-full bg-[#1e481c] text-xs text-white rounded-lg border border-emerald-400/50 px-2.5 py-1.5 focus:outline-none focus:border-white"
                >
                  {availableCohorts.map((c) => (
                    <option key={c.batchId} value={c.batchId}>
                      {c.courseTitle} &mdash; {c.batchName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Navigation Workspace Tabs */}
          <div className="flex items-center gap-1 sm:gap-2 mt-6 border-b border-emerald-800/60 overflow-x-auto text-xs font-semibold">
            <button
              onClick={() => setActiveTab('stream')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'stream'
                  ? 'border-white text-white font-bold'
                  : 'border-transparent text-emerald-200 hover:text-white'
              }`}
            >
              <span>Stream</span>
              {announcements.length > 0 && (
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full">
                  {announcements.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('classwork')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'classwork'
                  ? 'border-[#4f8c4c] text-white font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Classwork</span>
              {assignments.length > 0 && (
                <span className="text-[10px] bg-gray-700 text-gray-200 px-1.5 py-0.2 rounded-full">
                  {assignments.length}
                </span>
              )}
            </button>

            {effectiveDeliveryMode !== 'RECORDED' && (
              <button
                onClick={() => setActiveTab('live')}
                className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'live'
                    ? 'border-[#4f8c4c] text-white font-bold'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                <Video className="w-3.5 h-3.5 text-[#4f8c4c]" />
                <span>Live Classes (Zealosh VC)</span>
                {liveSessions.some((s) => s.status === 'LIVE') && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('people')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'people'
                  ? 'border-[#4f8c4c] text-white font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>People</span>
              <span className="text-[10px] bg-gray-700 text-gray-200 px-1.5 py-0.2 rounded-full">
                {people.students.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'calendar'
                  ? 'border-[#4f8c4c] text-white font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Calendar</span>
            </button>

            <button
              onClick={() => setActiveTab('todo')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'todo'
                  ? 'border-[#4f8c4c] text-white font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>{isInstructor ? 'To-Review' : 'To-Do'}</span>
              {(isInstructor ? todoTasks.needsGrading.length : (todoTasks.upcoming.length + todoTasks.overdue.length)) > 0 && (
                <span className="text-[10px] bg-[#4f8c4c] text-white px-1.5 py-0.2 rounded-full font-bold">
                  {isInstructor ? todoTasks.needsGrading.length : (todoTasks.upcoming.length + todoTasks.overdue.length)}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('grades')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'grades'
                  ? 'border-[#4f8c4c] text-white font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>{isInstructor ? 'Gradebook Matrix' : 'Grades & Feedback'}</span>
            </button>

            <button
              onClick={() => setActiveTab('doubts')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'doubts'
                  ? 'border-[#4f8c4c] text-white font-bold'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Doubts & Q&A</span>
              {doubts.length > 0 && (
                <span className="text-[10px] bg-gray-700 text-gray-200 px-1.5 py-0.2 rounded-full">
                  {doubts.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('messages')}
              className={`py-2.5 px-3.5 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === 'messages'
                  ? 'border-white text-white font-bold'
                  : 'border-transparent text-emerald-200 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>In-App Messages</span>
              {cohortMessages.length > 0 && (
                <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-bold">
                  {cohortMessages.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {/* ================================================================= */}
        {/* TAB 1: CLASSROOM STREAM                                           */}
        {/* ================================================================= */}
        {activeTab === 'stream' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar: Upcoming Due Dates & Mode Context */}
            <div className="lg:col-span-1 space-y-4">
              <div className="card-elevated p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  <span>Upcoming Deadlines</span>
                </h3>
                {assignments.filter((a) => new Date(a.dueDate) > new Date()).length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Woohoo, no work due soon!</p>
                ) : (
                  <div className="space-y-3">
                    {assignments
                      .filter((a) => new Date(a.dueDate) > new Date())
                      .slice(0, 3)
                      .map((asg) => (
                        <div key={asg.id} className="border-l-2 border-[#4f8c4c] pl-3 py-1">
                          <p className="text-xs font-bold text-slate-900 truncate">{asg.title}</p>
                          <p className="text-[10px] text-gray-500">
                            Due {new Date(asg.dueDate).toLocaleDateString()} at{' '}
                            {new Date(asg.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
                <button
                  onClick={() => setActiveTab('todo')}
                  className="w-full text-center text-xs text-[#4f8c4c] hover:underline font-semibold mt-4 block"
                >
                  View full task list &rarr;
                </button>
              </div>

              {/* Live Session Quick Link if Live mode */}
              {effectiveDeliveryMode !== 'RECORDED' && liveSessions.length > 0 && (
                <div className="card-elevated p-4 border-l-4 border-[#4f8c4c]">
                  <h4 className="text-xs font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                    <Video className="w-3.5 h-3.5 text-[#4f8c4c]" />
                    <span>Next Live Class</span>
                  </h4>
                  <p className="text-xs font-semibold text-gray-800">{liveSessions[0].title}</p>
                  <p className="text-[10px] text-gray-500 mt-1">
                    {new Date(liveSessions[0].scheduledStartTime).toLocaleDateString()} &bull;{' '}
                    {liveSessions[0].durationMinutes} mins
                  </p>
                  <button
                    onClick={() => handleJoinLive(liveSessions[0].id)}
                    className="btn-primary w-full mt-3 py-1.5 text-xs"
                  >
                    <span>Join Zealosh VC</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Feed: Stream Announcements & Post Composer */}
            <div className="lg:col-span-3 space-y-4">
              {/* Instructor Announcement Composer */}
              {isInstructor && (
                <div className="card-elevated p-4">
                  {!showAnnounceComposer ? (
                    <button
                      onClick={() => setShowAnnounceComposer(true)}
                      className="w-full flex items-center gap-3 p-3 text-left rounded-lg border border-dashed border-gray-300 hover:border-[#4f8c4c] hover:bg-gray-50 transition-colors text-xs text-gray-500 font-medium"
                    >
                      <Plus className="w-4 h-4 text-[#4f8c4c]" />
                      <span>Announce something to your class...</span>
                    </button>
                  ) : (
                    <form onSubmit={handlePostAnnouncement} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Post New Announcement
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAnnounceComposer(false)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>

                      <input
                        type="text"
                        placeholder="Announcement Title"
                        value={announcementTitle}
                        onChange={(e) => setAnnouncementTitle(e.target.value)}
                        className="zealosh-input text-sm font-semibold"
                        required
                      />

                      <textarea
                        rows={3}
                        placeholder="Type class notice, schedule update, or reading guidance..."
                        value={announcementContent}
                        onChange={(e) => setAnnouncementContent(e.target.value)}
                        className="zealosh-input text-xs"
                        required
                      />

                      <input
                        type="url"
                        placeholder="Optional attachment link (PDF / Document URL)"
                        value={announcementAttachmentUrl}
                        onChange={(e) => setAnnouncementAttachmentUrl(e.target.value)}
                        className="zealosh-input text-xs"
                      />

                      <div className="flex items-center justify-between pt-2">
                        <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={announcementIsPinned}
                            onChange={(e) => setAnnouncementIsPinned(e.target.checked)}
                            className="rounded text-[#4f8c4c] focus:ring-[#4f8c4c]"
                          />
                          <span className="font-medium">Pin announcement to top of stream</span>
                        </label>

                        <button
                          type="submit"
                          disabled={postingAnnouncement || !announcementTitle.trim()}
                          className="btn-primary"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>{postingAnnouncement ? 'Publishing...' : 'Publish to Stream'}</span>
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Announcements Feed */}
              {announcements.length === 0 ? (
                <div className="card-elevated p-8 text-center text-gray-500">
                  <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-900">Class stream is currently quiet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Announcements and notices posted by faculty will appear here.
                  </p>
                </div>
              ) : (
                announcements.map((anc) => (
                  <div key={anc.id} className="card-elevated p-5 relative space-y-3">
                    {anc.isPinned && (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#3a7536] bg-[#e1f0df] px-2.5 py-0.5 rounded-full w-fit mb-2">
                        <Pin className="w-3 h-3 text-[#3a7536]" />
                        <span>Pinned Notice</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{anc.title}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Posted by <span className="font-semibold text-gray-700">{anc.authorName}</span> &bull;{' '}
                          {new Date(anc.createdAt).toLocaleDateString()} at{' '}
                          {new Date(anc.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="badge-navy text-[10px]">{anc.authorRole}</span>
                    </div>

                    <div className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {anc.content}
                    </div>

                    {anc.attachments && anc.attachments.length > 0 && (
                      <div className="pt-2 border-t border-gray-100 flex flex-wrap gap-2">
                        {anc.attachments.map((att, idx) => (
                          <a
                            key={idx}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs text-slate-900 font-medium transition-colors"
                          >
                            <Download className="w-3.5 h-3.5 text-[#4f8c4c]" />
                            <span>{att.title || 'Attachment'}</span>
                            <ExternalLink className="w-3 h-3 text-gray-400" />
                          </a>
                        ))}
                      </div>
                    )}

                    {/* Class Comments Stream */}
                    <div className="pt-3 border-t border-gray-100 space-y-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                        Class Discussion ({anc.comments?.length || 0})
                      </h4>

                      {anc.comments && anc.comments.length > 0 && (
                        <div className="space-y-2 pl-2 border-l-2 border-gray-100">
                          {anc.comments.map((cmt) => (
                            <div key={cmt.id} className="text-xs">
                              <span className="font-bold text-slate-900">{cmt.authorName}</span>{' '}
                              <span className="text-[10px] text-gray-400">
                                ({cmt.authorRole} &bull; {new Date(cmt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                              <p className="text-gray-700 mt-0.5">{cmt.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Comment Input */}
                      <div className="flex gap-2 pt-1">
                        <input
                          type="text"
                          placeholder="Add a class comment..."
                          value={commentInputMap[anc.id] || ''}
                          onChange={(e) => setCommentInputMap({ ...commentInputMap, [anc.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAddComment(anc.id);
                            }
                          }}
                          className="zealosh-input text-xs"
                        />
                        <button
                          onClick={() => handleAddComment(anc.id)}
                          disabled={submittingCommentId === anc.id || !commentInputMap[anc.id]?.trim()}
                          className="btn-primary px-3 py-1.5 text-xs"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 2: CLASSWORK & LEARNING RESOURCES                             */}
        {/* ================================================================= */}
        {activeTab === 'classwork' && (
          <div className="space-y-6">
            {/* Filter Pills & Instructor Create Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
                {(['all', 'modules', 'materials', 'assignments', 'quizzes'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setClassworkFilter(filterKey)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors uppercase text-[11px] tracking-wider ${
                      classworkFilter === filterKey
                        ? 'bg-[#3a7536] text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {filterKey === 'all' ? 'All Classwork' : filterKey}
                  </button>
                ))}
              </div>

              {isInstructor && (
                <button
                  onClick={() => setShowCreateAssignmentModal(true)}
                  className="btn-primary text-xs py-2 self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Assignment</span>
                </button>
              )}
            </div>

            {/* Section 0: Learning Engine Curriculum & Progressive Modules */}
            {(classworkFilter === 'all' || classworkFilter === 'modules') && course?.modules && course.modules.length > 0 && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-[#4f8c4c]" />
                    <span>Learning Engine Curriculum & Progressive Modules</span>
                  </h3>
                  <Link
                    href={`/learn/${course.slug || course.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#3a7536] hover:underline"
                  >
                    <span>Open Immersive Learning Engine Player</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="space-y-4">
                  {course.modules.map((mod: any, mIdx: number) => (
                    <div key={mod.id || mIdx} className="card-elevated p-5 space-y-3 border-l-4 border-l-[#4f8c4c]">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                              Module {mIdx + 1}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">{mod.title}</h4>
                          </div>
                          {mod.description && (
                            <p className="text-xs text-gray-500 mt-1">{mod.description}</p>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 font-mono">
                          {mod.lessons?.length || 0} Lessons
                        </span>
                      </div>

                      {/* Lesson Items */}
                      {mod.lessons && mod.lessons.length > 0 && (
                        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 overflow-hidden bg-slate-50/50">
                          {mod.lessons.map((lesson: any) => (
                            <div key={lesson.id} className="p-3 flex items-center justify-between gap-3 hover:bg-white transition-colors">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {lesson.isCompleted ? (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                ) : (
                                  <PlayCircle className="w-4 h-4 text-slate-400 shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-slate-900 truncate">
                                    {lesson.title}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                    <span>{lesson.duration || '20 mins'}</span>
                                    {lesson.completionPercentage > 0 && !lesson.isCompleted && (
                                      <span className="text-emerald-700 font-bold">
                                        &bull; {lesson.completionPercentage}% watched
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <Link
                                href={`/learn/${course.slug || course.id}?lessonId=${lesson.id}`}
                                className="btn-secondary text-[11px] py-1 px-3 shrink-0 flex items-center gap-1"
                              >
                                <span>{lesson.isCompleted ? 'Review' : 'Resume'}</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 1: Preloaded & Scheduled Live Materials */}
            {(classworkFilter === 'all' || classworkFilter === 'materials') && materials.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <Layers className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  <span>Learning Materials & Live Session Resource Packs</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {materials.map((mat) => (
                    <div key={mat.id} className="card-elevated p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-900">{mat.title}</h4>
                          <p className="text-xs text-gray-500">{mat.description}</p>
                        </div>
                        <span className="badge-navy text-[10px]">{mat.materialType}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-2 text-[11px]">
                        {mat.isReleased ? (
                          <span className="badge-green text-[10px] flex items-center gap-1">
                            <Unlock className="w-2.5 h-2.5" /> Released
                          </span>
                        ) : (
                          <span className="badge-amber text-[10px] flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Release Condition: {mat.releaseCondition}
                          </span>
                        )}

                        {isInstructor && !mat.isReleased && (
                          <button
                            onClick={() => handleReleaseMaterial(mat.id)}
                            disabled={releasingMaterialId === mat.id}
                            className="btn-brand-outline text-[11px] py-1 px-2.5 ml-auto"
                          >
                            <span>{releasingMaterialId === mat.id ? 'Releasing...' : 'Release Now'}</span>
                          </button>
                        )}

                        {mat.isReleased && mat.fileUrl && (
                          <a
                            href={mat.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[#4f8c4c] font-semibold hover:underline ml-auto"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download Resource</span>
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section 2: Coursework Assignments */}
            {(classworkFilter === 'all' || classworkFilter === 'assignments') && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <FileCheck2 className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  <span>Assignments & Submissions</span>
                </h3>

                {assignments.length === 0 ? (
                  <div className="card-elevated p-6 text-center text-gray-500 text-xs">
                    No coursework assignments posted for this cohort yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((asg) => (
                      <div key={asg.id} className="card-elevated p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1 max-w-2xl">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-900">{asg.title}</span>
                            <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                              Max: {asg.maxScore} marks
                            </span>
                            {asg.submission?.status && (
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                  asg.submission.status === 'GRADED'
                                    ? 'bg-green-100 text-green-800'
                                    : asg.submission.status === 'SUBMITTED'
                                    ? 'bg-blue-100 text-blue-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {asg.submission.status === 'GRADED'
                                  ? `Graded: ${asg.submission.score}/${asg.maxScore}`
                                  : asg.submission.status}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600">{asg.description}</p>
                          <p className="text-[11px] text-gray-400">
                            Due: {new Date(asg.dueDate).toLocaleDateString()} at{' '}
                            {new Date(asg.dueDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 self-start md:self-auto">
                          {!isInstructor ? (
                            <button
                              onClick={() => {
                                setActiveAssignmentModal(asg);
                                setSubmissionText(asg.submission?.submissionText || '');
                                setAttachmentUrl(asg.submission?.attachmentUrl || '');
                              }}
                              className="btn-primary text-xs py-1.5"
                            >
                              <span>{asg.submission ? 'Review / Resubmit' : 'Turn In Work'}</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => setActiveTab('grades')}
                              className="btn-secondary text-xs py-1.5"
                            >
                              <span>View Submissions ({asg.totalSubmissions || 0})</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Section 3: Scheduled Quizzes */}
            {(classworkFilter === 'all' || classworkFilter === 'quizzes') && quizzes.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  <span>Scheduled Formative Quizzes & Assessment Drills</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {quizzes.map((quiz) => (
                    <div key={quiz.id} className="card-elevated p-4 flex flex-col justify-between space-y-3">
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{quiz.title}</h4>
                          <span className="badge-navy text-[10px]">{quiz.quizType}</span>
                        </div>
                        <p className="text-xs text-gray-600">{quiz.description}</p>
                        <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                          <span>{quiz.totalQuestions} Questions</span>
                          <span>&bull;</span>
                          <span>{quiz.durationMinutes} Minutes</span>
                          <span>&bull;</span>
                          <span>Pass: {quiz.passingScorePercent}%</span>
                        </div>
                      </div>

                      <Link
                        href={`/quizzes/${quiz.id}`}
                        className="btn-primary w-full text-xs py-2 flex items-center justify-center gap-1.5"
                      >
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Start Permitted Attempt</span>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 3: LIVE CLASSES (ZEALOSH VC)                                  */}
        {/* ================================================================= */}
        {activeTab === 'live' && (
          <div className="space-y-6">
            <div className="glass-card p-6 bg-gradient-to-r from-[#1e481c] to-[#3a7536] text-white shadow-md">
              <div className="max-w-2xl">
                <span className="badge-green text-[10px] font-bold">ZEALOSH VC WEBRTC INFRASTRUCTURE</span>
                <h2 className="text-xl font-bold mt-2 text-white">Zealosh Virtual Classroom Portal</h2>
                <p className="text-xs text-gray-300 mt-1">
                  High-definition live interactive sessions with interactive canvas whiteboard, presenter PIP, real-time authenticated chat, and verified institutional attendance logging.
                </p>
              </div>
            </div>

            {joinError && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>{joinError}</span>
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Scheduled Cohort Live Sessions
              </h3>

              {liveSessions.length === 0 ? (
                <div className="card-elevated p-8 text-center text-gray-500 text-xs">
                  No live sessions scheduled for this cohort.
                </div>
              ) : (
                liveSessions.map((session) => (
                  <div key={session.id} className="card-elevated p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{session.title}</span>
                        {session.status === 'LIVE' ? (
                          <span className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" /> LIVE NOW
                          </span>
                        ) : (
                          <span className="badge-navy text-[10px]">SCHEDULED</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(session.scheduledStartTime).toLocaleDateString()} at{' '}
                        {new Date(session.scheduledStartTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        &bull; {session.durationMinutes} Minutes duration
                      </p>
                    </div>

                    <button
                      onClick={() => handleJoinLive(session.id)}
                      disabled={joiningSessionId === session.id}
                      className="btn-primary text-xs py-2 px-5 flex items-center gap-2"
                    >
                      <Video className="w-4 h-4" />
                      <span>{joiningSessionId === session.id ? 'Connecting WebRTC...' : 'Launch Zealosh VC'}</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 4: PEOPLE & MEMBERSHIP                                        */}
        {/* ================================================================= */}
        {activeTab === 'people' && (
          <div className="space-y-8 max-w-4xl mx-auto">
            {/* Faculty & Instructors Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#4f8c4c] border-b-2 border-[#4f8c4c] pb-2 flex items-center justify-between">
                <span>Teachers & Certified Faculty</span>
                <span className="text-xs text-gray-400 font-normal">{people.teachers.length} Instructors</span>
              </h3>

              <div className="divide-y divide-gray-100">
                {people.teachers.map((teacher) => (
                  <div key={teacher.id} className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#3a7536] text-white flex items-center justify-center text-xs font-bold">
                        {teacher.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{teacher.name}</p>
                        <p className="text-[10px] text-gray-400">{teacher.email}</p>
                      </div>
                    </div>
                    {teacher.isLead && (
                      <span className="badge-green text-[10px]">Lead Faculty</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Students Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-[#4f8c4c] border-b-2 border-[#4f8c4c] pb-2 flex items-center justify-between">
                <span>Classmates & Enrolled Candidates</span>
                <span className="text-xs text-gray-400 font-normal">{people.students.length} Students</span>
              </h3>

              {people.students.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-4">No candidates enrolled in this batch yet.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {people.students.map((std) => (
                    <div key={std.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold">
                          {std.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{std.name}</p>
                          <p className="text-[10px] text-gray-400">{std.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-24 hidden sm:block">
                          <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                            <span>Progress</span>
                            <span>{std.progressPercent}%</span>
                          </div>
                          <div className="w-full bg-gray-200 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-[#4f8c4c] h-full" style={{ width: `${std.progressPercent}%` }} />
                          </div>
                        </div>
                        <span className="badge-navy text-[10px]">{std.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 5: ACADEMIC CALENDAR                                          */}
        {/* ================================================================= */}
        {activeTab === 'calendar' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#4f8c4c]" />
                <span>Academic Schedule & Milestone Timeline</span>
              </h3>

              <div className="flex items-center gap-1.5 text-xs">
                {(['all', 'live', 'assignments', 'quizzes'] as const).map((filterKey) => (
                  <button
                    key={filterKey}
                    onClick={() => setCalendarFilter(filterKey)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors uppercase ${
                      calendarFilter === filterKey
                        ? 'bg-[#3a7536] text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {filterKey}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {calendarEvents
                .filter((e) => {
                  if (calendarFilter === 'live') return e.type === 'LIVE_CLASS';
                  if (calendarFilter === 'assignments') return e.type === 'ASSIGNMENT_DUE';
                  if (calendarFilter === 'quizzes') return e.type === 'QUIZ';
                  return true;
                })
                .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                .map((ev) => (
                  <div key={ev.id} className="card-elevated p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                          ev.type === 'LIVE_CLASS'
                            ? 'bg-red-50 text-red-600'
                            : ev.type === 'ASSIGNMENT_DUE'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-green-50 text-green-600'
                        }`}
                      >
                        {ev.type === 'LIVE_CLASS' ? (
                          <Video className="w-5 h-5" />
                        ) : ev.type === 'ASSIGNMENT_DUE' ? (
                          <Clock className="w-5 h-5" />
                        ) : (
                          <Award className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{ev.title}</h4>
                        <p className="text-[11px] text-gray-500">
                          {new Date(ev.start).toLocaleDateString()} at{' '}
                          {new Date(ev.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {ev.durationMinutes && ` (${ev.durationMinutes} mins)`}
                        </p>
                      </div>
                    </div>

                    <Link href={ev.linkUrl} className="btn-outline text-xs py-1.5">
                      <span>Open Activity</span>
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 6: TO-DO (STUDENT) / TO-REVIEW (INSTRUCTOR)                   */}
        {/* ================================================================= */}
        {activeTab === 'todo' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {!isInstructor ? (
              // Student View
              <div>
                <div className="flex items-center gap-2 border-b border-gray-200 pb-3 text-xs font-bold">
                  {(['upcoming', 'overdue', 'completed'] as const).map((tabKey) => (
                    <button
                      key={tabKey}
                      onClick={() => setTodoTab(tabKey)}
                      className={`px-4 py-2 rounded-lg transition-colors uppercase text-[11px] tracking-wider ${
                        todoTab === tabKey
                          ? 'bg-[#4f8c4c] text-white'
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {tabKey} ({todoTasks[tabKey]?.length || 0})
                    </button>
                  ))}
                </div>

                <div className="mt-4 space-y-3">
                  {todoTasks[todoTab as 'upcoming' | 'overdue' | 'completed']?.length === 0 ? (
                    <div className="card-elevated p-8 text-center text-gray-400 text-xs">
                      No items under {todoTab}.
                    </div>
                  ) : (
                    todoTasks[todoTab as 'upcoming' | 'overdue' | 'completed']?.map((item: any) => (
                      <div key={item.id} className="card-elevated p-4 flex items-center justify-between gap-4">
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                          <p className="text-[11px] text-gray-500">
                            {item.dueDate && `Due: ${new Date(item.dueDate).toLocaleDateString()}`}
                            {item.submittedAt && `Submitted: ${new Date(item.submittedAt).toLocaleDateString()}`}
                            {item.score !== undefined && ` &bull; Score: ${item.score}`}
                          </p>
                        </div>
                        <button
                          onClick={() => setActiveTab('classwork')}
                          className="btn-outline text-xs py-1"
                        >
                          View Work
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              // Instructor View
              <div>
                <div className="flex items-center gap-2 border-b border-gray-200 pb-3 text-xs font-bold">
                  <button
                    onClick={() => setTodoTab('needsGrading')}
                    className={`px-4 py-2 rounded-lg transition-colors uppercase text-[11px] tracking-wider ${
                      todoTab === 'needsGrading'
                        ? 'bg-[#4f8c4c] text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Pending Grading ({todoTasks.needsGrading?.length || 0})
                  </button>

                  <button
                    onClick={() => setTodoTab('unansweredDoubts')}
                    className={`px-4 py-2 rounded-lg transition-colors uppercase text-[11px] tracking-wider ${
                      todoTab === 'unansweredDoubts'
                        ? 'bg-[#4f8c4c] text-white'
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    Unanswered Questions ({todoTasks.unansweredDoubts?.length || 0})
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {todoTab === 'needsGrading' && (
                    todoTasks.needsGrading.length === 0 ? (
                      <div className="card-elevated p-8 text-center text-gray-400 text-xs">
                        All coursework submissions are evaluated!
                      </div>
                    ) : (
                      todoTasks.needsGrading.map((sub: any) => (
                        <div key={sub.id} className="card-elevated p-4 flex items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-slate-900">{sub.assignmentTitle}</span>
                            <p className="text-[11px] text-gray-500">
                              Candidate: <span className="font-semibold text-gray-700">{sub.studentName}</span> &bull; Submitted{' '}
                              {new Date(sub.submittedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setActiveTab('grades');
                              setGradingSubmission(sub);
                            }}
                            className="btn-primary text-xs py-1.5"
                          >
                            Evaluate
                          </button>
                        </div>
                      ))
                    )
                  )}

                  {todoTab === 'unansweredDoubts' && (
                    todoTasks.unansweredDoubts.length === 0 ? (
                      <div className="card-elevated p-8 text-center text-gray-400 text-xs">
                        All candidate questions have been resolved!
                      </div>
                    ) : (
                      todoTasks.unansweredDoubts.map((d: any) => (
                        <div key={d.id} className="card-elevated p-4 flex items-center justify-between gap-4">
                          <div>
                            <span className="text-xs font-bold text-slate-900">{d.question}</span>
                            <p className="text-[11px] text-gray-500">
                              Asked by: <span className="font-semibold text-gray-700">{d.askedBy}</span> &bull;{' '}
                              {new Date(d.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveTab('doubts')}
                            className="btn-primary text-xs py-1.5"
                          >
                            Answer Question
                          </button>
                        </div>
                      ))
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 7: GRADES & FEEDBACK                                          */}
        {/* ================================================================= */}
        {activeTab === 'grades' && (
          <div className="space-y-6">
            {!isInstructor ? (
              // Student View: Released Grades & Rubric Breakdowns
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Your Certified Coursework Gradebook
                </h3>

                {assignments.filter((a) => a.submission).length === 0 ? (
                  <div className="card-elevated p-8 text-center text-gray-500 text-xs">
                    No graded assignment submissions yet. Submit work via the Classwork tab.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {assignments
                      .filter((a) => a.submission)
                      .map((asg) => (
                        <div key={asg.id} className="card-elevated p-5 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="text-sm font-bold text-slate-900">{asg.title}</h4>
                              <p className="text-xs text-gray-500">
                                Submitted {new Date(asg.submission.submittedAt).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-lg font-bold text-[#4f8c4c]">
                                {asg.submission.score !== undefined ? `${asg.submission.score} / ${asg.maxScore}` : 'Pending Grade'}
                              </span>
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold">
                                {asg.submission.status}
                              </p>
                            </div>
                          </div>

                          {asg.submission.feedback && (
                            <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs">
                              <p className="font-bold text-slate-900 mb-1">Instructor Feedback:</p>
                              <p className="text-gray-700">{asg.submission.feedback}</p>
                            </div>
                          )}

                          {asg.submission.rubricScores && asg.submission.rubricScores.length > 0 && (
                            <div className="space-y-1.5 pt-2">
                              <h5 className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                                Rubric Breakdown
                              </h5>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {asg.submission.rubricScores.map((rb: any) => (
                                  <div key={rb.criterionId} className="p-2 rounded bg-white border border-gray-100 text-xs">
                                    <p className="text-gray-500 text-[10px]">Criterion: {rb.criterionId}</p>
                                    <p className="font-bold text-[#4f8c4c]">{rb.score} pts</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ) : (
              // Instructor View: Full Cohort Submissions & Evaluation Queue
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Cohort Coursework Submissions ({allSubmissions.length})
                  </h3>
                </div>

                {allSubmissions.length === 0 ? (
                  <div className="card-elevated p-8 text-center text-gray-500 text-xs">
                    No candidate submissions received for this cohort yet.
                  </div>
                ) : (
                  <div className="card-elevated overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#1e481c] text-white uppercase text-[10px] tracking-wider">
                        <tr>
                          <th className="py-3 px-4">Candidate</th>
                          <th className="py-3 px-4">Assignment</th>
                          <th className="py-3 px-4">Submitted Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Score</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {allSubmissions.map((sub) => {
                          const asg = assignments.find((a) => a.id === sub.assignmentId);
                          return (
                            <tr key={sub.id} className="hover:bg-gray-50">
                              <td className="py-3 px-4 font-bold text-slate-900">{sub.studentName || 'Student'}</td>
                              <td className="py-3 px-4 text-gray-700">{asg?.title || sub.assignmentId}</td>
                              <td className="py-3 px-4 text-gray-500">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    sub.status === 'GRADED'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {sub.status}
                                </span>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-gray-800">
                                {sub.score !== undefined ? `${sub.score} / ${asg?.maxScore || 100}` : '&mdash;'}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button
                                  onClick={() => {
                                    setGradingSubmission({ ...sub, assignment: asg });
                                    setGradingScore(sub.score || 85);
                                    setGradingFeedback(sub.feedback || '');
                                  }}
                                  className="btn-primary text-xs py-1 px-3"
                                >
                                  Evaluate
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 8: DOUBTS & ACADEMIC Q&A                                      */}
        {/* ================================================================= */}
        {activeTab === 'doubts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ask Doubt Form */}
            <div className="lg:col-span-1">
              <div className="card-elevated p-5 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-[#4f8c4c]" />
                  <span>Ask Certified Faculty</span>
                </h3>

                <form onSubmit={handlePostDoubt} className="space-y-3">
                  <textarea
                    rows={4}
                    placeholder="Describe your technical doubt, calculation challenge, or standard regulation question..."
                    value={doubtQuestion}
                    onChange={(e) => setDoubtQuestion(e.target.value)}
                    className="zealosh-input text-xs"
                    required
                  />

                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={doubtIsPublic}
                      onChange={(e) => setDoubtIsPublic(e.target.checked)}
                      className="rounded text-[#4f8c4c] focus:ring-[#4f8c4c]"
                    />
                    <span>Make visible to cohort classmates</span>
                  </label>

                  <button
                    type="submit"
                    disabled={postingDoubt || !doubtQuestion.trim()}
                    className="btn-primary w-full text-xs py-2"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{postingDoubt ? 'Submitting Question...' : 'Submit Question'}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Doubts Feed */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Cohort Questions & Tutor Clarifications ({doubts.length})
              </h3>

              {doubts.length === 0 ? (
                <div className="card-elevated p-8 text-center text-gray-500 text-xs">
                  No academic doubts submitted for this cohort yet.
                </div>
              ) : (
                doubts.map((doubt) => (
                  <div key={doubt.id} className="card-elevated p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-xs text-slate-900">{doubt.userName || 'Student'}</span>
                        <p className="text-[10px] text-gray-400">
                          {new Date(doubt.createdAt).toLocaleDateString()} at{' '}
                          {new Date(doubt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          doubt.status === 'RESOLVED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {doubt.status || 'OPEN'}
                      </span>
                    </div>

                    <p className="text-xs text-gray-800 font-medium leading-relaxed">{doubt.question}</p>

                    {/* Answers List */}
                    {doubt.answers && doubt.answers.length > 0 && (
                      <div className="p-3 rounded-lg bg-[#e1f0df]/40 border border-[#4f8c4c]/20 space-y-2 mt-2">
                        {doubt.answers.map((ans: any) => (
                          <div key={ans.id} className="text-xs">
                            <span className="font-bold text-[#3a7536]">
                              {ans.instructorName || 'Lead Faculty'}:
                            </span>{' '}
                            <span className="text-gray-700">{ans.answerText}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Instructor Reply Box */}
                    {isInstructor && (
                      <div className="pt-2 border-t border-gray-100 flex gap-2">
                        <input
                          type="text"
                          placeholder="Provide certified instructor clarification..."
                          value={doubtReplyMap[doubt.id] || ''}
                          onChange={(e) => setDoubtReplyMap({ ...doubtReplyMap, [doubt.id]: e.target.value })}
                          className="zealosh-input text-xs"
                        />
                        <button
                          onClick={() => handleReplyDoubt(doubt.id)}
                          disabled={submittingDoubtReplyId === doubt.id || !doubtReplyMap[doubt.id]?.trim()}
                          className="btn-primary text-xs py-1.5 px-3"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* TAB 9: IN-APP MESSAGING & COHORT CONVERSATIONS                    */}
        {/* ================================================================= */}
        {activeTab === 'messages' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="card-elevated p-6 bg-gradient-to-r from-emerald-50 via-white to-white border border-emerald-500/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="badge-green text-[10px] font-bold">IN-APP MESSAGING HUB</span>
                  <h3 className="text-lg font-bold text-slate-900 mt-1">Direct & Cohort Communications</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Communicate directly with certified instructors, academic mentors, and cohort peers with persistent audit logging.
                  </p>
                </div>
              </div>
            </div>

            {/* Compose Message Form */}
            <div className="card-elevated p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-[#4f8c4c]" />
                <span>Send a Message to Faculty / Cohort</span>
              </h4>
              <form onSubmit={handleSendMessage} className="space-y-3">
                <input
                  type="text"
                  value={newMsgSubject}
                  onChange={(e) => setNewMsgSubject(e.target.value)}
                  placeholder="Subject (e.g. Technical Question on Ventilation Calculations)"
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#4f8c4c]"
                />
                <textarea
                  value={newMsgContent}
                  onChange={(e) => setNewMsgContent(e.target.value)}
                  placeholder="Write your message or inquiry here..."
                  rows={3}
                  required
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-200 focus:outline-none focus:border-[#4f8c4c]"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sendingMsg || !newMsgContent.trim()}
                    className="btn-primary text-xs py-2 px-5 flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingMsg ? 'Dispatching...' : 'Send Message'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Message Thread List */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Conversation History ({cohortMessages.length})
              </h4>
              {cohortMessages.length === 0 ? (
                <div className="card-elevated p-8 text-center text-slate-400 text-xs">
                  No messages recorded in this cohort conversation yet.
                </div>
              ) : (
                cohortMessages.map((msg) => (
                  <div key={msg.id} className="card-elevated p-4 space-y-2 border-l-4 border-l-[#4f8c4c]">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{msg.senderName}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          msg.senderRole === 'INSTRUCTOR' ? 'bg-[#3a7536] text-white' :
                          msg.senderRole === 'SUPER_ADMIN' ? 'bg-[#245921] text-white' :
                          'bg-emerald-100 text-emerald-800'
                        }`}>
                          {msg.senderRole}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(msg.createdAt).toLocaleDateString()} at{' '}
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {msg.subject && (
                      <div className="text-xs font-bold text-slate-800">{msg.subject}</div>
                    )}
                    <p className="text-xs text-slate-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* MODAL 1: STUDENT ASSIGNMENT SUBMISSION                              */}
      {/* =================================================================== */}
      {activeAssignmentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="badge-navy text-[10px]">COURSEWORK SUBMISSION</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">{activeAssignmentModal.title}</h3>
                <p className="text-xs text-gray-500">Max Score: {activeAssignmentModal.maxScore} marks</p>
              </div>
              <button
                onClick={() => setActiveAssignmentModal(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {submissionSuccessMsg ? (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>{submissionSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleSubmitAssignment} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-900 block mb-1">
                    Written Technical Response / Calculations
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter coursework calculations, regulatory citations, or solution text..."
                    value={submissionText}
                    onChange={(e) => setSubmissionText(e.target.value)}
                    className="zealosh-input text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-900 block mb-1">
                    Work Document / File URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (Supporting diagram, spreadsheet, or scan)"
                    value={attachmentUrl}
                    onChange={(e) => setAttachmentUrl(e.target.value)}
                    className="zealosh-input text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveAssignmentModal(null)}
                    className="btn-outline text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingAssignment || !submissionText.trim()}
                    className="btn-primary text-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{submittingAssignment ? 'Submitting...' : 'Turn In Work'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 2: INSTRUCTOR CREATE ASSIGNMENT MODAL                         */}
      {/* =================================================================== */}
      {showCreateAssignmentModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="badge-green text-[10px]">FACULTY AUTHORING</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">Create Coursework Assignment</h3>
              </div>
              <button
                onClick={() => setShowCreateAssignmentModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateAssignment} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-900 block mb-1">Assignment Title</label>
                <input
                  type="text"
                  placeholder="e.g. ASP Module 3: Crane Load Chart Calculation Drill"
                  value={newAsgTitle}
                  onChange={(e) => setNewAsgTitle(e.target.value)}
                  className="zealosh-input text-xs"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-900 block mb-1">Instructions</label>
                <textarea
                  rows={3}
                  placeholder="Instructions, guidelines, rubric criteria..."
                  value={newAsgDesc}
                  onChange={(e) => setNewAsgDesc(e.target.value)}
                  className="zealosh-input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-900 block mb-1">Due Date</label>
                  <input
                    type="datetime-local"
                    value={newAsgDueDate}
                    onChange={(e) => setNewAsgDueDate(e.target.value)}
                    className="zealosh-input text-xs"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-900 block mb-1">Max Score</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={newAsgMaxScore}
                    onChange={(e) => setNewAsgMaxScore(Number(e.target.value))}
                    className="zealosh-input text-xs"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateAssignmentModal(false)}
                  className="btn-outline text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingAssignment || !newAsgTitle.trim() || !newAsgDueDate}
                  className="btn-primary text-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{creatingAssignment ? 'Creating...' : 'Publish Assignment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL 3: INSTRUCTOR RUBRIC EVALUATION MODAL                         */}
      {/* =================================================================== */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="badge-green text-[10px]">FACULTY EVALUATION</span>
                <h3 className="text-base font-bold text-slate-900 mt-1">
                  Grade: {gradingSubmission.studentName}
                </h3>
                <p className="text-xs text-gray-500">
                  Assignment: {gradingSubmission.assignment?.title || gradingSubmission.assignmentId}
                </p>
              </div>
              <button
                onClick={() => setGradingSubmission(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            {gradeSuccessMsg ? (
              <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800 font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span>{gradeSuccessMsg}</span>
              </div>
            ) : (
              <form onSubmit={handleGradeSubmission} className="space-y-4">
                <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                  <p className="font-bold text-slate-900 mb-1">Student Work Submission:</p>
                  <p className="text-gray-700 whitespace-pre-wrap">{gradingSubmission.submissionText || 'No text provided'}</p>
                  {gradingSubmission.attachmentUrl && (
                    <a
                      href={gradingSubmission.attachmentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#4f8c4c] font-semibold hover:underline mt-2 inline-flex items-center gap-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>View Attached File</span>
                    </a>
                  )}
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-900 block mb-1">
                    Awarded Score (Max: {gradingSubmission.assignment?.maxScore || 100})
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={gradingSubmission.assignment?.maxScore || 100}
                    value={gradingScore}
                    onChange={(e) => setGradingScore(Number(e.target.value))}
                    className="zealosh-input text-xs"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-900 block mb-1">Faculty Feedback</label>
                  <textarea
                    rows={3}
                    placeholder="Constructive feedback, regulatory notes, commendations..."
                    value={gradingFeedback}
                    onChange={(e) => setGradingFeedback(e.target.value)}
                    className="zealosh-input text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setGradingSubmission(null)}
                    className="btn-outline text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingGrade}
                    className="btn-primary text-xs"
                  >
                    <span>{submittingGrade ? 'Publishing...' : 'Publish Grade & Feedback'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function UnifiedClassroomPage() {
  return (
    <Suspense fallback={<ZealoshLoader size="fullscreen" />}>
      <ClassroomContent />
    </Suspense>
  );
}
