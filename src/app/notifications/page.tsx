'use client';

// Zealosh LMS — Phase 5A In-App Notification Center
// Dedicated academic notification hub: filters, pagination, mark-as-read workflows
// Strictly enforces WCAG 2.1 AA accessibility and Zealosh green brand design tokens

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { InAppNotification } from '@/types';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'read'>('all');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '15');
      if (activeTab !== 'all') {
        params.set('status', activeTab);
      }
      if (selectedType !== 'ALL') {
        params.set('type', selectedType);
      }

      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch {
      // Non-blocking error handling
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [activeTab, selectedType, page]);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // Non-blocking
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/notifications/mark-all-read', { method: 'POST' });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // Non-blocking
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'ANNOUNCEMENT_NEW':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">Announcement</span>;
      case 'ASSIGNMENT_PUBLISHED':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">Assignment</span>;
      case 'ASSIGNMENT_SUBMITTED':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">Submission</span>;
      case 'ASSIGNMENT_GRADED':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-green-50 text-[#3a7536] border border-green-200">Graded</span>;
      case 'RESUBMISSION_REQUESTED':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Revision</span>;
      case 'LIVE_SESSION_SCHEDULED':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Live Class</span>;
      case 'DOUBT_REPLIED':
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">Doubt Answer</span>;
      default:
        return <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-50 text-gray-700 border border-gray-200">System</span>;
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f9f3]">
      {/* Top Header */}
      <header className="bg-gradient-to-r from-[#1e481c] via-[#245921] to-[#3a7536] text-white border-b border-[#245921] shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/courses"
              className="text-white/80 hover:text-white transition p-1.5 rounded-lg hover:bg-white/10"
              aria-label="Back to courses"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </Link>
            <div>
              <h1 className="text-lg font-bold">Academic Notification Center</h1>
              <p className="text-xs text-white/80">Zealosh Training & Consultants — Live Academic Feed</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/student"
              className="text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition"
            >
              Student Portal
            </Link>
            <Link
              href="/instructor"
              className="text-xs px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white font-medium transition"
            >
              Instructor Portal
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-[#e2efe1] overflow-hidden">
          {/* Action Bar */}
          <div className="p-6 border-b border-[#e2efe1] flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-slate-900">Your Notifications</h2>
              {unreadCount > 0 && (
                <span className="text-xs bg-[#4f8c4c] text-white font-bold px-2.5 py-0.5 rounded-full">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-semibold px-4 py-2 rounded-lg text-[#3a7536] hover:bg-green-50 border border-[#3a7536]/30 transition self-start sm:self-auto"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Status Tabs & Filters */}
          <div className="px-6 py-4 bg-[#f7f9fc] border-b border-gray-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => { setActiveTab('all'); setPage(1); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'all'
                    ? 'bg-[#4f8c4c] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('unread'); setPage(1); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'unread'
                    ? 'bg-[#4f8c4c] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('read'); setPage(1); }}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                  activeTab === 'read'
                    ? 'bg-[#4f8c4c] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Read
              </button>
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2">
              <label htmlFor="categoryFilter" className="text-xs text-gray-500 font-medium">
                Category:
              </label>
              <select
                id="categoryFilter"
                value={selectedType}
                onChange={(e) => { setSelectedType(e.target.value); setPage(1); }}
                className="text-xs font-medium bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
              >
                <option value="ALL">All Categories</option>
                <option value="ANNOUNCEMENT_NEW">Announcements</option>
                <option value="ASSIGNMENT_PUBLISHED">Assignments</option>
                <option value="ASSIGNMENT_GRADED">Grades & Feedback</option>
                <option value="RESUBMISSION_REQUESTED">Revisions</option>
                <option value="LIVE_SESSION_SCHEDULED">Live Classes</option>
                <option value="DOUBT_REPLIED">Doubt Answers</option>
              </select>
            </div>
          </div>

          {/* List Content */}
          <div className="divide-y divide-gray-100">
            {isLoading ? (
              <div className="py-16 text-center text-gray-400 text-sm">
                Loading notifications...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 text-center text-gray-500">
                <svg
                  className="w-12 h-12 mx-auto text-gray-300 mb-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
                <h3 className="text-base font-bold text-gray-700 mb-1">No notifications found</h3>
                <p className="text-xs text-gray-400 max-w-sm mx-auto">
                  {activeTab === 'unread'
                    ? 'You have caught up with all academic updates!'
                    : 'Important announcements, coursework updates, and feedback will appear here.'}
                </p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-5 transition hover:bg-gray-50 flex items-start justify-between gap-4 ${
                    !notif.isRead ? 'bg-green-50/20' : ''
                  }`}
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      {!notif.isRead ? (
                        <span className="block w-2.5 h-2.5 rounded-full bg-[#4f8c4c] shadow-sm" title="Unread"></span>
                      ) : (
                        <span className="block w-2.5 h-2.5 rounded-full bg-gray-200"></span>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        {getTypeBadge(notif.type)}
                        <span className="text-xs text-gray-400">
                          {new Date(notif.createdAt).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}{' '}
                          at{' '}
                          {new Date(notif.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h3 className={`text-sm mb-1 ${!notif.isRead ? 'font-bold text-slate-900' : 'font-semibold text-gray-700'}`}>
                        {notif.title}
                      </h3>
                      <p className="text-xs text-gray-600 leading-relaxed max-w-3xl mb-3">
                        {notif.description}
                      </p>

                      <div className="flex items-center gap-3">
                        <Link
                          href={notif.actionUrl}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#3a7536] hover:text-[#2ea033] transition"
                        >
                          View academic details →
                        </Link>
                      </div>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={(e) => handleMarkRead(notif.id, e)}
                      className="text-xs text-gray-400 hover:text-gray-700 px-2.5 py-1 rounded border border-gray-200 hover:bg-white transition whitespace-nowrap self-start"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="p-4 bg-[#f7f9fc] border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                Page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

