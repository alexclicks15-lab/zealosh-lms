'use client';

// Zealosh LMS — Phase 5C.1 Centralized Diagnostics & Application Health Console
// Path: src/app/admin/diagnostics/page.tsx
// Real-time error monitoring, fingerprint aggregation, dependency health telemetry & incident resolution

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  ShieldAlert,
  ArrowLeft,
  ChevronRight,
  Database,
  Server,
  Video,
  Bot,
  Mail,
  Check,
  CheckCheck,
  Copy,
  X,
  Layers,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import {
  DiagnosticIssue,
  DiagnosticEvent,
  DiagnosticIssueStatus,
  DiagnosticSeverity,
  DiagnosticCategory,
  SystemHealthOverview,
  ServiceHealthCheck,
} from '@/types';

export default function AdminDiagnosticsConsole() {
  const [healthOverview, setHealthOverview] = useState<SystemHealthOverview | null>(null);
  const [issues, setIssues] = useState<DiagnosticIssue[]>([]);
  const [totalIssues, setTotalIssues] = useState(0);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Inspector Drawer state
  const [selectedIssue, setSelectedIssue] = useState<DiagnosticIssue | null>(null);
  const [issueEvents, setIssueEvents] = useState<DiagnosticEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [resolveNotes, setResolveNotes] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/admin/diagnostics/health');
      if (res.ok) {
        const data = await res.json();
        setHealthOverview(data.health);
      }
    } catch (err) {
      console.error('Failed to load health telemetry:', err);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const fetchIssues = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await fetch(`/api/admin/diagnostics/issues?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setIssues(data.issues || []);
        setTotalIssues(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to load diagnostic issues:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, categoryFilter, searchQuery]);

  useEffect(() => {
    fetchHealth();
    fetchIssues();
  }, [fetchHealth, fetchIssues]);

  const openInspector = async (issue: DiagnosticIssue) => {
    setSelectedIssue(issue);
    setResolveNotes('');
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/admin/diagnostics/issues/${issue.id}`);
      if (res.ok) {
        const data = await res.json();
        setIssueEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch events for issue:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedIssue) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/admin/diagnostics/issues/${selectedIssue.id}/acknowledge`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedIssue(data.issue);
        setActionMessage('Issue successfully acknowledged.');
        fetchIssues();
        fetchHealth();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to acknowledge issue:', err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedIssue) return;
    setSubmittingAction(true);
    try {
      const res = await fetch(`/api/admin/diagnostics/issues/${selectedIssue.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: resolveNotes }),
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedIssue(data.issue);
        setActionMessage('Issue marked as resolved.');
        fetchIssues();
        fetchHealth();
        setTimeout(() => setActionMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to resolve issue:', err);
    } finally {
      setSubmittingAction(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedFingerprint(true);
      setTimeout(() => setCopiedFingerprint(false), 2000);
    }
  };

  const renderServiceCard = (
    name: string,
    icon: React.ReactNode,
    check?: ServiceHealthCheck
  ) => {
    let statusBg = 'bg-slate-50 border-slate-200 text-slate-700';
    let statusLabel = 'CHECKING...';
    let iconColor = 'text-slate-500';

    if (check) {
      if (check.status === 'HEALTHY') {
        statusBg = 'bg-emerald-50 border-emerald-200 text-emerald-800';
        statusLabel = 'HEALTHY';
        iconColor = 'text-[#4f8c4c]';
      } else if (check.status === 'UNCONFIGURED') {
        statusBg = 'bg-blue-50 border-blue-200 text-blue-800';
        statusLabel = 'UNCONFIGURED (GATE)';
        iconColor = 'text-blue-500';
      } else if (check.status === 'DEGRADED') {
        statusBg = 'bg-amber-50 border-amber-200 text-amber-800';
        statusLabel = 'DEGRADED';
        iconColor = 'text-amber-500';
      } else if (check.status === 'DOWN') {
        statusBg = 'bg-rose-50 border-rose-200 text-rose-800';
        statusLabel = 'DOWN';
        iconColor = 'text-rose-500';
      }
    }

    return (
      <div className="bg-white rounded-xl border border-[#e2efe1] p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg bg-slate-50 ${iconColor}`}>{icon}</div>
            <div>
              <h4 className="text-sm font-semibold text-slate-900">{name}</h4>
              <span className="text-[11px] text-slate-500">
                {check?.latencyMs !== undefined ? `${check.latencyMs}ms latency` : 'Active probe'}
              </span>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusBg}`}>
            {statusLabel}
          </span>
        </div>
        <p className="text-xs text-slate-600 truncate mt-1" title={check?.message}>
          {check?.message || 'Awaiting probe response...'}
        </p>
      </div>
    );
  };

  const getSeverityBadge = (sev: DiagnosticSeverity) => {
    switch (sev) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-xs font-bold bg-rose-100 text-rose-800 rounded">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-xs font-bold bg-orange-100 text-orange-800 rounded">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded">MEDIUM</span>;
      case 'LOW':
        return <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 rounded">LOW</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 rounded">INFO</span>;
    }
  };

  const getStatusBadge = (st: DiagnosticIssueStatus) => {
    switch (st) {
      case 'OPEN':
        return <span className="px-2 py-0.5 text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 rounded">OPEN</span>;
      case 'REOPENED':
        return <span className="px-2 py-0.5 text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200 rounded">REOPENED</span>;
      case 'ACKNOWLEDGED':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded">ACKNOWLEDGED</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded">RESOLVED</span>;
      default:
        return <span className="px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 rounded">IGNORED</span>;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Top Header — Zealosh Green & White */}
      <div className="bg-gradient-to-r from-[#1e481c] via-[#245921] to-[#3a7536] text-white border-b border-emerald-900 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Link
                  href="/admin"
                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Administration
                </Link>
                <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-xs text-[#4f8c4c] font-semibold">Institutional Operations</span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
                <Activity className="w-6 h-6 text-[#4f8c4c]" />
                Live Bug Monitoring & Diagnostics
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Real-time incident grouping, error correlation, dependency health telemetry & resolution workflow
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  fetchHealth();
                  fetchIssues();
                }}
                disabled={healthLoading || loading}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-semibold text-white flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${healthLoading || loading ? 'animate-spin' : ''}`} />
                Refresh Telemetry
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Action message */}
        {actionMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold flex items-center gap-2 shadow-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {actionMessage}
          </div>
        )}

        {/* 1. Service Health Grid */}
        <div>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-slate-400" />
            System Dependency Health
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {renderServiceCard('Zealosh Core Database', <Database className="w-4 h-4" />, healthOverview?.services?.supabase)}
            {renderServiceCard('Zealosh Learning', <Server className="w-4 h-4" />, healthOverview?.services?.moodle)}
            {renderServiceCard('Zealosh VC', <Video className="w-4 h-4" />, healthOverview?.services?.bigbluebutton)}
            {renderServiceCard('Zealosh AI', <Bot className="w-4 h-4" />, healthOverview?.services?.ollama)}
            {renderServiceCard('Zealosh Email Gateway', <Mail className="w-4 h-4" />, healthOverview?.services?.email)}
          </div>
        </div>

        {/* 2. Key Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open Critical</span>
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
            </div>
            <p className="text-2xl font-extrabold text-rose-600 mt-2">
              {healthOverview?.openCriticalIssues ?? 0}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">Immediate administrator action required</span>
          </div>

          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Open High</span>
              <span className="w-2.5 h-2.5 rounded-full bg-orange-500"></span>
            </div>
            <p className="text-2xl font-extrabold text-orange-600 mt-2">
              {healthOverview?.openHighIssues ?? 0}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">Degraded functionality or flow</span>
          </div>

          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Active Issues</span>
              <Activity className="w-4 h-4 text-[#4f8c4c]" />
            </div>
            <p className="text-2xl font-extrabold text-slate-900 mt-2">
              {healthOverview?.totalOpenIssues ?? 0}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">Open, Reopened, or In-Progress</span>
          </div>

          <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Events (Last 24h)</span>
              <Clock className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-extrabold text-blue-600 mt-2">
              {healthOverview?.eventsLast24Hours ?? 0}
            </p>
            <span className="text-[11px] text-slate-500 mt-1 block">Scrubbed diagnostic occurrences</span>
          </div>
        </div>

        {/* 3. Filterable Issues Section */}
        <div className="bg-white rounded-xl border border-[#e2efe1] shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-4 border-b border-[#e2efe1] flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50/50">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, message, fingerprint, correlation ID..."
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c] focus:border-transparent"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              {/* Status */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
              >
                <option value="all">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="REOPENED">Reopened</option>
                <option value="ACKNOWLEDGED">Acknowledged</option>
                <option value="RESOLVED">Resolved</option>
                <option value="IGNORED">Ignored</option>
              </select>

              {/* Severity */}
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
              >
                <option value="all">All Severities</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
                <option value="INFO">Info</option>
              </select>

              {/* Category */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
              >
                <option value="all">All Categories</option>
                <option value="FRONTEND_RUNTIME">Frontend Runtime</option>
                <option value="FRONTEND_NETWORK">Frontend Network</option>
                <option value="API_FAILURE">API Failure</option>
                <option value="DATABASE_FAILURE">Database Failure</option>
                <option value="AUTH_FAILURE">Auth Failure</option>
                <option value="ACADEMIC_WORKFLOW">Academic Workflow</option>
                <option value="EXAMINATION_FAILURE">Examination Failure</option>
                <option value="INTEGRATION_FAILURE">Integration Failure</option>
                <option value="WORKER_FAILURE">Worker Failure</option>
                <option value="CONFIG_FAILURE">Config Failure</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#e2efe1] text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Issue Title / Normalized Error</th>
                  <th className="px-4 py-3 text-center">Occurrences</th>
                  <th className="px-4 py-3">Affected Routes</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Last Seen</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2efe1] bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-[#4f8c4c]" />
                      Loading diagnostic issues...
                    </td>
                  </tr>
                ) : issues.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      <CheckCircle2 className="w-8 h-8 text-[#4f8c4c] mx-auto mb-2" />
                      <p className="font-semibold text-slate-700">No diagnostic issues detected</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        All application systems are running cleanly within operational tolerances.
                      </p>
                    </td>
                  </tr>
                ) : (
                  issues.map((issue) => (
                    <tr
                      key={issue.id}
                      onClick={() => openInspector(issue)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getSeverityBadge(issue.severity)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {issue.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-md">
                        <p className="font-semibold text-slate-900 truncate">{issue.title}</p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-mono">
                          {issue.lastErrorMessage}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800">
                          {issue.occurrenceCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {issue.affectedRoutes.length > 0 ? (
                          <span className="text-[11px] font-mono text-slate-600 truncate block">
                            {issue.affectedRoutes[0]}
                            {issue.affectedRoutes.length > 1 && ` (+${issue.affectedRoutes.length - 1})`}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">system</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getStatusBadge(issue.status)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 text-[11px]">
                        {new Date(issue.lastSeenAt).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => openInspector(issue)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer Count */}
          <div className="p-3 bg-slate-50 border-t border-[#e2efe1] text-xs text-slate-500 flex items-center justify-between">
            <span>Showing {issues.length} of {totalIssues} issues</span>
            <span className="text-[11px] text-slate-400">Deterministic deduplication enabled</span>
          </div>
        </div>
      </div>

      {/* 4. Issue Inspector Slide-Over Drawer */}
      {selectedIssue && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-[#e2efe1] bg-slate-50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  {getSeverityBadge(selectedIssue.severity)}
                  {getStatusBadge(selectedIssue.status)}
                  <span className="text-xs font-mono text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded">
                    {selectedIssue.category}
                  </span>
                </div>
                <h2 className="text-base font-bold text-slate-900 leading-snug">
                  {selectedIssue.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIssue(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Meta Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Occurrences</span>
                  <span className="text-base font-bold text-slate-900 mt-0.5 block">{selectedIssue.occurrenceCount}</span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">First Seen</span>
                  <span className="text-xs font-semibold text-slate-700 mt-1 block">
                    {new Date(selectedIssue.firstSeenAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Last Seen</span>
                  <span className="text-xs font-semibold text-slate-700 mt-1 block">
                    {new Date(selectedIssue.lastSeenAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fingerprint</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedIssue.fingerprint)}
                    className="text-xs font-mono text-slate-700 mt-1 hover:text-[#4f8c4c] flex items-center gap-1"
                    title="Click to copy full fingerprint"
                  >
                    <span>{selectedIssue.fingerprint.slice(0, 8)}...</span>
                    {copiedFingerprint ? <Check className="w-3 h-3 text-[#4f8c4c]" /> : <Copy className="w-3 h-3 text-slate-400" />}
                  </button>
                </div>
              </div>

              {/* Correlation ID */}
              {selectedIssue.lastCorrelationId && (
                <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-blue-900">Last Correlation ID:</span>
                    <code className="font-mono text-blue-800 bg-blue-100/80 px-2 py-0.5 rounded">
                      {selectedIssue.lastCorrelationId}
                    </code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(selectedIssue.lastCorrelationId!)}
                    className="text-blue-700 hover:text-blue-900 text-xs font-medium flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              )}

              {/* Latest Sanitized Error Message */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                  Scrubbed Error Message
                </h4>
                <div className="p-3.5 bg-slate-900 text-rose-300 font-mono text-xs rounded-lg leading-relaxed whitespace-pre-wrap overflow-x-auto">
                  {selectedIssue.lastErrorMessage}
                </div>
              </div>

              {/* Sample Stack Trace */}
              {selectedIssue.sampleStackTrace && (
                <div>
                  <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                    Sample Stack Trace
                  </h4>
                  <div className="p-3.5 bg-slate-900 text-slate-300 font-mono text-[11px] rounded-lg max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {selectedIssue.sampleStackTrace}
                  </div>
                </div>
              )}

              {/* Recent Event Occurrences Timeline */}
              <div>
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center justify-between">
                  <span>Recent Event Occurrences</span>
                  <span className="text-[11px] font-normal text-slate-400">{issueEvents.length} recorded</span>
                </h4>
                {loadingEvents ? (
                  <div className="p-4 text-center text-xs text-slate-400">Loading occurrence timeline...</div>
                ) : issueEvents.length === 0 ? (
                  <div className="p-3 bg-slate-50 text-center text-xs text-slate-500 rounded-lg">
                    No individual event logs retained.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {issueEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-slate-700 font-semibold">{ev.correlationId}</span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(ev.createdAt).toLocaleString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span>Source: {ev.source}</span>
                          {ev.route && <span>Route: {ev.route}</span>}
                          {ev.statusCode && <span>HTTP {ev.statusCode}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resolution Workflow Controls */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Incident Action Controls
                </h4>

                <div className="space-y-3">
                  {selectedIssue.status !== 'ACKNOWLEDGED' && selectedIssue.status !== 'RESOLVED' && (
                    <button
                      type="button"
                      onClick={handleAcknowledge}
                      disabled={submittingAction}
                      className="w-full py-2 px-4 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      Acknowledge Issue (Assign Ownership)
                    </button>
                  )}

                  {selectedIssue.status !== 'RESOLVED' && (
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                      <label className="text-xs font-semibold text-slate-700 block">
                        Resolution Notes
                      </label>
                      <textarea
                        value={resolveNotes}
                        onChange={(e) => setResolveNotes(e.target.value)}
                        placeholder="Detail fix applied, code patch, or configuration adjustment..."
                        rows={3}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
                      />
                      <button
                        type="button"
                        onClick={handleResolve}
                        disabled={submittingAction}
                        className="py-2 px-4 rounded-lg bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                      >
                        <CheckCheck className="w-4 h-4" />
                        Resolve Incident
                      </button>
                    </div>
                  )}

                  {selectedIssue.status === 'RESOLVED' && (
                    <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                      <p className="font-bold flex items-center gap-1.5 mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Incident Resolved
                      </p>
                      {selectedIssue.resolutionNotes && (
                        <p className="text-slate-700 italic mt-1">"{selectedIssue.resolutionNotes}"</p>
                      )}
                      <p className="text-[11px] text-slate-500 mt-1">
                        Resolved by {selectedIssue.resolvedBy || 'Administrator'} at{' '}
                        {selectedIssue.resolvedAt ? new Date(selectedIssue.resolvedAt).toLocaleString('en-IN') : 'N/A'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

