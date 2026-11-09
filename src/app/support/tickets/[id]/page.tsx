'use client';

// Zealosh LMS — Phase 5C.3 Student Ticket Conversation View
// Route: /support/tickets/[id]
// Real-time conversation thread strictly scoped to PUBLIC messages.
// Internal notes and administrative internal audit records are 100% excluded.

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  LifeBuoy,
  ArrowLeft,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  User,
  Shield,
  BookOpen,
  Layers,
  Paperclip,
  Check,
  RefreshCw,
} from 'lucide-react';
import { SupportTicket, SupportTicketMessage } from '@/types';

export default function StudentTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reply composer state
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [ticketId]);

  async function fetchTicket() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to load support ticket.');
      }
      setTicket(data.ticket);
    } catch (err: any) {
      setError(err.message || 'Error loading support ticket.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;

    setIsSubmitting(true);
    setReplyError(null);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: replyText.trim(), visibility: 'PUBLIC' }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post reply.');
      }

      setReplyText('');
      await fetchTicket();
    } catch (err: any) {
      setReplyError(err.message || 'Failed to post reply.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCloseTicket() {
    if (!ticket) return;
    setIsClosing(true);
    try {
      const res = await fetch(`/api/support/tickets/${encodeURIComponent(ticketId)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: 'Requester has accepted the resolution and marked this ticket as closed. Thank you.',
          visibility: 'PUBLIC',
        }),
      });

      // Update status via admin/status route or reload
      await fetchTicket();
    } catch (err) {
      console.error('[StudentTicket] Error closing:', err);
    } finally {
      setIsClosing(false);
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'NEW':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">New</span>;
      case 'OPEN':
      case 'IN_PROGRESS':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Progress</span>;
      case 'WAITING_FOR_REQUESTER':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">Action Required</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">Resolved</span>;
      case 'CLOSED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Closed</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-50 text-gray-700">{status}</span>;
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/support"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#4f8c4c] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Helpdesk</span>
          </Link>
          <button
            onClick={fetchTicket}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200"
            title="Refresh Conversation"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="bg-white rounded-xl border border-[#e2efe1] p-12 text-center text-gray-500 text-xs">
            Loading ticket thread...
          </div>
        ) : error || !ticket ? (
          <div className="bg-white rounded-xl border border-red-200 p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
            <h2 className="text-sm font-bold text-gray-900">Support Ticket Not Found</h2>
            <p className="text-xs text-gray-500 max-w-sm mx-auto">
              {error || 'This support request does not exist or you do not have permission to access it.'}
            </p>
            <Link
              href="/support"
              className="inline-flex items-center gap-1.5 bg-[#4f8c4c] text-white text-xs font-bold py-2 px-4 rounded-lg"
            >
              Return to Helpdesk
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Ticket Header Card */}
            <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold text-sm text-[#4f8c4c] bg-[#e1f0df] px-3 py-1 rounded-md">
                    {ticket.ticketNumber}
                  </span>
                  {getStatusBadge(ticket.status)}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5 text-gray-400" />
                  <span>Submitted {new Date(ticket.createdAt).toLocaleString()}</span>
                </div>
              </div>

              <div>
                <h1 className="text-xl font-black text-slate-900 mb-2">{ticket.subject}</h1>
                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                  <span className="bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded font-medium">
                    {ticket.categoryName}
                  </span>
                  {ticket.relatedCourseTitle && (
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <BookOpen className="w-3.5 h-3.5 text-[#4f8c4c]" />
                      <span>{ticket.relatedCourseTitle}</span>
                    </span>
                  )}
                  {ticket.relatedBatchName && (
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Layers className="w-3.5 h-3.5 text-[#4f8c4c]" />
                      <span>{ticket.relatedBatchName}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Action Required Banner */}
              {ticket.status === 'WAITING_FOR_REQUESTER' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5 text-amber-900 text-xs">
                  <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Your response is needed.</span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      Support staff has requested additional details. Please reply below so we can continue assisting you.
                    </p>
                  </div>
                </div>
              )}

              {/* Resolved Banner */}
              {ticket.status === 'RESOLVED' && (
                <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-lg flex items-center justify-between text-purple-900 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>This ticket has been marked as <strong>Resolved</strong> by our operations team.</span>
                  </div>
                  <span className="text-[11px] text-purple-700 font-medium">Reply below anytime to reopen.</span>
                </div>
              )}
            </div>

            {/* Conversation Messages Thread */}
            <div className="space-y-4">
              <h2 className="text-xs font-black uppercase tracking-wider text-gray-500 px-1">
                Conversation History
              </h2>

              {(!ticket.messages || ticket.messages.length === 0) ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-xs text-gray-500">
                  No public messages found on this inquiry.
                </div>
              ) : (
                ticket.messages.map((msg, index) => {
                  const isRequester = msg.authorUserId === ticket.requesterUserId;
                  return (
                    <div
                      key={msg.id}
                      className={`p-5 rounded-xl border shadow-xs transition-all ${
                        isRequester
                          ? 'bg-white border-[#e2efe1]'
                          : 'bg-[#fbfcfd] border-[#4f8c4c]/40 ring-1 ring-[#4f8c4c]/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                              isRequester
                                ? 'bg-gray-100 text-gray-700'
                                : 'bg-[#e1f0df] text-[#3a7536]'
                            }`}
                          >
                            {isRequester ? <User className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-900">
                              {isRequester ? `${msg.authorName} (You)` : `${msg.authorName} • Student Services`}
                            </span>
                            {!isRequester && (
                              <span className="ml-2 bg-[#4f8c4c] text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                                Official Staff Response
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {new Date(msg.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap pl-9">
                        {msg.body}
                      </div>

                      {/* Message Attachments */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="mt-3 pl-9 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                          {msg.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="inline-flex items-center gap-1.5 text-[11px] bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-md text-gray-700"
                            >
                              <Paperclip className="w-3 h-3 text-gray-400" />
                              <span>{att.originalFilename}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Reply Composer */}
            {ticket.status !== 'CLOSED' ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-3">
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                  <Send className="w-3.5 h-3.5 text-[#4f8c4c]" />
                  <span>Post a Response</span>
                </h3>

                {replyError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{replyError}</span>
                  </div>
                )}

                <form onSubmit={handleSendReply} className="space-y-3">
                  <textarea
                    rows={4}
                    required
                    placeholder="Type your reply here..."
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    className="w-full text-xs p-3 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c] focus:ring-1 focus:ring-[#4f8c4c] leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-gray-400">
                      Your response will notify the assigned support team.
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmitting || !replyText.trim()}
                      className="inline-flex items-center gap-1.5 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold py-2 px-4 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSubmitting ? 'Sending...' : 'Send Reply'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-xs text-gray-500">
                This support ticket has been closed. If you require further assistance, please create a new support ticket.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

