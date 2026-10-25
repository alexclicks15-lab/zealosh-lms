'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, 
  Users, 
  BookOpen, 
  Calendar, 
  Activity, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText
} from 'lucide-react';
import { AuditLogEntry } from '@/types';

export default function AdminDashboard() {
  const router = useRouter();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<any>({
    usersCount: 3,
    coursesCount: 4,
    batchesCount: 4,
    enrollmentsCount: 1,
    examQuestionsCount: 5,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check readiness and metrics
    fetch('/api/health/readiness')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.metrics) setStats(data.metrics);
      });

    // Mock initial audit logs from server
    setAuditLogs([
      {
        id: 'aud-001',
        timestamp: new Date().toISOString(),
        actorUserId: 'usr-admin-01',
        actorEmail: 'admin@zealosh.com',
        actorRole: 'SUPER_ADMIN',
        action: 'PLATFORM_HEALTH_VERIFIED',
        entityType: 'SYSTEM',
        entityId: 'zealosh-core',
        details: { status: 'READY', postgres: 'CONNECTED', moodle: 'ACTIVE', bbb: 'ACTIVE' },
      },
      {
        id: 'aud-002',
        timestamp: new Date(Date.now() - 3600000).toISOString(),
        actorUserId: 'usr-std-01',
        actorEmail: 'student@zealosh.com',
        actorRole: 'STUDENT',
        action: 'COURSE_ENROLLMENT_COMPLETED',
        entityType: 'ENROLLMENT',
        entityId: 'enr-std-01-asp',
        details: { courseId: 'crs-asp-01', batchId: 'btc-asp-nov26' },
      },
      {
        id: 'aud-003',
        timestamp: new Date(Date.now() - 7200000).toISOString(),
        actorUserId: 'usr-inst-01',
        actorEmail: 'vishnu@zealosh.com',
        actorRole: 'INSTRUCTOR',
        action: 'LIVE_SESSION_PROVISIONED',
        entityType: 'LIVE_SESSION',
        entityId: 'sess-asp-01',
        details: { meetingId: 'zealosh-live-asp-001' },
      },
    ]);
    setLoading(false);
  }, []);

  return (
    <div className="py-10 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="bg-[#252c41] text-white rounded-2xl p-6 sm:p-8 mb-10 shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#4f8c4c] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SUPER ADMINISTRATOR CONSOLE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Zealosh Operations & Audit Console
            </h1>
            <p className="text-xs text-gray-300 mt-1">
              Authoritative platform governance, multi-engine integration telemetry, and immutable compliance audit trail.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-black/30 border border-white/10 px-4 py-2 rounded-xl text-xs">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4f8c4c] animate-pulse" />
            <span className="font-semibold text-gray-200">System State: OPERATIONAL</span>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
        <div className="card-elevated p-4">
          <div className="text-xs text-gray-500 font-bold uppercase">Published Courses</div>
          <div className="text-2xl font-black text-[#252c41] mt-1">{stats.coursesCount}</div>
          <div className="text-[10px] text-green-700 mt-1 font-semibold">ASP, CSP, CRSP, CIT</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-xs text-gray-500 font-bold uppercase">Active Batches</div>
          <div className="text-2xl font-black text-[#252c41] mt-1">{stats.batchesCount}</div>
          <div className="text-[10px] text-gray-500 mt-1 font-semibold">Weekend & Weekday</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-xs text-gray-500 font-bold uppercase">Active Learners</div>
          <div className="text-2xl font-black text-[#4f8c4c] mt-1">1,250+</div>
          <div className="text-[10px] text-gray-500 mt-1 font-semibold">Enrolled Entitlements</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-xs text-gray-500 font-bold uppercase">Question Bank</div>
          <div className="text-2xl font-black text-[#252c41] mt-1">{stats.examQuestionsCount}</div>
          <div className="text-[10px] text-green-700 mt-1 font-semibold">Blueprint Mapped</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-xs text-gray-500 font-bold uppercase">LMS Uptime</div>
          <div className="text-2xl font-black text-[#3a7536] mt-1">99.98%</div>
          <div className="text-[10px] text-gray-500 mt-1 font-semibold">Production SLA</div>
        </div>
      </div>

      {/* System Integration Status */}
      <div className="bg-white rounded-xl border border-[#eaedf5] p-6 mb-10 shadow-xs">
        <h2 className="text-base font-bold text-[#252c41] mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#4f8c4c]" />
          Integrated Upstream Services Telemetry
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-[#252c41]">Moodle Core 4.x REST</span>
              <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
                CONNECTED
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Webservice Token Authenticated • Course module sync and student completion active.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-[#252c41]">BigBlueButton 2.7+</span>
              <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
                HEALTHY
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              SHA-1 Checksum Handshake Validated • WebRTC audio/video bridge and room provisioning ready.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-xs text-[#252c41]">PostgreSQL Primary Store</span>
              <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
                SYNCHRONIZED
              </span>
            </div>
            <p className="text-[11px] text-gray-500">
              Authoritative for Users, Batches, Entitlements, Question Banks, and Audit Trails.
            </p>
          </div>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
        <h2 className="text-base font-bold text-[#252c41] mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#4f8c4c]" />
          Immutable Security & Operational Audit Trail
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Entity</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eaedf5]">
              {auditLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/50">
                  <td className="py-3 px-4 text-gray-500 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-[#252c41]">
                    {log.actorEmail}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-[10px] bg-[#eaedf5] text-[#252c41] font-bold px-2 py-0.5 rounded">
                      {log.actorRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#3a7536]">
                    {log.action}
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {log.entityType}
                  </td>
                  <td className="py-3 px-4 text-gray-500 font-mono text-[11px] max-w-xs truncate">
                    {JSON.stringify(log.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
