'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  ShieldCheck,
  Star,
  CheckCircle2,
  XCircle,
  Eye,
  AlertTriangle,
  Filter,
  Check,
  X,
  ArrowLeft,
  RefreshCw,
  Award,
} from 'lucide-react';
import { StudentReview } from '@/types';

export default function AdminTestimonialsPage() {
  const [reviews, setReviews] = useState<StudentReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [actionMsg, setActionMsg] = useState<string>('');
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  const loadReviews = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/testimonials/admin');
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const handleModerate = async (reviewId: string, decision: 'APPROVED' | 'PUBLISHED' | 'REJECTED' | 'HIDDEN', reason?: string) => {
    try {
      const res = await fetch(`/api/testimonials/${reviewId}/moderate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moderatorId: 'usr-super-admin',
          decision,
          rejectionReason: reason,
          notes: `Moderated to ${decision} by Admin`,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActionMsg(`Review successfully transitioned to ${decision}.`);
        setRejectingId(null);
        setRejectReason('');
        loadReviews();
        setTimeout(() => setActionMsg(''), 4000);
      } else {
        alert(`Moderation error: ${data.error}`);
      }
    } catch (err: any) {
      alert(`Moderation failed: ${err.message}`);
    }
  };

  const filteredReviews = reviews.filter(r => {
    if (filterStatus === 'ALL') return true;
    return r.submissionStatus === filterStatus;
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc] text-[#252c41]">
      {/* Top Banner */}
      <header className="bg-[#252c41] text-white py-6 px-6 border-b border-[#eaedf5]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link href="/admin" className="text-xs text-slate-400 hover:text-white flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Admin Console
              </Link>
              <span className="text-slate-500">/</span>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-[#4f8c4c] text-white">
                Track 5 Reputation
              </span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Student Reviews & Testimonials Moderation Queue
            </h1>
            <p className="text-slate-300 text-sm mt-0.5">
              Enforce granular publication consent, verify enrolled student eligibility, and maintain institutional reputation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadReviews}
              className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {actionMsg && (
          <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-5 h-5 text-[#4f8c4c]" />
            {actionMsg}
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#eaedf5] mb-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold uppercase text-slate-500">Filter by Status:</span>
            {['ALL', 'SUBMITTED', 'APPROVED', 'PUBLISHED', 'REJECTED', 'CONSENT_REVOKED'].map(st => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  filterStatus === st
                    ? 'bg-[#4f8c4c] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="text-xs text-slate-500 font-medium">
            Showing <strong>{filteredReviews.length}</strong> of <strong>{reviews.length}</strong> reviews
          </div>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-3 border-[#4f8c4c] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-xs text-slate-500">Loading reviews queue...</p>
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#eaedf5] p-12 text-center text-slate-500">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="font-bold text-base text-slate-700">No reviews found</p>
            <p className="text-xs text-slate-400 mt-1">
              {filterStatus === 'ALL'
                ? 'No student reviews have been submitted yet.'
                : `No reviews matching status "${filterStatus}".`}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map(r => (
              <div
                key={r.id}
                className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-slate-100 text-slate-700">
                        {r.category}
                      </span>
                      <span className="text-xs text-slate-400">•</span>
                      <span className="text-xs font-semibold text-slate-600">{r.courseTitle}</span>
                      <span className="text-xs text-slate-400">•</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          r.submissionStatus === 'PUBLISHED'
                            ? 'bg-green-100 text-green-800'
                            : r.submissionStatus === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800'
                            : r.submissionStatus === 'REJECTED'
                            ? 'bg-red-100 text-red-800'
                            : r.submissionStatus === 'CONSENT_REVOKED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {r.submissionStatus}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-[#252c41] flex items-center gap-2">
                      {r.studentName}
                      <span className="text-xs text-slate-400 font-normal">({r.studentId})</span>
                    </h3>

                    {/* Star Rating */}
                    <div className="flex items-center gap-1 my-2">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= r.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                      <span className="text-xs font-bold text-slate-600 ml-1.5">{r.rating}/5</span>
                    </div>

                    <p className="text-sm text-slate-700 italic bg-slate-50 p-3 rounded-lg border border-slate-100 mt-2">
                      &ldquo;{r.reviewText}&rdquo;
                    </p>
                  </div>

                  {/* Moderation Actions */}
                  <div className="flex flex-wrap md:flex-col items-end gap-2 shrink-0">
                    {r.submissionStatus !== 'PUBLISHED' && (
                      <button
                        onClick={() => handleModerate(r.id, 'PUBLISHED')}
                        className="bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Check className="w-3.5 h-3.5" /> Publish Publicly
                      </button>
                    )}

                    {r.submissionStatus === 'SUBMITTED' && (
                      <button
                        onClick={() => handleModerate(r.id, 'APPROVED')}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                    )}

                    {r.submissionStatus !== 'REJECTED' && (
                      <button
                        onClick={() => setRejectingId(rejectingId === r.id ? null : r.id)}
                        className="bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" /> Reject...
                      </button>
                    )}

                    {r.submissionStatus === 'PUBLISHED' && (
                      <button
                        onClick={() => handleModerate(r.id, 'HIDDEN')}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" /> Hide
                      </button>
                    )}
                  </div>
                </div>

                {/* Rejection Prompt */}
                {rejectingId === r.id && (
                  <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-xs">
                    <p className="font-bold text-red-800 mb-1.5">Mandatory Rejection Justification:</p>
                    <input
                      type="text"
                      placeholder="Provide specific reason for rejection..."
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      className="w-full p-2 rounded border border-red-300 text-xs mb-2 text-slate-800"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setRejectingId(null)}
                        className="px-3 py-1 rounded bg-slate-200 text-slate-700 font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleModerate(r.id, 'REJECTED', rejectReason)}
                        disabled={!rejectReason.trim()}
                        className="px-3 py-1 rounded bg-red-600 text-white font-semibold disabled:opacity-50"
                      >
                        Confirm Rejection
                      </button>
                    </div>
                  </div>
                )}

                {/* Granular Consent Matrix */}
                <div className="mt-4 pt-3 border-t border-[#eaedf5] text-xs text-slate-500">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 block mb-1.5">
                    Granular Student Consent (v{r.consent.consentVersion}):
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.consent.allowPublicTestimonial
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      Public Testimonial: {r.consent.allowPublicTestimonial ? 'YES' : 'NO'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.consent.allowPublicDisplayName
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      Display Name: {r.consent.allowPublicDisplayName ? 'REAL NAME' : 'REDACTED'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.consent.allowPublicPhoto
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      Photo: {r.consent.allowPublicPhoto ? 'PERMITTED' : 'REDACTED'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.consent.allowSocialMedia
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      Social Syndication: {r.consent.allowSocialMedia ? 'YES' : 'NO'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.consent.allowAchievementPoster
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      Poster Showcase: {r.consent.allowAchievementPoster ? 'YES' : 'NO'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
