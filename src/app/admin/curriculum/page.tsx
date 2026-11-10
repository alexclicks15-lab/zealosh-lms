'use client';

import React, { useState, useEffect } from 'react';
import { VisualCurriculumTree } from '@/components/academic/VisualCurriculumTree';
import { BookOpen, Layers, ShieldCheck, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminCurriculumPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch('/api/courses');
        if (res.ok) {
          const data = await res.json();
          const list = data.courses || data || [];
          setCourses(list);
          if (list.length > 0) {
            setSelectedCourseId(list[0].id);
          }
        }
      } catch (err) {
        console.error('Failed to load courses', err);
      } finally {
        setLoading(false);
      }
    }
    loadCourses();
  }, []);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <Link
              href="/admin"
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Workspace</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              <BookOpen className="w-6 h-6 text-[#4f8c4c]" />
              Academic Curriculum Authoring & Syllabus Control
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Authoritative visual hierarchy management across modules, technical topics, subtopics, and historical syllabus snapshots.
            </p>
          </div>

          {/* Course Selector Dropdown */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-slate-700 whitespace-nowrap">Select Program:</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="bg-white border border-[#e2efe1] rounded-lg px-3 py-2 text-xs font-semibold text-slate-800 shadow-2xs focus:ring-2 focus:ring-[#4f8c4c] focus:outline-hidden"
              disabled={loading || courses.length === 0}
            >
              {courses.map((crs) => (
                <option key={crs.id} value={crs.id}>
                  {crs.title} ({crs.code || crs.id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Visual Tree Component */}
        {selectedCourse ? (
          <VisualCurriculumTree
            courseId={selectedCourse.id}
            courseTitle={selectedCourse.title}
            canEdit={true}
          />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500 text-sm">
            {loading ? 'Loading course curriculum...' : 'No courses available in this academic catalog.'}
          </div>
        )}
      </div>
    </div>
  );
}

