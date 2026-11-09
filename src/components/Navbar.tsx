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
  CheckCircle2,
  LifeBuoy,
  Layers,
  ChevronDown
} from 'lucide-react';
import NotificationBell from '@/components/notifications/NotificationBell';

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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network failure on logout
    }
    document.cookie = 'zealosh_token=; Max-Age=0; path=/;';
    setCurrentUser(null);
    router.push('/login');
    router.refresh();
  };

  // Dynamic Navigation Items based on Authenticated Role
  const getNavLinks = () => {
    if (!currentUser) {
      return [
        { label: 'Home', href: '/' },
        { label: 'Courses & Batches', href: '/courses' },
        { label: 'HSE Exam Engine', href: '/exams' },
        { label: 'Student Helpdesk', href: '/support' },
      ];
    }

    if (currentUser.role === 'STUDENT') {
      return [
        { label: 'My Learning', href: '/student' },
        { label: 'Digital Classroom', href: '/classroom' },
        { label: 'Live Classes', href: '/live' },
        { label: 'Recordings', href: '/recordings' },
        { label: 'Exams & Quizzes', href: '/exams' },
        { label: 'Support', href: '/support' },
      ];
    }

    if (currentUser.role === 'INSTRUCTOR') {
      return [
        { label: 'Faculty Hub', href: '/instructor' },
        { label: 'Classrooms', href: '/classroom' },
        { label: 'Live Sessions', href: '/live' },
        { label: 'Recordings', href: '/recordings' },
        { label: 'Courses Catalog', href: '/courses' },
        { label: 'Support', href: '/support' },
      ];
    }

    // Administrators
    return [
      { label: 'Admin Ops', href: '/admin' },
      { label: 'Classroom Hub', href: '/classroom' },
      { label: 'Live Sessions', href: '/live' },
      { label: 'Support Desk', href: '/admin/support' },
      { label: 'Analytics', href: '/admin/support/analytics' },
      { label: 'Courses', href: '/courses' },
    ];
  };

  const navLinks = getNavLinks();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#e2efe1] shadow-xs">
      {/* Top Banner with WhatsApp & Official Accreditation (Zealosh Forest Green) */}
      <div className="bg-[#3a7536] text-white text-xs py-1.5 px-3 sm:px-8 border-b border-[#245921]">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="bg-[#4f8c4c] text-white px-2 py-0.5 rounded text-[9px] sm:text-[10px] font-bold tracking-wider uppercase shadow-xs truncate">
              OFFICIAL HSE PLATFORM
            </span>
            <span className="hidden md:inline text-emerald-100 font-medium text-xs">
              Premier ASP, CSP, CRSP, CIT & NEBOSH Mentorship Institute
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-[10px] sm:text-xs">
            <a
              href="https://wa.me/916282809443?text=Hi%20Zealosh"
              target="_blank"
              rel="noreferrer"
              className="hover:text-emerald-200 flex items-center gap-1 transition-colors font-medium whitespace-nowrap"
            >
              <PhoneCall className="w-3 h-3 text-emerald-300" />
              <span>+91 6282809443</span>
            </a>
            <span className="text-emerald-400 hidden sm:inline">|</span>
            <span className="text-emerald-100 hidden sm:inline">Kollam, Kerala</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar (Clean White Frosted Glass) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 py-3 flex items-center justify-between">
        {/* Official Brand Logo */}
        <Link href={currentUser?.role === 'STUDENT' ? '/student' : currentUser?.role === 'INSTRUCTOR' ? '/instructor' : currentUser ? '/admin' : '/'} className="flex items-center gap-3 shrink-0">
          <div className="relative w-32 h-8 sm:w-44 sm:h-11">
            <Image
              src="/logo.png"
              alt="Zealosh Training & Consultants"
              fill
              className="object-contain"
              priority
            />
          </div>
        </Link>

        {/* Desktop Role-Aware Navigation Links */}
        <nav className="hidden lg:flex items-center gap-6 text-sm font-semibold text-slate-700">
          {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`transition-all py-1 ${
                  isActive
                    ? 'text-[#3a7536] font-bold border-b-2 border-[#4f8c4c]'
                    : 'hover:text-[#4f8c4c]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* User Account / Role Badge & Switching */}
        <div className="hidden lg:flex items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <div className="text-right">
                <div className="text-sm font-bold text-slate-800 flex items-center gap-1.5 justify-end">
                  <span>{currentUser.name}</span>
                  <span className="text-[10px] bg-[#e8f3e7] text-[#245921] border border-emerald-300 px-2 py-0.5 rounded font-bold uppercase tracking-wide">
                    {currentUser.role}
                  </span>
                </div>
                <div className="text-xs text-slate-500">{currentUser.email}</div>
              </div>

              {/* Fast Switch Button for Pair-Programming & Demo Verification (Local Dev Only) */}
              {process.env.NODE_ENV === 'development' && (
                <div className="relative">
                  <button
                    onClick={() => setRoleSwitchOpen(!roleSwitchOpen)}
                    className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                    title="Switch Role"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  {roleSwitchOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#e2efe1] p-3 z-50 animate-in fade-in slide-in-from-top-2 glass-modal">
                      <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 px-2">
                        Development: Switch Identity
                      </div>
                      <button
                        onClick={() => handleQuickLogin('student@zealosh.com')}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between group mb-1 ${
                          currentUser.email === 'student@zealosh.com' ? 'bg-[#f1f8f0] border border-emerald-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            Arjun Menon
                          </div>
                          <div className="text-[11px] text-slate-500">Student • ASP Cohort</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          STUDENT
                        </span>
                      </button>

                      <button
                        onClick={() => handleQuickLogin('vishnu@zealosh.com')}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between group mb-1 ${
                          currentUser.email === 'vishnu@zealosh.com' ? 'bg-[#f1f8f0] border border-emerald-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            Vishnu Rajendran
                          </div>
                          <div className="text-[11px] text-slate-500">Faculty • CSP Lead</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          INSTRUCTOR
                        </span>
                      </button>

                      <button
                        onClick={() => handleQuickLogin('admin@zealosh.com')}
                        className={`w-full text-left p-2.5 rounded-xl transition-colors flex items-center justify-between group ${
                          currentUser.email === 'admin@zealosh.com' ? 'bg-[#f1f8f0] border border-emerald-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            Dr. K. Ravindran
                          </div>
                          <div className="text-[11px] text-slate-500">Super Administrator</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          ADMIN
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleLogout}
                className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="btn-primary text-xs py-2 px-4 shadow-sm"
              >
                <UserIcon className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </Link>

              {process.env.NODE_ENV === 'development' && (
                <div className="relative">
                  <button
                    onClick={() => setRoleSwitchOpen(!roleSwitchOpen)}
                    className="btn-secondary text-xs py-2 px-3 shadow-xs"
                    title="Demo Fast Access (Dev Only)"
                  >
                    <span>Demo Roles</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-1" />
                  </button>

                  {roleSwitchOpen && (
                    <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-xl border border-[#e2efe1] p-3 z-50 animate-in fade-in slide-in-from-top-2 glass-modal">
                      <div className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 px-2">
                        Development: Instant Demo Login
                      </div>
                      <button
                        onClick={() => handleQuickLogin('student@zealosh.com')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#f1f8f0] transition-colors flex items-center justify-between group mb-1"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            Arjun Menon (Student)
                          </div>
                          <div className="text-[11px] text-slate-500">Enrolled in ASP Cohort</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          STUDENT
                        </span>
                      </button>

                      <button
                        onClick={() => handleQuickLogin('vishnu@zealosh.com')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#f1f8f0] transition-colors flex items-center justify-between group mb-1"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            Vishnu Rajendran (Lead)
                          </div>
                          <div className="text-[11px] text-slate-500">CSP & CRSP Lead Instructor</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          INSTRUCTOR
                        </span>
                      </button>

                      <button
                        onClick={() => handleQuickLogin('admin@zealosh.com')}
                        className="w-full text-left p-2.5 rounded-xl hover:bg-[#f1f8f0] transition-colors flex items-center justify-between group"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            Dr. K. Ravindran
                          </div>
                          <div className="text-[11px] text-slate-500">Super Administrator</div>
                        </div>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded">
                          ADMIN
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Mobile Hamburger Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="lg:hidden p-2 text-slate-700 hover:text-[#3a7536] shrink-0"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/95 backdrop-blur-md border-t border-[#e2efe1] px-4 py-4 space-y-2">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`block py-2 text-sm font-semibold ${
                pathname === link.href ? 'text-[#3a7536] font-bold' : 'text-slate-800 hover:text-[#4f8c4c]'
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-3 border-t border-slate-100">
            {currentUser ? (
              <div className="space-y-2">
                <div className="text-xs text-slate-600">
                  Signed in as <strong>{currentUser.name}</strong> ({currentUser.role})
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full btn-secondary text-xs py-2"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full btn-primary text-xs py-2 text-center block"
                >
                  Sign In
                </Link>
                {process.env.NODE_ENV === 'development' && (
                  <button
                    onClick={() => handleQuickLogin('student@zealosh.com')}
                    className="w-full btn-secondary text-xs py-2"
                  >
                    Demo Student (Dev)
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
