'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  CheckCircle,
  Video,
  ArrowLeft,
  BookOpen,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { MentorshipAppointment } from '@/types';

export default function StudentMentorshipPage() {
  const [instructors, setInstructors] = useState<any[]>([]);
  const [selectedInstructorId, setSelectedInstructorId] = useState<string>('');
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() + 86400000).toISOString().split('T')[0] // Tomorrow
  );
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any | null>(null);
  const [studentNotes, setStudentNotes] = useState('');
  const [appointments, setAppointments] = useState<MentorshipAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      setLoading(true);
      try {
        const [crsRes, appRes, ohRes] = await Promise.all([
          fetch('/api/courses'),
          fetch('/api/mentorship/appointments'),
          fetch('/api/mentorship/office-hours'),
        ]);

        if (crsRes.ok) {
          const d = await crsRes.json();
          const list = d.courses || d || [];
          setCourses(list);
          if (list.length > 0) setSelectedCourseId(list[0].id);
        }

        if (appRes.ok) {
          const d = await appRes.json();
          setAppointments(d.appointments || []);
        }

        if (ohRes.ok) {
          const d = await ohRes.json();
          const ohList: any[] = d.officeHours || [];
          // Extract unique instructors from office hours
          const instMap = new Map();
          for (const oh of ohList) {
            if (oh.instructorId) {
              instMap.set(oh.instructorId, {
                id: oh.instructorId,
                name: oh.instructorName || 'Senior Faculty',
              });
            }
          }
          const instArr = Array.from(instMap.values());
          setInstructors(instArr);
          if (instArr.length > 0) {
            setSelectedInstructorId(instArr[0].id);
          }
        }
      } catch (err: any) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!selectedInstructorId || !selectedDate) return;
    async function fetchSlots() {
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const url = `/api/mentorship/slots?instructorId=${selectedInstructorId}&courseId=${selectedCourseId}&date=${selectedDate}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setSlots(data.slots || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setSlotsLoading(false);
      }
    }
    fetchSlots();
  }, [selectedInstructorId, selectedCourseId, selectedDate]);

  async function handleBookSession(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSlot || !selectedInstructorId || !selectedCourseId) return;
    setBooking(true);
    try {
      const res = await fetch('/api/mentorship/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instructorId: selectedInstructorId,
          courseId: selectedCourseId,
          officeHourId: selectedSlot.officeHourId,
          scheduledStart: selectedSlot.startTime,
          scheduledEnd: selectedSlot.endTime,
          durationMinutes: selectedSlot.durationMinutes,
          studentNotes,
        }),
      });

      if (res.ok) {
        const booked = await res.json();
        setAppointments([booked, ...appointments]);
        setSelectedSlot(null);
        setStudentNotes('');
        setMessage({ text: '1-on-1 Mentorship session successfully booked!', type: 'success' });
        // Refresh slots
        const url = `/api/mentorship/slots?instructorId=${selectedInstructorId}&courseId=${selectedCourseId}&date=${selectedDate}`;
        fetch(url).then(r => r.json()).then(d => setSlots(d.slots || []));
      } else {
        const err = await res.json();
        setMessage({ text: err.error || 'Failed to book slot', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setBooking(false);
    }
  }

  async function handleCancel(appointmentId: string) {
    if (!confirm('Cancel this mentorship appointment?')) return;
    try {
      const res = await fetch('/api/mentorship/appointments', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, action: 'CANCEL', reason: 'Cancelled by student' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAppointments(appointments.map((a) => (a.id === updated.id ? updated : a)));
        setMessage({ text: 'Appointment cancelled', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <Link
            href="/student"
            className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 mb-2 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Student Portal</span>
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-[#4f8c4c]" />
            1-on-1 Faculty Mentorship & Office Hours
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Book dedicated 1-on-1 technical advisory sessions with certified faculty mentors for examination guidance and formula workshops.
          </p>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Booking Column */}
          <div className="lg:col-span-7 bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs space-y-5">
            <h2 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#4f8c4c]" />
              Book a Mentorship Session
            </h2>

            <form onSubmit={handleBookSession} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Select Mentor</label>
                  <select
                    value={selectedInstructorId}
                    onChange={(e) => setSelectedInstructorId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                    disabled={instructors.length === 0}
                  >
                    {instructors.map((inst) => (
                      <option key={inst.id} value={inst.id}>{inst.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Program / Subject</label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                  >
                    {courses.map((crs) => (
                      <option key={crs.id} value={crs.id}>{crs.title}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Consultation Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                  required
                />
              </div>

              {/* Slots Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Available Consultation Slots ({slots.filter(s => !s.isBooked).length} available)
                </label>

                {slotsLoading ? (
                  <div className="text-xs text-gray-400 py-4 text-center">Checking faculty availability...</div>
                ) : slots.length === 0 ? (
                  <div className="text-xs text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200">
                    No office hours available on this date. Please select another day.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {slots.map((s, idx) => {
                      const isSelected = selectedSlot?.startTime === s.startTime;
                      const timeLabel = `${new Date(s.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} (${s.durationMinutes}m)`;

                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={s.isBooked}
                          onClick={() => setSelectedSlot(s)}
                          className={`p-2.5 rounded-lg text-xs font-semibold border transition text-center ${
                            s.isBooked
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                              : isSelected
                              ? 'bg-[#4f8c4c] text-white border-[#4f8c4c] shadow-xs'
                              : 'bg-white text-slate-800 border-gray-200 hover:border-[#4f8c4c]'
                          }`}
                        >
                          {timeLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Session Agenda / Questions for Mentor</label>
                <textarea
                  value={studentNotes}
                  onChange={(e) => setStudentNotes(e.target.value)}
                  placeholder="e.g. Need clarification on Domain 4: Fire Prevention calculations and hydraulic formula derivation..."
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white"
                  rows={3}
                />
              </div>

              <button
                type="submit"
                disabled={!selectedSlot || booking}
                className="w-full btn-primary py-2.5 px-4 bg-[#4f8c4c] hover:bg-[#3a7536] text-white font-bold text-xs rounded-lg shadow disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                <span>{booking ? 'Confirming Booking...' : 'Confirm 1-on-1 Mentorship Booking'}</span>
              </button>
            </form>
          </div>

          {/* My Appointments Column */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-slate-900 border-b border-gray-100 pb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-[#4f8c4c]" />
              My Scheduled Consultations ({appointments.length})
            </h2>

            {appointments.length === 0 ? (
              <div className="text-xs text-gray-400 py-8 text-center">
                You have no scheduled mentorship consultations. Select a date and book with a faculty mentor.
              </div>
            ) : (
              <div className="space-y-3">
                {appointments.map((app) => (
                  <div
                    key={app.id}
                    className="p-3.5 rounded-lg border border-gray-200 text-xs bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{app.courseTitle || 'HSE Consultation'}</span>
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
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      <span>
                        {new Date(app.scheduledStart).toLocaleDateString()} at{' '}
                        {new Date(app.scheduledStart).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="text-gray-500 text-[11px]">
                      Faculty Mentor: <strong className="text-slate-800">{app.instructorName}</strong>
                    </div>

                    {app.status !== 'CANCELLED' && (
                      <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                        <span className="text-[10px] text-gray-400 font-mono">Room: {app.meetingRoomId}</span>
                        <button
                          onClick={() => handleCancel(app.id)}
                          className="text-[11px] font-bold text-red-600 hover:underline flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Cancel</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

