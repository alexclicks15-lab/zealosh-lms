'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Video,
  Award,
  Users,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  RefreshCw,
  Search,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  CalendarDays,
  List,
  Sparkles,
} from 'lucide-react';
import { CalendarEvent, CalendarEventType, ScheduleConflict, InstitutionalHoliday } from '@/types';

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<InstitutionalHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'month' | 'agenda' | 'conflicts'>('agenda');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedCourse, setSelectedCourse] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Conflict state
  const [conflicts, setConflicts] = useState<ScheduleConflict[]>([]);
  const [conflictLoading, setConflictLoading] = useState(false);

  // Reschedule modal
  const [rescheduleModalOpen, setRescheduleModalOpen] = useState(false);
  const [activeRescheduleEvent, setActiveRescheduleEvent] = useState<CalendarEvent | null>(null);
  const [newStartTime, setNewStartTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduleSubmitting, setRescheduleSubmitting] = useState(false);
  const [rescheduleMessage, setRescheduleMessage] = useState<string | null>(null);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = currentDate;
      // 30 days before and 60 days after
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 28).toISOString();

      let url = `/api/calendar?startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`;
      if (selectedType !== 'ALL') {
        url += `&eventType=${encodeURIComponent(selectedType)}`;
      }
      if (selectedCourse !== 'ALL') {
        url += `&courseId=${encodeURIComponent(selectedCourse)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load calendar events');
      }

      setEvents(data.events || []);
      setHolidays(data.holidays || []);
    } catch (err: any) {
      setError(err.message || 'Error loading calendar');
    } finally {
      setLoading(false);
    }
  }, [currentDate, selectedType, selectedCourse]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  // Filter events by search query
  const filteredEvents = events.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.title.toLowerCase().includes(q) ||
      (e.courseName && e.courseName.toLowerCase().includes(q)) ||
      (e.batchName && e.batchName.toLowerCase().includes(q))
    );
  });

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRescheduleEvent) return;

    setRescheduleSubmitting(true);
    setRescheduleMessage(null);
    try {
      const res = await fetch('/api/calendar/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceEntityType: activeRescheduleEvent.sourceEntityType,
          sourceEntityId: activeRescheduleEvent.sourceEntityId,
          newStartTime,
          reason: rescheduleReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reschedule event');
      }

      setRescheduleMessage('Event successfully rescheduled and participants notified.');
      setTimeout(() => {
        setRescheduleModalOpen(false);
        setActiveRescheduleEvent(null);
        setNewStartTime('');
        setRescheduleReason('');
        setRescheduleMessage(null);
        fetchCalendarData();
      }, 1200);
    } catch (err: any) {
      setRescheduleMessage(`Error: ${err.message}`);
    } finally {
      setRescheduleSubmitting(false);
    }
  };

  const getEventTypeBadge = (type: CalendarEventType) => {
    switch (type) {
      case 'BATCH_SESSION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">LIVE COHORT</span>;
      case 'EXAM':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">EXAMINATION</span>;
      case 'ORIENTATION':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">ORIENTATION</span>;
      case 'HOLIDAY':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">HOLIDAY</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-800">ACADEMIC</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-slate-900 pb-16">
      {/* Header Banner */}
      <div className="bg-[#252c41] text-white py-8 px-4 sm:px-8 border-b border-gray-800">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 mb-1">
              <CalendarDays className="w-4 h-4" />
              <span>ZEALOSH ACADEMIC OPERATIONS & SCHEDULING CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Master Institutional Calendar
            </h1>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl">
              Coordinated calendar engine unifying batch cohort timetables, live classrooms, examination sitting windows, course orientation sessions, and institutional holidays.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors border border-white/10"
            >
              <span>Governance Console</span>
            </Link>
            <Link
              href="/admin/admissions"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#4f8c4c] hover:bg-[#3a7536] text-white transition-colors"
            >
              <Users className="w-3.5 h-3.5" />
              <span>Admissions & Pipeline</span>
            </Link>
            <button
              onClick={() => fetchCalendarData()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8">
        {/* Navigation & Controls Bar */}
        <div className="bg-white rounded-xl border border-[#eaedf5] p-4 mb-6 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          {/* View Toggles */}
          <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('agenda')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'agenda' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Timeline / Agenda</span>
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'month' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>Month Grid</span>
            </button>
            <button
              onClick={() => setViewMode('conflicts')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                viewMode === 'conflicts' ? 'bg-white text-slate-900 shadow-xs' : 'text-gray-600 hover:text-slate-900'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span>Conflict Inspector</span>
            </button>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event, course, batch..."
                className="w-full text-xs pl-8 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
              />
            </div>

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg font-semibold text-gray-700"
            >
              <option value="ALL">All Event Types</option>
              <option value="BATCH_SESSION">Live Cohort Sessions</option>
              <option value="ORIENTATION">Orientation Sessions</option>
              <option value="EXAM">Certification Exams</option>
              <option value="HOLIDAY">Institutional Holidays</option>
            </select>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* AGENDA / TIMELINE VIEW */}
        {viewMode === 'agenda' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500 px-1 font-semibold">
              <span>Showing {filteredEvents.length} scheduled institutional events</span>
              <span>Timezone: Asia/Kolkata (IST, UTC+05:30)</span>
            </div>

            {filteredEvents.length === 0 ? (
              <div className="bg-white rounded-xl border border-[#eaedf5] p-12 text-center">
                <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">No scheduled events match current filters</p>
                <p className="text-xs text-gray-500 mt-1">Adjust filters or create a new batch timetable</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="bg-white rounded-xl border border-[#eaedf5] p-4 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${
                          ev.eventType === 'BATCH_SESSION'
                            ? 'bg-blue-50 text-blue-600'
                            : ev.eventType === 'ORIENTATION'
                            ? 'bg-emerald-50 text-[#4f8c4c]'
                            : ev.eventType === 'EXAM'
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-rose-50 text-rose-600'
                        }`}
                      >
                        {ev.eventType === 'BATCH_SESSION' ? (
                          <Video className="w-5 h-5" />
                        ) : ev.eventType === 'ORIENTATION' ? (
                          <Users className="w-5 h-5" />
                        ) : ev.eventType === 'EXAM' ? (
                          <Award className="w-5 h-5" />
                        ) : (
                          <CalendarDays className="w-5 h-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          {getEventTypeBadge(ev.eventType)}
                          {ev.courseName && (
                            <span className="text-[11px] font-bold text-gray-600">{ev.courseName}</span>
                          )}
                          {ev.batchName && (
                            <span className="text-[10px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              {ev.batchName}
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900">{ev.title}</h3>
                        {ev.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{ev.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end justify-between gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        <span>
                          {new Date(ev.startTime).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          •{' '}
                          {new Date(ev.startTime).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {(ev.sourceEntityType === 'LIVE_SESSION' || ev.sourceEntityType === 'ORIENTATION') && (
                          <button
                            onClick={() => {
                              setActiveRescheduleEvent(ev);
                              setNewStartTime(ev.startTime.slice(0, 16));
                              setRescheduleModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded-md text-[11px] font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                          >
                            Reschedule
                          </button>
                        )}

                        {ev.meetingId && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                            VC: {ev.meetingId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MONTH GRID VIEW */}
        {viewMode === 'month' && (
          <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs text-center space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-800">
                {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentDate(new Date())}
                  className="px-3 py-1 rounded-lg text-xs font-semibold border border-gray-200 hover:bg-gray-50"
                >
                  Today
                </button>
                <button
                  onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-2 text-xs font-bold text-gray-500 pb-2 border-b border-gray-100">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>

            <div className="grid grid-cols-7 gap-2 min-h-[300px]">
              {Array.from({ length: 35 }).map((_, i) => {
                const dayNum = ((i + 1) % 31) + 1;
                const dayEvents = filteredEvents.filter((e) => {
                  const d = new Date(e.startTime);
                  return d.getDate() === dayNum && d.getMonth() === currentDate.getMonth();
                });

                return (
                  <div
                    key={i}
                    className="h-24 p-1.5 rounded-lg border border-gray-100 bg-gray-50/50 flex flex-col justify-between text-left hover:bg-white hover:border-[#4f8c4c]/40 transition-colors"
                  >
                    <span className="text-[11px] font-bold text-gray-500">{dayNum}</span>
                    <div className="space-y-1 overflow-hidden">
                      {dayEvents.slice(0, 2).map((de) => (
                        <div
                          key={de.id}
                          className="text-[9px] font-bold truncate px-1 rounded bg-[#4f8c4c]/10 text-[#3a7536]"
                          title={de.title}
                        >
                          {de.title}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="text-[8px] text-gray-400 font-bold block">
                          +{dayEvents.length - 2} more
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CONFLICT INSPECTOR */}
        {viewMode === 'conflicts' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Instructor & Cohort Scheduling Conflict Inspector</span>
              </h2>
              <p className="text-xs text-gray-500 leading-relaxed max-w-3xl">
                The Zealosh scheduling engine continuously audits live classroom timetables against faculty availability, batch allocations, and institutional holidays. Overlapping sessions on the same instructor or cohort are strictly flagged.
              </p>

              <div className="mt-6 border-t border-gray-100 pt-6">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-4 rounded-xl">
                  <CheckCircle2 className="w-5 h-5 text-[#4f8c4c] shrink-0" />
                  <div>
                    <p className="font-bold">Zero active schedule conflicts detected.</p>
                    <p className="text-[11px] text-emerald-700 font-normal mt-0.5">
                      All live classes and orientation sessions are cleanly partitioned across instructors and batches.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Official Institutional Holidays */}
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#4f8c4c]" />
                <span>Institutional Academic Holidays (2026)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {holidays.map((h) => (
                  <div key={h.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <span className="text-xs font-bold text-slate-800 block">{h.name}</span>
                    <span className="text-[11px] text-gray-500 block mt-0.5">{h.date}</span>
                    <span className="text-[10px] text-emerald-700 font-semibold mt-1 inline-block">
                      {h.affectsBatches ? 'Classes Suspended' : 'Administrative Only'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Reschedule Modal */}
      {rescheduleModalOpen && activeRescheduleEvent && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Reschedule Event: {activeRescheduleEvent.title}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Current Time: {new Date(activeRescheduleEvent.startTime).toLocaleString('en-IN')}
            </p>

            {rescheduleMessage && (
              <div className="mb-4 p-3 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
                {rescheduleMessage}
              </div>
            )}

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  New Start Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  required
                  value={newStartTime}
                  onChange={(e) => setNewStartTime(e.target.value)}
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reschedule Justification / Reason *
                </label>
                <textarea
                  required
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Explain why this session is being rescheduled for audit logs..."
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRescheduleModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduleSubmitting}
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#4f8c4c] hover:bg-[#3a7536] text-white transition-colors"
                >
                  {rescheduleSubmitting ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

