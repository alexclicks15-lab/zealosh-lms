'use client';

// Zealosh LMS — Phase 5C.3 Support Operations & SLA Analytics Dashboard
// Route: /admin/support/analytics
// Institutional queue KPIs, response metrics, category distribution, and SLA state summary.

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  ArrowLeft,
  Download,
  Clock,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  FolderOpen,
  Users,
} from 'lucide-react';
import { SupportAnalyticsOverview } from '@/types';

export default function SupportAnalyticsPage() {
  const [analytics, setAnalytics] = useState<SupportAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/support/analytics');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed loading support analytics');
      }
      setAnalytics(data.analytics);
    } catch (err: any) {
      setError(err.message || 'Error loading analytics');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#e2efe1] shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/admin/support" className="hover:text-[#4f8c4c] transition-colors flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Support Operations</span>
              </Link>
              <span>/</span>
              <span className="text-gray-800 font-semibold">Operational Analytics</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <BarChart3 className="w-7 h-7 text-[#4f8c4c]" />
              Support Operations & SLA Intelligence
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Institutional queue telemetry, first response time benchmarks, and SLA compliance tracking.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={fetchAnalytics}
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg shadow-xs transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Metrics</span>
            </button>
            <a
              href="/api/admin/support/export"
              download
              className="inline-flex items-center gap-1.5 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold py-2 px-3.5 rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </a>
          </div>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-[#e2efe1] p-12 text-center text-xs text-gray-500">
            Calculating institutional support metrics...
          </div>
        ) : error || !analytics ? (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center text-xs text-red-600">
            {error || 'Unable to retrieve support metrics.'}
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                  Total Inquiries
                </span>
                <span className="text-2xl font-black text-slate-900">{analytics.totalTicketsCount}</span>
                <span className="text-[11px] text-gray-400 block mt-1">Lifetime ticket volume</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block mb-1">
                  Active Backlog
                </span>
                <span className="text-2xl font-black text-[#3a7536]">{analytics.openTicketsCount}</span>
                <span className="text-[11px] text-gray-400 block mt-1">Requires team resolution</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block mb-1">
                  New Untriaged
                </span>
                <span className="text-2xl font-black text-blue-700">{analytics.newUntriagedCount}</span>
                <span className="text-[11px] text-gray-400 block mt-1">Awaiting initial review</span>
              </div>

              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 block mb-1">
                  High / Urgent
                </span>
                <span className="text-2xl font-black text-red-600">{analytics.highOrUrgentCount}</span>
                <span className="text-[11px] text-gray-400 block mt-1">Priority academic blockers</span>
              </div>
            </div>

            {/* Performance & SLA Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* First Response Time */}
              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Average First Response</span>
                  <Clock className="w-4 h-4 text-[#4f8c4c]" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {analytics.averageFirstResponseHours > 0
                    ? `${analytics.averageFirstResponseHours}h`
                    : 'N/A'}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Elapsed hours from inquiry submission to initial public response from faculty or staff.
                </p>
              </div>

              {/* Resolution Time */}
              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Average Resolution Time</span>
                  <CheckCircle className="w-4 h-4 text-[#4f8c4c]" />
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {analytics.averageResolutionHours > 0
                    ? `${analytics.averageResolutionHours}h`
                    : 'N/A'}
                </div>
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  Elapsed hours from inquiry creation until successful resolution and closure.
                </p>
              </div>

              {/* SLA Compliance Status */}
              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700">Institutional SLA Compliance</span>
                  <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900">
                    {analytics.slaStateSummary.notConfigured === analytics.totalTicketsCount
                      ? 'NOT CONFIGURED'
                      : `${analytics.slaCompliancePercent}%`}
                  </span>
                </div>
                <div className="text-[11px] text-gray-500">
                  {analytics.slaStateSummary.notConfigured === analytics.totalTicketsCount ? (
                    <span className="text-amber-700">
                      Zero active SLA policies assigned. Reporting is paused to prevent fabricated compliance metrics.
                    </span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-700 font-semibold">{analytics.slaStateSummary.withinSla} Within</span>
                      <span>•</span>
                      <span className="text-amber-700 font-semibold">{analytics.slaStateSummary.warning} Warning</span>
                      <span>•</span>
                      <span className="text-red-700 font-semibold">{analytics.slaStateSummary.breached} Breached</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Categorization & Team Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Breakdown by Category */}
              <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-[#4f8c4c]" />
                  <span>Inquiries by Academic / Functional Category</span>
                </h3>

                <div className="divide-y divide-gray-100 text-xs">
                  {analytics.ticketsByCategory.length === 0 ? (
                    <p className="text-gray-400 py-3">No category data recorded.</p>
                  ) : (
                    analytics.ticketsByCategory.map((c) => (
                      <div key={c.categoryId} className="py-2.5 flex items-center justify-between">
                        <span className="font-medium text-gray-700">{c.categoryName}</span>
                        <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-gray-800">
                          {c.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Breakdown by Team */}
              <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#4f8c4c]" />
                  <span>Backlog by Support Team</span>
                </h3>

                <div className="divide-y divide-gray-100 text-xs">
                  {analytics.ticketsByTeam.length === 0 ? (
                    <p className="text-gray-400 py-3">No tickets assigned to specialized teams.</p>
                  ) : (
                    analytics.ticketsByTeam.map((t) => (
                      <div key={t.teamId} className="py-2.5 flex items-center justify-between">
                        <span className="font-medium text-gray-700">{t.teamName}</span>
                        <span className="font-mono font-bold bg-[#e1f0df] text-[#3a7536] px-2 py-0.5 rounded">
                          {t.count}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

