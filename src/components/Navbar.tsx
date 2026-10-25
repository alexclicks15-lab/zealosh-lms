'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  GraduationCap, 
  Video, 
  FileText, 
  ShieldCheck, 
  User as UserIcon, 
  LogOut, 
  Menu, 
  X,
  PhoneCall,
  CheckCircle2
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [roleSwitchOpen, setRoleSwitchOpen] = useState(false);

  useEffect(() => {
    // Check current session
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) setCurrentUser(data.user);
      })
      .catch(() => {});
  }, [pathname]);

  const handleQuickLogin = async (email: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Zealosh@2026' }),
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
        setRoleSwitchOpen(false);
        // Route according to role
        if (data.user.role === 'STUDENT') router.push('/student');
        else if (data.user.role === 'INSTRUCTOR') router.push('/instructor');
        else if (data.user.role === 'SUPER_ADMIN') router.push('/admin');
        else router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    document.cookie = 'zealosh_token=; Max-Age=0; path=/;';
    setCurrentUser(null);
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#eaedf5] shadow-xs">
      {/* Top Banner with WhatsApp & Official Accreditation */}
      <div className="bg-[#252c41] text-white text-xs py-1.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-[#4f8c4c] text-white px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider">
              OFFICIAL HSE PLATFORM
            </span>
            <span className="hidden md:inline text-gray-300">
              Premier ASP, CSP, CRSP, CIT & NEBOSH Mentorship Institute
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/916282809443?text=Hi%20Zealosh"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#99cd92] flex items-center gap-1.5 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-[#4f8c4c]" />
              <span>WhatsApp: +91 6282809443</span>
            </a>
            <span className="text-gray-500">|</span>
            <span className="text-gray-300">Kollam, Kerala</span>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3">
          <div className="relative w-40 h-10 sm:w-48 sm:h-12">
            <Image
              src="/logo.png"
              alt="Zealosh Training & Consultants"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#252c41]">
          <Link
            href="/"
            className={`hover:text-[#4f8c4c] transition-colors ${
              pathname === '/' ? 'text-[#4f8c4c] font-semibold' : ''
            }`}
          >
            Home
          </Link>
          <Link
            href="/courses"
            className={`hover:text-[#4f8c4c] transition-colors ${
              pathname.startsWith('/courses') ? 'text-[#4f8c4c] font-semibold' : ''
            }`}
          >
            Courses & Batches
          </Link>
          <Link
            href="/exams"
            className={`hover:text-[#4f8c4c] transition-colors ${
              pathname.startsWith('/exams') ? 'text-[#4f8c4c] font-semibold' : ''
            }`}
          >
            Exam Engine
          </Link>
          <Link
            href="/student"
            className={`hover:text-[#4f8c4c] transition-colors ${
              pathname === '/student' ? 'text-[#4f8c4c] font-semibold' : ''
            }`}
          >
            Student Hub
          </Link>
          <Link
            href="/instructor"
            className={`hover:text-[#4f8c4c] transition-colors ${
              pathname === '/instructor' ? 'text-[#4f8c4c] font-semibold' : ''
            }`}
          >
            Instructor Portal
          </Link>
          <Link
            href="/admin"
            className={`hover:text-[#4f8c4c] transition-colors ${
              pathname === '/admin' ? 'text-[#4f8c4c] font-semibold' : ''
            }`}
          >
            Admin Ops
          </Link>
        </nav>

        {/* User Account / Role Selector */}
        <div className="hidden lg:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-semibold text-[#252c41] flex items-center gap-1.5 justify-end">
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] bg-[#e1f0df] text-[#3a7536] px-2 py-0.5 rounded font-bold">
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-xs text-[#5e5e5e]">{currentUser.email}</div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setRoleSwitchOpen(!roleSwitchOpen)}
                className="btn-primary text-sm py-2 px-4"
              >
                <UserIcon className="w-4 h-4" />
                <span>Sign In / Demo Roles</span>
              </button>

              {roleSwitchOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-[#eaedf5] p-3 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 px-2">
                    Instant Demo Login
                  </div>
                  <button
                    onClick={() => handleQuickLogin('student@zealosh.com')}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#f1f8f0] transition-colors flex items-center justify-between group mb-1"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#252c41] group-hover:text-[#4f8c4c]">
                        Arjun Menon (Student)
                      </div>
                      <div className="text-[11px] text-gray-500">Enrolled in ASP Cohort</div>
                    </div>
                    <span className="text-[10px] bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded">
                      STUDENT
                    </span>
                  </button>

                  <button
                    onClick={() => handleQuickLogin('vishnu@zealosh.com')}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#f1f8f0] transition-colors flex items-center justify-between group mb-1"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#252c41] group-hover:text-[#4f8c4c]">
                        Vishnu Rajendran (Lead)
                      </div>
                      <div className="text-[11px] text-gray-500">CSP & CRSP Lead Instructor</div>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded">
                      INSTRUCTOR
                    </span>
                  </button>

                  <button
                    onClick={() => handleQuickLogin('admin@zealosh.com')}
                    className="w-full text-left p-2.5 rounded-lg hover:bg-[#f1f8f0] transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <div className="text-xs font-bold text-[#252c41] group-hover:text-[#4f8c4c]">
                        Dr. K. Ravindran
                      </div>
                      <div className="text-[11px] text-gray-500">Super Administrator</div>
                    </div>
                    <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2 py-0.5 rounded">
                      ADMIN
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Hamburger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-gray-600 hover:text-gray-900"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white border-t border-[#eaedf5] px-4 py-4 space-y-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#252c41]"
          >
            Home
          </Link>
          <Link
            href="/courses"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#252c41]"
          >
            Courses & Batches
          </Link>
          <Link
            href="/exams"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#252c41]"
          >
            Exam Engine
          </Link>
          <Link
            href="/student"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#252c41]"
          >
            Student Hub
          </Link>
          <Link
            href="/instructor"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#252c41]"
          >
            Instructor Portal
          </Link>
          <Link
            href="/admin"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2 text-sm font-medium text-[#252c41]"
          >
            Admin Ops
          </Link>
          <div className="pt-3 border-t border-gray-100">
            {currentUser ? (
              <button
                onClick={handleLogout}
                className="w-full btn-secondary text-sm py-2"
              >
                Sign Out ({currentUser.name})
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => handleQuickLogin('student@zealosh.com')}
                  className="w-full btn-primary text-sm py-2"
                >
                  Login as Student (Arjun)
                </button>
                <button
                  onClick={() => handleQuickLogin('vishnu@zealosh.com')}
                  className="w-full btn-outline text-sm py-2"
                >
                  Login as Instructor (Vishnu)
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
