'use client';

import React, { useState } from 'react';
import { WorkspaceLayoutArranger } from '@/components/admin/WorkspaceLayoutArranger';
import { WebsiteStudioWorkspace } from '@/components/cms/WebsiteStudioWorkspace';
import { LayoutGrid, ArrowLeft, Palette } from 'lucide-react';
import Link from 'next/link';

export default function AdminWorkspacePage() {
  const [activeTab, setActiveTab] = useState<'widgets' | 'studio'>('widgets');

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <Link
              href="/admin"
              className="text-xs font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 mb-2 transition"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Admin Workspace</span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
              {activeTab === 'widgets' ? (
                <>
                  <LayoutGrid className="w-6 h-6 text-[#4f8c4c]" />
                  <span>Workspace Dashboard Customization</span>
                </>
              ) : (
                <>
                  <Palette className="w-6 h-6 text-[#4f8c4c]" />
                  <span>Zealosh Website Studio</span>
                </>
              )}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {activeTab === 'widgets'
                ? 'Reorder, toggle, and size dashboard widget components for institutional command and executive visibility.'
                : 'Central content, institutional template, and canonical page management workspace.'}
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setActiveTab('widgets')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'widgets'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Dashboard Widgets</span>
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'studio'
                  ? 'bg-[#4f8c4c] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Website Studio</span>
            </button>
          </div>
        </div>

        {activeTab === 'widgets' ? <WorkspaceLayoutArranger /> : <WebsiteStudioWorkspace />}
      </div>
    </div>
  );
}

