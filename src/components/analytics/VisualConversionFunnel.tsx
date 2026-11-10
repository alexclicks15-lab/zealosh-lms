'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Download,
  Filter,
  Users,
  CheckCircle,
  ArrowDown,
  DollarSign,
  GraduationCap,
  Clock,
  Sparkles,
} from 'lucide-react';
import { ConversionFunnelReport, ExecutiveKpiSummary } from '@/types';

export function VisualConversionFunnel() {
  const [data, setData] = useState<{
    kpiSummary: ExecutiveKpiSummary;
    funnelReport: ConversionFunnelReport;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchExecutiveData();
  }, []);

  async function fetchExecutiveData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/reports/executive');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to load executive reports', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadCsv() {
    setDownloading(true);
    try {
      const res = await fetch('/api/admin/reports/executive?format=csv');
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `zealosh-executive-funnel-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error('Failed to download CSV', err);
    } finally {
      setDownloading(false);
    }
  }

  const kpis = data?.kpiSummary;
  const funnel = data?.funnelReport;

  return (
    <div className="space-y-6">
      {/* Executive KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Learners</span>
            <Users className="w-4 h-4 text-[#4f8c4c]" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : kpis?.activeLearnersCount || 0}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Enrolled in active cohorts
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Gross Revenue (INR)</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : `₹${(kpis?.grossRevenueINR || 0).toLocaleString('en-IN')}`}
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
            Authoritative paid order receipts
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Admissions Conversion</span>
            <TrendingUp className="w-4 h-4 text-[#4f8c4c]" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : `${kpis?.admissionsConversionRatePercent || 0}%`}
          </div>
          <span className="text-[11px] text-emerald-600 font-semibold mt-1 inline-block">
            Lead-to-Admitted ratio
          </span>
        </div>

        <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Exam Pass Rate</span>
            <GraduationCap className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">
            {loading ? '...' : `${kpis?.averageExamPassRatePercent || 0}%`}
          </div>
          <span className="text-[11px] text-slate-400 font-medium mt-1 inline-block">
            Average technical pass mark
          </span>
        </div>
      </div>

      {/* Visual Conversion Funnel Chart */}
      <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-gray-100 gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#4f8c4c]" />
              Institutional Admissions & Enrollment Conversion Funnel
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Multi-stage student journey progression from initial enquiry to fully provisioned learning access.
            </p>
          </div>

          <button
            onClick={handleDownloadCsv}
            disabled={downloading || loading}
            className="btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5 border-gray-200 text-gray-700 hover:bg-slate-50 self-start sm:self-auto"
          >
            <Download className="w-3.5 h-3.5 text-gray-500" />
            <span>{downloading ? 'Exporting...' : 'Export CSV (Sanitized)'}</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-gray-400 text-sm">Computing conversion funnel analytics...</div>
        ) : !funnel || funnel.stages.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">No admissions data available for funnel computation.</div>
        ) : (
          <div className="space-y-4">
            {funnel.stages.map((st, idx) => {
              // Color ramp from deep green to bright highlight
              const barWidthPercent = Math.max(12, st.conversionPercentFromTop);

              return (
                <div key={st.stageId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className="font-bold">{st.stageName}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-slate-900 font-bold">{st.count} learners</span>
                      <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono font-bold">
                        {st.conversionPercentFromTop}%
                      </span>
                    </div>
                  </div>

                  {/* Funnel Bar */}
                  <div className="w-full bg-slate-100 rounded-lg h-9 p-1 flex items-center overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-[#3a7536] to-[#4f8c4c] h-full rounded-md transition-all duration-500 flex items-center justify-between px-3 text-white text-[11px] font-bold shadow-xs"
                      style={{ width: `${barWidthPercent}%` }}
                    >
                      <span className="truncate">{st.stageId}</span>
                      <span className="text-emerald-100 font-mono text-[10px]">{st.count}</span>
                    </div>
                  </div>

                  {/* Drop-off Note */}
                  {idx < funnel.stages.length - 1 && st.dropOffCount > 0 && (
                    <div className="pl-4 text-[10px] text-gray-400 flex items-center gap-1 py-0.5">
                      <ArrowDown className="w-3 h-3 text-amber-500" />
                      <span>
                        Drop-off: <strong className="text-slate-600">{st.dropOffCount}</strong> ({st.dropOffPercent}%)
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Overall Conversion Footer */}
            <div className="pt-4 mt-6 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-gray-600 gap-2">
              <span>
                Overall End-to-End Conversion Rate: <strong className="text-[#3a7536] font-bold text-sm">{funnel.overallConversionPercent}%</strong>
              </span>
              <span className="text-[11px] text-gray-400">
                Top Funnel: {funnel.totalTopFunnel} → Admitted: {funnel.totalBottomFunnel}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

