'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const executeLogin = async (loginEmail: string, loginPass: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPass }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (data.user.role === 'STUDENT') router.push('/student');
      else if (data.user.role === 'INSTRUCTOR') router.push('/instructor');
      else if (data.user.role === 'SUPER_ADMIN') router.push('/admin');
      else router.push('/student');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(email, password);
  };

  return (
    <div className="min-h-screen py-16 px-4 flex items-center justify-center bg-gradient-to-b from-[#f4f9f3] via-white to-white relative overflow-hidden">
      {/* Decorative subtle ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-[#4f8c4c]/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#2ea033]/6 rounded-full blur-2xl pointer-events-none" />

      <div className="w-full max-w-md glass-card p-8 sm:p-9 shadow-xl relative z-10 border border-emerald-500/20">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="relative w-44 h-12 mx-auto mb-3">
            <Image
              src="/logo.png"
              alt="Zealosh Training & Consultants"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight">
            Sign in to Your Account
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Access your courses, live cohorts, and HSE mock examinations
          </p>
        </div>

        {error && (
          <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="neomorphic-input pl-10"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
                className="neomorphic-input pl-10"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary py-3 text-xs shadow-md mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Demo Fast Login — Strictly Protected to Local Development Environments */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 pt-6 border-t border-[#e2efe1]">
            <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider mb-3 text-center">
              Development Only: One-Click Instant Demo Roles
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => executeLogin('student@zealosh.com', 'Zealosh@2026')}
                className="w-full text-left p-3 rounded-xl border border-emerald-200 bg-[#f1f8f0]/80 hover:bg-[#e8f3e7] transition-all flex items-center justify-between shadow-xs group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#245921]">
                    Arjun Menon (Student)
                  </div>
                  <div className="text-[11px] text-slate-500">Enrolled in ASP Cohort</div>
                </div>
                <span className="text-[10px] bg-emerald-700 text-white font-bold px-2 py-0.5 rounded shadow-xs">
                  STUDENT
                </span>
              </button>

              <button
                type="button"
                onClick={() => executeLogin('vishnu@zealosh.com', 'Zealosh@2026')}
                className="w-full text-left p-3 rounded-xl border border-emerald-200 bg-[#f1f8f0]/80 hover:bg-[#e8f3e7] transition-all flex items-center justify-between shadow-xs group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#245921]">
                    Vishnu Rajendran (Lead)
                  </div>
                  <div className="text-[11px] text-slate-500">CSP & CRSP Lead Instructor</div>
                </div>
                <span className="text-[10px] bg-[#3a7536] text-white font-bold px-2 py-0.5 rounded shadow-xs">
                  INSTRUCTOR
                </span>
              </button>

              <button
                type="button"
                onClick={() => executeLogin('admin@zealosh.com', 'Zealosh@2026')}
                className="w-full text-left p-3 rounded-xl border border-emerald-200 bg-[#f1f8f0]/80 hover:bg-[#e8f3e7] transition-all flex items-center justify-between shadow-xs group"
              >
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-[#245921]">
                    Dr. K. Ravindran
                  </div>
                  <div className="text-[11px] text-slate-500">Super Administrator</div>
                </div>
                <span className="text-[10px] bg-[#245921] text-white font-bold px-2 py-0.5 rounded shadow-xs">
                  SUPER ADMIN
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
