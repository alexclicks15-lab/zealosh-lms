'use client';

// Zealosh LMS — Phase 5C.2 Institutional Reporting, Academic Analytics & Cohort Telemetry Dashboard
// Path: src/app/admin/reports/page.tsx
// Authoritative academic KPIs, cohort telemetry, live attendance, and faculty operational metrics

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calendar,
  Users,
  GraduationCap,
  Award,
  Video,
  FileCheck2,
  Clock,
  Download,
  RefreshCw,
  ArrowLeft,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  BookOpen,
  UserCheck,
  AlertCircle,
  HelpCircle,
  X,
  FileText,
  Search,
  Filter,
} from 'lucide-react';
import {
  ExecutiveOverviewKpis,
  EnrollmentAnalyticsReport,
  AttendanceAnalyticsReport,
  AssessmentAnalyticsReport,
  CourseProgressionReport,
  InstructorAnalyticsReport,
  StudentRequiringAttentionItem,
  ReportingDateRangePreset,
} from '@/types/reporting';

type TabKey =
  | 'overview'
  | 'enrollments'
  | 'attendance'
  | 'assessments'
  | 'progression'
  | 'attention'
  | 'faculty';

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [preset, setPreset] = useState<ReportingDateRangePreset>('last_30_days');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Data states
  const [overview, setOverview] = useState<ExecutiveOverviewKpis | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentAnalyticsReport | null>(null);
  const [attendance, setAttendance] = useState<AttendanceAnalyticsReport | null>(null);
  const [assessments, setAssessments] = useState<AssessmentAnalyticsReport | null>(null);
  const [progression, setProgression] = useState<CourseProgressionReport | null>(null);
  const [faculty, setFaculty] = useState<InstructorAnalyticsReport | null>(null);
  const [attentionList, setAttentionList] = useState<StudentRequiringAttentionItem[]>([]);

  // Selected student for attention drill-down modal
  const [selectedStudent, setSelectedStudent] = useState<StudentRequiringAttentionItem | null>(null);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set('preset', preset);
    if (preset === 'custom') {
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
    }
    return params.toString();
  }, [preset, startDate, endDate]);

  const loadReportData = useCallback(async () => {
    setLoading(true);
    setFeedback(null);
    const qs = buildQueryString();

    try {
      const [
        resOverview,
        resEnroll,
        resAttend,
        resAssess,
        resProg,
        resFaculty,
        resAttention,
      ] = await Promise.all([
        fetch(`/api/admin/reports/overview?${qs}`),
        fetch(`/api/admin/reports/enrollments?${qs}`),
        fetch(`/api/admin/reports/attendance?${qs}`),
        fetch(`/api/admin/reports/assessments?${qs}`),
        fetch(`/api/admin/reports/progression?${qs}`),
        fetch(`/api/admin/reports/faculty?${qs}`),
        fetch(`/api/admin/reports/attention?${qs}`),
      ]);

      if (resOverview.ok) {
        const json = await resOverview.json();
        if (json.success) setOverview(json.data);
      }
      if (resEnroll.ok) {
        const json = await resEnroll.json();
        if (json.success) setEnrollments(json.data);
      }
      if (resAttend.ok) {
        const json = await resAttend.json();
        if (json.success) setAttendance(json.data);
      }
      if (resAssess.ok) {
        const json = await resAssess.json();
        if (json.success) setAssessments(json.data);
      }
      if (resProg.ok) {
        const json = await resProg.json();
        if (json.success) setProgression(json.data);
      }
      if (resFaculty.ok) {
        const json = await resFaculty.json();
        if (json.success) setFaculty(json.data);
      }
      if (resAttention.ok) {
        const json = await resAttention.json();
        if (json.success) setAttentionList(json.data || []);
      }
    } catch (err: any) {
      console.error('Failed to load institutional reports:', err);
      setFeedback({ type: 'error', message: 'Unable to load report telemetry. Please check session or connectivity.' });
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    loadReportData();
  }, [loadReportData]);

  const handleExportCsv = async (type: string) => {
    setExporting(true);
    try {
      const qs = buildQueryString();
      const res = await fetch(`/api/admin/reports/export?type=${type}&${qs}`);
      if (!res.ok) {
        throw new Error('Export failed with status ' + res.status);
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `zealosh_${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setFeedback({ type: 'success', message: `Report exported successfully as sanitized CSV.` });
    } catch (err: any) {
      setFeedback({ type: 'error', message: `Export failed: ${err.message}` });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Header — Official Zealosh Green & White */}
      <header className="bg-gradient-to-r from-[#1e481c] via-[#245921] to-[#3a7536] text-white border-b border-emerald-900 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-gray-300 hover:text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Admin Hub</span>
            </Link>
            <div className="h-5 w-px bg-gray-700" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#4f8c4c] flex items-center justify-center text-white shadow-sm">
                <BarChart3 className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Institutional Reporting & Academic Analytics</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#3a7536] text-white font-medium">
                    ADR-004
                  </span>
                </h1>
                <p className="text-[11px] text-gray-400">Zealosh Training & Consultants — Academic Intelligence</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/diagnostics"
              className="text-xs text-rose-300 hover:text-rose-200 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 font-medium transition-colors"
            >
              Bug Diagnostics &rarr;
            </Link>
            <button
              onClick={() => loadReportData()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 text-xs text-white bg-[#4f8c4c] hover:bg-[#3a7536] px-3 py-1.5 rounded-lg font-semibold shadow-sm transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Control Bar: Date Presets & CSV Export */}
      <div className="bg-white border-b border-[#e2efe1] px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 flex items-center gap-1 mr-1">
              <Calendar className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Timeframe:</span>
            </span>
            {(
              [
                ['last_30_days', 'Last 30 Days'],
                ['last_7_days', 'Last 7 Days'],
                ['today', 'Today'],
                ['this_month', 'This Month'],
                ['previous_month', 'Previous Month'],
                ['current_academic_year', 'Academic Year'],
                ['custom', 'Custom'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPreset(key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                  preset === key
                    ? 'bg-[#4f8c4c] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}

            {preset === 'custom' && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                />
                <span className="text-xs text-gray-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExportCsv(activeTab === 'overview' ? 'overview' : activeTab)}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 text-xs text-slate-900 bg-gray-100 hover:bg-gray-200 border border-gray-300 px-3 py-1.5 rounded-lg font-semibold transition-colors disabled:opacity-50"
              title="Download RFC 4180 sanitized CSV with formula injection mitigation"
            >
              <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-bounce text-[#4f8c4c]' : ''}`} />
              <span>{exporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {feedback && (
          <div
            className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between ${
              feedback.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 border-b border-[#e2efe1] bg-white px-3 py-1.5 rounded-xl shadow-xs overflow-x-auto">
          {[
            { key: 'overview', label: 'Executive Overview', icon: BarChart3 },
            { key: 'enrollments', label: 'Enrollment & Cohorts', icon: Users },
            { key: 'attendance', label: 'Live Attendance', icon: Video },
            { key: 'assessments', label: 'Assessments & HSE Exams', icon: Award },
            { key: 'progression', label: 'Course Progression', icon: GraduationCap },
            {
              key: 'attention',
              label: `Students Requiring Attention (${overview?.studentsRequiringAttentionCount || 0})`,
              icon: AlertTriangle,
              highlight: (overview?.studentsRequiringAttentionCount || 0) > 0,
            },
            { key: 'faculty', label: 'Faculty Operations', icon: UserCheck },
          ].map(({ key, label, icon: Icon, highlight }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as TabKey)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeTab === key
                  ? 'bg-[#4f8c4c] text-white shadow-xs'
                  : highlight
                  ? 'text-amber-700 bg-amber-50 hover:bg-amber-100'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* TAB 1: EXECUTIVE OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Distinct Enrolled Learners
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.activeEnrolledLearners ?? 0}
                  </span>
                  <span className="text-xs text-gray-500">
                    of {overview?.totalRegisteredStudents ?? 0} registered
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {overview?.totalActiveEnrolments ?? 0} total active enrollments across courses
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Admissions Conversion
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.admissionsConversionRatePercent ?? 0}%
                  </span>
                  <span className="text-xs text-gray-500">
                    ({overview?.pendingApplicationsCount ?? 0} pending)
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {overview?.newAdmissionsCount ?? 0} new applications in period
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Cohort Capacity Utilization
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.overallBatchCapacityUtilizationPercent ?? 0}%
                  </span>
                  <span className="text-xs text-gray-500">
                    across {overview?.activeBatchesCount ?? 0} batches
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  {overview?.activeCoursesCount ?? 0} active published courses
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    HSE Exam Pass Rate
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-[#4f8c4c]/10 text-[#4f8c4c] flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.formalExamPassRatePercent ?? 0}%
                  </span>
                  <span className="text-xs text-gray-500">
                    ({overview?.pendingExamEvaluationsCount ?? 0} pending eval)
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-gray-500">
                  Formal high-stakes certification attempts only
                </div>
              </div>
            </div>

            {/* Second Row: Attendance, Grading Backlog & Attention */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Average Live Attendance</span>
                  <Video className="w-4 h-4 text-[#4f8c4c]" />
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {overview?.averageLiveAttendancePercent ?? 0}%
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Attended duration vs scheduled time across live classrooms
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Assignment Grading Queue</span>
                  <FileCheck2 className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-700">
                    {overview?.assignmentGradingBacklogCount ?? 0}
                  </span>
                  <span className="text-xs text-gray-500">awaiting faculty review</span>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Submission rate: {overview?.assignmentSubmissionRatePercent ?? 0}%
                </p>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Attention Required</span>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-rose-700">
                    {overview?.studentsRequiringAttentionCount ?? 0}
                  </span>
                  <span className="text-xs text-gray-500">students flagged</span>
                </div>
                <button
                  onClick={() => setActiveTab('attention')}
                  className="mt-2 text-xs font-semibold text-[#4f8c4c] hover:underline flex items-center gap-1"
                >
                  <span>Review Attention Register</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ENROLLMENTS & BATCH CAPACITY */}
        {activeTab === 'enrollments' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                <span>Cohort Batch Occupancy & Available Seats</span>
                <span className="text-xs font-normal text-gray-500">
                  {enrollments?.batches.length || 0} batches configured
                </span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-[#f7f9fc] text-gray-700 font-semibold uppercase text-[10px] tracking-wider border-b border-[#e2efe1]">
                    <tr>
                      <th className="py-2.5 px-3">Batch Name</th>
                      <th className="py-2.5 px-3">Course</th>
                      <th className="py-2.5 px-3">Lead Instructor</th>
                      <th className="py-2.5 px-3 text-center">Capacity</th>
                      <th className="py-2.5 px-3 text-center">Enrolled</th>
                      <th className="py-2.5 px-3 text-center">Available</th>
                      <th className="py-2.5 px-3 text-center">Occupancy</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2efe1]">
                    {enrollments?.batches.map((b) => (
                      <tr key={b.batchId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{b.batchName}</td>
                        <td className="py-2.5 px-3">{b.courseTitle}</td>
                        <td className="py-2.5 px-3">{b.leadInstructorName}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{b.configuredCapacity}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold">{b.activeEnrolledCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{b.availableSeats}</td>
                        <td className="py-2.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  b.occupancyPercent >= 100
                                    ? 'bg-rose-500'
                                    : b.occupancyPercent >= 80
                                    ? 'bg-amber-500'
                                    : 'bg-[#4f8c4c]'
                                }`}
                                style={{ width: `${Math.min(100, b.occupancyPercent)}%` }}
                              />
                            </div>
                            <span className="font-mono text-[11px]">{b.occupancyPercent}%</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              b.occupancyStatus === 'FULL'
                                ? 'bg-rose-100 text-rose-800'
                                : b.occupancyStatus === 'NEAR_CAPACITY'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {b.occupancyStatus}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {(!enrollments?.batches || enrollments.batches.length === 0) && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-gray-400">
                          No cohort batches found for the selected filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: LIVE ATTENDANCE */}
        {activeTab === 'attendance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-xs text-gray-500 font-semibold uppercase">Total Sessions Conducted</span>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {attendance?.totalSessionsConducted ?? 0}
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-xs text-gray-500 font-semibold uppercase">Average Attendance Rate</span>
                <div className="mt-1 text-2xl font-bold text-[#4f8c4c]">
                  {attendance?.averageAttendanceRatePercent ?? 0}%
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
                <span className="text-xs text-gray-500 font-semibold uppercase">Participant Learning Hours</span>
                <div className="mt-1 text-2xl font-bold text-slate-900">
                  {attendance?.totalParticipantHours ?? 0} hrs
                </div>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3">Recent Live Classroom Attendance Sessions</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-[#f7f9fc] text-gray-700 font-semibold uppercase text-[10px] tracking-wider border-b border-[#e2efe1]">
                    <tr>
                      <th className="py-2.5 px-3">Session Title</th>
                      <th className="py-2.5 px-3">Course & Cohort</th>
                      <th className="py-2.5 px-3">Scheduled Start</th>
                      <th className="py-2.5 px-3 text-center">Scheduled Mins</th>
                      <th className="py-2.5 px-3 text-center">Attended / Eligible</th>
                      <th className="py-2.5 px-3 text-center">Attendance %</th>
                      <th className="py-2.5 px-3 text-center">Avg Attended Mins</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2efe1]">
                    {attendance?.recentSessions.map((s) => (
                      <tr key={s.sessionId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{s.sessionTitle}</td>
                        <td className="py-2.5 px-3">
                          {s.courseTitle} ({s.batchName})
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {s.scheduledStartTime ? new Date(s.scheduledStartTime).toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{s.scheduledDurationMinutes}m</td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          {s.attendedStudentCount} / {s.eligibleStudentCount}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-semibold ${
                              s.attendanceRatePercent >= 75
                                ? 'text-emerald-700'
                                : s.attendanceRatePercent >= 50
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {s.attendanceRatePercent}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{s.averageAttendedMinutes}m</td>
                      </tr>
                    ))}
                    {(!attendance?.recentSessions || attendance.recentSessions.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-400">
                          No live sessions recorded in this timeframe.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: ASSESSMENTS & FORMAL HSE EXAMS (STRICT SEPARATION) */}
        {activeTab === 'assessments' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Formative Assessments / Quizzes */}
              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#e2efe1]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>Formative Learning Quizzes</span>
                      <span className="text-[10px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
                        Formative Practice
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">Low-stakes learning check-ins and module reviews</p>
                  </div>
                  <BookOpen className="w-5 h-5 text-blue-600" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-500">Attempts</span>
                    <div className="text-lg font-bold text-gray-800">
                      {assessments?.formativeQuizzes.totalAttemptsCount ?? 0}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-500">Average Score</span>
                    <div className="text-lg font-bold text-blue-700">
                      {assessments?.formativeQuizzes.averageScorePercent ?? 0}%
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-500">Pass Rate</span>
                    <div className="text-lg font-bold text-emerald-700">
                      {assessments?.formativeQuizzes.passRatePercent ?? 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Formal High-Stakes HSE Examinations */}
              <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#e2efe1]">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>High-Stakes HSE Certification Exams</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                        Formal HSE Engine
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">Server-timed, blueprint-governed certification examinations</p>
                  </div>
                  <Award className="w-5 h-5 text-[#4f8c4c]" />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-500">Attempts</span>
                    <div className="text-lg font-bold text-gray-800">
                      {assessments?.formalHseExams.completedAttempts ?? 0}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-500">Pass Rate</span>
                    <div className="text-lg font-bold text-emerald-700">
                      {assessments?.formalHseExams.passRatePercent ?? 0}%
                    </div>
                  </div>
                  <div className="bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    <span className="text-[10px] uppercase font-semibold text-gray-500">Pending Eval</span>
                    <div className="text-lg font-bold text-amber-700">
                      {assessments?.formalHseExams.pendingManualEvaluationCount ?? 0}
                    </div>
                  </div>
                </div>

                {/* Domain Performance */}
                {assessments?.formalHseExams.domainPerformance &&
                  assessments.formalHseExams.domainPerformance.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-semibold text-gray-700">HSE Domain Performance Breakdown</span>
                      {assessments.formalHseExams.domainPerformance.map((dp) => (
                        <div key={dp.domainName} className="flex items-center justify-between text-xs">
                          <span className="text-gray-600">{dp.domainName}</span>
                          <span className="font-mono font-semibold text-gray-800">{dp.averagePercent}%</span>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>

            {/* Coursework & Assignment Queue */}
            <div className="bg-white p-5 rounded-xl border border-[#e2efe1] shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Coursework & Assignment Submissions</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Published</span>
                  <div className="text-xl font-bold text-gray-800">
                    {assessments?.assignments.totalPublished ?? 0}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Received</span>
                  <div className="text-xl font-bold text-gray-800">
                    {assessments?.assignments.totalSubmissionsReceived ?? 0}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Pending Review</span>
                  <div className="text-xl font-bold text-amber-700">
                    {assessments?.assignments.pendingGradingCount ?? 0}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <span className="text-[10px] text-gray-500 uppercase font-semibold">Avg Awarded Score</span>
                  <div className="text-xl font-bold text-[#4f8c4c]">
                    {assessments?.assignments.averageAwardedScorePercent ?? 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: COURSE PROGRESSION */}
        {activeTab === 'progression' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Course Completion & Academic Progression</h3>
                <span className="text-xs font-semibold text-[#4f8c4c]">
                  Overall Completion Rate: {progression?.overallCompletionRatePercent ?? 0}%
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-[#f7f9fc] text-gray-700 font-semibold uppercase text-[10px] tracking-wider border-b border-[#e2efe1]">
                    <tr>
                      <th className="py-2.5 px-3">Course Title</th>
                      <th className="py-2.5 px-3">Certification</th>
                      <th className="py-2.5 px-3 text-center">Enrolled</th>
                      <th className="py-2.5 px-3 text-center">Completed</th>
                      <th className="py-2.5 px-3 text-center">Completion %</th>
                      <th className="py-2.5 px-3 text-center">Avg Lesson Progress</th>
                      <th className="py-2.5 px-3 text-center">Modules / Lessons</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2efe1]">
                    {progression?.courses.map((c) => (
                      <tr key={c.courseId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{c.courseTitle}</td>
                        <td className="py-2.5 px-3 font-mono">{c.certificationType}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{c.enrolledStudentsCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{c.completedStudentsCount}</td>
                        <td className="py-2.5 px-3 text-center font-semibold text-[#4f8c4c]">
                          {c.completionRatePercent}%
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{c.averageLessonProgressPercent}%</td>
                        <td className="py-2.5 px-3 text-center font-mono text-gray-500">
                          {c.totalModulesCount} / {c.totalLessonsCount}
                        </td>
                      </tr>
                    ))}
                    {(!progression?.courses || progression.courses.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-400">
                          No courses available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: STUDENTS REQUIRING ATTENTION (FACTUAL, RULE-BASED) */}
        {activeTab === 'attention' && (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Transparent Factual Attention Register</span>
                <p className="mt-0.5 text-amber-800">
                  Students are flagged solely based on deterministic academic indicators: overdue assignment deadlines,
                  live attendance below 60%, formative quiz averages below 50%, unresolved doubts over 48 hours, or
                  stalled lesson progress. Zero black-box or hallucinated AI scores.
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                <span>Flagged Learners ({attentionList.length})</span>
                <span className="text-xs font-normal text-gray-500">Requires institutional follow-up</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-[#f7f9fc] text-gray-700 font-semibold uppercase text-[10px] tracking-wider border-b border-[#e2efe1]">
                    <tr>
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Course & Cohort</th>
                      <th className="py-2.5 px-3 text-center">Progress</th>
                      <th className="py-2.5 px-3 text-center">Attendance</th>
                      <th className="py-2.5 px-3">Factual Trigger Flags</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2efe1]">
                    {attentionList.map((st) => (
                      <tr key={st.studentId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{st.studentName}</div>
                          <div className="text-[11px] text-gray-400 font-normal">{st.studentEmail}</div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div>{st.courseTitle}</div>
                          <div className="text-[11px] text-gray-400">{st.batchName}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{st.lessonProgressPercent}%</td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span
                            className={st.attendancePercent < 60 ? 'text-rose-600 font-bold' : 'text-gray-700'}
                          >
                            {st.attendancePercent}%
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1.5">
                            {st.flags.map((f, i) => (
                              <span
                                key={i}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  f.severity === 'HIGH'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                                title={f.detail}
                              >
                                <span>{f.reasonLabel}</span>
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => setSelectedStudent(st)}
                            className="text-xs text-[#4f8c4c] font-semibold hover:underline"
                          >
                            Details &rarr;
                          </button>
                        </td>
                      </tr>
                    ))}
                    {attentionList.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-gray-400">
                          <div className="flex flex-col items-center justify-center gap-1">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                            <span>No students currently flagged for academic attention.</span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: FACULTY OPERATIONS */}
        {activeTab === 'faculty' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-[#e2efe1] shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-900">Instructor Academic Workload Matrix</h3>
                <span className="text-xs font-semibold text-gray-600">
                  Total Institutional Grading Backlog: {faculty?.totalGradingBacklog ?? 0}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-600">
                  <thead className="bg-[#f7f9fc] text-gray-700 font-semibold uppercase text-[10px] tracking-wider border-b border-[#e2efe1]">
                    <tr>
                      <th className="py-2.5 px-3">Instructor</th>
                      <th className="py-2.5 px-3 text-center">Courses</th>
                      <th className="py-2.5 px-3 text-center">Batches</th>
                      <th className="py-2.5 px-3 text-center">Active Learners</th>
                      <th className="py-2.5 px-3 text-center">Sessions Held</th>
                      <th className="py-2.5 px-3 text-center">Grading Backlog</th>
                      <th className="py-2.5 px-3 text-center">Doubts Answered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2efe1]">
                    {faculty?.faculty.map((f) => (
                      <tr key={f.instructorId} className="hover:bg-gray-50/60 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          <div>{f.instructorName}</div>
                          <div className="text-[11px] text-gray-400 font-normal">{f.instructorEmail}</div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">{f.assignedCoursesCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{f.assignedBatchesCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold">{f.activeLearnersCount}</td>
                        <td className="py-2.5 px-3 text-center font-mono">{f.liveSessionsConductedCount}</td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`font-mono font-bold ${
                              f.submissionsAwaitingGradingCount > 0 ? 'text-amber-700' : 'text-gray-400'
                            }`}
                          >
                            {f.submissionsAwaitingGradingCount}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono text-emerald-700 font-semibold">
                          {f.doubtsAnsweredCount}
                        </td>
                      </tr>
                    ))}
                    {(!faculty?.faculty || faculty.faculty.length === 0) && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-gray-400">
                          No faculty instructors assigned.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Drill-down Attention Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h4 className="text-sm font-bold text-slate-900">Academic Attention Diagnostic Detail</h4>
              <button
                onClick={() => setSelectedStudent(null)}
                className="text-gray-400 hover:text-gray-600 rounded-lg p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <div className="font-bold text-base text-slate-900">{selectedStudent.studentName}</div>
              <div className="text-xs text-gray-500">{selectedStudent.studentEmail}</div>
              <div className="text-xs text-gray-600 mt-1">
                Course: <span className="font-semibold">{selectedStudent.courseTitle}</span> (
                {selectedStudent.batchName})
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-700 uppercase">Triggered Indicators:</span>
              {selectedStudent.flags.map((f, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-xl border text-xs ${
                    f.severity === 'HIGH'
                      ? 'bg-rose-50 border-rose-200 text-rose-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <div className="font-bold flex items-center justify-between">
                    <span>{f.reasonLabel}</span>
                    <span className="text-[10px] font-semibold uppercase">{f.severity}</span>
                  </div>
                  <div className="mt-1 text-gray-700">{f.detail}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-gray-100">
              <button
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

