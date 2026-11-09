import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Mail, Phone, MapPin, Award, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#1b4318] text-emerald-100 pt-16 pb-8 border-t-4 border-[#4f8c4c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12 w-full">
          {/* Brand Info */}
          <div className="min-w-0">
            <div className="relative w-44 h-12 mb-4 bg-white/95 p-1 rounded-xl shadow-sm">
              <Image
                src="/logo.png"
                alt="Zealosh Training & Consultants"
                fill
                className="object-contain p-1"
              />
            </div>
            <p className="text-sm text-emerald-100/90 mb-4 leading-relaxed break-words">
              Zealosh Training & Consultants is an industry-leading HSE education institute specializing in advanced international safety certification coaching and professional safety career advancement.
            </p>
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#6fb76b] shrink-0" />
              <span>Accreditation-Aligned Mock Blueprint Engine</span>
            </div>
          </div>

          {/* Certification Pathways */}
          <div className="min-w-0">
            <h4 className="text-white text-base font-bold mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#6fb76b] shrink-0" />
              Certification Tracks
            </h4>
            <ul className="space-y-2 text-sm text-emerald-100/80">
              <li>
                <Link href="/courses/asp-examination-prep" className="hover:text-white transition-colors flex items-center gap-1 group">
                  <span className="break-words">ASP — Associate Safety Professional</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              </li>
              <li>
                <Link href="/courses/csp-masterclass" className="hover:text-white transition-colors flex items-center gap-1 group">
                  <span className="break-words">CSP — Certified Safety Professional</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              </li>
              <li>
                <Link href="/courses/crsp-exam-bootcamp" className="hover:text-white transition-colors flex items-center gap-1 group">
                  <span className="break-words">CRSP — Canadian Registered Safety Professional</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              </li>
              <li>
                <Link href="/courses/cit-fast-track" className="hover:text-white transition-colors flex items-center gap-1 group">
                  <span className="break-words">CIT — Certified Instructional Trainer</span>
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              </li>
              <li>
                <span className="text-emerald-300/70 break-words">NEBOSH International Diploma Mentorship</span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div className="min-w-0">
            <h4 className="text-white text-base font-bold mb-4">Platform Navigation</h4>
            <ul className="space-y-2 text-sm text-emerald-100/80">
              <li>
                <Link href="/courses" className="hover:text-white transition-colors">
                  Course Catalog & Cohorts
                </Link>
              </li>
              <li>
                <Link href="/exams" className="hover:text-white transition-colors">
                  Mock Examination Engine
                </Link>
              </li>
              <li>
                <Link href="/student" className="hover:text-white transition-colors">
                  Student Learning Hub
                </Link>
              </li>
              <li>
                <Link href="/instructor" className="hover:text-white transition-colors">
                  Instructor Batch Portal
                </Link>
              </li>
              <li>
                <Link href="/classroom" className="hover:text-white transition-colors">
                  Digital Classroom Hub
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-white transition-colors">
                  Student Helpdesk & Support
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div className="min-w-0">
            <h4 className="text-white text-base font-bold mb-4">Official Contact</h4>
            <ul className="space-y-3 text-sm text-emerald-100/80">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#6fb76b] shrink-0 mt-0.5" />
                <span className="break-words">Zealosh Training & Consultants, Kureepuzha North, Kavanad P.O, Kollam, Kerala 691003, India</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#6fb76b] shrink-0" />
                <a href="mailto:contact@zealosh.com" className="hover:text-white transition-colors break-words">
                  contact@zealosh.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#6fb76b] shrink-0" />
                <a href="tel:+916282809443" className="hover:text-white transition-colors whitespace-nowrap">
                  +91 6282809443
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Legal bar */}
        <div className="pt-8 border-t border-emerald-900/60 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-emerald-300/80">
          <div className="text-center sm:text-left">
            © {new Date().getFullYear()} Zealosh Training & Consultants. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-3 sm:gap-6">
            <Link href="/support" className="hover:text-white transition-colors">
              Helpdesk
            </Link>
            <span>•</span>
            <span className="text-emerald-300/60 text-center">
              Enterprise HSE Mentorship Infrastructure
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
