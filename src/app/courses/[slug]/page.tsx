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
  AlertCircle,
  PackageCheck,
  Send,
  HelpCircle
} from 'lucide-react';
import { Batch, ProductOffering } from '@/types';

export default function CourseDetailPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [course, setCourse] = useState<any>(null);
  const [offerings, setOfferings] = useState<ProductOffering[]>([]);
  const [selectedOfferingId, setSelectedOfferingId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [enrolling, setEnrolling] = useState(false);
  const [enrollmentSuccess, setEnrollmentSuccess] = useState<any>(null);
  const [enrollmentError, setEnrollmentError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Inquiry modal state
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquirySuccess, setInquirySuccess] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/courses/${params.slug}`).then((res) => (res.ok ? res.json() : null)),
      fetch(`/api/commerce/products/${params.slug}`).then((res) => (res.ok ? res.json() : null)),
    ])
      .then(([courseData, productData]) => {
        if (courseData?.course) {
          setCourse(courseData.course);
          if (courseData.course.batches?.length > 0) {
            setSelectedBatchId(courseData.course.batches[0].id);
          }
        }
        if (productData?.product?.offerings?.length > 0) {
          setOfferings(productData.product.offerings);
          setSelectedOfferingId(productData.product.offerings[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.slug]);

  const selectedOffering = offerings.find((o) => o.id === selectedOfferingId);
  const displayPriceInr = selectedOffering ? selectedOffering.priceInr : course?.priceInr || 0;
  const displayPriceUsd = selectedOffering ? selectedOffering.priceUsd : course?.priceUsd || 0;

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

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryName || !inquiryEmail) {
      setInquiryError('Name and email are required');
      return;
    }
    setSubmittingInquiry(true);
    setInquiryError('');

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: inquiryName,
          email: inquiryEmail,
          phone: inquiryPhone,
          courseInterest: course?.id,
          offeringInterest: selectedOfferingId,
          notes: inquiryNotes,
          source: 'COURSE_PAGE_INQUIRY',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit inquiry');
      }

      setInquirySuccess(true);
    } catch (err: any) {
      setInquiryError(err.message);
    } finally {
      setSubmittingInquiry(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 max-w-7xl mx-auto px-4 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-[#4f8c4c] border-t-transparent rounded-full mx-auto" />
        <p className="text-gray-500 text-sm mt-3">Loading course curriculum and offerings...</p>
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
              <span className="bg-[#1e481c] text-white text-xs font-bold px-3 py-1 rounded-md">
                {course.certificationType} PREPARATION
              </span>
              <span className="badge-green">
                {course.deliveryModel}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
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
                    {enrollmentSuccess.message}. Your student access has been provisioned and synchronized with the Zealosh Learning engine.
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

          {/* Published Offerings Overview (Workstream B Decoupling) */}
          {offerings.length > 0 && (
            <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs">
              <h3 className="font-bold text-lg text-slate-900 mb-2 flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-[#4f8c4c]" />
                Available Learning Packages & Offerings
              </h3>
              <p className="text-xs text-gray-500 mb-6">
                Choose the access package tailored to your career schedule, from self-paced question banks to full mentor-led cohorts.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {offerings.map((off) => {
                  const isSelected = selectedOfferingId === off.id;
                  return (
                    <div
                      key={off.id}
                      onClick={() => setSelectedOfferingId(off.id)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-2 border-[#4f8c4c] bg-[#f1f8f0] shadow-xs'
                          : 'border-[#eaedf5] hover:border-gray-300 bg-white'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                            {off.offeringType.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-500">
                            {off.validityDays} Days Access
                          </span>
                        </div>
                        <h4 className="font-bold text-sm text-slate-900 leading-snug mb-2">
                          {off.title}
                        </h4>
                        <div className="text-lg font-black text-slate-900 mb-3">
                          ₹{off.priceInr.toLocaleString()}
                          {off.priceUsd && (
                            <span className="text-xs font-normal text-gray-500 ml-1.5">
                              (${off.priceUsd} USD)
                            </span>
                          )}
                        </div>
                        <ul className="text-[11px] text-gray-600 space-y-1.5 mb-4">
                          {off.featuresList?.slice(0, 3).map((feat, i) => (
                            <li key={i} className="flex items-start gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#4f8c4c] shrink-0 mt-0.5" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <button
                        type="button"
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          isSelected
                            ? 'bg-[#4f8c4c] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {isSelected ? 'Selected Package' : 'Select Package'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Learning Objectives */}
          <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs">
            <h3 className="font-bold text-lg text-slate-900 mb-4 flex items-center gap-2">
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
          <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs">
            <h3 className="font-bold text-lg text-slate-900 mb-2 flex items-center gap-2">
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
                  className="p-4 rounded-lg border border-[#e2efe1] hover:border-gray-300 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#f1f8f0] text-[#3a7536] flex items-center justify-center font-bold text-xs shrink-0">
                      {i + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
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
            <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs">
              <h3 className="font-bold text-lg text-slate-900 mb-4">
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
                  <h4 className="text-base font-bold text-slate-900">
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
                src={
                  course.coverImage && course.coverImage !== '/images/cover.jpg'
                    ? course.coverImage
                    : '/logo.png'
                }
                alt={course.title}
                fill
                className="object-cover"
              />
            </div>

            <div className="mb-6">
              <div className="text-xs text-gray-400 font-semibold uppercase">
                {selectedOffering ? selectedOffering.title : 'Total Investment'}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-slate-900">
                  ₹{displayPriceInr.toLocaleString()}
                </span>
                {displayPriceUsd && (
                  <span className="text-sm font-semibold text-gray-500">
                    (${displayPriceUsd} USD)
                  </span>
                )}
              </div>
              {selectedOffering && (
                <div className="text-[11px] text-[#3a7536] font-semibold mt-1">
                  Includes {selectedOffering.validityDays} days authoritative entitlement access
                </div>
              )}
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
                          : 'border-[#e2efe1] hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">
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

            {/* Academic Inquiry CTA */}
            <button
              type="button"
              onClick={() => {
                setShowInquiryModal(true);
                setInquirySuccess(false);
              }}
              className="w-full mt-3 py-2.5 px-4 bg-white border border-[#4f8c4c] text-[#3a7536] hover:bg-[#f1f8f0] rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Talk to Admissions Advisor</span>
            </button>

            <div className="mt-4 text-[11px] text-center text-gray-500">
              Guaranteed Seat Reservation • Immediate LMS Access
            </div>
          </div>
        </div>
      </div>

      {/* Inquiry Modal */}
      {showInquiryModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-[#eaedf5]">
            <button
              onClick={() => setShowInquiryModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-sm font-bold"
            >
              ✕
            </button>

            {inquirySuccess ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-12 h-12 text-[#4f8c4c] mx-auto mb-3" />
                <h3 className="text-lg font-bold text-slate-900">Inquiry Received!</h3>
                <p className="text-xs text-gray-600 mt-2">
                  Thank you for your interest in Zealosh certification programs. Our academic team will contact you within 24 hours.
                </p>
                <button
                  onClick={() => setShowInquiryModal(false)}
                  className="btn-primary text-xs mt-5 py-2 px-6"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2 text-[#3a7536]">
                  <Send className="w-5 h-5" />
                  <h3 className="font-bold text-base text-slate-900">
                    Connect with an Admissions Advisor
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  Have questions about BCSP prerequisites, exam formats, or course offerings? Leave your details below.
                </p>

                {inquiryError && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    {inquiryError}
                  </div>
                )}

                <form onSubmit={handleInquirySubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      placeholder="e.g. Arun Kumar"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                      placeholder="e.g. arun@company.com"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Phone / WhatsApp</label>
                    <input
                      type="tel"
                      value={inquiryPhone}
                      onChange={(e) => setInquiryPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Questions or Career Background</label>
                    <textarea
                      rows={3}
                      value={inquiryNotes}
                      onChange={(e) => setInquiryNotes(e.target.value)}
                      placeholder="Tell us your current safety certifications or target exam timeline..."
                      className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowInquiryModal(false)}
                      className="btn-secondary py-2 px-4 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submittingInquiry}
                      className="btn-primary py-2 px-5 text-xs"
                    >
                      {submittingInquiry ? 'Sending...' : 'Submit Inquiry'}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
