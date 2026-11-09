'use client';

// Zealosh LMS — Phase 5C.3 Student Helpdesk & Service Operations Hub
// Route: /support
// Single place for learners and instructors to submit and track support requests.

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Plus,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  ChevronRight,
  BookOpen,
  Layers,
  Paperclip,
  X,
  MessageSquare,
  ShieldCheck,
} from 'lucide-react';
import { SupportCategory, SupportTicket, SupportTicketPriority } from '@/types';

export default function SupportHelpdeskPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [courses, setCourses] = useState<Array<{ id: string; title: string }>>([]);
  const [batches, setBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'OPEN' | 'WAITING_FOR_REQUESTER' | 'RESOLVED' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Ticket Form State
  const [subject, setSubject] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [priority, setPriority] = useState<SupportTicketPriority>('NORMAL');
  const [relatedCourseId, setRelatedCourseId] = useState('');
  const [relatedBatchId, setRelatedBatchId] = useState('');
  const [description, setDescription] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  async function fetchInitialData() {
    setIsLoading(true);
    try {
      // 1. Fetch Active Support Categories
      const catRes = await fetch('/api/support/categories');
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
        if (catData.categories?.length > 0 && !categoryId) {
          setCategoryId(catData.categories[0].id);
        }
      }

      // 2. Fetch User's Tickets
      const tktRes = await fetch('/api/support/tickets');
      if (tktRes.ok) {
        const tktData = await tktRes.json();
        setTickets(tktData.tickets || []);
      }

      // 3. Fetch Available Courses & Batches for academic linking
      const crsRes = await fetch('/api/courses');
      if (crsRes.ok) {
        const crsData = await crsRes.json();
        setCourses(crsData.courses || []);
      }
      const bthRes = await fetch('/api/batches');
      if (bthRes.ok) {
        const bthData = await bthRes.json();
        setBatches(bthData.batches || []);
      }
    } catch (err) {
      console.error('[SupportPage] Failed loading data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const selectedCategory = categories.find((c) => c.id === categoryId);

  async function handleCreateTicket(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!subject.trim() || subject.trim().length < 3) {
      setFormError('Subject must be at least 3 characters long.');
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setFormError('Description must be at least 5 characters long.');
      return;
    }
    if (selectedCategory?.requiresAcademicContext && !relatedCourseId && !relatedBatchId) {
      setFormError(`"${selectedCategory.name}" requires selecting an associated course or cohort batch.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const attachments = attachmentName.trim()
        ? [
            {
              originalFilename: attachmentName.trim(),
              sanitizedFilename: attachmentName.trim().replace(/[^a-zA-Z0-9.-]/g, '_'),
              contentType: 'application/octet-stream',
              fileSize: 1024,
              storageKey: `support/mock-${Date.now()}-${attachmentName.trim()}`,
            },
          ]
        : undefined;

      const payload = {
        categoryId,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        relatedCourseId: relatedCourseId || undefined,
        relatedBatchId: relatedBatchId || undefined,
        attachments,
      };

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit support ticket.');
      }

      // Reset form and refresh list
      setSubject('');
      setDescription('');
      setAttachmentName('');
      setRelatedCourseId('');
      setRelatedBatchId('');
      setIsModalOpen(false);

      // Refresh tickets
      const tktRes = await fetch('/api/support/tickets');
      if (tktRes.ok) {
        const tktData = await tktRes.json();
        setTickets(tktData.tickets || []);
      }
    } catch (err: any) {
      setFormError(err.message || 'An error occurred submitting your ticket.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (activeTab === 'OPEN') {
      if (!['NEW', 'OPEN', 'IN_PROGRESS'].includes(t.status)) return false;
    } else if (activeTab === 'WAITING_FOR_REQUESTER') {
      if (t.status !== 'WAITING_FOR_REQUESTER') return false;
    } else if (activeTab === 'RESOLVED') {
      if (t.status !== 'RESOLVED') return false;
    } else if (activeTab === 'CLOSED') {
      if (t.status !== 'CLOSED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNumber = t.ticketNumber.toLowerCase().includes(q);
      const matchSubject = t.subject.toLowerCase().includes(q);
      const matchCategory = t.categoryName.toLowerCase().includes(q);
      if (!matchNumber && !matchSubject && !matchCategory) return false;
    }
    return true;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'NEW':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">New</span>;
      case 'OPEN':
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Progress</span>;
      case 'WAITING_FOR_REQUESTER':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Awaiting Your Reply</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Resolved</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-600 border border-gray-200">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-50 text-gray-700">{status}</span>;
    }
  }

  function getPriorityBadge(p: string) {
    switch (p) {
      case 'URGENT':
        return <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">Urgent</span>;
      case 'HIGH':
        return <span className="text-[10px] font-bold uppercase text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded">High</span>;
      case 'NORMAL':
        return <span className="text-[10px] font-medium uppercase text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">Normal</span>;
      case 'LOW':
        return <span className="text-[10px] font-medium uppercase text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">Low</span>;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Breadcrumbs & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-[#e2efe1] shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/student" className="hover:text-[#4f8c4c] transition-colors">Student Portal</Link>
              <span>/</span>
              <span className="text-gray-800 font-semibold">Helpdesk & Support</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <LifeBuoy className="w-7 h-7 text-[#4f8c4c]" />
              Zealosh Student Helpdesk
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Authoritative academic and technical service operations. Inquiries are tracked in real-time.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create Support Ticket</span>
          </button>
        </div>

        {/* Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#e2efe1]">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'All Requests' },
              { id: 'OPEN', label: 'Active & In Progress' },
              { id: 'WAITING_FOR_REQUESTER', label: 'Action Required' },
              { id: 'RESOLVED', label: 'Resolved' },
              { id: 'CLOSED', label: 'Closed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#4f8c4c] text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by ticket # or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c] focus:ring-1 focus:ring-[#4f8c4c]"
            />
          </div>
        </div>

        {/* Tickets List */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-[#e2efe1] p-12 text-center text-gray-500 text-xs">
            Loading your support requests...
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#e2efe1] p-12 text-center">
            <LifeBuoy className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-900 mb-1">No support tickets found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
              {searchQuery
                ? 'No tickets match your search criteria. Try a different term or clear the filter.'
                : 'You currently have no open or past support inquiries recorded.'}
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold py-2 px-4 rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Ticket</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTickets.map((t) => (
              <Link
                key={t.id}
                href={`/support/tickets/${t.id}`}
                className="block bg-white hover:bg-[#fbfcfd] border border-[#e2efe1] hover:border-[#4f8c4c] rounded-xl p-5 transition-all shadow-xs group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-xs text-[#4f8c4c] bg-[#e1f0df] px-2.5 py-0.5 rounded-md">
                      {t.ticketNumber}
                    </span>
                    {getStatusBadge(t.status)}
                    {getPriorityBadge(t.priority)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    <span>Updated {new Date(t.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#4f8c4c] transition-colors mb-1.5">
                  {t.subject}
                </h3>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mb-3">
                  {t.description}
                </p>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100 text-[11px] text-gray-500">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium">
                      {t.categoryName}
                    </span>
                    {t.relatedCourseTitle && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <BookOpen className="w-3 h-3 text-[#4f8c4c]" />
                        <span>{t.relatedCourseTitle}</span>
                      </span>
                    )}
                    {t.relatedBatchName && (
                      <span className="flex items-center gap-1 text-gray-600">
                        <Layers className="w-3 h-3 text-[#4f8c4c]" />
                        <span>{t.relatedBatchName}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[#4f8c4c] font-bold">
                    <span>View Conversation</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Ticket Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl max-w-xl w-full p-6 space-y-4 shadow-xl border border-gray-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <LifeBuoy className="w-5 h-5 text-[#4f8c4c]" />
                  <h2 className="text-base font-bold text-slate-900">Submit Support Inquiry</h2>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateTicket} className="space-y-4 text-xs">
                {/* Subject */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="Briefly state your question or issue..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c] focus:ring-1 focus:ring-[#4f8c4c]"
                  />
                </div>

                {/* Category & Priority Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Category</label>
                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c]"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Urgency</label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c]"
                    >
                      <option value="LOW">Low — General inquiry</option>
                      <option value="NORMAL">Normal — Standard request</option>
                      <option value="HIGH">High — Urgent coursework blocker</option>
                      <option value="URGENT">Urgent — Examination/exam integrity issue</option>
                    </select>
                  </div>
                </div>

                {/* Category Context Advisory */}
                {selectedCategory?.description && (
                  <p className="text-[11px] text-gray-500 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                    {selectedCategory.description}
                  </p>
                )}

                {/* Academic Context (Required if category demands it, or optional) */}
                {selectedCategory?.requiresAcademicContext && (
                  <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg space-y-2.5">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-[11px]">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Academic Association Required</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-gray-600 mb-1">Related Course</label>
                        <select
                          value={relatedCourseId}
                          onChange={(e) => setRelatedCourseId(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-200 bg-white"
                        >
                          <option value="">Select course...</option>
                          {courses.map((crs) => (
                            <option key={crs.id} value={crs.id}>
                              {crs.title}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-600 mb-1">Related Batch</label>
                        <select
                          value={relatedBatchId}
                          onChange={(e) => setRelatedBatchId(e.target.value)}
                          className="w-full text-xs px-2.5 py-1.5 rounded border border-gray-200 bg-white"
                        >
                          <option value="">Select batch...</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Detailed Explanation</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide details, steps taken, or specific questions..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c] focus:ring-1 focus:ring-[#4f8c4c]"
                  />
                </div>

                {/* Attachment Input */}
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Attachment Reference (Optional)</label>
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. error-screenshot.png or assignment-draft.pdf"
                      value={attachmentName}
                      onChange={(e) => setAttachmentName(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded-lg border border-gray-200"
                    />
                  </div>
                </div>

                {/* Modal Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 text-xs font-bold bg-[#4f8c4c] hover:bg-[#3a7536] text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Support Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

