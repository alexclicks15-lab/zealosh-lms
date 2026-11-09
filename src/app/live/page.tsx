'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Calendar,
  Clock,
  PlayCircle,
  Users,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';

export default function LiveSessionsHubPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [joiningSessionId, setJoiningSessionId] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setJoinError(null);
    try {
      const authRes = await fetch('/api/auth/me');
      if (!authRes.ok) {
        router.push('/login');
        return;
      }
      const authData = await authRes.json();
      setUser(authData.user);

      const res = await fetch('/api/live', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
    } catch {
      setJoinError('Failed to retrieve live classroom schedule.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

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
        setJoinError(data.error || 'Unable to join this live classroom session.');
      }
    } catch {
      setJoinError('Network error connecting to Zealosh Live Classroom.');
    } finally {
      setJoiningSessionId(null);
    }
  };

  const isInstructor = user?.role === 'INSTRUCTOR' || user?.role === 'SUPER_ADMIN';

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Header Banner — Zealosh Green & White */}
      <div className="glass-card-green p-6 sm:p-8 mb-8 shadow-sm border border-emerald-500/20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] bg-[#4f8c4c] text-white font-bold px-2.5 py-0.5 rounded tracking-wider uppercase shadow-xs">
                ZEALOSH VIRTUAL CLASSROOM
              </span>
              <span className="text-xs text-slate-500 font-semibold">Live Academic Conferencing</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Interactive Live Classes & Workshops
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Real-time WebRTC audio/video sessions, collaborative whiteboards, ventilation mathematics workshops, and verified attendance logging.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Link href="/classroom" className="btn-secondary text-xs py-2 px-3.5 shadow-xs">
              <span>Digital Classroom</span>
            </Link>
            <Link href="/recordings" className="btn-primary text-xs py-2 px-4 shadow-sm">
              <span>View Replays</span>
            </Link>
          </div>
        </div>
      </div>

      {joinError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{joinError}</span>
        </div>
      )}

      {/* Main Timetable */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            Your Cohort Live Class Timetable
          </h2>
          <button
            onClick={loadSessions}
            className="text-xs text-gray-500 hover:text-gray-900 flex items-center gap-1 font-medium"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Schedule</span>
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-500 text-xs mt-3">Checking active classroom sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="card-elevated p-12 text-center text-gray-500">
            <Video className="w-10 h-10 mx-auto mb-3 text-gray-400" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No Active or Scheduled Live Sessions</h3>
            <p className="text-xs text-gray-500 max-w-md mx-auto mb-4">
              {isInstructor
                ? 'You do not have any live classroom sessions scheduled. You can schedule workshops from your Faculty Hub.'
                : 'Your faculty has not scheduled upcoming live classroom sessions yet. Check your digital classroom stream for announcements.'}
            </p>
            <Link href={isInstructor ? '/instructor' : '/student'} className="btn-primary text-xs py-2 px-4 inline-flex">
              <span>Return to Workspace</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map((session) => {
              const isLive = session.status === 'LIVE' || session.lifecycleState === 'LIVE';
              const isCompleted = session.status === 'ENDED' || session.status === 'RECORDING_READY' || session.lifecycleState === 'COMPLETED';

              return (
                <div key={session.id} className="card-elevated p-6 flex flex-col justify-between border-t-4 border-t-[#4f8c4c]">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isLive ? 'bg-red-500 text-white animate-pulse' : isCompleted ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-[#245921]'
                      }`}>
                        {isLive ? 'LIVE NOW' : session.status}
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{session.durationMinutes || 60} mins</span>
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mb-1.5 line-clamp-2">
                      {session.title}
                    </h3>
                    <p className="text-xs text-gray-500 mb-4 line-clamp-1">
                      {session.courseTitle || 'Certification Course Cohort'}
                    </p>

                    <div className="bg-gray-50 rounded-lg p-2.5 text-[11px] text-gray-600 space-y-1 mb-4 border border-gray-100">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Scheduled:</span>
                        <span className="font-semibold text-gray-700">
                          {new Date(session.scheduledStartTime).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400">Platform:</span>
                        <span className="font-semibold text-[#3a7536]">Zealosh VC WebRTC</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isCompleted ? (
                      <Link
                        href="/recordings"
                        className="w-full btn-outline text-xs py-2 text-center block"
                      >
                        <span>Session Concluded • View Replay</span>
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleJoinLive(session.id)}
                        disabled={joiningSessionId === session.id}
                        className="w-full btn-primary text-xs py-2.5"
                      >
                        {joiningSessionId === session.id
                          ? 'Connecting to Room...'
                          : isLive
                          ? 'Enter Active Live Room'
                          : isInstructor
                          ? 'Launch Meeting Room'
                          : 'Join Live Classroom'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

