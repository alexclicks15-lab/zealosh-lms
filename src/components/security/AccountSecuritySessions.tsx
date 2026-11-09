// Zealosh LMS — Account Security & Active Sessions Component
// Track 1: Foundation Hardening (ZM-IMPL-08B)
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldAlert,
  Smartphone,
  Laptop,
  Tablet,
  Globe,
  Clock,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { UserSession } from '@/types';

export function AccountSecuritySessions() {
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/sessions', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to load session list');
      }
      const data = await res.json();
      if (data.sessions) {
        setSessions(data.sessions);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Error loading active sessions', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevokeSession = async (sessionId: string, isCurrent: boolean) => {
    if (isCurrent && !confirm('Revoking your current session will sign you out of this browser immediately. Continue?')) {
      return;
    }

    try {
      setActionLoading(sessionId);
      setMessage(null);
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke session');
      }

      setMessage({ text: 'Session revoked successfully.', type: 'success' });
      if (data.isCurrentSession) {
        window.location.href = '/login';
        return;
      }
      await fetchSessions();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error revoking session', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm('Are you sure you want to sign out all other devices and browser sessions?')) {
      return;
    }

    try {
      setActionLoading('all-others');
      setMessage(null);
      const res = await fetch('/api/auth/sessions', {
        method: 'POST',
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke other sessions');
      }

      setMessage({ text: data.message || 'All other active sessions revoked.', type: 'success' });
      await fetchSessions();
    } catch (err: any) {
      setMessage({ text: err.message || 'Error revoking other sessions', type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const activeSessions = sessions.filter((s) => !s.revoked && !s.revokedAt);
  const otherActiveCount = activeSessions.filter((s) => !s.isCurrent).length;

  const getDeviceIcon = (deviceLabel?: string, ua?: string) => {
    const text = (deviceLabel || ua || '').toLowerCase();
    if (text.includes('mobile') || text.includes('iphone') || text.includes('android')) {
      return <Smartphone className="w-5 h-5 text-emerald-600" />;
    }
    if (text.includes('tablet') || text.includes('ipad')) {
      return <Tablet className="w-5 h-5 text-emerald-600" />;
    }
    return <Laptop className="w-5 h-5 text-emerald-600" />;
  };

  return (
    <div className="bg-white border border-[#eaedf5] rounded-2xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#eaedf5]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#3a7536]">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Active Sessions & Signed-In Devices</h3>
            <p className="text-xs text-slate-500">
              Review and manage browser and mobile sessions authenticated to your account.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSessions()}
            disabled={loading}
            className="p-2 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-slate-200 transition-colors"
            title="Refresh session list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleRevokeAllOthers}
            disabled={otherActiveCount === 0 || actionLoading !== null}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all border text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-40 disabled:pointer-events-none"
          >
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            <span>Sign Out Other Devices ({otherActiveCount})</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-xl flex items-center gap-2 text-xs font-medium ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {loading && sessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">Loading active sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">No active sessions found.</div>
        ) : (
          sessions.map((session) => {
            const isRevoked = session.revoked || Boolean(session.revokedAt);
            const isCurrent = Boolean(session.isCurrent);

            return (
              <div
                key={session.id}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isCurrent
                    ? 'border-emerald-200 bg-[#f7faf7]'
                    : isRevoked
                    ? 'border-slate-100 bg-slate-50/60 opacity-60'
                    : 'border-[#eaedf5] bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-2 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    {getDeviceIcon(session.deviceLabel, session.userAgent)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">
                        {session.deviceLabel || 'Web Browser Session'}
                      </span>
                      {isCurrent && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f3e7] text-[#245921] border border-emerald-300 uppercase tracking-wide">
                          Current Device
                        </span>
                      )}
                      {isRevoked ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-200 text-slate-600">
                          Revoked
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span>{session.ipAddress || 'IP Protected'}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          Signed in {new Date(session.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {!isRevoked && (
                  <div className="sm:self-center shrink-0">
                    <button
                      onClick={() => handleRevokeSession(session.id, isCurrent)}
                      disabled={actionLoading === session.id}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-semibold transition-colors flex items-center gap-1 ${
                        isCurrent
                          ? 'border-slate-300 text-slate-600 hover:bg-slate-100'
                          : 'border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300'
                      } disabled:opacity-50`}
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{isCurrent ? 'Sign Out This Browser' : 'Revoke Session'}</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

