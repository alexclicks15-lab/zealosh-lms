import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShieldCheck, Mail, Phone, MapPin, Award } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#252c41] text-gray-300 pt-16 pb-8 border-t-4 border-[#4f8c4c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand Info */}
          <div>
            <div className="relative w-44 h-12 mb-4 bg-white/95 p-1 rounded-lg">
              <Image
                src="/logo.png"
                alt="Zealosh Training & Consultants"
                fill
                className="object-contain p-1"
              />
            </div>
            <p className="text-sm text-gray-400 mb-4 leading-relaxed">
              Zealosh Training & Consultants is an industry-leading HSE education institute specializing in advanced international safety certification coaching and professional safety career advancement.
            </p>
            <div className="flex items-center gap-2 text-xs text-[#99cd92]">
              <ShieldCheck className="w-4 h-4 text-[#4f8c4c]" />
              <span>Accreditation-Aligned Mock Blueprint Engine</span>
            </div>
          </div>

          {/* Certification Pathways */}
          <div>
            <h4 className="text-white text-base font-bold mb-4 flex items-center gap-2">
              <Award className="w-4 h-4 text-[#4f8c4c]" />
              Certification Tracks
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/courses/asp-examination-prep" className="hover:text-white transition-colors">
                  ASP — Associate Safety Professional
                </Link>
              </li>
              <li>
                <Link href="/courses/csp-masterclass" className="hover:text-white transition-colors">
                  CSP — Certified Safety Professional
                </Link>
              </li>
              <li>
                <Link href="/courses/crsp-exam-bootcamp" className="hover:text-white transition-colors">
                  CRSP — Canadian Registered Safety Professional
                </Link>
              </li>
              <li>
                <Link href="/courses/cit-fast-track" className="hover:text-white transition-colors">
                  CIT — Certified Instructional Trainer
                </Link>
              </li>
              <li>
                <span className="text-gray-400">NEBOSH International Diploma Mentorship</span>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white text-base font-bold mb-4">Platform Navigation</h4>
            <ul className="space-y-2 text-sm">
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
                <Link href="/admin" className="hover:text-white transition-colors">
                  Operations & Audit Console
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-white text-base font-bold mb-4">Official Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-[#4f8c4c] shrink-0 mt-0.5" />
                <span>Zealosh Training & Consultants, Kollam, Kerala, India</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#4f8c4c] shrink-0" />
                <a href="https://wa.me/916282809443" target="_blank" rel="noreferrer" className="hover:text-white">
                  +91 6282809443 (WhatsApp)
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-[#4f8c4c] shrink-0" />
                <span>info@zealosh.com</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-700/60 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <div>
            © {new Date().getFullYear()} Zealosh Training & Consultants. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
            <span>HSE Examination Honor Code</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
