'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Users, 
  Calendar, 
  Video, 
  BookOpen, 
  CheckCircle2, 
  Plus, 
  Award,
  Clock,
  ArrowRight
} from 'lucide-react';
import { Batch } from '@/types';

export default function InstructorDashboard() {
  const router = useRouter();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          // Fetch courses to get batches
          fetch('/api/courses')
            .then((r) => r.json())
            .then((cData) => {
              const allBatches: Batch[] = [];
              cData.courses?.forEach((c: any) => {
                if (c.upcomingBatches) allBatches.push(...c.upcomingBatches);
              });
              setBatches(allBatches);
              setLoading(false);
            });
        }
      })
      .catch(() => setLoading(false));
  }, [router]);

  const handleLaunchLiveAsModerator = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/live/${sessionId}/join`, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.joinUrl) {
        router.push(data.joinUrl);
      } else {
        alert(data.error || 'Failed to launch live classroom');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading instructor portal...</p>
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#252c41] to-[#3a7536] text-white rounded-2xl p-6 sm:p-8 mb-10 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="text-xs font-bold text-[#99cd92] uppercase tracking-wider mb-1">
              Instructor Operations Console
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {user?.name || 'Vishnu Rajendran, Lead Mentor'}
            </h1>
            <p className="text-sm text-gray-200 mt-1 max-w-xl">
              Manage your assigned cohorts, moderate live BigBlueButton workshops, monitor student attendance, and grade practice assignments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleLaunchLiveAsModerator('sess-asp-01')}
              className="btn-primary bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold py-2.5 px-5 shadow"
            >
              <Video className="w-4 h-4" />
              <span>Launch Live Room as Host</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Assigned Batches */}
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#252c41] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#4f8c4c]" />
              Assigned Cohort Batches
            </h2>
            <span className="text-xs text-gray-500 font-semibold">
              {batches.length} Active Batches
            </span>
          </div>

          <div className="space-y-4">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="card-elevated p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="badge-navy text-[10px]">
                      {batch.status}
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Starts: {new Date(batch.startDate).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-[#252c41]">
                    {batch.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {batch.scheduleDescription}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-gray-600 pt-2">
                    <span className="flex items-center gap-1 font-semibold text-gray-800">
                      <Users className="w-3.5 h-3.5 text-[#4f8c4c]" />
                      {batch.enrolledCount} / {batch.capacity} Students Enrolled
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handleLaunchLiveAsModerator('sess-asp-01')}
                    className="btn-outline text-xs py-2 px-4 w-full sm:w-auto"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Host Session</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Sidebar: Student Roster & Live Status */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-xl border border-[#eaedf5] p-5 shadow-xs">
            <h3 className="font-bold text-base text-[#252c41] mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-[#4f8c4c]" />
              Active Cohort Roster (ASP Nov)
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-[#eaedf5] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#252c41]">Arjun Menon</div>
                  <div className="text-[11px] text-gray-500">Progress: 45% • 2 Lessons Completed</div>
                </div>
                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">
                  ATTENDED
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#eaedf5] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#252c41]">Priya Sharma</div>
                  <div className="text-[11px] text-gray-500">Progress: 60% • 3 Lessons Completed</div>
                </div>
                <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">
                  ATTENDED
                </span>
              </div>

              <div className="p-3 rounded-lg border border-[#eaedf5] flex items-center justify-between">
                <div>
                  <div className="font-bold text-[#252c41]">Mohammed Farhan</div>
                  <div className="text-[11px] text-gray-500">Progress: 30% • 1 Lesson Completed</div>
                </div>
                <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded">
                  ENROLLED
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
