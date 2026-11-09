'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Activity,
  Layers,
  Inbox,
  AlertOctagon,
  RefreshCw,
  ShieldCheck,
  Archive,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowLeft,
  Search,
  ExternalLink,
} from 'lucide-react';
import {
  DomainRegistryEntry,
  EventOutboxRecord,
  DeadLetterEventRecord,
  ReconciliationRun,
  ReconciliationResult,
  MaintenanceConfig,
  InstitutionalAuditArchive,
  OperationalDashboardMetrics,
} from '@/types';

export default function AdminOperationsPage() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'domains' | 'outbox' | 'dead-letter' | 'reconciliation' | 'maintenance' | 'archives'
  >('overview');

  const [metrics, setMetrics] = useState<OperationalDashboardMetrics | null>(null);
  const [domains, setDomains] = useState<DomainRegistryEntry[]>([]);
  const [outboxRecords, setOutboxRecords] = useState<EventOutboxRecord[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetterEventRecord[]>([]);
  const [reconciliationRuns, setReconciliationRuns] = useState<ReconciliationRun[]>([]);
  const [reconciliationResults, setReconciliationResults] = useState<ReconciliationResult[]>([]);
  const [maintenanceConfig, setMaintenanceConfig] = useState<MaintenanceConfig | null>(null);
  const [archives, setArchives] = useState<InstitutionalAuditArchive[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Replay modal state
  const [replayModalOpen, setReplayModalOpen] = useState(false);
  const [selectedDlqId, setSelectedDlqId] = useState<string | null>(null);
  const [replayReason, setReplayReason] = useState('');

  // Maintenance form state
  const [maintMode, setMaintMode] = useState<'NORMAL' | 'READ_ONLY' | 'FULL_MAINTENANCE'>('NORMAL');
  const [maintMessage, setMaintMessage] = useState('');
  const [maintReason, setMaintReason] = useState('');

  // Archive generation form state
  const [archivePeriod, setArchivePeriod] = useState('2026-Q4');
  const [archiveScope, setArchiveScope] = useState('ALL');

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setIsLoading(true);
    try {
      const [
        metricsRes,
        domainsRes,
        outboxRes,
        dlqRes,
        recRes,
        maintRes,
        archRes,
      ] = await Promise.all([
        fetch('/api/admin/telemetry/metrics').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/events/registry').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/events/outbox?limit=50').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/events/dead-letter').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/events/reconciliation').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/maintenance').then((r) => r.json()).catch(() => null),
        fetch('/api/admin/audit/archives').then((r) => r.json()).catch(() => null),
      ]);

      if (metricsRes?.metrics) setMetrics(metricsRes.metrics);
      if (domainsRes?.domains) setDomains(domainsRes.domains);
      if (outboxRes?.records) setOutboxRecords(outboxRes.records);
      if (dlqRes?.deadLetters) setDeadLetters(dlqRes.deadLetters);
      if (recRes?.runs) setReconciliationRuns(recRes.runs);
      if (recRes?.results) setReconciliationResults(recRes.results);
      if (maintRes?.config) {
        setMaintenanceConfig(maintRes.config);
        setMaintMode(maintRes.config.mode);
        setMaintMessage(maintRes.config.maintenanceMessage);
      }
      if (archRes?.archives) setArchives(archRes.archives);
    } catch (err: any) {
      console.error('Failed to load operations data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDispatchBatch() {
    setActionMessage('Dispatching batch deliveries...');
    try {
      const res = await fetch('/api/admin/events/dispatch', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Dispatched successfully: ${data.batchResult?.deliveredCount || 0} delivered, ${data.batchResult?.retriedCount || 0} scheduled for retry.`);
        fetchInitialData();
      } else {
        setActionMessage(`Dispatch failed: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  }

  async function handleRunReconciliation() {
    setActionMessage('Running reconciliation sweep...');
    try {
      const res = await fetch('/api/admin/events/reconciliation/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Reconciliation completed. ${data.runsCount} rules evaluated.`);
        fetchInitialData();
      } else {
        setActionMessage(`Reconciliation failed: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  }

  async function handleReplaySubmit() {
    if (!selectedDlqId || replayReason.trim().length < 5) {
      alert('Please provide a mandatory justification reason (at least 5 characters).');
      return;
    }

    try {
      const res = await fetch(`/api/admin/events/dead-letter/${selectedDlqId}/replay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: replayReason, actorUserId: 'admin' }),
      });
      const data = await res.json();
      if (data.success) {
        setReplayModalOpen(false);
        setReplayReason('');
        setSelectedDlqId(null);
        setActionMessage(`Event queued for replay.`);
        fetchInitialData();
      } else {
        alert(data.error || 'Replay failed');
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleSaveMaintenance() {
    try {
      const res = await fetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: maintMode !== 'NORMAL',
          mode: maintMode,
          maintenanceMessage: maintMessage,
          reason: maintReason || 'Manual update via operations console',
          actorUserId: 'admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMaintenanceConfig(data.config);
        setActionMessage(`Maintenance mode updated to ${data.config.mode}.`);
      } else {
        alert(data.error || 'Failed to update maintenance configuration');
      }
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleGenerateArchive() {
    setActionMessage('Generating institutional audit archive...');
    try {
      const res = await fetch('/api/admin/audit/archives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archivePeriod,
          scope: archiveScope,
          format: 'JSONL',
          actorUserId: 'admin',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionMessage(`Archive generated successfully (Checksum: ${data.archive?.contentChecksum?.substring(0, 12)}...)`);
        fetchInitialData();
      } else {
        setActionMessage(`Archive generation failed: ${data.error}`);
      }
    } catch (err: any) {
      setActionMessage(`Error: ${err.message}`);
    }
  }

  async function handleVerifyArchive(id: string) {
    try {
      const res = await fetch(`/api/admin/audit/archives/${id}/verify`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Archive Verified Clean! SHA-256 Checksum: ${data.calculatedChecksum}`);
        fetchInitialData();
      } else {
        alert(`Integrity Check Failed: ${data.error || 'Tamper detected!'}`);
        fetchInitialData();
      }
    } catch (err: any) {
      alert(`Verification error: ${err.message}`);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#252c41]">
      {/* Header */}
      <header className="bg-white border-b border-[#eaedf5] sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              title="Return to Admin Hub"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#4f8c4c] bg-[#eef7ee] px-2 py-0.5 rounded">
                  Track 6 Enterprise Operations
                </span>
                <span className="text-xs text-gray-400">• Single Institution</span>
              </div>
              <h1 className="text-xl font-extrabold text-[#252c41] mt-0.5">
                Central Operations & Synchronization Control Centre
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDispatchBatch}
              className="inline-flex items-center gap-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white px-3.5 py-2 rounded-lg text-sm font-semibold shadow-sm transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Dispatch Outbox</span>
            </button>
            <button
              onClick={fetchInitialData}
              className="p-2 rounded-lg border border-[#eaedf5] hover:bg-gray-50 text-gray-600 transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action feedback bar */}
        {actionMessage && (
          <div className="bg-[#eef7ee] border-t border-[#4f8c4c]/20 px-4 py-2 text-xs font-medium text-[#3a7536] flex items-center justify-between">
            <span>{actionMessage}</span>
            <button onClick={() => setActionMessage(null)} className="text-gray-400 hover:text-gray-600">×</button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-gray-100 overflow-x-auto">
          {[
            { id: 'overview', label: 'Operations Overview', icon: Activity },
            { id: 'domains', label: 'Domain Registry', icon: Layers },
            { id: 'outbox', label: 'Event Outbox', icon: Inbox },
            { id: 'dead-letter', label: `Dead Letters (${deadLetters.length})`, icon: AlertOctagon },
            { id: 'reconciliation', label: 'Reconciliation', icon: RefreshCw },
            { id: 'maintenance', label: 'Maintenance Mode', icon: ShieldCheck },
            { id: 'archives', label: 'Audit Archives', icon: Archive },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-[#4f8c4c] text-[#4f8c4c] bg-green-50/30'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {isLoading ? (
          <div className="py-24 text-center">
            <RefreshCw className="w-8 h-8 text-[#4f8c4c] animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Loading operational telemetry...</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPI Metrics Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-xl border border-[#eaedf5] shadow-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Registered Domains</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-[#252c41]">{metrics?.domainsCount || 20}</span>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded">All Connected</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#eaedf5] shadow-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Outbox Backlog</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-2xl font-black text-[#252c41]">{metrics?.outboxBacklogCount || 0}</span>
                      <span className="text-xs text-gray-400">pending events</span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#eaedf5] shadow-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dead-Letter Queue</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className={`text-2xl font-black ${metrics?.deadLetterCount ? 'text-red-600' : 'text-[#252c41]'}`}>
                        {metrics?.deadLetterCount || 0}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${metrics?.deadLetterCount ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                        {metrics?.deadLetterCount ? 'Requires Review' : 'Clean'}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white p-5 rounded-xl border border-[#eaedf5] shadow-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Maintenance State</span>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-xl font-black uppercase text-[#252c41]">{metrics?.maintenanceMode || 'NORMAL'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded font-semibold ${metrics?.maintenanceMode === 'NORMAL' ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-700'}`}>
                        {metrics?.maintenanceMode === 'NORMAL' ? 'Active' : 'Restricted'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Operational Status Panels */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                    <h3 className="font-bold text-base text-[#252c41] mb-3 flex items-center gap-2">
                      <Layers className="w-5 h-5 text-[#4f8c4c]" />
                      <span>Domain Synchronization Status</span>
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      All 20 institutional business domains have registered event contracts and permitted consumer matrix.
                    </p>
                    <div className="space-y-2">
                      {domains.slice(0, 5).map((d) => (
                        <div key={d.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-100">
                          <span className="font-semibold text-gray-700">{d.displayName}</span>
                          <span className="font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded text-[11px] font-bold">
                            {d.operationalHealth}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => setActiveTab('domains')}
                      className="mt-4 text-xs font-semibold text-[#4f8c4c] hover:underline flex items-center gap-1"
                    >
                      <span>View all 20 domains</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                    <h3 className="font-bold text-base text-[#252c41] mb-3 flex items-center gap-2">
                      <RefreshCw className="w-5 h-5 text-[#4f8c4c]" />
                      <span>Domain Reconciliation Health</span>
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Automated background rules detect state drift between authoritative records and downstream projections.
                    </p>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs py-2 border-b border-gray-100">
                        <span className="text-gray-700">Orders vs. Active Entitlements</span>
                        <span className="text-green-600 font-bold">Rule Active</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 border-b border-gray-100">
                        <span className="text-gray-700">Admissions vs. Course Enrollments</span>
                        <span className="text-green-600 font-bold">Rule Active</span>
                      </div>
                      <div className="flex items-center justify-between text-xs py-2 border-b border-gray-100">
                        <span className="text-gray-700">Passed Exams vs. Issued Certificates</span>
                        <span className="text-green-600 font-bold">Rule Active</span>
                      </div>
                    </div>
                    <button
                      onClick={handleRunReconciliation}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Trigger Reconciliation Sweep</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* DOMAINS TAB */}
            {activeTab === 'domains' && (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#252c41]">Authoritative Service & Domain Registry</h2>
                    <p className="text-xs text-gray-500">20 modular single-institution domains with explicit data ownership.</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500">{domains.length} Registered</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-gray-500 uppercase font-bold text-[11px] border-b border-gray-200">
                        <th className="py-2.5 px-3">Domain</th>
                        <th className="py-2.5 px-3">Owner Directorate</th>
                        <th className="py-2.5 px-3">Authoritative Tables</th>
                        <th className="py-2.5 px-3">Permitted Consumers</th>
                        <th className="py-2.5 px-3">Health</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {domains.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50/50">
                          <td className="py-3 px-3">
                            <span className="font-bold text-[#252c41] block">{d.displayName}</span>
                            <span className="font-mono text-gray-400 text-[10px]">{d.id}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-600">{d.owner}</td>
                          <td className="py-3 px-3">
                            <span className="font-mono text-gray-500 text-[11px]">{d.authoritativeTables?.join(', ') || 'None'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="text-gray-500 text-[11px]">{d.permittedConsumers?.join(', ') || 'Internal only'}</span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="inline-block bg-green-50 text-green-700 px-2 py-0.5 rounded text-[11px] font-bold">
                              {d.operationalHealth}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EVENT OUTBOX TAB */}
            {activeTab === 'outbox' && (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#252c41]">Transactional Event Outbox</h2>
                    <p className="text-xs text-gray-500">Durable events committed atomically with authoritative domain transactions.</p>
                  </div>
                  <button
                    onClick={handleDispatchBatch}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#4f8c4c] hover:bg-[#3a7536] text-white px-3 py-1.5 rounded transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Dispatch Batch</span>
                  </button>
                </div>

                {outboxRecords.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">No events currently in outbox.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase font-bold text-[11px] border-b border-gray-200">
                          <th className="py-2.5 px-3">Event Type</th>
                          <th className="py-2.5 px-3">Source Domain</th>
                          <th className="py-2.5 px-3">Aggregate</th>
                          <th className="py-2.5 px-3">Correlation ID</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Recorded At</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {outboxRecords.map((r) => (
                          <tr key={r.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-mono font-bold text-[#252c41]">{r.envelope.eventType}</td>
                            <td className="py-3 px-3 text-gray-600">{r.envelope.sourceDomain}</td>
                            <td className="py-3 px-3 font-mono text-gray-500">
                              {r.envelope.aggregateType}:{r.envelope.aggregateId} (v{r.envelope.aggregateVersion})
                            </td>
                            <td className="py-3 px-3 font-mono text-gray-400 text-[11px]">{r.envelope.correlationId}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                r.status === 'COMPLETED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                              }`}>
                                {r.status}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-400 text-[11px]">
                              {new Date(r.envelope.recordedAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* DEAD-LETTER QUEUE TAB */}
            {activeTab === 'dead-letter' && (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#252c41]">Dead-Letter Queue (DLQ)</h2>
                    <p className="text-xs text-gray-500">Failed event deliveries exceeding retry bounds or terminal schema conflicts.</p>
                  </div>
                </div>

                {deadLetters.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400 flex flex-col items-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                    <span>Dead-letter queue is completely clean. No failed events.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase font-bold text-[11px] border-b border-gray-200">
                          <th className="py-2.5 px-3">Consumer</th>
                          <th className="py-2.5 px-3">Failure Class</th>
                          <th className="py-2.5 px-3">Error Message</th>
                          <th className="py-2.5 px-3">Attempts</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {deadLetters.map((dl) => (
                          <tr key={dl.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-bold text-[#252c41]">{dl.consumerDomain}</td>
                            <td className="py-3 px-3 font-mono text-red-600">{dl.failureClassification}</td>
                            <td className="py-3 px-3 text-gray-600 max-w-xs truncate">{dl.errorMessage}</td>
                            <td className="py-3 px-3 text-gray-500">{dl.attemptCount}</td>
                            <td className="py-3 px-3">
                              <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded text-[11px] font-bold">
                                {dl.resolutionStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <button
                                onClick={() => {
                                  setSelectedDlqId(dl.id);
                                  setReplayModalOpen(true);
                                }}
                                className="text-xs font-semibold text-[#4f8c4c] hover:underline"
                              >
                                Replay Event
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* RECONCILIATION TAB */}
            {activeTab === 'reconciliation' && (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-[#252c41]">Cross-Domain Reconciliation Engine</h2>
                    <p className="text-xs text-gray-500">Detects state divergence between authoritative records and consumer projections.</p>
                  </div>
                  <button
                    onClick={handleRunReconciliation}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#4f8c4c] hover:bg-[#3a7536] text-white px-3 py-1.5 rounded transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Run Full Sweep</span>
                  </button>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Latest Evaluation Results</h3>
                  {reconciliationResults.length === 0 ? (
                    <div className="py-8 text-center text-xs text-gray-400">No reconciliation records found. Click Run Full Sweep to evaluate.</div>
                  ) : (
                    <div className="space-y-2">
                      {reconciliationResults.map((res) => (
                        <div key={res.id} className="p-3 border rounded-lg flex items-center justify-between text-xs bg-gray-50/50">
                          <div>
                            <span className="font-mono font-bold text-gray-700 block">{res.ruleName}</span>
                            <span className="text-gray-500">{res.details}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            res.status === 'MATCHED' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {res.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MAINTENANCE MODE TAB */}
            {activeTab === 'maintenance' && (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm max-w-2xl">
                <h2 className="text-base font-bold text-[#252c41] mb-2">Administrative Maintenance Controls</h2>
                <p className="text-xs text-gray-500 mb-6">
                  Server-enforced operational modes. Restricts writes or completely pauses public and student traffic.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-2">Operational Mode</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['NORMAL', 'READ_ONLY', 'FULL_MAINTENANCE'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMaintMode(m)}
                          className={`p-3 rounded-lg border text-xs font-bold text-center transition-all ${
                            maintMode === m
                              ? 'border-[#4f8c4c] bg-green-50 text-[#3a7536] shadow-sm'
                              : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Public Maintenance Message</label>
                    <textarea
                      value={maintMessage}
                      onChange={(e) => setMaintMessage(e.target.value)}
                      placeholder="e.g. Platform undergoing scheduled maintenance. Please check back shortly."
                      className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4f8c4c]"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-700 block mb-1">Audit Justification</label>
                    <input
                      type="text"
                      value={maintReason}
                      onChange={(e) => setMaintReason(e.target.value)}
                      placeholder="Reason for changing operational state..."
                      className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4f8c4c]"
                    />
                  </div>

                  <button
                    onClick={handleSaveMaintenance}
                    className="w-full bg-[#4f8c4c] hover:bg-[#3a7536] text-white py-2.5 rounded-lg text-xs font-bold shadow-sm transition-colors"
                  >
                    Apply Maintenance Configuration
                  </button>
                </div>
              </div>
            )}

            {/* AUDIT ARCHIVES TAB */}
            {activeTab === 'archives' && (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-bold text-[#252c41]">Institutional Audit Archives</h2>
                    <p className="text-xs text-gray-500">Single-institution compliance archives with SHA-256 cryptographic verification.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={archivePeriod}
                      onChange={(e) => setArchivePeriod(e.target.value)}
                      className="text-xs p-1.5 border border-gray-200 rounded w-24 text-center"
                      placeholder="2026-Q4"
                    />
                    <button
                      onClick={handleGenerateArchive}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold bg-[#4f8c4c] hover:bg-[#3a7536] text-white px-3 py-1.5 rounded transition-colors"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      <span>Compile Archive</span>
                    </button>
                  </div>
                </div>

                {archives.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">No archives generated yet. Click Compile Archive above.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 uppercase font-bold text-[11px] border-b border-gray-200">
                          <th className="py-2.5 px-3">Period</th>
                          <th className="py-2.5 px-3">Records</th>
                          <th className="py-2.5 px-3">SHA-256 Checksum</th>
                          <th className="py-2.5 px-3">Format</th>
                          <th className="py-2.5 px-3">Integrity</th>
                          <th className="py-2.5 px-3">Downloads</th>
                          <th className="py-2.5 px-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {archives.map((a) => (
                          <tr key={a.id} className="hover:bg-gray-50/50">
                            <td className="py-3 px-3 font-bold text-[#252c41]">{a.archivePeriod}</td>
                            <td className="py-3 px-3 text-gray-600">{a.sourceRecordCount} events</td>
                            <td className="py-3 px-3 font-mono text-gray-500 text-[11px]">{a.contentChecksum?.substring(0, 16)}...</td>
                            <td className="py-3 px-3 font-mono text-gray-600">{a.format}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                                a.integrityStatus === 'VERIFIED' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                              }`}>
                                {a.integrityStatus}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-gray-500">{a.downloadCount || 0}</td>
                            <td className="py-3 px-3 space-x-2">
                              <button
                                onClick={() => handleVerifyArchive(a.id)}
                                className="text-xs font-semibold text-[#4f8c4c] hover:underline"
                              >
                                Verify
                              </button>
                              <a
                                href={`/api/admin/audit/archives/${a.id}/download`}
                                className="text-xs font-semibold text-gray-600 hover:text-gray-900 hover:underline"
                              >
                                Download
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* REPLAY MODAL */}
      {replayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-base font-bold text-[#252c41] mb-2">Authorize Event Replay</h3>
            <p className="text-xs text-gray-500 mb-4">
              Replays reset the delivery state to PENDING and trigger an immediate dispatch. A mandatory justification reason is required for audit trails.
            </p>
            <textarea
              value={replayReason}
              onChange={(e) => setReplayReason(e.target.value)}
              placeholder="Mandatory justification reason (at least 5 characters)..."
              className="w-full text-xs p-2.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#4f8c4c] mb-4"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setReplayModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleReplaySubmit}
                className="px-3.5 py-1.5 bg-[#4f8c4c] hover:bg-[#3a7536] text-white rounded-lg text-xs font-semibold"
              >
                Confirm Replay
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

