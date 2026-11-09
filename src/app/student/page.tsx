'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  FileText,
  Receipt,
  Bookmark,
  Download,
  Lock,
  Play,
  RefreshCw,
  AlertCircle,
  Bell,
  LifeBuoy,
  ShieldCheck,
  MessageSquare,
  Users
} from 'lucide-react';
import { Enrollment, Course, LiveSession, ClassRecording } from '@/types';
import type {
  ResolvedStudentLiveSession,
  StudentLiveSessionResolutionResult,
} from '@/lib/store/live-session-resolver';

function formatSessionDateTime(isoString?: string): string {
  if (!isoString) return 'Schedule TBD';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) return 'Schedule TBD';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export default function StudentDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<ClassRecording[]>([]);
  const [activityEvents, setActivityEvents] = useState<any[]>([]);
  const [liveResolution, setLiveResolution] = useState<StudentLiveSessionResolutionResult | null>(null);
  const [liveLoading, setLiveLoading] = useState<boolean>(true);
  const [liveLookupError, setLiveLookupError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadLiveSessions = useCallback(async () => {
    setLiveLoading(true);
    setLiveLookupError(null);
    try {
      const res = await fetch('/api/live', { cache: 'no-store' });
      if (!res.ok) {
        setLiveResolution(null);
        setLiveLookupError('Unable to load your live classroom schedule right now.');
        return;
      }
      const data = await res.json();
      if (data && Array.isArray(data.sessions)) {
        setLiveResolution({
          resolutionStatus: data.resolutionStatus || 'NO_SESSIONS_SCHEDULED',
          primarySession: data.primarySession || null,
          sessions: data.sessions,
          activeEnrollmentCount:
            typeof data.activeEnrollmentCount === 'number' ? data.activeEnrollmentCount : 0,
        });
      } else {
        setLiveResolution(null);
        setLiveLookupError('Live session schedule returned an unexpected response.');
      }
    } catch {
      setLiveResolution(null);
      setLiveLookupError('Network error while checking your live classroom schedule.');
    } finally {
      setLiveLoading(false);
    }
  }, []);

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

          // Resolve authorized live sessions & replays dynamically (bounded one-shot fetch)
          loadLiveSessions();

          // Fetch student certificates
          fetch('/api/certificates')
            .then((r) => (r.ok ? r.json() : null))
            .then((certData) => {
              if (certData?.certificates) {
                setCertificates(certData.certificates);
              }
            })
            .catch(() => {});

          // Fetch assignments
          fetch('/api/assignments')
            .then((r) => (r.ok ? r.json() : null))
            .then((asgData) => {
              if (asgData?.assignments) {
                setAssignments(asgData.assignments);
              }
            })
            .catch(() => {});

          // Fetch invoices
          fetch('/api/invoices')
            .then((r) => (r.ok ? r.json() : null))
            .then((invData) => {
              if (invData?.invoices) {
                setInvoices(invData.invoices);
              }
            })
            .catch(() => {});

          // Fetch authorized class recordings
          fetch('/api/recordings')
            .then((r) => (r.ok ? r.json() : null))
            .then((recData) => {
              if (recData?.recordings) {
                setRecordings(recData.recordings);
              }
            })
            .catch(() => {});

          // Fetch recent academic activity feed
          fetch('/api/activities?limit=5')
            .then((r) => (r.ok ? r.json() : null))
            .then((actData) => {
              if (actData?.events) {
                setActivityEvents(actData.events);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setLoading(false));

  }, [router, loadLiveSessions]);

  const handleJoinLive = async (sessionId: string) => {
    if (!sessionId) return;
    setJoinError(null);
    setJoiningSessionId(sessionId);
    try {
      const res = await fetch(`/api/live/${encodeURIComponent(sessionId)}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.joinUrl) {
        router.push(data.joinUrl);
      } else {
        setJoinError(data.error || 'Unable to join this live classroom session.');
      }
    } catch {
      setJoinError('Network error connecting to the Zealosh Live Classroom gateway.');
    } finally {
      setJoiningSessionId(null);
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
      {/* Welcome Banner — Zealosh Green & White Glassmorphism */}
      <div className="glass-card-green p-6 sm:p-8 mb-10 shadow-sm border border-emerald-500/20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-1">
              Zealosh Academic Workspace
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Welcome back, {user?.name || 'Student'}!
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-xl">
              Track certified course progression, participate in live cohort classrooms, and verify examination readiness.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/classroom"
              className="btn-secondary text-xs py-2 px-3.5 shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Digital Classroom</span>
            </Link>
            <Link
              href="/live"
              className="btn-secondary text-xs py-2 px-3.5 shadow-xs"
            >
              <Video className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Live Classes</span>
            </Link>
            <Link
              href="/exams"
              className="btn-primary text-xs py-2 px-4 shadow-sm"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Exam Engine</span>
            </Link>
            <Link
              href="/messages"
              className="btn-secondary text-xs py-2 px-3.5 shadow-xs"
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Channels & Messaging</span>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Enrolled Courses */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-[#4f8c4c]" />
              Active Enrolled Programs
            </h2>
            <Link href="/courses" className="text-xs font-bold text-[#4f8c4c] hover:underline">
              Browse More Courses
            </Link>
          </div>

          {enrollments.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e2efe1] p-10 text-center">
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
                      <h3 className="font-bold text-base text-slate-900">
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

                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                    <Link
                      href={`/classroom?courseId=${enr.courseId}&batchId=${enr.batchId}`}
                      className="btn-secondary text-xs py-2 px-3.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-semibold"
                    >
                      <span>Digital Classroom</span>
                    </Link>
                    <Link
                      href={`/learn/${enr.courseId}`}
                      className="btn-primary text-xs py-2 px-4 shrink-0"
                    >
                      <PlayCircle className="w-4 h-4" />
                      <span>Continue Learning</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Academic Activity Feed */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bell className="w-5 h-5 text-[#4f8c4c]" />
                Recent Academic Activity
              </h2>
              <Link
                href="/classroom?tab=stream"
                className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
              >
                <span>View Stream</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {activityEvents.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-6 text-center text-xs text-gray-500">
                No recent academic activities recorded in your enrolled cohorts.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-[#e2efe1] divide-y divide-slate-100 shadow-xs">
                {activityEvents.map((ev) => (
                  <div key={ev.id} className="p-4 flex items-start justify-between gap-3 hover:bg-[#fbfdfb] transition-colors">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-[#3a7536] border border-emerald-100 uppercase">
                          {ev.category?.replace(/_/g, ' ')}
                        </span>
                        {ev.courseName && (
                          <span className="text-xs font-semibold text-slate-500">{ev.courseName}</span>
                        )}
                        <span className="text-[10px] text-slate-400">
                          {new Date(ev.createdAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900">{ev.title}</h4>
                      <p className="text-xs text-slate-600">{ev.description}</p>
                    </div>
                    {ev.actionUrl && (
                      <Link
                        href={ev.actionUrl}
                        className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1 shrink-0 mt-1"
                      >
                        <span>Open</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coursework & Practice Assignments */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#4f8c4c]" />
                Coursework & Practice Assignments
              </h2>
              <span className="text-xs text-gray-500 font-semibold">
                {assignments.length} Projects Assigned
              </span>
            </div>

            {assignments.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-6 text-center text-xs text-gray-500">
                No active assignments assigned to your cohorts.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {assignments.map((asg) => (
                  <div
                    key={asg.id}
                    className="card-elevated p-5 flex flex-col justify-between border-l-4 border-l-[#4f8c4c]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-bold text-[#4f8c4c] bg-green-50 px-2 py-0.5 rounded">
                          Max: {asg.maxScore} pts
                        </span>
                        {asg.submission ? (
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              asg.submission.status === 'GRADED'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {asg.submission.status === 'GRADED'
                              ? `Score: ${asg.submission.score}/${asg.maxScore}`
                              : 'Under Review'}
                          </span>
                        ) : (
                          <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                            PENDING
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">
                        {asg.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mb-3">
                        {asg.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Due: {new Date(asg.dueDate).toLocaleDateString()}
                      </span>
                      <Link
                        href={`/learn/${asg.courseId}`}
                        className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
                      >
                        <span>{asg.submission ? 'View Feedback' : 'Submit Solution'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recorded Masterclasses & Topic Revisions */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-[#4f8c4c]" />
                Recorded Classes & Revision Highlights
              </h2>
              <span className="text-xs text-gray-500 font-semibold">
                {recordings.length} Recordings Available
              </span>
            </div>

            {recordings.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-6 text-center text-xs text-gray-500">
                No recorded sessions published for your cohorts yet.
              </div>
            ) : (
              <div className="space-y-3">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="card-elevated p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-l-4 border-l-[#4f8c4c]"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="bg-[#e1f0df] text-[#3a7536] text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {rec.batchId}
                        </span>
                        <span className="text-[10px] text-gray-500 font-mono">
                          {Math.round(rec.durationSeconds / 60)} Mins
                        </span>
                        {rec.isDownloadable ? (
                          <span className="text-[10px] font-bold text-[#4f8c4c] bg-green-50 px-2 py-0.5 rounded flex items-center gap-1">
                            <Download className="w-2.5 h-2.5" /> Downloadable
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> Streaming Only
                          </span>
                        )}
                      </div>

                      <h3 className="font-bold text-sm text-slate-900 mb-1">{rec.title}</h3>
                      {rec.description && (
                        <p className="text-xs text-gray-500 line-clamp-1 max-w-xl">{rec.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                      <Link
                        href={`/recordings/${rec.id}`}
                        className="btn-primary text-xs py-2 px-4 flex items-center gap-1.5 w-full sm:w-auto justify-center"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Watch Class</span>
                      </Link>

                      {rec.isDownloadable && (
                        <a
                          href={`/api/recordings/${rec.id}/stream?download=1`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 border border-gray-200 hover:border-[#4f8c4c] text-gray-600 hover:text-[#4f8c4c] rounded-lg transition-colors"
                          title="Download MP4"
                        >
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Earned Accreditations & Certificates */}
          <div className="pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-[#4f8c4c]" />
                Earned Accreditations & Verified Certificates
              </h2>
              <Link
                href="/student/career"
                className="text-xs font-semibold text-[#4f8c4c] hover:underline flex items-center gap-1"
              >
                HSE Career Roadmap & Progression →
              </Link>
            </div>

            {certificates.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-6 text-center">
                <p className="text-gray-500 text-xs">
                  Pass your official examination simulation with 70%+ score to earn a blockchain-verifiable Zealosh Accreditation Certificate.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {certificates.map((cert) => (
                  <div
                    key={cert.id}
                    className="card-elevated p-5 flex flex-col justify-between border-l-4 border-l-[#4f8c4c]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="badge-green text-[10px]">
                          {cert.certificationType || 'HSE'} CERTIFIED
                        </span>
                        <span className="text-[11px] font-bold text-[#3a7536]">
                          Score: {cert.scorePercent}%
                        </span>
                      </div>
                      <h4 className="font-bold text-sm text-slate-900 mb-1">
                        {cert.courseTitle}
                      </h4>
                      <p className="text-[11px] font-mono text-gray-500 mb-3">
                        {cert.certificateCode}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">
                        Issued: {new Date(cert.issueDate).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-3">
                        <a
                          href={`/api/credentials/certificates/${encodeURIComponent(cert.certificateCode)}/download`}
                          download
                          className="text-xs font-bold text-slate-700 hover:text-[#4f8c4c] flex items-center gap-1"
                          title="Download Tamper-Evident Signed PDF Certificate"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </a>
                        <Link
                          href={`/verify/${encodeURIComponent(cert.certificateCode)}`}
                          className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
                        >
                          <span>Verify</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Dynamic Live Classroom, Replays & Resources */}
        <div className="lg:col-span-4 space-y-6">
          {/* Dynamic Live Session & Replay Resolution Panel */}
          <div className="bg-white rounded-xl border-2 border-[#4f8c4c] p-5 shadow-xs">
            {liveLoading ? (
              <div className="py-4 text-center">
                <div className="animate-spin w-5 h-5 border-2 border-[#4f8c4c] border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-xs text-gray-500">Resolving your cohort live schedule...</p>
              </div>
            ) : liveLookupError ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    SCHEDULE UNAVAILABLE
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">Zealosh Live</span>
                </div>
                <p className="text-xs text-gray-600 mb-3 leading-relaxed">{liveLookupError}</p>
                <button
                  type="button"
                  onClick={loadLiveSessions}
                  className="w-full py-2 px-3 rounded-lg border border-[#e2efe1] hover:border-[#4f8c4c] text-xs font-bold text-slate-900 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  <span>Retry Schedule Lookup</span>
                </button>
              </div>
            ) : liveResolution?.primarySession ? (
              (() => {
                const primary: ResolvedStudentLiveSession = liveResolution.primarySession;
                const additionalSessions = liveResolution.sessions.slice(1);
                return (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      {primary.lifecycleState === 'LIVE' ? (
                        <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
                          LIVE CLASS IN PROGRESS
                        </span>
                      ) : primary.lifecycleState === 'UPCOMING' ? (
                        <span className="bg-[#e1f0df] text-[#3a7536] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          UPCOMING LIVE CLASS
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-[#4f8c4c]" />
                          SESSION COMPLETED
                        </span>
                      )}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-semibold">Zealosh Live</span>
                        <button
                          type="button"
                          onClick={loadLiveSessions}
                          title="Refresh live session status"
                          className="text-gray-400 hover:text-[#4f8c4c] transition-colors"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="text-[11px] font-bold text-[#4f8c4c] mb-1">
                      {primary.courseTitle} • {primary.batchName}
                    </div>
                    <h3 className="font-bold text-sm text-slate-900 mb-1.5 leading-snug">
                      {primary.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-1">
                      Lead Mentor: {primary.instructorName} • {primary.durationMinutes} Minutes
                    </p>
                    <p className="text-[11px] text-gray-500 mb-4 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-[#4f8c4c]" />
                      <span>
                        {primary.lifecycleState === 'COMPLETED'
                          ? `Concluded ${formatSessionDateTime(primary.scheduledEndTime)}`
                          : `Scheduled ${formatSessionDateTime(primary.scheduledStartTime)}`}
                      </span>
                    </p>

                    {joinError && (
                      <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                        {joinError}
                      </div>
                    )}

                    {primary.canJoinLive ? (
                      <button
                        type="button"
                        disabled={joiningSessionId === primary.id}
                        onClick={() => handleJoinLive(primary.id)}
                        className="w-full btn-primary text-xs py-2.5 shadow-sm disabled:opacity-60"
                      >
                        <Video className="w-4 h-4" />
                        <span>
                          {joiningSessionId === primary.id
                            ? 'Connecting to Classroom...'
                            : primary.lifecycleState === 'LIVE'
                            ? 'Join Active Live Classroom'
                            : 'Join Scheduled Classroom'}
                        </span>
                      </button>
                    ) : primary.lifecycleState === 'COMPLETED' &&
                      primary.replayState === 'AVAILABLE' &&
                      primary.replay?.playbackUrl ? (
                      <Link
                        href={primary.replay.playbackUrl}
                        className="w-full btn-primary text-xs py-2.5 shadow-sm flex items-center justify-center gap-2"
                      >
                        <PlayCircle className="w-4 h-4" />
                        <span>Watch Recorded Replay</span>
                      </Link>
                    ) : primary.lifecycleState === 'COMPLETED' &&
                      primary.replayState === 'PROCESSING' ? (
                      <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                        Live class has ended. The session recording is currently processing and will be available for replay soon.
                      </div>
                    ) : primary.lifecycleState === 'COMPLETED' &&
                      primary.replayState === 'UNAVAILABLE' ? (
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs">
                        Live class has ended. The recording for this session is currently unavailable or has expired.
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-xs">
                        Live class has ended. A replay recording is not yet available for this session.
                      </div>
                    )}

                    {additionalSessions.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-[#e2efe1]">
                        <div className="text-[11px] font-bold text-slate-900 uppercase tracking-wider mb-2">
                          Additional Cohort Sessions ({additionalSessions.length})
                        </div>
                        <div className="space-y-2">
                          {additionalSessions.map((sess) => (
                            <div
                              key={sess.id}
                              className="p-2.5 rounded-lg bg-[#f7f9fc] border border-[#e2efe1] flex items-center justify-between gap-2"
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {sess.title}
                                </div>
                                <div className="text-[10px] text-gray-500">
                                  {formatSessionDateTime(sess.scheduledStartTime)} • {sess.batchName}
                                </div>
                              </div>
                              {sess.canJoinLive ? (
                                <button
                                  type="button"
                                  disabled={joiningSessionId === sess.id}
                                  onClick={() => handleJoinLive(sess.id)}
                                  className="shrink-0 px-2.5 py-1 rounded-md bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-[11px] font-bold transition-colors"
                                >
                                  Join
                                </button>
                              ) : sess.lifecycleState === 'COMPLETED' &&
                                sess.replayState === 'AVAILABLE' &&
                                sess.replay?.playbackUrl ? (
                                <Link
                                  href={sess.replay.playbackUrl}
                                  className="shrink-0 px-2.5 py-1 rounded-md bg-[#3a7536] hover:bg-[#245921] text-white text-[11px] font-bold transition-colors"
                                >
                                  Replay
                                </Link>
                              ) : sess.lifecycleState === 'COMPLETED' &&
                                sess.replayState === 'PROCESSING' ? (
                                <span className="shrink-0 px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                                  Processing
                                </span>
                              ) : (
                                <span className="shrink-0 px-2 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-semibold">
                                  Ended
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()
            ) : liveResolution?.resolutionStatus === 'NO_ACTIVE_ENROLLMENTS' ? (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    NO ACTIVE COHORT
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">Zealosh Live</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1.5">
                  No Eligible Live Sessions
                </h3>
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Enroll in an active certification cohort to unlock live interactive workshops and session replays.
                </p>
                <Link
                  href="/courses"
                  className="w-full py-2 px-3 rounded-lg bg-[#f7f9fc] hover:bg-[#e1f0df] text-[#3a7536] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Browse Certification Cohorts</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="bg-[#e1f0df] text-[#3a7536] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    SCHEDULE PENDING
                  </span>
                  <span className="text-xs text-gray-500 font-semibold">Zealosh Live</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mb-1.5">
                  No Live Classes Scheduled Yet
                </h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  No upcoming or completed live sessions are currently scheduled for your enrolled cohort.
                </p>
              </div>
            )}
          </div>

          {/* Course Orientation Sessions & Gating */}
          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-emerald-100 text-[#3a7536] text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Users className="w-3 h-3" />
                ADMISSION ORIENTATION
              </span>
              <span className="text-xs text-gray-500 font-semibold">Gated Requirement</span>
            </div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">
              Course Induction & Orientation
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Attendance at a live or physical orientation session is an institutional prerequisite to finalize admission approval and classroom provisioning.
            </p>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">ASP Candidate Orientation</span>
                <span className="text-[10px] text-gray-500">Upcoming Live Cohort Session</span>
              </div>
              <Link
                href="/messages"
                className="px-2.5 py-1 rounded bg-[#4f8c4c] text-white text-xs font-bold hover:bg-[#3a7536] transition-colors"
              >
                View
              </Link>
            </div>
          </div>

          {/* Quick Study Aids */}
          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
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

          {/* Tuition Invoices & Payment Receipts */}
          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#4f8c4c]" />
                Tax Invoices & Receipts
              </span>
              <span className="text-[10px] font-bold bg-[#e1f0df] text-[#3a7536] px-2 py-0.5 rounded-full">
                GST VERIFIED
              </span>
            </h3>

            {invoices.length === 0 ? (
              <p className="text-xs text-gray-400">No payment records found.</p>
            ) : (
              <div className="space-y-2.5">
                {invoices.map((inv) => (
                  <div key={inv.id} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-between">
                    <div>
                      <div className="font-mono font-bold text-xs text-slate-900">{inv.invoiceNumber}</div>
                      <div className="text-[10px] text-gray-500">{inv.courseTitle} • ₹{inv.totalAmount.toLocaleString()}</div>
                    </div>
                    <Link
                      href={`/invoices/${encodeURIComponent(inv.id)}`}
                      className="text-xs font-bold text-[#4f8c4c] hover:underline flex items-center gap-1"
                    >
                      <span>View</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Student Helpdesk & Academic Support */}
          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <LifeBuoy className="w-4 h-4 text-[#4f8c4c]" />
                Helpdesk & Support
              </span>
              <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                ACTIVE
              </span>
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Need assistance with cohort allocation, coursework, live classrooms, or certifications? Our support desk is here to help.
            </p>
            <Link
              href="/support"
              className="w-full py-2 px-3 rounded-lg bg-[#f7f9fc] hover:bg-[#e1f0df] text-[#3a7536] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <span>Open Student Helpdesk</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Account Security & Signed-in Devices (ZM-IMPL-08B) */}
          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
            <h3 className="font-bold text-sm text-slate-900 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3a7536]" />
                Device & Session Security
              </span>
              <span className="text-[10px] font-bold bg-[#e8f3e7] text-[#245921] px-2 py-0.5 rounded-full border border-emerald-300">
                PROTECTED
              </span>
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              Review signed-in browsers, inspect active device locations, or remotely sign out of other devices.
            </p>
            <Link
              href="/student/security"
              className="w-full py-2 px-3 rounded-lg bg-[#e8f3e7] hover:bg-[#d8ebd6] text-[#245921] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors border border-emerald-200"
            >
              <span>Manage Active Devices</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
