'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Globe,
  Layers,
  LayoutGrid,
  FileText,
  Sparkles,
  BookOpen,
  ShieldCheck,
  Palette,
  ExternalLink,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info,
  Calendar,
  Eye,
  Settings,
} from 'lucide-react';
import { CmsPageList } from './CmsPageList';
import { CmsEditorWorkspace } from './CmsEditorWorkspace';
import { CmsTemplate, CmsPageType, PageTypeDefinition } from '@/types/cms';
import {
  getAllPageTypes,
  getCanonicalPublicPageTypes,
  CANONICAL_PAGE_TYPE_REGISTRY,
} from '@/lib/cms/page-type-registry';

interface WebsiteStudioWorkspaceProps {
  initialPageId?: string | null;
  onNavigateBack?: () => void;
}

export function WebsiteStudioWorkspace({
  initialPageId = null,
  onNavigateBack,
}: WebsiteStudioWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<'pages' | 'templates' | 'page_types' | 'brand'>('pages');
  const [activeEditorPageId, setActiveEditorPageId] = useState<string | null>(initialPageId);
  const [templates, setTemplates] = useState<CmsTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState('ALL');

  // Overview metrics state
  const [metrics, setMetrics] = useState<{
    totalPages: number;
    publishedCount: number;
    draftCount: number;
    scheduledCount: number;
    systemTemplatesCount: number;
  } | null>(null);

  const fetchOverviewMetrics = async () => {
    try {
      const res = await fetch('/api/cms/studio/overview');
      if (res.ok) {
        const data = await res.json();
        if (data.metrics) {
          setMetrics(data.metrics);
        }
      }
    } catch (e) {
      console.warn('Could not load studio overview metrics:', e);
    }
  };

  const fetchTemplates = async () => {
    try {
      setLoadingTemplates(true);
      const res = await fetch('/api/cms/templates');
      if (res.ok) {
        const data = await res.json();
        if (data.templates) {
          setTemplates(data.templates);
        }
      }
    } catch (e) {
      console.error('Error fetching CMS templates:', e);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchOverviewMetrics();
    fetchTemplates();
  }, []);

  const pageTypesList = getAllPageTypes();

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearch.toLowerCase());
    const matchesCategory =
      templateCategoryFilter === 'ALL' || t.category.toUpperCase() === templateCategoryFilter.toUpperCase();
    return matchesSearch && matchesCategory;
  });

  // If in editor mode, render full editor workspace
  if (activeEditorPageId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <CmsEditorWorkspace
          pageId={activeEditorPageId}
          onExit={() => {
            setActiveEditorPageId(null);
            fetchOverviewMetrics();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Studio Header & Brand Primacy Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-200">
                LMS-Native Web Studio
              </span>
              <span className="text-xs text-slate-400 font-medium">Zealosh Training & Consultants</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1.5 flex items-center gap-2.5">
              <Globe className="w-6 h-6 text-[#4f8c4c]" />
              <span>Zealosh Website Studio</span>
            </h1>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Centralized institutional website, portal pages, and content management suite. All public course pages
              and syllabus details bind directly to live PostgreSQL academic records without duplication.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setActiveTab('pages');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold rounded-lg shadow-xs transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Page</span>
            </button>
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
              >
                Back to Admin
              </button>
            )}
          </div>
        </div>

        {/* Studio Top KPI Cards */}
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-slate-100">
            <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Total Pages</span>
              <div className="text-xl font-black text-slate-900 mt-0.5">{metrics.totalPages}</div>
            </div>
            <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Published
              </span>
              <div className="text-xl font-black text-emerald-900 mt-0.5">{metrics.publishedCount}</div>
            </div>
            <div className="bg-amber-50/50 p-3.5 rounded-xl border border-amber-100">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wide flex items-center gap-1">
                <FileText className="w-3 h-3 text-amber-600" />
                Drafts
              </span>
              <div className="text-xl font-black text-amber-900 mt-0.5">{metrics.draftCount}</div>
            </div>
            <div className="bg-blue-50/50 p-3.5 rounded-xl border border-blue-100">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wide flex items-center gap-1">
                <Clock className="w-3 h-3 text-blue-600" />
                Scheduled
              </span>
              <div className="text-xl font-black text-blue-900 mt-0.5">{metrics.scheduledCount}</div>
            </div>
            <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-600" />
                System Templates
              </span>
              <div className="text-xl font-black text-purple-900 mt-0.5">{metrics.systemTemplatesCount}</div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mt-6 -mb-6 gap-6">
          <button
            onClick={() => setActiveTab('pages')}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'pages'
                ? 'border-[#4f8c4c] text-[#4f8c4c]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span>Pages & Content</span>
          </button>

          <button
            onClick={() => setActiveTab('templates')}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'templates'
                ? 'border-[#4f8c4c] text-[#4f8c4c]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Institutional Templates (17)</span>
          </button>

          <button
            onClick={() => setActiveTab('page_types')}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'page_types'
                ? 'border-[#4f8c4c] text-[#4f8c4c]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Page Type Registry</span>
          </button>

          <button
            onClick={() => setActiveTab('brand')}
            className={`pb-3 text-xs font-bold transition flex items-center gap-2 border-b-2 ${
              activeTab === 'brand'
                ? 'border-[#4f8c4c] text-[#4f8c4c]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Brand & Design Tokens</span>
          </button>
        </div>
      </div>

      {/* TAB 1: PAGES & CONTENT */}
      {activeTab === 'pages' && (
        <CmsPageList onOpenEditor={(pageId) => setActiveEditorPageId(pageId)} />
      )}

      {/* TAB 2: INSTITUTIONAL TEMPLATES CATALOG */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search templates by title or purpose..."
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
              />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-semibold">Category:</label>
              <select
                value={templateCategoryFilter}
                onChange={(e) => setTemplateCategoryFilter(e.target.value)}
                className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#4f8c4c]"
              >
                <option value="ALL">All Categories</option>
                <option value="MARKETING">Marketing & Solutions</option>
                <option value="ACADEMIC">Academic & Syllabi</option>
                <option value="INFORMATIONAL">Informational & FAQs</option>
                <option value="LEGAL">Statutory & Legal</option>
                <option value="COMMUNITY">Faculty & Testimonials</option>
              </select>
            </div>
          </div>

          {loadingTemplates ? (
            <div className="p-12 text-center text-xs text-slate-400">Loading institutional templates...</div>
          ) : filteredTemplates.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              No templates found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="bg-white rounded-xl border border-slate-200/90 p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        {template.category}
                      </span>
                      {template.isSystem && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          System Built-in
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">{template.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{template.description}</p>
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{template.nodesSnapshot?.length || 0} Components</span>
                      <span>·</span>
                      <span>Target: {template.pageType || 'STANDARD'}</span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-mono">{template.id}</span>
                    <button
                      onClick={() => {
                        setActiveTab('pages');
                      }}
                      className="text-xs font-bold text-[#4f8c4c] hover:text-[#3a7536] flex items-center gap-1 transition"
                    >
                      <span>Use Template</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PAGE TYPE REGISTRY */}
      {activeTab === 'page_types' && (
        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-xs">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#4f8c4c]" />
              <span>Canonical Page Type Architecture (17 Public + Preserved Legacy Types)</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Authoritative single-source-of-truth definitions for all supported page purposes in Zealosh LMS.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Identifier</th>
                  <th className="p-3.5">Label</th>
                  <th className="p-3.5">Category</th>
                  <th className="p-3.5">Canonical Slug</th>
                  <th className="p-3.5">Dynamic Bindings</th>
                  <th className="p-3.5">Default Template</th>
                  <th className="p-3.5">Public Access</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageTypesList.map((pt) => (
                  <tr key={pt.type} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-mono font-bold text-slate-800">{pt.type}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{pt.label}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-700">
                        {pt.category}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-500">/{pt.canonicalSlugPrefix || ''}</td>
                    <td className="p-3.5">
                      {pt.hasDynamicBindings ? (
                        <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          PostgreSQL Live
                        </span>
                      ) : (
                        <span className="text-slate-400">Static CMS</span>
                      )}
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-slate-500">{pt.defaultTemplateId}</td>
                    <td className="p-3.5">
                      {pt.isPublic ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                          Public Live
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                          Auth Required
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BRAND & DESIGN TOKENS */}
      {activeTab === 'brand' && (
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-6 shadow-xs">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-[#4f8c4c]" />
              <span>Institutional Visual Identity & Design Tokens</span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Official branding tokens for Zealosh Training & Consultants. All templates strictly adhere to these color
              scales to guarantee WCAG 2.1 AA accessibility contrast compliance.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="w-full h-12 rounded-lg bg-[#4f8c4c] mb-2 shadow-xs"></div>
              <span className="text-xs font-bold text-slate-900">Primary Green</span>
              <p className="text-[11px] font-mono text-slate-500">#4f8c4c</p>
              <p className="text-[10px] text-slate-400 mt-1">Primary CTA buttons, brand badges, active links.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="w-full h-12 rounded-lg bg-[#3a7536] mb-2 shadow-xs"></div>
              <span className="text-xs font-bold text-slate-900">Dark Forest Green</span>
              <p className="text-[11px] font-mono text-slate-500">#3a7536</p>
              <p className="text-[10px] text-slate-400 mt-1">Button hover states, accent borders, deep headers.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="w-full h-12 rounded-lg bg-[#252c41] mb-2 shadow-xs"></div>
              <span className="text-xs font-bold text-slate-900">Header Dark Navy</span>
              <p className="text-[11px] font-mono text-slate-500">#252c41</p>
              <p className="text-[10px] text-slate-400 mt-1">Top navigation bar, institutional footers.</p>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="w-full h-12 rounded-lg bg-[#f7f9fc] border border-slate-200 mb-2"></div>
              <span className="text-xs font-bold text-slate-900">Surface Clean Background</span>
              <p className="text-[11px] font-mono text-slate-500">#f7f9fc</p>
              <p className="text-[10px] text-slate-400 mt-1">Page background surfaces, card containers.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
