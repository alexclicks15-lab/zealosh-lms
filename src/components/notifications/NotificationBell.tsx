'use client';

// Zealosh LMS — Phase 5A In-App Notification Bell Component
// Displays dynamic unread count badge, recent alerts dropdown, and navigation trigger
// Complies with WCAG 2.1 AA keyboard accessibility and Zealosh green brand design tokens

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { InAppNotification } from '@/types';

export default function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [recentNotifications, setRecentNotifications] = useState<InAppNotification[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/notifications/unread-count');
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Non-blocking fetch
    }
  };

  const fetchRecent = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=5');
      if (res.ok) {
        const data = await res.json();
        setRecentNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {
      // Non-blocking fetch
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000); // 30s poll
    return () => clearInterval(interval);
  }, []);

  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      fetchRecent();
    }
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      if (res.ok) {
        setRecentNotifications((prev) =>
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
        setRecentNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
        setUnreadCount(0);
      }
    } catch {
      // Non-blocking
    }
  };

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'ANNOUNCEMENT_NEW':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700">Announcement</span>;
      case 'ASSIGNMENT_PUBLISHED':
      case 'ASSIGNMENT_SUBMITTED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700">Assignment</span>;
      case 'ASSIGNMENT_GRADED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-50 text-[#3a7536]">Graded</span>;
      case 'RESUBMISSION_REQUESTED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700">Revision</span>;
      case 'LIVE_SESSION_SCHEDULED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700">Live Class</span>;
      case 'DOUBT_REPLIED':
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">Doubt</span>;
      default:
        return <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-gray-50 text-gray-700">Alert</span>;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c] transition"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-[#e53e3e] rounded-full border-2 border-white shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 sm:w-96 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-[#e2efe1] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2efe1] bg-[#f4f9f3]">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-[#4f8c4c] text-white font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-[#3a7536] hover:text-[#2ea033] font-medium transition"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {isLoading ? (
              <div className="py-8 text-center text-gray-400 text-xs">
                Loading notifications...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="py-8 text-center text-gray-500 text-xs">
                <svg className="w-8 h-8 mx-auto text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                No notifications yet
              </div>
            ) : (
              recentNotifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notif.actionUrl}
                  onClick={() => setIsOpen(false)}
                  className={`block px-4 py-3 hover:bg-gray-50 transition relative ${
                    !notif.isRead ? 'bg-green-50/25' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getTypeBadge(notif.type)}
                        <span className="text-[11px] text-gray-400">
                          {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <h4 className={`text-xs ${!notif.isRead ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                        {notif.title}
                      </h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
                        {notif.description}
                      </p>
                    </div>

                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={(e) => handleMarkRead(notif.id, e)}
                        title="Mark as read"
                        className="text-gray-300 hover:text-[#4f8c4c] p-1 mt-0.5"
                      >
                        <span className="block w-2 h-2 rounded-full bg-[#4f8c4c]"></span>
                      </button>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="p-2.5 border-t border-[#e2efe1] bg-[#f4f9f3] text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-semibold text-[#3a7536] hover:text-[#2ea033] block py-1 transition"
            >
              See all notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

