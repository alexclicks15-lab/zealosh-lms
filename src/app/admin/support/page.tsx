'use client';

// Zealosh LMS — Phase 5C.3 Support Triage Operations Console
// Route: /admin/support
// Comprehensive queue management, team/agent assignment, status lifecycle,
// and private internal note / public reply composition.

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Search,
  Filter,
  Clock,
  CheckCircle,
  AlertCircle,
  User,
  Shield,
  Send,
  Eye,
  EyeOff,
  UserCheck,
  Tag,
  Paperclip,
  ArrowRight,
  RefreshCw,
  BarChart3,
  Download,
  AlertTriangle,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  SupportTicket,
  SupportCategory,
  SupportTeam,
  SupportTicketStatus,
  SupportTicketPriority,
  SupportMessageVisibility,
} from '@/types';

export default function AdminSupportTriagePage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [categories, setCategories] = useState<SupportCategory[]>([]);
  const [teams, setTeams] = useState<SupportTeam[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Staff message composer
  const [replyBody, setReplyBody] = useState('');
  const [replyVisibility, setReplyVisibility] = useState<SupportMessageVisibility>('PUBLIC');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  // Status & Assignment quick actions
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [assignTeamModalOpen, setAssignTeamModalOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');

  useEffect(() => {
    fetchQueueData();
  }, []);

  async function fetchQueueData() {
    setIsLoading(true);
    try {
      const [tktRes, catRes, teamRes] = await Promise.all([
        fetch('/api/admin/support/tickets'),
        fetch('/api/support/categories'),
        fetch('/api/admin/support/teams'),
      ]);

      if (tktRes.ok) {
        const tktData = await tktRes.json();
        setTickets(tktData.tickets || []);
        if (tktData.tickets?.length > 0 && !selectedTicket) {
          fetchTicketDetail(tktData.tickets[0].id);
        }
      }
      if (catRes.ok) {
        const catData = await catRes.json();
        setCategories(catData.categories || []);
      }
      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeams(teamData.teams || []);
      }
    } catch (err) {
      console.error('[AdminSupport] Error fetching queue:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchTicketDetail(ticketId: string) {
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${encodeURIComponent(ticketId)}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTicket(data.ticket);
      }
    } catch (err) {
      console.error('[AdminSupport] Error loading detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;

    setIsSendingReply(true);
    setComposerError(null);
    try {
      const res = await fetch(`/api/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: replyBody.trim(),
          visibility: replyVisibility,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post staff response.');
      }

      setReplyBody('');
      await fetchTicketDetail(selectedTicket.id);

      // Refresh triage queue
      const qRes = await fetch('/api/admin/support/tickets');
      if (qRes.ok) {
        const qData = await qRes.json();
        setTickets(qData.tickets || []);
      }
    } catch (err: any) {
      setComposerError(err.message || 'Error sending reply.');
    } finally {
      setIsSendingReply(false);
    }
  }

  async function handleStatusChange(newStatus: SupportTicketStatus) {
    if (!selectedTicket) return;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchTicketDetail(selectedTicket.id);
        const qRes = await fetch('/api/admin/support/tickets');
        if (qRes.ok) {
          const qData = await qRes.json();
          setTickets(qData.tickets || []);
        }
      }
    } catch (err) {
      console.error('[AdminSupport] Status update failed:', err);
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function handleAssignTeam() {
    if (!selectedTicket || !selectedTeamId) return;
    try {
      const res = await fetch(`/api/admin/support/tickets/${encodeURIComponent(selectedTicket.id)}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedTeamId: selectedTeamId }),
      });
      if (res.ok) {
        setAssignTeamModalOpen(false);
        await fetchTicketDetail(selectedTicket.id);
        const qRes = await fetch('/api/admin/support/tickets');
        if (qRes.ok) {
          const qData = await qRes.json();
          setTickets(qData.tickets || []);
        }
      }
    } catch (err) {
      console.error('[AdminSupport] Assignment failed:', err);
    }
  }

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
    if (categoryFilter !== 'ALL' && t.categoryId !== categoryFilter) return false;
    if (teamFilter !== 'ALL' && t.assignedTeamId !== teamFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        t.ticketNumber.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q) ||
        t.requesterEmail.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  function getStatusBadge(status: string) {
    switch (status) {
      case 'NEW':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">NEW</span>;
      case 'OPEN':
      case 'IN_PROGRESS':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">IN PROGRESS</span>;
      case 'WAITING_FOR_REQUESTER':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">WAITING LEARNER</span>;
      case 'RESOLVED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">RESOLVED</span>;
      case 'CLOSED':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">CLOSED</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-50 text-gray-700">{status}</span>;
    }
  }

  function getPriorityBadge(priority: string) {
    switch (priority) {
      case 'URGENT':
        return <span className="text-[10px] font-black text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">URGENT</span>;
      case 'HIGH':
        return <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">HIGH</span>;
      case 'NORMAL':
        return <span className="text-[10px] font-medium text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">NORMAL</span>;
      case 'LOW':
        return <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">LOW</span>;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Analytics Link */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-[#e2efe1] shadow-xs">
          <div>
            <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
              <Link href="/admin" className="hover:text-[#4f8c4c] transition-colors">Admin Console</Link>
              <span>/</span>
              <span className="text-gray-800 font-semibold">Service Operations & Triage</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <LifeBuoy className="w-7 h-7 text-[#4f8c4c]" />
              Support Triage & Service Desk Operations
            </h1>
            <p className="text-xs text-gray-500 mt-1">
              Enterprise incident triage, team routing, confidential internal deliberation, and SLA tracking.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              href="/admin/support/analytics"
              className="inline-flex items-center gap-2 bg-[#1e481c] hover:bg-[#245921] text-white text-xs font-bold py-2.5 px-4 rounded-lg shadow-xs transition-colors"
            >
              <BarChart3 className="w-4 h-4 text-[#4f8c4c]" />
              <span>Support Analytics & SLA</span>
            </Link>
            <a
              href="/api/admin/support/export"
              download
              className="inline-flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold py-2.5 px-3.5 rounded-lg shadow-xs transition-colors"
            >
              <Download className="w-4 h-4 text-gray-500" />
              <span>Export CSV</span>
            </a>
          </div>
        </div>

        {/* Filters Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-[#e2efe1] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search #, learner, subject..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-[#4f8c4c]"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New (Untriaged)</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="WAITING_FOR_REQUESTER">Waiting on Learner</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="NORMAL">Normal</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Team Filter */}
          <div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white"
            >
              <option value="ALL">All Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Master-Detail Split Pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Triage Queue List (Left 5 Cols) */}
          <div className="lg:col-span-5 bg-white rounded-xl border border-[#e2efe1] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
                Triage Queue ({filteredTickets.length})
              </span>
              <button
                onClick={fetchQueueData}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Refresh Queue"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-gray-100 max-h-[700px] overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-xs text-gray-500">Loading queue...</div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">No tickets matching filter.</div>
              ) : (
                filteredTickets.map((t) => {
                  const isSelected = selectedTicket?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => fetchTicketDetail(t.id)}
                      className={`p-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[#f0f6ef] border-l-4 border-l-[#4f8c4c]'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="font-mono font-bold text-xs text-[#4f8c4c]">
                          {t.ticketNumber}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {getStatusBadge(t.status)}
                          {getPriorityBadge(t.priority)}
                        </div>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 line-clamp-1 mb-1">
                        {t.subject}
                      </h4>

                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{t.requesterName}</span>
                        <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Ticket Detail & Deliberation Panel (Right 7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            {isDetailLoading ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-12 text-center text-xs text-gray-500">
                Loading ticket details...
              </div>
            ) : !selectedTicket ? (
              <div className="bg-white rounded-xl border border-[#e2efe1] p-12 text-center text-xs text-gray-500">
                Select a ticket from the queue to view full conversation and take action.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Detail Header & Action Controls */}
                <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono font-bold text-sm text-[#4f8c4c] bg-[#e1f0df] px-3 py-1 rounded-md">
                        {selectedTicket.ticketNumber}
                      </span>
                      {getStatusBadge(selectedTicket.status)}
                      {getPriorityBadge(selectedTicket.priority)}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status Dropdown */}
                      <select
                        disabled={updatingStatus}
                        value={selectedTicket.status}
                        onChange={(e) => handleStatusChange(e.target.value as any)}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white focus:outline-none"
                      >
                        <option value="NEW">Set Status: New</option>
                        <option value="OPEN">Set Status: Open</option>
                        <option value="IN_PROGRESS">Set Status: In Progress</option>
                        <option value="WAITING_FOR_REQUESTER">Set: Waiting on Learner</option>
                        <option value="RESOLVED">Set: Resolved</option>
                        <option value="CLOSED">Set: Closed</option>
                      </select>

                      <button
                        onClick={() => setAssignTeamModalOpen(true)}
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center gap-1.5"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#4f8c4c]" />
                        <span>Assign</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <h2 className="text-lg font-black text-slate-900 mb-1.5">{selectedTicket.subject}</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-gray-600 bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div>
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">Requester</span>
                        <span className="font-semibold">{selectedTicket.requesterName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">Email</span>
                        <span className="font-mono text-[11px] truncate block">{selectedTicket.requesterEmail}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">Category</span>
                        <span>{selectedTicket.categoryName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 block font-bold uppercase">Team Assignment</span>
                        <span className="font-semibold text-[#4f8c4c]">
                          {selectedTicket.assignedTeamName || 'Unassigned'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Conversation & Internal Notes Thread */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-black uppercase tracking-wider text-gray-500">
                      Conversation & Internal Audit Notes
                    </span>
                    <span className="text-[10px] text-gray-400">
                      Internal notes are strictly concealed from learners
                    </span>
                  </div>

                  {(!selectedTicket.messages || selectedTicket.messages.length === 0) ? (
                    <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-xs text-gray-500">
                      No messages recorded.
                    </div>
                  ) : (
                    selectedTicket.messages.map((msg) => {
                      const isInternal = msg.visibility === 'INTERNAL';
                      const isRequester = msg.authorUserId === selectedTicket.requesterUserId;

                      return (
                        <div
                          key={msg.id}
                          className={`p-4 rounded-xl border shadow-xs transition-all ${
                            isInternal
                              ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-200'
                              : isRequester
                              ? 'bg-white border-[#e2efe1]'
                              : 'bg-[#fbfcfd] border-[#4f8c4c]/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-xs font-bold ${
                                  isInternal
                                    ? 'text-amber-900'
                                    : isRequester
                                    ? 'text-gray-900'
                                    : 'text-[#3a7536]'
                                }`}
                              >
                                {msg.authorName} ({msg.authorRole})
                              </span>

                              {isInternal ? (
                                <span className="inline-flex items-center gap-1 bg-amber-200 text-amber-900 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                                  <EyeOff className="w-3 h-3" />
                                  <span>Internal Staff Note — Hidden From Student</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[9px] font-bold px-1.5 py-0.5 rounded">
                                  <Eye className="w-3 h-3" />
                                  <span>Public to Learner</span>
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-gray-400">
                              {new Date(msg.createdAt).toLocaleString()}
                            </span>
                          </div>

                          <div className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed">
                            {msg.body}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Staff Response / Internal Note Composer */}
                <div className="bg-white rounded-xl border border-[#e2efe1] p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Send className="w-3.5 h-3.5 text-[#4f8c4c]" />
                      <span>Post Communication</span>
                    </span>

                    {/* Visibility Switcher */}
                    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg text-xs">
                      <button
                        type="button"
                        onClick={() => setReplyVisibility('PUBLIC')}
                        className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          replyVisibility === 'PUBLIC'
                            ? 'bg-white text-[#4f8c4c] shadow-xs'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Public Reply</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyVisibility('INTERNAL')}
                        className={`px-3 py-1 rounded font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${
                          replyVisibility === 'INTERNAL'
                            ? 'bg-amber-200 text-amber-900 shadow-xs'
                            : 'text-gray-500 hover:text-gray-800'
                        }`}
                      >
                        <EyeOff className="w-3.5 h-3.5" />
                        <span>Internal Note</span>
                      </button>
                    </div>
                  </div>

                  {replyVisibility === 'INTERNAL' && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>
                        This internal note will only be visible to support staff and administrators. It is strictly excluded from learner views and email dispatch.
                      </span>
                    </div>
                  )}

                  {composerError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                      {composerError}
                    </div>
                  )}

                  <form onSubmit={handleSendReply} className="space-y-3">
                    <textarea
                      rows={4}
                      required
                      placeholder={
                        replyVisibility === 'INTERNAL'
                          ? 'Write internal notes, diagnostic observations, or escalation details...'
                          : 'Write public response to the learner...'
                      }
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      className={`w-full text-xs p-3 rounded-lg border focus:outline-none focus:ring-1 leading-relaxed ${
                        replyVisibility === 'INTERNAL'
                          ? 'border-amber-300 focus:border-amber-500 focus:ring-amber-500 bg-amber-50/20'
                          : 'border-gray-200 focus:border-[#4f8c4c] focus:ring-[#4f8c4c]'
                      }`}
                    />

                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        {replyVisibility === 'PUBLIC'
                          ? 'Will trigger email outbox and student in-app notification.'
                          : 'Concealed at DB RLS and API serialization layer.'}
                      </span>
                      <button
                        type="submit"
                        disabled={isSendingReply || !replyBody.trim()}
                        className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition-colors cursor-pointer disabled:opacity-50 ${
                          replyVisibility === 'INTERNAL'
                            ? 'bg-amber-700 hover:bg-amber-800'
                            : 'bg-[#4f8c4c] hover:bg-[#3a7536]'
                        }`}
                      >
                        {isSendingReply
                          ? 'Saving...'
                          : replyVisibility === 'INTERNAL'
                          ? 'Save Internal Note'
                          : 'Send Public Response'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Assign Team Modal */}
        {assignTeamModalOpen && selectedTicket && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-gray-200">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900">Assign Support Team</h3>
                <button
                  onClick={() => setAssignTeamModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-gray-700 mb-1">Select Specialized Team</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => setSelectedTeamId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:border-[#4f8c4c]"
                  >
                    <option value="">Choose team...</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setAssignTeamModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAssignTeam}
                  disabled={!selectedTeamId}
                  className="px-4 py-1.5 text-xs font-bold bg-[#4f8c4c] text-white rounded-lg hover:bg-[#3a7536] disabled:opacity-50"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

