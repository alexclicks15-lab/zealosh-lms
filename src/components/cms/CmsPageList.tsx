'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  Globe,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { CmsPage, CmsPageType, CmsTemplate, CmsVersionStatus } from '@/types/cms';
import {
  getAllPageTypes,
  CANONICAL_PAGE_TYPE_REGISTRY,
  suggestSlugForPageType,
} from '@/lib/cms/page-type-registry';

interface CmsPageListProps {
  onOpenEditor: (pageId: string) => void;
}

export function CmsPageList({ onOpenEditor }: CmsPageListProps) {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // New Page Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newPageType, setNewPageType] = useState<CmsPageType>('STANDARD');
  const [templates, setTemplates] = useState<CmsTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [slugValidation, setSlugValidation] = useState<{ valid: boolean; reason?: string } | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchPages = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await fetch('/api/cms/pages');
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch pages from database');
      }
      if (data.pages) {
        setPages(data.pages);
      }
    } catch (e: any) {
      console.error('Error fetching CMS pages:', e);
      setLoadError(e.message || 'Database unavailable');
    } finally {
      setLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/cms/templates');
      const data = await res.json();
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (e: any) {
      console.error('Failed to load templates:', e);
    }
  };

  useEffect(() => {
    fetchPages();
    fetchTemplates();
  }, []);

  // Validate slug debounced
  useEffect(() => {
    if (!newSlug.trim()) {
      setSlugValidation(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/cms/validate-slug?slug=${encodeURIComponent(newSlug)}`);
        const data = await res.json();
        setSlugValidation(data);
      } catch {
        setSlugValidation({ valid: false, reason: 'Validation error' });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [newSlug]);

  const handleTitleChange = (val: string) => {
    setNewTitle(val);
    if (!newSlug || newSlug === newTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      const generated = suggestSlugForPageType(newPageType, val);
      setNewSlug(generated);
    }
  };

  const handlePageTypeChange = (type: CmsPageType) => {
    setNewPageType(type);
    const suggested = suggestSlugForPageType(type, newTitle);
    if (suggested) {
      setNewSlug(suggested);
    }
  };

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newSlug.trim() || slugValidation?.valid === false) return;

    try {
      setIsCreating(true);
      setErrorMessage(null);
      const res = await fetch('/api/cms/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          slug: newSlug.trim(),
          pageType: newPageType,
          templateId: selectedTemplateId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create page');
      }

      setShowCreateModal(false);
      setNewTitle('');
      setNewSlug('');
      setSelectedTemplateId('');
      await fetchPages();
      onOpenEditor(data.page.id);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePage = async (pageId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/cms/pages/${pageId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete');
      await fetchPages();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const filteredPages = pages.filter((page) => {
    const matchesSearch =
      page.title.toLowerCase().includes(search.toLowerCase()) ||
      page.slug.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || page.status === statusFilter;
    const matchesType = typeFilter === 'ALL' || page.pageType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-[#4f8c4c]" />
            <span>Visual PageBuilder & Relational CMS</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Author, structure, and publish version-controlled landing pages with live academic data bindings.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary text-sm px-4 py-2.5 shadow-sm inline-flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          <span>Create New Page</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            aria-label="Search pages by title or slug"
            placeholder="Search pages by title or slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#4f8c4c]/20 focus:border-[#4f8c4c]"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-hidden"
        >
          <option value="ALL">All Statuses</option>
          <option value="PUBLISHED">Published</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by page type"
          className="text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-semibold focus:outline-hidden"
        >
          <option value="ALL">All Page Types</option>
          {getAllPageTypes().map((pt) => (
            <option key={pt.type} value={pt.type}>
              {pt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Pages Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-12 text-center text-sm text-slate-500">Loading pages...</div>
        ) : loadError ? (
          <div className="p-12 text-center text-slate-500">
            <AlertCircle className="w-10 h-10 mx-auto text-amber-500 mb-3" />
            <div className="text-sm font-bold text-slate-900">Unable to load pages from database</div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">{loadError}</p>
            <button
              onClick={fetchPages}
              className="mt-4 px-3 py-1.5 text-xs font-bold text-[#3a7536] bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredPages.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Layers className="w-10 h-10 mx-auto text-slate-300 mb-3" />
            <div className="text-sm font-bold text-slate-700">No pages found</div>
            <p className="text-xs text-slate-400 mt-1">Get started by creating your first landing page.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Page Title & Slug</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPages.map((page) => {
                  let statusBadge = 'bg-slate-100 text-slate-700';
                  if (page.status === 'PUBLISHED') statusBadge = 'bg-emerald-100 text-emerald-800 font-bold';
                  else if (page.status === 'PENDING_REVIEW') statusBadge = 'bg-amber-100 text-amber-800 font-bold';
                  else if (page.status === 'APPROVED') statusBadge = 'bg-blue-100 text-blue-800 font-bold';
                  else if (page.status === 'REJECTED') statusBadge = 'bg-red-100 text-red-800 font-bold';

                  const publicUrl = page.slug === 'home' ? '/' : `/p/${page.slug}`;

                  return (
                    <tr key={page.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{page.title}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">/{page.slug}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="badge-slate text-[10px] uppercase font-bold">
                          {CANONICAL_PAGE_TYPE_REGISTRY[page.pageType as CmsPageType]?.label || page.pageType}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusBadge}`}>
                          {page.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500">
                        {new Date(page.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        {page.status === 'PUBLISHED' && (
                          <Link
                            href={publicUrl}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold px-2 py-1 rounded-md hover:bg-slate-100"
                            title="View Public Page"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>View</span>
                          </Link>
                        )}

                        <button
                          onClick={() => onOpenEditor(page.id)}
                          className="btn-primary text-xs px-3 py-1 shadow-xs inline-flex items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Edit Page</span>
                        </button>

                        {page.slug !== 'home' && (
                          <button
                            onClick={() => handleDeletePage(page.id, page.title)}
                            className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50"
                            title="Delete Page"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Page Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <h3 className="text-lg font-black text-slate-900 mb-1">Create New Landing Page</h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter page title and URL slug to initialize your new layout.
            </p>

            {errorMessage && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreatePage} className="space-y-4">
              <div>
                <label htmlFor="cms-create-title" className="block text-xs font-bold text-slate-700 mb-1">Page Title</label>
                <input
                  id="cms-create-title"
                  type="text"
                  required
                  placeholder="e.g. CRSP Examination Preparation"
                  value={newTitle}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4f8c4c]/20 focus:border-[#4f8c4c]"
                />
              </div>

              <div>
                <label htmlFor="cms-create-slug" className="block text-xs font-bold text-slate-700 mb-1">URL Path Slug</label>
                <div className="flex items-center">
                  <span className="bg-slate-100 border border-r-0 border-slate-300 rounded-l-lg px-3 py-2 text-xs text-slate-500">
                    /p/
                  </span>
                  <input
                    id="cms-create-slug"
                    type="text"
                    required
                    placeholder="crsp-examination-preparation"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-r-lg focus:ring-2 focus:ring-[#4f8c4c]/20 focus:border-[#4f8c4c]"
                  />
                </div>
                {slugValidation && !slugValidation.valid && (
                  <p className="text-[11px] text-red-500 mt-1 font-semibold">{slugValidation.reason}</p>
                )}
                {slugValidation && slugValidation.valid && (
                  <p className="text-[11px] text-[#3a7536] mt-1 font-semibold">✓ Slug is valid and available</p>
                )}
              </div>

              <div>
                <label htmlFor="cms-create-pagetype" className="block text-xs font-bold text-slate-700 mb-1">
                  Page Type & Purpose
                </label>
                <select
                  id="cms-create-pagetype"
                  value={newPageType}
                  onChange={(e) => handlePageTypeChange(e.target.value as CmsPageType)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4f8c4c]/20 focus:border-[#4f8c4c]"
                >
                  {getAllPageTypes().map((pt) => (
                    <option key={pt.type} value={pt.type}>
                      {pt.label} ({pt.category})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="cms-create-template" className="block text-xs font-bold text-slate-700 mb-1">
                  Starting Template (Optional)
                </label>
                <select
                  id="cms-create-template"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#4f8c4c]/20 focus:border-[#4f8c4c]"
                >
                  <option value="">Default institutional starter layout</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name} {tpl.isSystem ? '(System Template)' : '(Custom)'}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  System templates provide pre-structured responsive sections adhering to Zealosh design standards.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating || slugValidation?.valid === false}
                  className="btn-primary text-xs px-5 py-2 font-bold shadow-sm disabled:opacity-50"
                >
                  {isCreating ? 'Creating...' : 'Initialize Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

