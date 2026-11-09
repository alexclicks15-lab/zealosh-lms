// Zealosh LMS — Student Security & Device Sessions Management
// Track 1: Foundation Hardening (ZM-IMPL-08B)
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  ArrowLeft,
  KeyRound,
  Lock,
  Smartphone,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { AccountSecuritySessions } from '@/components/security/AccountSecuritySessions';

export default function StudentSecurityPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (!res.ok) {
          router.push('/login');
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
        }
        setLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center p-6">
        <div className="text-center text-slate-500 text-sm">Loading security center...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f9fc] pb-16">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/student"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-emerald-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Student Dashboard</span>
          </Link>
        </div>

        {/* Page Title */}
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e8f3e7] text-[#245921] uppercase tracking-wide border border-emerald-300">
                Institutional Security Center
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#252c41]">
              Account Security & Devices
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Manage your active login sessions, verify device activity, and monitor account protection policies.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-white px-4 py-2.5 rounded-2xl border border-[#eaedf5] shadow-2xs">
            <ShieldCheck className="w-5 h-5 text-[#3a7536]" />
            <div className="text-left">
              <div className="text-xs font-bold text-slate-800">Auth Authority</div>
              <div className="text-[11px] text-slate-500">Supabase GoTrue • Active</div>
            </div>
          </div>
        </div>

        {/* Security Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl border border-[#eaedf5] shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5 text-emerald-700">
              <Lock className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Brute-Force Lockout</span>
            </div>
            <div className="text-sm font-extrabold text-slate-800">5 Attempts / 15 Min</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Database-enforced concurrency-safe lockout protects against credential stuffing.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#eaedf5] shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5 text-emerald-700">
              <KeyRound className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Token Revocation</span>
            </div>
            <div className="text-sm font-extrabold text-slate-800">Instant Killswitch</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Revoking a session immediately invalidates tokens across all endpoints.
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#eaedf5] shadow-2xs">
            <div className="flex items-center gap-2 mb-1.5 text-emerald-700">
              <Smartphone className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wide">Device Auditing</span>
            </div>
            <div className="text-sm font-extrabold text-slate-800">Masked IP & Agent</div>
            <p className="text-[11px] text-slate-500 mt-1">
              Session registry records device fingerprinting and IP ranges for audit transparency.
            </p>
          </div>
        </div>

        {/* Active Sessions Manager Component */}
        <AccountSecuritySessions />
      </div>
    </div>
  );
}

