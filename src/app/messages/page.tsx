'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Users,
  Send,
  Paperclip,
  Search,
  Plus,
  Shield,
  Flag,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Reply,
  Lock,
  Hash,
  BookOpen,
  ArrowLeft,
  RefreshCw,
  Clock,
  Trash2,
} from 'lucide-react';
import { Conversation, ChannelMessage, ConversationMember, UserRole } from '@/types';

export default function MessagesPage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [channels, setChannels] = useState<Conversation[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [members, setMembers] = useState<ConversationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Message input state
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  // Threading state
  const [activeThreadParent, setActiveThreadParent] = useState<ChannelMessage | null>(null);
  const [threadReplies, setThreadReplies] = useState<ChannelMessage[]>([]);
  const [threadText, setThreadText] = useState('');
  const [threadSending, setThreadSending] = useState(false);

  // New channel modal
  const [newChannelModalOpen, setNewChannelModalOpen] = useState(false);
  const [newChannelTitle, setNewChannelTitle] = useState('');
  const [newChannelDescription, setNewChannelDescription] = useState('');
  const [newChannelType, setNewChannelType] = useState<'GROUP' | 'COURSE' | 'BATCH'>('GROUP');
  const [isCrossBatch, setIsCrossBatch] = useState(false);
  const [createChannelError, setCreateChannelError] = useState<string | null>(null);

  // Moderation report modal
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportingMessage, setReportingMessage] = useState<ChannelMessage | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  // Load current user
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch channels
  const loadChannels = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/messaging/channels');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load conversations');

      const convs: Conversation[] = data.channels || [];
      setChannels(convs);
      if (convs.length > 0 && !activeChannelId) {
        setActiveChannelId(convs[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading messaging channels');
    } finally {
      setLoading(false);
    }
  }, [activeChannelId]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Load messages for active channel
  const loadActiveMessages = useCallback(async (channelId: string) => {
    setMessagesLoading(true);
    try {
      const [msgRes, channelRes] = await Promise.all([
        fetch(`/api/messaging/channels/${channelId}/messages`),
        fetch(`/api/messaging/channels/${channelId}`),
      ]);

      const msgData = await msgRes.json();
      const channelData = await channelRes.json();

      if (msgRes.ok) {
        setMessages(msgData.messages || []);
      }
      if (channelRes.ok) {
        setMembers(channelData.members || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeChannelId) {
      loadActiveMessages(activeChannelId);
      setActiveThreadParent(null);
    }
  }, [activeChannelId, loadActiveMessages]);

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelId || !messageText.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/messaging/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageText.trim(),
          clientMessageId: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message');

      setMessages((prev) => [...prev, data.message]);
      setMessageText('');
    } catch (err: any) {
      alert(`Send Error: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  // Open thread and load replies
  const handleOpenThread = async (msg: ChannelMessage) => {
    setActiveThreadParent(msg);
    try {
      const res = await fetch(
        `/api/messaging/channels/${activeChannelId}/messages?parentMessageId=${msg.id}`
      );
      const data = await res.json();
      if (res.ok) {
        setThreadReplies(data.messages || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Send thread reply
  const handleSendThreadReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannelId || !activeThreadParent || !threadText.trim() || threadSending) return;

    setThreadSending(true);
    try {
      const res = await fetch(`/api/messaging/channels/${activeChannelId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: threadText.trim(),
          parentMessageId: activeThreadParent.id,
          clientMessageId: `reply-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reply in thread');

      setThreadReplies((prev) => [...prev, data.message]);
      setThreadText('');

      // Increment parent reply count locally
      setMessages((prev) =>
        prev.map((m) =>
          m.id === activeThreadParent.id ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        )
      );
    } catch (err: any) {
      alert(`Reply Error: ${err.message}`);
    } finally {
      setThreadSending(false);
    }
  };

  // Create Channel
  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateChannelError(null);

    try {
      const res = await fetch('/api/messaging/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newChannelType,
          title: newChannelTitle,
          description: newChannelDescription,
          isCrossBatch,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create channel');

      setNewChannelModalOpen(false);
      setNewChannelTitle('');
      setNewChannelDescription('');
      setIsCrossBatch(false);
      await loadChannels();
      setActiveChannelId(data.conversation.id);
    } catch (err: any) {
      setCreateChannelError(err.message);
    }
  };

  // Report message submit
  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingMessage || !activeChannelId) return;

    try {
      const res = await fetch(`/api/messaging/channels/${activeChannelId}/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: reportingMessage.id,
          reason: reportReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit report');

      setReportSuccess(true);
      setTimeout(() => {
        setReportModalOpen(false);
        setReportingMessage(null);
        setReportReason('');
        setReportSuccess(false);
      }, 1200);
    } catch (err: any) {
      alert(`Report Error: ${err.message}`);
    }
  };

  const activeChannel = channels.find((c) => c.id === activeChannelId);

  return (
    <div className="min-h-screen bg-[#f7f9fc] flex flex-col text-slate-900">
      {/* Top Header */}
      <div className="bg-[#252c41] text-white py-3.5 px-4 sm:px-6 border-b border-gray-800 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/student"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <h1 className="text-sm font-bold tracking-tight flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                <span>Zealosh Institutional Messaging & Group Channels</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-300">
              User: <strong className="text-white">{currentUser?.name || 'Candidate'}</strong> (
              {currentUser?.role || 'STUDENT'})
            </span>
            <button
              onClick={() => setNewChannelModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#4f8c4c] hover:bg-[#3a7536] text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Channel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Workspace: Left Sidebar + Message Pane + Thread Drawer */}
      <div className="flex-1 flex overflow-hidden max-w-7xl w-full mx-auto p-4 sm:p-6 gap-5">
        {/* Left Sidebar: Channels List */}
        <div className="w-72 bg-white rounded-2xl border border-[#eaedf5] flex flex-col shrink-0 shadow-xs overflow-hidden">
          <div className="p-3.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Channels</span>
            <button
              onClick={loadChannels}
              className="p-1 rounded-md text-gray-400 hover:text-slate-700"
              title="Refresh Channels"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {channels.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setActiveChannelId(conv.id)}
                className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center gap-2.5 transition-colors ${
                  activeChannelId === conv.id
                    ? 'bg-[#4f8c4c] text-white font-bold shadow-xs'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {conv.type === 'COURSE' ? (
                  <BookOpen
                    className={`w-4 h-4 shrink-0 ${activeChannelId === conv.id ? 'text-white' : 'text-[#4f8c4c]'}`}
                  />
                ) : conv.type === 'BATCH' ? (
                  <Users
                    className={`w-4 h-4 shrink-0 ${activeChannelId === conv.id ? 'text-white' : 'text-blue-500'}`}
                  />
                ) : (
                  <Hash
                    className={`w-4 h-4 shrink-0 ${activeChannelId === conv.id ? 'text-white' : 'text-gray-400'}`}
                  />
                )}

                <div className="truncate flex-1">
                  <div className="truncate">{conv.title}</div>
                  <div
                    className={`text-[10px] truncate ${
                      activeChannelId === conv.id ? 'text-emerald-100' : 'text-gray-400'
                    }`}
                  >
                    {conv.type} • {conv.memberCount} members
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Academic Isolation Invariant Notice */}
          <div className="p-3 bg-emerald-50/50 border-t border-emerald-100 text-[10px] text-emerald-800 leading-tight">
            <Shield className="w-3.5 h-3.5 text-[#4f8c4c] inline mr-1" />
            <strong>Academic Isolation Active:</strong> Channel membership allows messaging only and does not grant course or batch enrollment.
          </div>
        </div>

        {/* Center: Main Message Stream */}
        <div className="flex-1 bg-white rounded-2xl border border-[#eaedf5] flex flex-col shadow-xs overflow-hidden">
          {activeChannel ? (
            <>
              {/* Channel Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50/40">
                <div>
                  <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <span className="text-base text-[#4f8c4c]">#</span>
                    <span>{activeChannel.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-700">
                      {activeChannel.type}
                    </span>
                  </h2>
                  {activeChannel.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{activeChannel.description}</p>
                  )}
                </div>

                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  <span>{members.length} members</span>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messagesLoading ? (
                  <div className="text-center py-12 text-xs text-gray-400">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 text-xs">
                    No messages yet in this channel. Send the first message below.
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className="group flex items-start gap-3 p-2 rounded-xl hover:bg-gray-50/80 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-[#3a7536] font-bold text-xs flex items-center justify-center shrink-0">
                        {m.senderName.slice(0, 1)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{m.senderName}</span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.2 rounded bg-gray-100 text-gray-600">
                            {m.senderRole}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(m.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800 mt-1 whitespace-pre-wrap leading-relaxed">
                          {m.content}
                        </div>

                        {/* Thread reply actions */}
                        <div className="flex items-center gap-4 mt-2">
                          <button
                            onClick={() => handleOpenThread(m)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4f8c4c] hover:underline"
                          >
                            <Reply className="w-3 h-3" />
                            <span>
                              {m.replyCount && m.replyCount > 0
                                ? `${m.replyCount} ${m.replyCount === 1 ? 'reply' : 'replies'}`
                                : 'Reply'}
                            </span>
                          </button>

                          <button
                            onClick={() => {
                              setReportingMessage(m);
                              setReportModalOpen(true);
                            }}
                            className="text-[10px] text-gray-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1"
                            title="Report message for moderation"
                          >
                            <Flag className="w-3 h-3" />
                            <span>Report</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Message Composer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-2 focus-within:ring-1 focus-within:ring-[#4f8c4c] focus-within:border-[#4f8c4c]">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    placeholder={`Message #${activeChannel.title}...`}
                    className="flex-1 text-xs bg-transparent border-0 focus:outline-hidden text-slate-900"
                  />
                  <button
                    type="submit"
                    disabled={sending || !messageText.trim()}
                    className="p-2 rounded-lg bg-[#4f8c4c] hover:bg-[#3a7536] text-white disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-gray-400">
              Select a conversation to start messaging.
            </div>
          )}
        </div>

        {/* Right Sidebar: Active Thread Drawer (if thread open) */}
        {activeThreadParent && (
          <div className="w-80 bg-white rounded-2xl border border-[#eaedf5] flex flex-col shrink-0 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Reply className="w-3.5 h-3.5 text-[#4f8c4c]" />
                <span>Thread Replies</span>
              </span>
              <button
                onClick={() => setActiveThreadParent(null)}
                className="text-gray-400 hover:text-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Parent Message Card */}
            <div className="p-3 bg-gray-50/80 border-b border-gray-100">
              <span className="text-[11px] font-bold text-slate-900 block">
                {activeThreadParent.senderName}
              </span>
              <p className="text-xs text-slate-700 mt-1">{activeThreadParent.content}</p>
            </div>

            {/* Replies Stream */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {threadReplies.map((r) => (
                <div key={r.id} className="text-xs bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-[11px]">{r.senderName}</span>
                    <span className="text-[9px] text-gray-400">
                      {new Date(r.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-slate-800">{r.content}</p>
                </div>
              ))}
            </div>

            {/* Thread Composer */}
            <form onSubmit={handleSendThreadReply} className="p-3 border-t border-gray-100 bg-white">
              <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-1.5">
                <input
                  type="text"
                  value={threadText}
                  onChange={(e) => setThreadText(e.target.value)}
                  placeholder="Reply in thread..."
                  className="flex-1 text-xs bg-transparent border-0 focus:outline-hidden text-slate-900 pl-2"
                />
                <button
                  type="submit"
                  disabled={threadSending || !threadText.trim()}
                  className="p-1.5 rounded-lg bg-[#4f8c4c] text-white disabled:opacity-40"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Create Channel Modal */}
      {newChannelModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-base font-bold text-slate-900 mb-1">Create Discussion Channel</h3>
            <p className="text-xs text-gray-500 mb-4">
              Create an institutional messaging channel for cohort collaboration.
            </p>

            {createChannelError && (
              <div className="mb-4 p-3 rounded-lg text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
                {createChannelError}
              </div>
            )}

            <form onSubmit={handleCreateChannel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Channel Title *</label>
                <input
                  type="text"
                  required
                  value={newChannelTitle}
                  onChange={(e) => setNewChannelTitle(e.target.value)}
                  placeholder="e.g. Safety Management System Study Circle"
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={newChannelDescription}
                  onChange={(e) => setNewChannelDescription(e.target.value)}
                  placeholder="Channel guidelines and topic scope..."
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Channel Scope</label>
                <select
                  value={newChannelType}
                  onChange={(e) => setNewChannelType(e.target.value as any)}
                  className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg font-semibold text-gray-700"
                >
                  <option value="GROUP">General Student Study Group</option>
                  <option value="COURSE">Academic Course Forum</option>
                  <option value="BATCH">Batch Cohort Exclusive Channel</option>
                </select>
              </div>

              {/* Cross-Batch Policy Notice */}
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-[11px] text-amber-900">
                <span className="font-bold block mb-1">Institutional Governance Gate (BDR-13):</span>
                Students cannot self-create unrestricted cross-batch groups. Institutional staff authorization is required.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewChannelModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#4f8c4c] hover:bg-[#3a7536] text-white transition-colors"
                >
                  Create Channel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Moderation Report Modal */}
      {reportModalOpen && reportingMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-gray-100">
            <h3 className="text-base font-bold text-slate-900 mb-1">Report Message for Moderation</h3>
            <p className="text-xs text-gray-500 mb-4">
              Reported messages are audited privately by Zealosh faculty and administrators.
            </p>

            {reportSuccess ? (
              <div className="p-4 bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold text-center">
                ✓ Report submitted to moderation queue. Thank you.
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} className="space-y-4">
                <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-700">
                  <span className="font-bold block text-slate-900">{reportingMessage.senderName}:</span>
                  <p className="mt-1">{reportingMessage.content}</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Reason for Report *</label>
                  <textarea
                    required
                    rows={3}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Specify why this message violates institutional communication guidelines..."
                    className="w-full text-xs p-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:outline-hidden focus:ring-1 focus:ring-[#4f8c4c]"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setReportModalOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-slate-900"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

