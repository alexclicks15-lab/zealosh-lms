'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Filter, 
  Clock, 
  BookOpen, 
  Users, 
  ChevronRight, 
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { Course, CertificationType, DeliveryModel } from '@/types';

export default function CoursesPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [certFilter, setCertFilter] = useState<string>('ALL');
  const [deliveryFilter, setDeliveryFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/courses?cert=${certFilter}&delivery=${deliveryFilter}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.courses) setCourses(data.courses);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [certFilter, deliveryFilter]);

  const certOptions = ['ALL', 'ASP', 'CSP', 'CRSP', 'CIT'];
  const deliveryOptions = ['ALL', 'HYBRID', 'LIVE', 'RECORDED', 'MATERIALS_ONLY'];

  return (
    <div className="py-12 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="mb-10 text-center sm:text-left">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#252c41] tracking-tight">
          HSE Certification Courses & Batches
        </h1>
        <p className="text-gray-600 mt-2 text-base max-w-3xl">
          Browse our premier preparatory programs for international health, safety, and environmental certifications. Select a batch to view schedules and enrollment capacity.
        </p>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 sm:p-5 rounded-xl border border-[#eaedf5] shadow-xs mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
          <Filter className="w-4 h-4 text-[#4f8c4c]" />
          <span>Filters:</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Cert Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {certOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setCertFilter(opt)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  certFilter === opt
                    ? 'bg-[#4f8c4c] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          <span className="text-gray-300 hidden md:inline">|</span>

          {/* Delivery Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {deliveryOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setDeliveryFilter(opt)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                  deliveryFilter === opt
                    ? 'bg-[#252c41] text-white shadow-xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Course Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-96 bg-gray-200 rounded-xl" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#eaedf5] p-12 text-center">
          <p className="text-gray-500 text-sm">No courses match the selected filters.</p>
          <button
            onClick={() => {
              setCertFilter('ALL');
              setDeliveryFilter('ALL');
            }}
            className="btn-outline text-xs mt-4 mx-auto"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {courses.map((course) => (
            <div
              key={course.id}
              className="card-elevated flex flex-col justify-between overflow-hidden group"
            >
              <div>
                <div className="relative h-48 w-full overflow-hidden bg-gray-100">
                  <Image
                    src={course.coverImage}
                    alt={course.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-3 left-3 bg-[#252c41]/90 text-white text-xs font-bold px-2.5 py-1 rounded-md backdrop-blur-xs">
                    {course.certificationType}
                  </div>
                  <div className="absolute top-3 right-3 bg-[#4f8c4c] text-white text-xs font-bold px-2.5 py-1 rounded-md shadow-xs">
                    {course.deliveryModel}
                  </div>
                </div>

                <div className="p-6">
                  <h3 className="font-bold text-lg text-[#252c41] mb-2 group-hover:text-[#4f8c4c] transition-colors leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-gray-500 line-clamp-3 mb-4 leading-relaxed">
                    {course.headline}
                  </p>

                  {/* Highlights */}
                  <div className="space-y-1.5 text-xs text-gray-600 border-t border-[#eaedf5] pt-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        Program Length:
                      </span>
                      <span className="font-semibold text-gray-800">{course.durationWeeks} Weeks</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-gray-500">
                        <BookOpen className="w-3.5 h-3.5" />
                        Curriculum Content:
                      </span>
                      <span className="font-semibold text-gray-800">{course.totalLessons} Lessons ({course.totalHours} hrs)</span>
                    </div>
                  </div>

                  {/* Active Batches Indicator */}
                  {course.upcomingBatches && course.upcomingBatches.length > 0 && (
                    <div className="bg-[#f1f8f0] border border-[#c3e2be] rounded-lg p-2.5 mb-2 text-xs">
                      <div className="font-bold text-[#3a7536] flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#4f8c4c]" />
                        <span>Upcoming Cohort:</span>
                      </div>
                      <div className="text-gray-700 font-medium mt-0.5 truncate">
                        {course.upcomingBatches[0].name}
                      </div>
                      <div className="text-[11px] text-gray-500 flex justify-between mt-1">
                        <span>Capacity: {course.upcomingBatches[0].enrolledCount} / {course.upcomingBatches[0].capacity}</span>
                        <span className="text-[#3a7536] font-semibold">
                          {course.upcomingBatches[0].capacity - course.upcomingBatches[0].enrolledCount} seats left
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 pt-0">
                <div className="flex items-center justify-between pt-3 border-t border-[#eaedf5] mb-4">
                  <div>
                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Fee (India)</div>
                    <div className="text-xl font-black text-[#252c41]">
                      ₹{course.priceInr.toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-gray-400 font-semibold uppercase">Fee (International)</div>
                    <div className="text-base font-bold text-gray-700">${course.priceUsd} USD</div>
                  </div>
                </div>

                <Link
                  href={`/courses/${course.slug}`}
                  className="w-full btn-primary text-xs py-2.5"
                >
                  <span>Select Cohort & Enroll</span>
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
