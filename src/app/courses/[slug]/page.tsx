'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  Users, 
  Video, 
  BookOpen, 
  FileText, 
  Award,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Batch } from '@/types';

export default function CourseDetailPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<any>(null);
  const [enrollmentError, setEnrollmentError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/courses/${params.slug}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.course) {
          setCourse(data.course);
          if (data.course.batches?.length > 0) {
            setSelectedBatchId(data.course.batches[0].id);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  const handleEnroll = async () => {
    if (!selectedBatchId) return;
    setEnrolling(true);
    setEnrollmentError('');
    setEnrollmentSuccess(null);

    try {
      const res = await fetch(`/api/batches/${selectedBatchId}/enroll`, {
        method: 'POST',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Enrollment failed');
      }

      setEnrollmentSuccess(data);
    } catch (err: any) {
      setEnrollmentError(err.message);
    } finally {
      setEnrolling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading course curriculum...</p>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-800">Course Not Found</h2>
        <Link href="/courses" className="btn-primary text-xs mt-4 inline-flex">
          Back to Course Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-[#4f8c4c]">Home</Link>
        <span>/</span>
        <Link href="/courses" className="hover:text-[#4f8c4c]">Courses</Link>
        <span>/</span>
        <span className="text-gray-800 font-medium truncate">{course.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Main Left Content */}
        <div className="lg:col-span-8 space-y-10">
          <div>
            <div className="flex flex-wrap items-center gap-2.5 mb-3">
              <span className="bg-[#252c41] text-white text-xs font-bold px-3 py-1 rounded-md">
                {course.certificationType} PREPARATION
              </span>
              <span className="badge-green">
                {course.deliveryModel}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#252c41] tracking-tight leading-tight mb-4">
              {course.title}
            </h1>
            <p className="text-base text-gray-600 leading-relaxed">
              {course.headline}
            </p>
          </div>

          {/* Success Banner */}
          {enrollmentSuccess && (
            <div className="bg-[#e1f0df] border-2 border-[#4f8c4c] rounded-xl p-5 animate-in fade-in">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-[#3a7536] shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-bold text-[#3a7536] text-base">
                    Enrollment Confirmed!
                  </h4>
                  <p className="text-xs text-gray-700 mt-1">
                    {enrollmentSuccess.message}. Your student access has been provisioned and synchronized with the Moodle learning engine.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-4">
                    <Link
                      href={`/learn/${course.id}`}
                      className="btn-primary text-xs py-2 px-4 shadow-sm"
                    >
                      <span>Start Learning Now</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                    <Link
                      href="/student"
                      className="btn-secondary text-xs py-2 px-4"
                    >
                      Go to Student Hub
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Learning Objectives */}
          <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
            <h3 className="font-bold text-lg text-[#252c41] mb-4 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#4f8c4c]" />
              Learning Objectives & Blueprint Competencies
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700">
              {course.learningObjectives?.map((obj: string, i: number) => (
                <div key={i} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                  <span>{obj}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Curriculum Modules */}
          <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
            <h3 className="font-bold text-lg text-[#252c41] mb-2 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#4f8c4c]" />
              Course Curriculum & Sample Lessons
            </h3>
            <p className="text-xs text-gray-500 mb-6">
              Includes pre-recorded theory, downloadable quick cards, formula sheets, and live problem sessions.
            </p>

            <div className="space-y-3">
              {course.lessons?.map((lesson: any, i: number) => (
                <div
                  key={lesson.id}
                  className="p-4 rounded-lg border border-[#eaedf5] hover:border-gray-300 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#f1f8f0] text-[#3a7536] flex items-center justify-center font-bold text-xs shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[#252c41]">
                        {lesson.title}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {lesson.moduleTitle} • {lesson.durationMinutes} minutes
                      </div>
                    </div>
                  </div>

                  {lesson.isFreePreview && (
                    <span className="text-[11px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded">
                      Free Preview
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Instructor Bio */}
          {course.leadInstructor && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
              <h3 className="font-bold text-lg text-[#252c41] mb-4">
                Lead Instructor & Mentor
              </h3>
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="w-20 h-20 rounded-full overflow-hidden relative border-2 border-[#4f8c4c] shrink-0">
                  <Image
                    src={course.leadInstructor.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                    alt={course.leadInstructor.name}
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <h4 className="text-base font-bold text-[#252c41]">
                    {course.leadInstructor.name}
                  </h4>
                  <p className="text-xs text-[#3a7536] font-semibold mt-0.5">
                    Lead Safety Consultant & Certified Trainer
                  </p>
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed">
                    Vishnu Rajendran brings over a decade of high-consequence industrial safety, international audit, and certification coaching experience, successfully preparing hundreds of professionals for BCSP and BCRSP designations.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar: Batch Selection & Enrollment Action */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card-elevated p-6 sticky top-24">
            <div className="relative h-44 w-full rounded-lg overflow-hidden mb-6 bg-gray-100">
              <Image
                src={course.coverImage}
                alt={course.title}
                fill
                className="object-cover"
              />
            </div>

            <div className="mb-6">
              <div className="text-xs text-gray-400 font-semibold uppercase">Total Investment</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-[#252c41]">
                  ₹{course.priceInr.toLocaleString()}
                </span>
                <span className="text-sm font-semibold text-gray-500">
                  (${course.priceUsd} USD)
                </span>
              </div>
            </div>

            {/* Select Batch */}
            <div className="mb-6">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Select Cohort Batch
              </label>

              <div className="space-y-2.5">
                {course.batches?.map((batch: Batch) => {
                  const isFull = batch.enrolledCount >= batch.capacity;
                  const isSelected = selectedBatchId === batch.id;

                  return (
                    <div
                      key={batch.id}
                      onClick={() => !isFull && setSelectedBatchId(batch.id)}
                      className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                        isFull
                          ? 'opacity-60 bg-gray-50 border-gray-200 cursor-not-allowed'
                          : isSelected
                          ? 'border-2 border-[#4f8c4c] bg-[#f1f8f0]'
                          : 'border-[#eaedf5] hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#252c41]">
                          {batch.name}
                        </span>
                        {isFull ? (
                          <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded">
                            FULL
                          </span>
                        ) : (
                          <span className="text-[10px] bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded">
                            {batch.capacity - batch.enrolledCount} seats left
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-1">
                        {batch.scheduleDescription}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Enrollment Error Notice */}
            {enrollmentError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{enrollmentError}</span>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={handleEnroll}
              disabled={enrolling || !selectedBatchId}
              className="w-full btn-primary py-3 text-sm shadow-md"
            >
              {enrolling ? 'Provisioning Entitlement...' : 'Enroll in Selected Cohort'}
            </button>

            <div className="mt-4 text-[11px] text-center text-gray-500">
              Guaranteed Seat Reservation • Immediate LMS Access
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
