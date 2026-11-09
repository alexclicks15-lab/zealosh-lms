'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle,
  Eye,
  Monitor,
  Tablet,
  Smartphone,
  Undo2,
  Redo2,
  Layers,
  Box,
  Columns,
  LayoutGrid,
  FileText,
  Heading,
  AlignLeft,
  Code,
  MousePointerClick,
  Quote,
  CheckSquare,
  Image as ImageIcon,
  Sparkles,
  Grid,
  Award,
  Users,
  BookOpen,
  GraduationCap,
  ListOrdered,
  Calendar,
  UserCheck,
  FolderKanban,
  HelpCircle,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  AlertCircle,
  Settings,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import {
  CmsPage,
  CmsPageVersion,
  CmsPageNode,
  CmsNodeType,
} from '@/types/cms';
import { COMPONENT_REGISTRY } from '@/lib/cms/component-registry';
import {
  buildTree,
  flattenTree,
  insertNode,
  moveNode,
  duplicateNode,
  deleteNode,
  generateNodeId,
} from '@/lib/cms/tree-engine';
import { CmsComponentRenderer } from './CmsComponentRenderer';

interface CmsEditorWorkspaceProps {
  pageId: string;
  onExit: () => void;
}

export function CmsEditorWorkspace({ pageId, onExit }: CmsEditorWorkspaceProps) {
  const [page, setPage] = useState<CmsPage | null>(null);
  const [version, setVersion] = useState<CmsPageVersion | null>(null);
  const [nodes, setNodes] = useState<CmsPageNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeSidebarTab, setActiveSidebarTab] = useState<'library' | 'tree'>('library');
  const [activeInspectorTab, setActiveInspectorTab] = useState<'content' | 'layout' | 'styles' | 'responsive'>('content');

  // History for Undo/Redo
  const [history, setHistory] = useState<CmsPageNode[][]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Status & Notification
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Load Page & Version Nodes
  const loadPageData = async () => {
    try {
      setLoading(true);
      const pageRes = await fetch(`/api/cms/pages/${pageId}`);
      const pageData = await pageRes.json();
      if (!pageData.page) throw new Error('Page not found');
      setPage(pageData.page);

      // Determine active version
      const activeVersionId = pageData.page.currentDraftVersionId || pageData.page.publishedVersionId;
      if (!activeVersionId) throw new Error('No active version found');

      const verRes = await fetch(`/api/cms/pages/${pageId}/versions/${activeVersionId}`);
      const verData = await verRes.json();
      if (!verData.version) throw new Error('Version details not found');

      setVersion(verData.version);
      const loadedNodes = verData.nodes || [];
      setNodes(loadedNodes);

      // Initialize history stack
      setHistory([loadedNodes]);
      setHistoryIndex(0);

      // Select root section if available
      if (loadedNodes.length > 0) {
        setSelectedNodeId(loadedNodes[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load PageBuilder:', err);
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, [pageId]);

  // Update nodes and push to undo/redo history
  const updateNodesWithHistory = useCallback((newNodes: CmsPageNode[]) => {
    setNodes(newNodes);
    setHistory((prev) => {
      const sliced = prev.slice(0, historyIndex + 1);
      return [...sliced, newNodes];
    });
    setHistoryIndex((prev) => prev + 1);
  }, [historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setNodes(history[newIndex]);
    }
  };

  // Save draft nodes to database
  const handleSaveDraft = async () => {
    if (!version) return;
    try {
      setIsSaving(true);
      setStatusMessage(null);
      const res = await fetch(`/api/cms/pages/${pageId}/versions/${version.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setLastSavedTime(new Date().toLocaleTimeString());
      setStatusMessage({ type: 'success', text: 'Draft saved successfully' });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Publish version
  const handlePublish = async () => {
    if (!version || !page) return;
    if (!confirm('Are you sure you want to publish this version to the live public platform?')) return;

    try {
      setIsPublishing(true);
      setStatusMessage(null);
      // First save current nodes
      await fetch(`/api/cms/pages/${pageId}/versions/${version.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });

      // Then publish
      const res = await fetch(`/api/cms/pages/${pageId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ versionId: version.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish');

      setPage((prev) => (prev ? { ...prev, status: 'PUBLISHED', publishedVersionId: version.id, scheduledPublishAt: undefined, scheduledVersionId: undefined } : null));
      setVersion((prev) => (prev ? { ...prev, status: 'PUBLISHED' } : null));
      setStatusMessage({ type: 'success', text: 'Published successfully to live site!' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsPublishing(false);
    }
  };

  // Schedule future publication
  const handleSchedulePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!version || !page || !scheduleDateTime) return;

    try {
      setIsScheduling(true);
      setStatusMessage(null);

      await fetch(`/api/cms/pages/${pageId}/versions/${version.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodes }),
      });

      const res = await fetch(`/api/cms/pages/${pageId}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          versionId: version.id,
          scheduledPublishAt: new Date(scheduleDateTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to schedule publication');

      setPage(data.page);
      setShowScheduleModal(false);
      setStatusMessage({ type: 'success', text: `Page scheduled for publication on ${new Date(scheduleDateTime).toLocaleString()}` });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelSchedule = async () => {
    if (!page) return;
    try {
      const res = await fetch(`/api/cms/pages/${pageId}/schedule`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to cancel schedule');
      setPage(data.page);
      setStatusMessage({ type: 'success', text: 'Scheduled publication cancelled.' });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    }
  };

  // Insert component from library
  const handleInsertComponent = (componentType: string) => {
    const compDef = COMPONENT_REGISTRY[componentType];
    if (!compDef || !version) return;

    const newNode: CmsPageNode = {
      id: generateNodeId(componentType),
      pageVersionId: version.id,
      parentId: null,
      nodeType: compDef.nodeType,
      componentType: compDef.type,
      position: 0,
      props: JSON.parse(JSON.stringify(compDef.defaultProps)),
      styles: JSON.parse(JSON.stringify(compDef.defaultStyles)),
      responsiveStyles: JSON.parse(JSON.stringify(compDef.defaultResponsiveStyles)),
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // If section, insert at page root
    if (compDef.type === 'section') {
      const result = insertNode(nodes, newNode, null);
      if (result.success) {
        updateNodesWithHistory(result.nodes);
        setSelectedNodeId(newNode.id);
      }
      return;
    }

    // Otherwise determine target parent
    let targetParentId: string | null = selectedNodeId;
    const selectedNode = nodes.find((n) => n.id === selectedNodeId);

    // If selected node cannot accept this child, find closest eligible ancestor
    if (selectedNode && !compDef.allowedParents.includes(selectedNode.componentType)) {
      if (compDef.allowedParents.includes('column')) {
        // If child needs a column and selected is inside a column, use that column
        const columnAncestor = nodes.find(
          (n) => n.componentType === 'column' && (n.id === selectedNode.parentId || n.id === selectedNode.id)
        );
        if (columnAncestor) targetParentId = columnAncestor.id;
      }
    }

    const result = insertNode(nodes, newNode, targetParentId);
    if (result.success) {
      updateNodesWithHistory(result.nodes);
      setSelectedNodeId(newNode.id);
    } else {
      setStatusMessage({ type: 'error', text: result.error || 'Cannot insert here' });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Node operations: Move, Duplicate, Delete
  const handleDuplicate = (nodeId: string) => {
    const res = duplicateNode(nodes, nodeId);
    if (res.success) {
      updateNodesWithHistory(res.nodes);
      if (res.newRootId) setSelectedNodeId(res.newRootId);
      setStatusMessage({ type: 'success', text: 'Duplicated successfully' });
      setTimeout(() => setStatusMessage(null), 2000);
    } else {
      setStatusMessage({ type: 'error', text: res.error || 'Duplication failed' });
    }
  };

  const handleDelete = (nodeId: string) => {
    const res = deleteNode(nodes, nodeId);
    if (res.success) {
      updateNodesWithHistory(res.nodes);
      setSelectedNodeId(null);
    }
  };

  const handleMove = (nodeId: string, direction: 'up' | 'down') => {
    const target = nodes.find((n) => n.id === nodeId);
    if (!target) return;

    const siblings = nodes
      .filter((n) => (n.parentId || null) === (target.parentId || null))
      .sort((a, b) => a.position - b.position);

    const currentIndex = siblings.findIndex((s) => s.id === nodeId);
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    if (newIndex >= 0 && newIndex < siblings.length) {
      const res = moveNode(nodes, nodeId, target.parentId || null, newIndex);
      if (res.success) {
        updateNodesWithHistory(res.nodes);
      }
    }
  };

  // Inspector property updates
  const handleUpdateProps = (newProps: Record<string, any>) => {
    if (!selectedNodeId) return;
    const updated = nodes.map((n) => (n.id === selectedNodeId ? { ...n, props: { ...n.props, ...newProps } } : n));
    updateNodesWithHistory(updated);
  };

  const handleUpdateStyles = (newStyles: Record<string, any>) => {
    if (!selectedNodeId) return;
    const updated = nodes.map((n) => (n.id === selectedNodeId ? { ...n, styles: { ...n.styles, ...newStyles } } : n));
    updateNodesWithHistory(updated);
  };

  const handleUpdateResponsiveStyles = (newStyles: Record<string, any>) => {
    if (!selectedNodeId) return;
    const updated = nodes.map((n) => {
      if (n.id === selectedNodeId) {
        const cur = n.responsiveStyles || {};
        const curViewport = cur[viewport] || {};
        return {
          ...n,
          responsiveStyles: {
            ...cur,
            [viewport]: { ...curViewport, ...newStyles },
          },
        };
      }
      return n;
    });
    updateNodesWithHistory(updated);
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const hierarchicalTree = buildTree(nodes);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        <Sparkles className="w-5 h-5 text-[#4f8c4c] animate-spin mr-3" />
        <span>Loading Zealosh Visual PageBuilder Workspace...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-100 font-sans text-slate-800 overflow-hidden">
      {/* -------------------------------------------------------------------- */}
      {/* 1. TOP TOOLBAR                                                       */}
      {/* -------------------------------------------------------------------- */}
      <header className="h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-30 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onExit}
            className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            title="Exit PageBuilder"
            aria-label="Exit PageBuilder"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">{page?.title}</span>
              <span className="badge-slate text-[10px] uppercase font-bold">/{page?.slug}</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  version?.status === 'PUBLISHED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {version?.status || 'DRAFT'} v{version?.versionNumber}
              </span>
            </div>
            {lastSavedTime && (
              <div className="text-[10px] text-slate-400">Last saved at {lastSavedTime}</div>
            )}
          </div>
        </div>

        {/* Viewport Controls */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 gap-1">
          <button
            onClick={() => setViewport('desktop')}
            className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewport === 'desktop' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Desktop Viewport (100%)"
          >
            <Monitor className="w-3.5 h-3.5 text-[#4f8c4c]" />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            onClick={() => setViewport('tablet')}
            className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewport === 'tablet' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Tablet Viewport (768px)"
          >
            <Tablet className="w-3.5 h-3.5 text-[#4f8c4c]" />
            <span className="hidden sm:inline">Tablet</span>
          </button>
          <button
            onClick={() => setViewport('mobile')}
            className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1.5 ${
              viewport === 'mobile' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Mobile Viewport (390px)"
          >
            <Smartphone className="w-3.5 h-3.5 text-[#4f8c4c]" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-md hover:bg-slate-100"
            title="Undo"
            aria-label="Undo"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 text-slate-500 hover:text-slate-900 disabled:opacity-30 rounded-md hover:bg-slate-100"
            title="Redo"
            aria-label="Redo"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-slate-200 mx-1" />

          {/* Preview Public URL */}
          {page && (
            <Link
              href={page.slug === 'home' ? '/' : `/p/${page.slug}`}
              target="_blank"
              className="p-1.5 text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 inline-flex items-center gap-1 text-xs font-bold"
              title="Preview Live Page"
              aria-label="Preview Live Page"
            >
              <Eye className="w-4 h-4 text-slate-500" />
              <span className="hidden md:inline">Preview</span>
            </Link>
          )}

          {/* Save Draft */}
          <button
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="btn-secondary text-xs px-3 py-1.5 rounded-lg shadow-xs inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5 text-slate-600" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          {/* Schedule Publication */}
          <button
            onClick={() => setShowScheduleModal(true)}
            className="btn-secondary text-xs px-3 py-1.5 rounded-lg shadow-xs inline-flex items-center gap-1.5"
            title="Schedule Future Publication"
          >
            <Calendar className="w-3.5 h-3.5 text-[#4f8c4c]" />
            <span>Schedule</span>
          </button>

          {/* Publish */}
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="btn-primary text-xs px-4 py-1.5 rounded-lg shadow-sm inline-flex items-center gap-1.5 font-bold"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{isPublishing ? 'Publishing...' : 'Publish'}</span>
          </button>
        </div>
      </header>

      {/* Scheduled Publication Banner */}
      {page?.scheduledPublishAt && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs text-emerald-900 flex items-center justify-between z-30">
          <div className="flex items-center gap-2 font-medium">
            <Calendar className="w-3.5 h-3.5 text-[#4f8c4c]" />
            <span>
              Scheduled for automatic publication on{' '}
              <strong className="font-bold">{new Date(page.scheduledPublishAt).toLocaleString()}</strong>
            </span>
          </div>
          <button
            onClick={handleCancelSchedule}
            className="text-red-600 hover:text-red-800 font-bold underline"
          >
            Cancel Schedule
          </button>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 mb-1">Schedule Future Publication</h3>
            <p className="text-xs text-slate-500 mb-4">
              Select a future date and time when the background publisher worker will automatically publish this version.
            </p>
            <form onSubmit={handleSchedulePublish} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Target Publication Date & Time
                </label>
                <input
                  type="datetime-local"
                  required
                  value={scheduleDateTime}
                  onChange={(e) => setScheduleDateTime(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-[#4f8c4c]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="btn-secondary text-xs px-4 py-2 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isScheduling}
                  className="btn-primary text-xs px-4 py-2 rounded-lg font-bold"
                >
                  {isScheduling ? 'Scheduling...' : 'Confirm Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status banner */}
      {statusMessage && (
        <div
          className={`px-4 py-2 text-xs font-bold flex items-center justify-between z-40 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-red-600 text-white'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-white/80 hover:text-white"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. THREE-PANE MAIN WORKSPACE                                         */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex-1 flex overflow-hidden">
        {/* ================================================================== */}
        {/* LEFT SIDEBAR: Component Library & Structure Tree                   */}
        {/* ================================================================== */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 z-20">
          <div className="flex border-b border-slate-200 bg-slate-50">
            <button
              onClick={() => setActiveSidebarTab('library')}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                activeSidebarTab === 'library'
                  ? 'border-[#4f8c4c] text-[#3a7536] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Component Library
            </button>
            <button
              onClick={() => setActiveSidebarTab('tree')}
              className={`flex-1 py-2.5 text-xs font-bold text-center border-b-2 transition-all ${
                activeSidebarTab === 'tree'
                  ? 'border-[#4f8c4c] text-[#3a7536] bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Structure Tree
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {activeSidebarTab === 'library' && (
              <div className="space-y-4">
                {/* Layout Category */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Layout & Grid
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['section', 'container', 'row', 'column'].map((type) => {
                      const def = COMPONENT_REGISTRY[type];
                      return (
                        <button
                          key={type}
                          onClick={() => handleInsertComponent(type)}
                          className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all group"
                        >
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            {def?.name}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{def?.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Content Category */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Content & Typography
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['heading', 'paragraph', 'rich_text', 'button', 'quote', 'list'].map((type) => {
                      const def = COMPONENT_REGISTRY[type];
                      return (
                        <button
                          key={type}
                          onClick={() => handleInsertComponent(type)}
                          className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all group"
                        >
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            {def?.name}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{def?.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Media & Presentation */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Presentation & Media
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['hero', 'stats_counter', 'feature_grid', 'testimonial_grid', 'image'].map((type) => {
                      const def = COMPONENT_REGISTRY[type];
                      return (
                        <button
                          key={type}
                          onClick={() => handleInsertComponent(type)}
                          className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all group"
                        >
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            {def?.name}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{def?.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Academic Dynamic Projections */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Academic Database Bindings
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['course_cards', 'course_hero', 'curriculum_accordion', 'batch_selector', 'instructor_card'].map(
                      (type) => {
                        const def = COMPONENT_REGISTRY[type];
                        return (
                          <button
                            key={type}
                            onClick={() => handleInsertComponent(type)}
                            className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all group"
                          >
                            <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                              {def?.name}
                            </div>
                            <div className="text-[10px] text-slate-400 line-clamp-1">{def?.description}</div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Interactive Blocks */}
                <div>
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-2">
                    Interactive Blocks
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {['tabs', 'accordion'].map((type) => {
                      const def = COMPONENT_REGISTRY[type];
                      return (
                        <button
                          key={type}
                          onClick={() => handleInsertComponent(type)}
                          className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-lg text-left transition-all group"
                        >
                          <div className="text-xs font-bold text-slate-800 group-hover:text-[#3a7536]">
                            {def?.name}
                          </div>
                          <div className="text-[10px] text-slate-400 line-clamp-1">{def?.description}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Structure Tree Tab */}
            {activeSidebarTab === 'tree' && (
              <div className="space-y-1">
                {hierarchicalTree.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 py-8">Tree is empty. Add a section.</div>
                ) : (
                  hierarchicalTree.map((secNode) => (
                    <TreeNodeItem
                      key={secNode.id}
                      node={secNode}
                      selectedNodeId={selectedNodeId}
                      onSelect={setSelectedNodeId}
                      onDuplicate={handleDuplicate}
                      onDelete={handleDelete}
                      onMove={handleMove}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* ================================================================== */}
        {/* CENTER CANVAS: Responsive Page Simulator                           */}
        {/* ================================================================== */}
        <main className="flex-1 bg-slate-200/75 p-6 overflow-y-auto flex flex-col items-center">
          <div
            style={{
              width: viewport === 'mobile' ? '390px' : viewport === 'tablet' ? '768px' : '100%',
              maxWidth: viewport === 'desktop' ? '1440px' : undefined,
              minHeight: '800px',
            }}
            className="bg-white shadow-xl rounded-xl overflow-hidden border border-slate-300 transition-all duration-200 flex flex-col"
          >
            {/* Viewport Frame Marker */}
            <div className="bg-slate-100 border-b border-slate-200 py-1 px-3 text-[10px] text-slate-500 font-mono flex items-center justify-between">
              <span>VIEWPORT: {viewport.toUpperCase()}</span>
              <span>{viewport === 'mobile' ? '390 × 844' : viewport === 'tablet' ? '768 × 1024' : '1440 × AUTO'}</span>
            </div>

            {/* Canvas Body */}
            <div className="flex-1">
              {hierarchicalTree.length === 0 ? (
                <div className="p-16 text-center text-slate-400 flex flex-col items-center justify-center">
                  <Layers className="w-12 h-12 text-slate-300 mb-3" />
                  <h3 className="text-base font-bold text-slate-700">Canvas is Empty</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Click "Section" in the left sidebar to add your first layout section.
                  </p>
                  <button
                    onClick={() => handleInsertComponent('section')}
                    className="btn-primary text-xs px-4 py-2 mt-4 inline-flex items-center gap-1.5"
                  >
                    <span>Add Top-Level Section</span>
                  </button>
                </div>
              ) : (
                hierarchicalTree.map((sec) => (
                  <CmsComponentRenderer
                    key={sec.id}
                    node={sec}
                    isEditorMode={true}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    previewViewport={viewport}
                  />
                ))
              )}

              {/* Add Section Footer Button */}
              {hierarchicalTree.length > 0 && (
                <div className="p-6 text-center border-t border-dashed border-slate-200 bg-slate-50/50">
                  <button
                    onClick={() => handleInsertComponent('section')}
                    className="btn-secondary text-xs px-4 py-2 rounded-lg font-bold inline-flex items-center gap-2 hover:bg-emerald-50 hover:text-[#3a7536] hover:border-emerald-300"
                  >
                    <Layers className="w-4 h-4 text-[#4f8c4c]" />
                    <span>+ Add Another Section</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ================================================================== */}
        {/* RIGHT SIDEBAR: Properties Inspector                                */}
        {/* ================================================================== */}
        <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 z-20">
          <div className="p-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-slate-900 uppercase tracking-wider">
                {selectedNode ? selectedNode.componentType : 'No Selection'}
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                {selectedNode ? selectedNode.id : 'Click a component on canvas to inspect'}
              </div>
            </div>

            {selectedNode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDuplicate(selectedNode.id)}
                  className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md hover:bg-slate-200"
                  title="Duplicate Component"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(selectedNode.id)}
                  className="p-1.5 text-red-500 hover:text-red-700 rounded-md hover:bg-red-50"
                  title="Delete Component"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {selectedNode ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 text-xs">
                {(['content', 'layout', 'styles', 'responsive'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveInspectorTab(tab)}
                    className={`flex-1 py-2 text-center font-bold capitalize border-b-2 transition-all ${
                      activeInspectorTab === tab
                        ? 'border-[#4f8c4c] text-[#3a7536]'
                        : 'border-transparent text-slate-400 hover:text-slate-700'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Inspector Tab Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                {/* 1. CONTENT TAB */}
                {activeInspectorTab === 'content' && (
                  <div className="space-y-3">
                    {/* Heading Props */}
                    {selectedNode.componentType === 'heading' && (
                      <>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Heading Text</label>
                          <input
                            type="text"
                            value={selectedNode.props?.text || ''}
                            onChange={(e) => handleUpdateProps({ text: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Level</label>
                          <select
                            value={selectedNode.props?.level || 'h2'}
                            onChange={(e) => handleUpdateProps({ level: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          >
                            <option value="h1">H1 (Page Title)</option>
                            <option value="h2">H2 (Section Heading)</option>
                            <option value="h3">H3 (Card Heading)</option>
                            <option value="h4">H4 (Subheading)</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Paragraph Props */}
                    {selectedNode.componentType === 'paragraph' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Paragraph Text</label>
                        <textarea
                          rows={4}
                          value={selectedNode.props?.text || ''}
                          onChange={(e) => handleUpdateProps({ text: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs leading-relaxed"
                        />
                      </div>
                    )}

                    {/* Button Props */}
                    {selectedNode.componentType === 'button' && (
                      <>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Button Label</label>
                          <input
                            type="text"
                            value={selectedNode.props?.label || ''}
                            onChange={(e) => handleUpdateProps({ label: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Destination URL / Route</label>
                          <input
                            type="text"
                            value={selectedNode.props?.href || ''}
                            onChange={(e) => handleUpdateProps({ href: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Style Variant</label>
                          <select
                            value={selectedNode.props?.variant || 'primary'}
                            onChange={(e) => handleUpdateProps({ variant: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          >
                            <option value="primary">Primary Green</option>
                            <option value="secondary">Secondary Slate</option>
                            <option value="outline">Outline</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Image Props */}
                    {selectedNode.componentType === 'image' && (
                      <>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Image URL</label>
                          <input
                            type="text"
                            value={selectedNode.props?.url || ''}
                            onChange={(e) => handleUpdateProps({ url: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Alt Text (Accessibility)</label>
                          <input
                            type="text"
                            value={selectedNode.props?.alt || ''}
                            onChange={(e) => handleUpdateProps({ alt: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                      </>
                    )}

                    {/* Hero Props */}
                    {selectedNode.componentType === 'hero' && (
                      <>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Headline</label>
                          <textarea
                            rows={2}
                            value={selectedNode.props?.headline || ''}
                            onChange={(e) => handleUpdateProps({ headline: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Subtitle</label>
                          <textarea
                            rows={3}
                            value={selectedNode.props?.subtitle || ''}
                            onChange={(e) => handleUpdateProps({ subtitle: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">Primary CTA Label</label>
                          <input
                            type="text"
                            value={selectedNode.props?.primaryCtaText || ''}
                            onChange={(e) => handleUpdateProps({ primaryCtaText: e.target.value })}
                            className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                          />
                        </div>
                      </>
                    )}

                    {/* Fallback for general props */}
                    {!['heading', 'paragraph', 'button', 'image', 'hero'].includes(selectedNode.componentType) && (
                      <div className="text-slate-500 italic">
                        Standard properties configured for {selectedNode.componentType}.
                      </div>
                    )}
                  </div>
                )}

                {/* 2. LAYOUT TAB */}
                {activeInspectorTab === 'layout' && (
                  <div className="space-y-3">
                    {selectedNode.componentType === 'column' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Column Span (1 - 12)</label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={selectedNode.props?.colSpan || 12}
                          onChange={(e) => handleUpdateProps({ colSpan: parseInt(e.target.value) || 12 })}
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Padding</label>
                      <input
                        type="text"
                        placeholder="e.g. 2rem 1rem"
                        value={selectedNode.styles?.padding || ''}
                        onChange={(e) => handleUpdateStyles({ padding: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Margin</label>
                      <input
                        type="text"
                        placeholder="e.g. 0 auto"
                        value={selectedNode.styles?.margin || ''}
                        onChange={(e) => handleUpdateStyles({ margin: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* 3. STYLES TAB */}
                {activeInspectorTab === 'styles' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Background Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={selectedNode.styles?.backgroundColor || '#ffffff'}
                          onChange={(e) => handleUpdateStyles({ backgroundColor: e.target.value })}
                          className="w-8 h-8 rounded border border-slate-200 p-0.5 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedNode.styles?.backgroundColor || ''}
                          onChange={(e) => handleUpdateStyles({ backgroundColor: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Text Color</label>
                      <div className="flex gap-2 items-center">
                        <input
                          type="color"
                          value={selectedNode.styles?.textColor || '#0f172a'}
                          onChange={(e) => handleUpdateStyles({ textColor: e.target.value })}
                          className="w-8 h-8 rounded border border-slate-200 p-0.5 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={selectedNode.styles?.textColor || ''}
                          onChange={(e) => handleUpdateStyles({ textColor: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Text Alignment</label>
                      <select
                        value={selectedNode.styles?.textAlign || 'left'}
                        onChange={(e) => handleUpdateStyles({ textAlign: e.target.value })}
                        className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* 4. RESPONSIVE TAB */}
                {activeInspectorTab === 'responsive' && (
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <span className="font-bold text-slate-700">Active Viewport: </span>
                      <span className="font-mono text-[#3a7536] uppercase">{viewport}</span>
                    </div>

                    {selectedNode.componentType === 'column' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {viewport.toUpperCase()} Column Span (1-12)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={12}
                          value={selectedNode.responsiveStyles?.[viewport]?.colSpan || selectedNode.props?.colSpan || 12}
                          onChange={(e) =>
                            handleUpdateResponsiveStyles({ colSpan: parseInt(e.target.value) || 12 })
                          }
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 p-6 text-center text-slate-400 text-xs flex flex-col items-center justify-center">
              <Settings className="w-8 h-8 text-slate-300 mb-2" />
              <span>Select any element on the canvas to inspect and configure its attributes.</span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// Helper Subcomponent for Structure Tree
function TreeNodeItem({
  node,
  selectedNodeId,
  onSelect,
  onDuplicate,
  onDelete,
  onMove,
  depth = 0,
}: {
  node: CmsPageNode;
  selectedNodeId: string | null;
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: 'up' | 'down') => void;
  depth?: number;
}) {
  const isSelected = selectedNodeId === node.id;
  const paddingLeft = `${depth * 14 + 8}px`;

  return (
    <div>
      <div
        onClick={() => onSelect(node.id)}
        style={{ paddingLeft }}
        className={`py-1.5 pr-2 rounded-md flex items-center justify-between text-xs cursor-pointer group transition-colors ${
          isSelected
            ? 'bg-[#4f8c4c] text-white font-bold'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span className="truncate flex-1">
          {node.componentType}
          <span className={`text-[10px] ml-1.5 ${isSelected ? 'text-white/70' : 'text-slate-400'}`}>
            ({node.id.substring(0, 7)})
          </span>
        </span>

        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(node.id, 'up');
            }}
            className={`p-0.5 rounded hover:bg-black/10 ${isSelected ? 'text-white' : 'text-slate-500'}`}
            title="Move Up"
            aria-label="Move Up"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMove(node.id, 'down');
            }}
            className={`p-0.5 rounded hover:bg-black/10 ${isSelected ? 'text-white' : 'text-slate-500'}`}
            title="Move Down"
            aria-label="Move Down"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(node.id);
            }}
            className={`p-0.5 rounded hover:bg-black/10 ${isSelected ? 'text-white' : 'text-slate-500'}`}
            title="Duplicate"
            aria-label="Duplicate"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(node.id);
            }}
            className="p-0.5 rounded hover:bg-red-500 hover:text-white text-red-500"
            title="Delete"
            aria-label="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {node.children && node.children.length > 0 && (
        <div className="space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedNodeId={selectedNodeId}
              onSelect={onSelect}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onMove={onMove}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

