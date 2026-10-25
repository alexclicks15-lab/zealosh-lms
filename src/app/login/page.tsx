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
    <div className="min-h-screen py-16 px-4 flex items-center justify-center bg-[#f7f9fc]">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#eaedf5] shadow-xl p-8">
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
          <h1 className="text-xl font-extrabold text-[#252c41]">
            Sign in to Your Account
          </h1>
          <p className="text-xs text-gray-500 mt-1">
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
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full px-3.5 py-2.5 pl-10 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#4f8c4c] focus:ring-1 focus:ring-[#4f8c4c]"
              />
              <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 pl-10 text-xs rounded-lg border border-gray-300 focus:outline-none focus:border-[#4f8c4c] focus:ring-1 focus:ring-[#4f8c4c]"
              />
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
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

        {/* Demo Fast Login */}
        <div className="mt-8 pt-6 border-t border-[#eaedf5]">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3 text-center">
            One-Click Instant Demo Roles
          </div>

          <div className="space-y-2">
            <button
              onClick={() => executeLogin('student@zealosh.com', 'Zealosh@2026')}
              className="w-full text-left p-3 rounded-lg border border-green-200 bg-green-50/50 hover:bg-green-100/50 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-[#252c41]">Arjun Menon (Student)</div>
                <div className="text-[11px] text-gray-500">Enrolled in ASP Cohort</div>
              </div>
              <span className="text-[10px] bg-green-700 text-white font-bold px-2 py-0.5 rounded">
                STUDENT
              </span>
            </button>

            <button
              onClick={() => executeLogin('vishnu@zealosh.com', 'Zealosh@2026')}
              className="w-full text-left p-3 rounded-lg border border-blue-200 bg-blue-50/50 hover:bg-blue-100/50 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-[#252c41]">Vishnu Rajendran (Lead)</div>
                <div className="text-[11px] text-gray-500">CSP & CRSP Lead Instructor</div>
              </div>
              <span className="text-[10px] bg-blue-700 text-white font-bold px-2 py-0.5 rounded">
                INSTRUCTOR
              </span>
            </button>

            <button
              onClick={() => executeLogin('admin@zealosh.com', 'Zealosh@2026')}
              className="w-full text-left p-3 rounded-lg border border-purple-200 bg-purple-50/50 hover:bg-purple-100/50 transition-colors flex items-center justify-between"
            >
              <div>
                <div className="text-xs font-bold text-[#252c41]">Dr. K. Ravindran</div>
                <div className="text-[11px] text-gray-500">Super Administrator</div>
              </div>
              <span className="text-[10px] bg-purple-700 text-white font-bold px-2 py-0.5 rounded">
                SUPER ADMIN
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
