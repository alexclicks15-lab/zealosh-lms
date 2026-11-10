'use client';

import React, { useState, useEffect } from 'react';
import {
  Clock,
  Calendar,
  Plus,
  Trash2,
  CheckCircle,
  XCircle,
  Video,
  User,
  AlertCircle,
} from 'lucide-react';
import { InstructorOfficeHour, MentorshipAppointment } from '@/types';

export function InstructorOfficeHoursManager() {
  const [officeHours, setOfficeHours] = useState<InstructorOfficeHour[]>([]);
  const [appointments, setAppointments] = useState<MentorshipAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [startTime, setStartTime] = useState('10:00');
  const [endTime, setEndTime] = useState('13:00');
  const [slotDuration, setSlotDuration] = useState(30);
  const [instructions, setInstructions] = useState('Zealosh VC 1-on-1 virtual mentoring room');

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [ohRes, appRes] = await Promise.all([
        fetch('/api/mentorship/office-hours'),
        fetch('/api/mentorship/appointments'),
      ]);

      if (ohRes.ok) {
        const d = await ohRes.json();
        setOfficeHours(d.officeHours || []);
      }
      if (appRes.ok) {
        const d = await appRes.json();
        setAppointments(d.appointments || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load mentorship data', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddOfficeHour(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch('/api/mentorship/office-hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dayOfWeek,
          startTime,
          endTime,
          slotDurationMinutes: slotDuration,
          meetingInstructions: instructions,
        }),
      });

      if (res.ok) {
        const created = await res.json();
        setOfficeHours([...officeHours, created]);
        setShowAddForm(false);
        setMessage({ text: 'Office hour window created successfully', type: 'success' });
      } else {
        const d = await res.json();
        setMessage({ text: d.error || 'Failed to create office hour', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  async function handleDeleteOfficeHour(id: string) {
    try {
      const res = await fetch(`/api/mentorship/office-hours?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setOfficeHours(officeHours.filter((oh) => oh.id !== id));
        setMessage({ text: 'Office hour window removed', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  async function handleAppointmentAction(appointmentId: string, action: 'CONFIRM' | 'CANCEL') {
    try {
      const res = await fetch('/api/mentorship/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action, reason: 'Updated by instructor' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(appointments.map((a) => (a.id === updated.id ? updated : a)));
        setMessage({ text: `Appointment ${action.toLowerCase()}ed`, type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold underline ml-3">Dismiss</button>
        </div>
      )}

      {/* Top Banner & Action */}
      <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-[#4f8c4c]" />
            Faculty Office Hours & 1-on-1 Mentorship Roster
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define recurring weekly availability windows for individual student guidance and technical blueprint consultations.
          </p>
        </div>

        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="btn-primary text-xs py-2 px-4 bg-[#4f8c4c] hover:bg-[#3a7536] text-white font-bold flex items-center gap-1.5 shadow"
        >
          <Plus className="w-4 h-4" />
          <span>{showAddForm ? 'Close Form' : 'Add Availability Window'}</span>
        </button>
      </div>

      {/* Add Office Hours Form */}
      {showAddForm && (
        <form onSubmit={handleAddOfficeHour} className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-gray-100 pb-2">New Recurring Availability Window</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Day of Week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full text-xs p-2 rounded border border-gray-300 bg-white"
              >
                {DAYS.map((d, idx) => (
                  <option key={idx} value={idx}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Time (HH:MM)</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs p-2 rounded border border-gray-300 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Time (HH:MM)</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-xs p-2 rounded border border-gray-300 bg-white"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Slot Duration</label>
              <select
                value={slotDuration}
                onChange={(e) => setSlotDuration(Number(e.target.value))}
                className="w-full text-xs p-2 rounded border border-gray-300 bg-white"
              >
                <option value={15}>15 Minutes</option>
                <option value={30}>30 Minutes</option>
                <option value={45}>45 Minutes</option>
                <option value={60}>60 Minutes</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Meeting Venue / Instructions</label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs p-2 rounded border border-gray-300 bg-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="btn-outline text-xs py-1.5 px-3 text-gray-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary text-xs py-1.5 px-4 bg-[#4f8c4c] text-white font-bold rounded"
            >
              Save Window
            </button>
          </div>
        </form>
      )}

      {/* Grid: Office Hours Windows & Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Availability Windows */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#4f8c4c]" />
            Configured Office Hours
          </h3>

          {loading ? (
            <div className="text-xs text-gray-400 py-6 text-center">Loading office hours...</div>
          ) : officeHours.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">No office hour windows configured yet.</div>
          ) : (
            officeHours.map((oh) => (
              <div
                key={oh.id}
                className="p-3 rounded-lg border border-gray-200 text-xs flex items-center justify-between bg-slate-50/50"
              >
                <div>
                  <span className="font-bold text-slate-900">{DAYS[oh.dayOfWeek]}</span>
                  <div className="text-gray-600 mt-0.5">
                    {oh.startTime} – {oh.endTime} ({oh.slotDurationMinutes} min slots)
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteOfficeHour(oh.id)}
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50"
                  title="Delete window"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Booked Appointments */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4 text-[#4f8c4c]" />
            Student Mentorship Bookings ({appointments.length})
          </h3>

          {loading ? (
            <div className="text-xs text-gray-400 py-6 text-center">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="text-xs text-gray-400 py-6 text-center">No appointments booked yet.</div>
          ) : (
            appointments.map((app) => (
              <div
                key={app.id}
                className="p-3.5 rounded-lg border border-gray-200 text-xs bg-white space-y-2 shadow-2xs"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 text-sm">{app.studentName || 'Learner'}</span>
                    <span className="text-[11px] text-gray-400 ml-2">({app.studentEmail})</span>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      app.status === 'CONFIRMED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : app.status === 'CANCELLED'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {app.status}
                  </span>
                </div>

                <div className="text-gray-600 flex items-center gap-2 text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>
                    {new Date(app.scheduledStart).toLocaleDateString()} at{' '}
                    {new Date(app.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} –{' '}
                    {new Date(app.scheduledEnd).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({app.durationMinutes}m)
                  </span>
                </div>

                {app.studentNotes && (
                  <p className="text-[11px] text-slate-700 bg-slate-50 p-2 rounded border border-gray-100">
                    <strong className="text-gray-500">Student Note:</strong> {app.studentNotes}
                  </p>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-gray-400 font-mono">Room: {app.meetingRoomId}</span>
                  {app.status === 'BOOKED' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAppointmentAction(app.id, 'CONFIRM')}
                        className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Confirm</span>
                      </button>
                      <button
                        onClick={() => handleAppointmentAction(app.id, 'CANCEL')}
                        className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>Cancel</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

