'use client';

// Zealosh LMS — Phase 5B Admin Email Dispatch & Diagnostics Console
// Path: /admin/email
// Real-time outbox inspection, provider configuration gate telemetry, lease recovery & manual dispatch

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mail,
  RefreshCw,
  Play,
  RotateCcw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Send,
  Eye,
  ShieldCheck,
  Search,
  Filter,
  FileText,
  ChevronRight,
  ArrowLeft,
  Inbox,
  AlertCircle,
} from 'lucide-react';
import { EmailOutboxJob, EmailOutboxStatus } from '@/types';

interface OutboxStats {
  total: number;
  queued: number;
  processing: number;
  sent: number;
  delivered: number;
  failed: number;
  retryPending: number;
  bounced: number;
  suppressed: number;
  cancelled: number;
}

interface ProviderInfo {
  name: string;
  isConfigured: boolean;
  status: string;
}

interface TemplateItem {
  id: string;
  name: string;
  eventType: string;
  version: string;
  subjectTemplate: string;
  requiredVariables: string[];
}

export default function AdminEmailConsole() {
  const [stats, setStats] = useState<OutboxStats | null>(null);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [jobs, setJobs] = useState<EmailOutboxJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'outbox' | 'templates'>('outbox');
  const [selectedJob, setSelectedJob] = useState<EmailOutboxJob | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setProvider(data.provider);
      }
    } catch (err) {
      console.error('Failed to load email stats:', err);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('limit', '50');

      const res = await fetch(`/api/admin/email/outbox?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
        setTotalJobs(data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to load email jobs:', err);
    }
  }, [statusFilter, searchQuery]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/email/templates');
      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch (err) {
      console.error('Failed to load email templates:', err);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchStats(), fetchJobs(), fetchTemplates()]);
    setLoading(false);
  }, [fetchStats, fetchJobs, fetchTemplates]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const handleTriggerDispatch = async () => {
    setDispatching(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/admin/email/dispatch', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        const dr = data.dispatchResult;
        setActionMessage(
          `Dispatch complete: ${dr.processedCount} processed, ${dr.sentCount} sent, ${dr.retryCount} retry-pending, ${dr.failedCount} failed, ${dr.suppressedCount} suppressed.`
        );
      } else {
        setActionMessage(`Dispatch failed: ${data.error || 'Unknown error'}`);
      }
      await refreshAll();
    } catch (err: any) {
      setActionMessage(`Dispatch error: ${err?.message || 'Network exception'}`);
    } finally {
      setDispatching(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/email/${jobId}/retry`, { method: 'POST' });
      if (res.ok) {
        setActionMessage(`Job ${jobId} reset to QUEUED for retry.`);
        await refreshAll();
      }
    } catch (err: any) {
      setActionMessage(`Retry failed: ${err?.message}`);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      const res = await fetch(`/api/admin/email/${jobId}/cancel`, { method: 'POST' });
      if (res.ok) {
        setActionMessage(`Job ${jobId} cancelled.`);
        await refreshAll();
      }
    } catch (err: any) {
      setActionMessage(`Cancellation failed: ${err?.message}`);
    }
  };

  const getStatusBadge = (status: EmailOutboxStatus) => {
    switch (status) {
      case 'QUEUED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">QUEUED</span>;
      case 'PROCESSING':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">PROCESSING</span>;
      case 'SENT':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">SENT</span>;
      case 'DELIVERED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800 border border-green-300">DELIVERED</span>;
      case 'RETRY_PENDING':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">RETRY PENDING</span>;
      case 'FAILED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">FAILED</span>;
      case 'BOUNCED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">BOUNCED</span>;
      case 'SUPPRESSED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-300">SUPPRESSED</span>;
      case 'CANCELLED':
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-50 text-gray-500 border border-gray-200">CANCELLED</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-50 text-gray-600">{status}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Breadcrumb */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#e2efe1]">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/admin" className="hover:text-[#4f8c4c] flex items-center gap-1 font-semibold">
                <ArrowLeft className="w-3.5 h-3.5" /> Admin Portal
              </Link>
              <span>/</span>
              <span className="font-bold text-slate-900">Transactional Email Dispatch</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Mail className="w-6 h-6 text-[#4f8c4c]" />
              Transactional Email Dispatch & Outbox Diagnostics
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Zealosh Training & Consultants &bull; Durable ADR-004 PostgreSQL Outbox & Delivery Reconciliation
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={refreshAll}
              disabled={loading}
              className="px-3 py-2 bg-white border border-[#e2efe1] text-xs font-bold rounded-lg hover:bg-gray-50 flex items-center gap-1.5 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#4f8c4c]' : 'text-gray-500'}`} />
              Refresh
            </button>
            <button
              onClick={handleTriggerDispatch}
              disabled={dispatching}
              className="px-4 py-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 ${dispatching ? 'animate-spin' : ''}`} />
              {dispatching ? 'Dispatching...' : 'Trigger Dispatch Cycle'}
            </button>
          </div>
        </div>

        {/* Action / Notification Banner */}
        {actionMessage && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-800 flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-blue-500 hover:text-blue-800 font-bold ml-4">
              &times;
            </button>
          </div>
        )}

        {/* Provider Configuration Gate Banner */}
        {provider && !provider.isConfigured && (
          <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm text-amber-950 flex items-center gap-2">
                Institutional Safety Gate Active: Provider Mode [<code>{provider.name}</code>]
                <span className="px-2 py-0.5 bg-amber-200/70 text-amber-900 rounded text-[10px] font-bold">
                  LIVE SENDING BLOCKED
                </span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                No external email provider credentials (AWS SES, Postmark, Resend, or SendGrid) have been authorized for live dispatch. All transactional jobs are queued, validated, and processed safely in the database outbox without leaking external test emails.
              </p>
            </div>
          </div>
        )}

        {/* Outbox Metrics Summary Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="text-[11px] font-bold uppercase text-gray-500">Queued</div>
              <div className="text-xl font-black text-amber-600 mt-1">{stats.queued}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Pending first attempt</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="text-[11px] font-bold uppercase text-gray-500">Processing</div>
              <div className="text-xl font-black text-blue-600 mt-1">{stats.processing}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Active worker lease</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="text-[11px] font-bold uppercase text-gray-500">Sent / Delivered</div>
              <div className="text-xl font-black text-[#4f8c4c] mt-1">{stats.sent + stats.delivered}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{stats.delivered} confirmed receipts</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="text-[11px] font-bold uppercase text-gray-500">Retry Pending</div>
              <div className="text-xl font-black text-orange-600 mt-1">{stats.retryPending}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Exponential backoff</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="text-[11px] font-bold uppercase text-gray-500">Failed</div>
              <div className="text-xl font-black text-red-600 mt-1">{stats.failed}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">Attempts exhausted</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="text-[11px] font-bold uppercase text-gray-500">Suppressed / Bounced</div>
              <div className="text-xl font-black text-purple-600 mt-1">{stats.suppressed + stats.bounced}</div>
              <div className="text-[10px] text-gray-400 mt-0.5">{stats.suppressed} user opt-outs</div>
            </div>
          </div>
        )}

        {/* Tabs & Controls */}
        <div className="flex border-b border-[#e2efe1] gap-4">
          <button
            onClick={() => setActiveTab('outbox')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'outbox'
                ? 'border-[#4f8c4c] text-[#4f8c4c]'
                : 'border-transparent text-gray-500 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Outbox Queue ({totalJobs})
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'templates'
                ? 'border-[#4f8c4c] text-[#4f8c4c]'
                : 'border-transparent text-gray-500 hover:text-slate-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Institutional Templates ({templates.length})
          </button>
        </div>

        {/* Tab 1: Outbox Queue Management */}
        {activeTab === 'outbox' && (
          <div className="bg-white rounded-xl border border-[#e2efe1] shadow-xs overflow-hidden">
            {/* Filters Bar */}
            <div className="p-4 border-b border-[#e2efe1] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-gray-50/50">
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Statuses' },
                  { id: 'QUEUED', label: 'Queued' },
                  { id: 'PROCESSING', label: 'Processing' },
                  { id: 'SENT', label: 'Sent' },
                  { id: 'DELIVERED', label: 'Delivered' },
                  { id: 'RETRY_PENDING', label: 'Retry Pending' },
                  { id: 'FAILED', label: 'Failed' },
                  { id: 'BOUNCED', label: 'Bounced' },
                  { id: 'SUPPRESSED', label: 'Suppressed' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-md transition-colors ${
                      statusFilter === tab.id
                        ? 'bg-[#4f8c4c] text-white shadow-xs'
                        : 'bg-white text-gray-600 border border-[#e2efe1] hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full md:w-64">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search recipient or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-[#e2efe1] rounded-md focus:outline-hidden focus:border-[#4f8c4c]"
                />
              </div>
            </div>

            {/* Outbox Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-[#e2efe1] text-gray-500 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">Job ID &amp; Event</th>
                    <th className="py-2.5 px-3">Recipient</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Attempts</th>
                    <th className="py-2.5 px-3">Created / Due</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e2efe1]">
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-gray-400">
                        No email outbox jobs matching the specified filter.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          <div className="font-bold text-slate-900 truncate max-w-[140px]">{job.id}</div>
                          <div className="text-[10px] text-gray-400">{job.eventType}</div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{job.recipientName || 'Learner'}</div>
                          <div className="text-[11px] text-gray-500">{job.recipientEmail}</div>
                        </td>

                        <td className="py-2.5 px-3 max-w-[240px]">
                          <div className="truncate font-medium text-slate-900">{job.subject}</div>
                          {job.errorMessage && (
                            <div className="truncate text-[10px] text-red-500 mt-0.5">
                              {job.errorMessage}
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {getStatusBadge(job.status)}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                          {job.attemptCount} / {job.maxAttempts}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-gray-500">
                          <div>{new Date(job.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          <div className="text-[10px] text-gray-400">{new Date(job.createdAt).toLocaleDateString()}</div>
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                          <button
                            onClick={() => setSelectedJob(job)}
                            className="p-1 hover:bg-gray-100 rounded text-gray-600 hover:text-[#4f8c4c]"
                            title="Inspect Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {(job.status === 'FAILED' || job.status === 'RETRY_PENDING' || job.status === 'CANCELLED') && (
                            <button
                              onClick={() => handleRetryJob(job.id)}
                              className="p-1 hover:bg-amber-50 rounded text-amber-600 hover:text-amber-800"
                              title="Manual Retry"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(job.status === 'QUEUED' || job.status === 'RETRY_PENDING' || job.status === 'PROCESSING') && (
                            <button
                              onClick={() => handleCancelJob(job.id)}
                              className="p-1 hover:bg-red-50 rounded text-red-500 hover:text-red-700"
                              title="Cancel Job"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Institutional Templates Catalogue */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map((tpl) => (
              <div key={tpl.id} className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{tpl.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">
                        {tpl.eventType}
                      </span>
                      <span className="text-[10px] font-bold text-[#4f8c4c] bg-green-50 px-1.5 py-0.5 rounded">
                        {tpl.version}
                      </span>
                    </div>
                  </div>
                  <FileText className="w-4 h-4 text-gray-400" />
                </div>

                <div className="text-xs bg-gray-50 p-2.5 rounded-lg border border-[#e2efe1] font-mono text-gray-700">
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-0.5">Subject Template</div>
                  {tpl.subjectTemplate}
                </div>

                <div>
                  <div className="text-[10px] uppercase font-bold text-gray-400 mb-1">Interpolated Variables</div>
                  <div className="flex flex-wrap gap-1">
                    {tpl.requiredVariables.map((v) => (
                      <span key={v} className="text-[10px] bg-emerald-50 text-emerald-800 font-mono px-1.5 py-0.5 rounded border border-emerald-100">
                        &#123;&#123;{v}&#125;&#125;
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Detailed Job Inspector Modal */}
        {selectedJob && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-xl border border-[#e2efe1] overflow-hidden">
              <div className="p-4 border-b border-[#e2efe1] flex items-center justify-between bg-gray-50">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-[#4f8c4c]" />
                  <span className="text-sm font-bold text-slate-900">Inspect Outbox Job: {selectedJob.id}</span>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-lg"
                >
                  &times;
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-gray-50 p-3 rounded-xl border border-[#e2efe1]">
                  <div>
                    <span className="text-gray-400 uppercase text-[10px] font-bold block">Recipient</span>
                    <span className="font-bold text-slate-900">{selectedJob.recipientName} ({selectedJob.recipientEmail})</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase text-[10px] font-bold block">Status</span>
                    <span>{getStatusBadge(selectedJob.status)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase text-[10px] font-bold block">Idempotency Key</span>
                    <span className="font-mono text-[10px] break-all">{selectedJob.idempotencyKey || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-400 uppercase text-[10px] font-bold block">Template</span>
                    <span>{selectedJob.templateId} ({selectedJob.templateVersion})</span>
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block mb-1">Subject</span>
                  <div className="p-2.5 bg-gray-50 rounded-lg border border-[#e2efe1] font-semibold text-slate-900">
                    {selectedJob.subject}
                  </div>
                </div>

                <div>
                  <span className="text-gray-400 uppercase text-[10px] font-bold block mb-1">Plain Text Body</span>
                  <pre className="p-3 bg-gray-900 text-gray-100 rounded-lg text-[11px] font-mono whitespace-pre-wrap overflow-x-auto max-h-48">
                    {selectedJob.textBody}
                  </pre>
                </div>

                {selectedJob.errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-xs">
                    <span className="font-bold block mb-0.5">Error Diagnostic ({selectedJob.errorClassification || 'UNCLASSIFIED'})</span>
                    {selectedJob.errorMessage}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-[#e2efe1] bg-gray-50 flex items-center justify-between">
                <div className="text-[11px] text-gray-500">
                  Attempt {selectedJob.attemptCount} of {selectedJob.maxAttempts} &bull; Created {new Date(selectedJob.createdAt).toLocaleString()}
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="px-4 py-1.5 bg-[#1e481c] text-white font-bold rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

