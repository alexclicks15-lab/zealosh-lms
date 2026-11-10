'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, LayoutGrid, Palette } from 'lucide-react';
import { WebsiteStudioWorkspace } from '@/components/cms/WebsiteStudioWorkspace';

export default function WebsiteStudioSubroutePage() {
  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <Link
              href="/admin"
              className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1.5 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Workspace</span>
            </Link>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Palette className="w-6 h-6 text-[#4f8c4c]" />
              <span>Zealosh Website Studio</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Central content, template, and design token management for Zealosh Training & Consultants.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/admin/workspace"
              className="px-3.5 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-1.5 shadow-xs transition"
            >
              <LayoutGrid className="w-4 h-4 text-slate-500" />
              <span>Dashboard Widgets</span>
            </Link>
          </div>
        </div>

        <WebsiteStudioWorkspace />
      </div>
    </div>
  );
}
