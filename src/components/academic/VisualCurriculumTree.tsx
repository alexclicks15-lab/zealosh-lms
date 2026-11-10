'use client';

import React, { useState, useEffect } from 'react';
import {
  Folder,
  FileText,
  Layers,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowUp,
  ArrowDown,
  History,
  CheckCircle,
  Eye,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { CourseModule, Topic, Subtopic, SyllabusVersion } from '@/types';

interface VisualCurriculumTreeProps {
  courseId: string;
  courseTitle: string;
  canEdit?: boolean;
}

export function VisualCurriculumTree({
  courseId,
  courseTitle,
  canEdit = true,
}: VisualCurriculumTreeProps) {
  const [tree, setTree] = useState<any[]>([]);
  const [versions, setVersions] = useState<SyllabusVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Snapshot version dialog
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [versionTitle, setVersionTitle] = useState('');
  const [versionChangelog, setVersionChangelog] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);

  // New Node Form
  const [activeForm, setActiveForm] = useState<{
    type: 'MODULE' | 'TOPIC' | 'SUBTOPIC';
    parentId?: string;
  } | null>(null);
  const [newNodeTitle, setNewNodeTitle] = useState('');
  const [newNodeDesc, setNewNodeDesc] = useState('');

  useEffect(() => {
    fetchTreeAndVersions();
  }, [courseId]);

  async function fetchTreeAndVersions() {
    setLoading(true);
    try {
      const [treeRes, versRes] = await Promise.all([
        fetch('/api/admin/academic/tree'),
        fetch(`/api/admin/academic/curriculum/versions?courseId=${courseId}`),
      ]);

      if (treeRes.ok) {
        const data = await treeRes.json();
        // Locate course modules in tree
        let foundModules: any[] = [];
        const departments = data.departments || [];
        for (const dep of departments) {
          for (const prog of dep.programmes || []) {
            for (const crs of prog.courses || []) {
              if (crs.id === courseId) {
                foundModules = crs.modules || [];
              }
            }
          }
        }
        setTree(foundModules);
        // Expand first module by default
        if (foundModules.length > 0) {
          setExpandedModules({ [foundModules[0].id]: true });
        }
      }

      if (versRes.ok) {
        const vData = await versRes.json();
        setVersions(vData.versions || []);
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Failed to load curriculum', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleReorder(items: Array<{ id: string; sortOrder: number }>) {
    try {
      const res = await fetch('/api/admin/academic/tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REORDER', items }),
      });
      if (res.ok) {
        setMessage({ text: 'Hierarchy order updated successfully', type: 'success' });
        fetchTreeAndVersions();
      } else {
        const data = await res.json();
        setMessage({ text: data.error || 'Reorder failed', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  async function handleCreateSnapshot(e: React.FormEvent) {
    e.preventDefault();
    if (!versionTitle.trim()) return;
    setSavingVersion(true);
    try {
      const res = await fetch('/api/admin/academic/curriculum/versions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          title: versionTitle,
          changelog: versionChangelog,
        }),
      });
      if (res.ok) {
        const v = await res.json();
        setVersions([v, ...versions]);
        setShowVersionModal(false);
        setVersionTitle('');
        setVersionChangelog('');
        setMessage({ text: `Syllabus Snapshot v${v.versionNumber} created`, type: 'success' });
      } else {
        const d = await res.json();
        setMessage({ text: d.error || 'Failed to create snapshot', type: 'error' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    } finally {
      setSavingVersion(false);
    }
  }

  async function handlePublishVersion(versionId: string) {
    try {
      const res = await fetch(`/api/admin/academic/curriculum/versions/${versionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'PUBLISH' }),
      });
      if (res.ok) {
        const updated = await res.json();
        setVersions(versions.map((v) => (v.id === updated.id ? updated : v)));
        setMessage({ text: `Version v${updated.versionNumber} published as authoritative`, type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message, type: 'error' });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#e2efe1] p-6 shadow-xs">
      {/* Header with Title & Action Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-gray-100 gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#4f8c4c] bg-[#eef7ee] px-2.5 py-1 rounded-full">
            Curriculum Hierarchy
          </span>
          <h2 className="text-xl font-bold text-slate-900 mt-2">{courseTitle}</h2>
          <p className="text-xs text-slate-500">
            Authoritative dynamic syllabus hierarchy with acyclic validation and historical versioning
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowVersionModal(true)}
            className="btn-outline text-xs py-2 px-3.5 flex items-center gap-1.5 border-[#4f8c4c] text-[#3a7536] hover:bg-[#eef7ee]"
          >
            <History className="w-3.5 h-3.5" />
            <span>Syllabus Versions ({versions.length})</span>
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`mt-4 p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            message.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-bold underline ml-3">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400 text-sm">Loading curriculum tree...</div>
      ) : tree.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm font-semibold">No modules configured for this course yet.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {tree.map((mod: any, mIdx: number) => {
            const isModOpen = !!expandedModules[mod.id];
            const topics = mod.topics || [];

            return (
              <div key={mod.id} className="border border-gray-200 rounded-lg overflow-hidden bg-slate-50/50">
                {/* Module Bar */}
                <div className="flex items-center justify-between p-3.5 bg-white hover:bg-slate-50 transition border-b border-gray-100">
                  <div
                    className="flex items-center gap-2.5 cursor-pointer flex-1"
                    onClick={() => setExpandedModules({ ...expandedModules, [mod.id]: !isModOpen })}
                  >
                    {isModOpen ? <ChevronDown className="w-4 h-4 text-gray-500" /> : <ChevronRight className="w-4 h-4 text-gray-500" />}
                    <Folder className="w-4 h-4 text-[#4f8c4c]" />
                    <span className="font-bold text-sm text-slate-900">{mod.title}</span>
                    <span className="text-[11px] text-gray-400">({topics.length} topics)</span>
                  </div>

                  {canEdit && (
                    <div className="flex items-center gap-1">
                      {mIdx > 0 && (
                        <button
                          onClick={() => {
                            const prev = tree[mIdx - 1];
                            handleReorder([
                              { id: mod.id, sortOrder: prev.displayOrder || mIdx - 1 },
                              { id: prev.id, sortOrder: mod.displayOrder || mIdx },
                            ]);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500"
                          title="Move module up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {mIdx < tree.length - 1 && (
                        <button
                          onClick={() => {
                            const next = tree[mIdx + 1];
                            handleReorder([
                              { id: mod.id, sortOrder: next.displayOrder || mIdx + 1 },
                              { id: next.id, sortOrder: mod.displayOrder || mIdx },
                            ]);
                          }}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500"
                          title="Move module down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Topics List */}
                {isModOpen && (
                  <div className="p-3 pl-8 space-y-3 bg-slate-50/70 border-t border-gray-100">
                    {topics.length === 0 ? (
                      <div className="text-xs text-gray-400 py-2">No topics in this module.</div>
                    ) : (
                      topics.map((top: any, tIdx: number) => {
                        const isTopOpen = !!expandedTopics[top.id];
                        const subtopics = top.subtopics || [];

                        return (
                          <div key={top.id} className="bg-white rounded-md border border-gray-200 p-2.5 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <div
                                className="flex items-center gap-2 cursor-pointer flex-1"
                                onClick={() => setExpandedTopics({ ...expandedTopics, [top.id]: !isTopOpen })}
                              >
                                {isTopOpen ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="font-semibold text-xs text-slate-800">{top.title}</span>
                                <span className="text-[10px] text-gray-400">({subtopics.length} subtopics)</span>
                              </div>

                              {canEdit && (
                                <div className="flex items-center gap-1">
                                  {tIdx > 0 && (
                                    <button
                                      onClick={() => {
                                        const prev = topics[tIdx - 1];
                                        handleReorder([
                                          { id: top.id, sortOrder: prev.displayOrder || tIdx - 1 },
                                          { id: prev.id, sortOrder: top.displayOrder || tIdx },
                                        ]);
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                  )}
                                  {tIdx < topics.length - 1 && (
                                    <button
                                      onClick={() => {
                                        const next = topics[tIdx + 1];
                                        handleReorder([
                                          { id: top.id, sortOrder: next.displayOrder || tIdx + 1 },
                                          { id: next.id, sortOrder: top.displayOrder || tIdx },
                                        ]);
                                      }}
                                      className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Subtopics List */}
                            {isTopOpen && (
                              <div className="mt-2 pl-6 pt-2 border-t border-gray-50 space-y-1.5">
                                {subtopics.length === 0 ? (
                                  <div className="text-[11px] text-gray-400 py-1">No subtopics defined.</div>
                                ) : (
                                  subtopics.map((sub: any) => (
                                    <div
                                      key={sub.id}
                                      className="flex items-center justify-between text-[11px] py-1 px-2 rounded bg-slate-50 text-slate-700"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <FileText className="w-3 h-3 text-slate-400" />
                                        <span>{sub.title}</span>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Syllabus Versions Modal / Drawer */}
      {showVersionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <History className="w-4 h-4 text-[#4f8c4c]" />
                Syllabus Version History
              </h3>
              <button
                onClick={() => setShowVersionModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Create Snapshot Form */}
            <form onSubmit={handleCreateSnapshot} className="mt-4 p-3 bg-slate-50 rounded-lg border border-gray-200">
              <h4 className="text-xs font-bold text-slate-800 mb-2">Create New Syllabus Snapshot</h4>
              <input
                type="text"
                placeholder="e.g. 2026/Q4 Revised Technical Blueprint"
                value={versionTitle}
                onChange={(e) => setVersionTitle(e.target.value)}
                className="w-full text-xs p-2 rounded border border-gray-300 mb-2 bg-white"
                required
              />
              <textarea
                placeholder="Changelog notes (e.g. Added Advanced HAZOP calculations module)..."
                value={versionChangelog}
                onChange={(e) => setVersionChangelog(e.target.value)}
                className="w-full text-xs p-2 rounded border border-gray-300 mb-2 bg-white"
                rows={2}
              />
              <button
                type="submit"
                disabled={savingVersion || !versionTitle.trim()}
                className="btn-primary text-xs py-1.5 px-3 bg-[#4f8c4c] text-white font-bold rounded"
              >
                {savingVersion ? 'Capturing Snapshot...' : 'Capture Snapshot'}
              </button>
            </form>

            {/* Existing Versions List */}
            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Archived & Published Versions</h4>
              {versions.length === 0 ? (
                <div className="text-xs text-gray-400 py-3 text-center">No snapshots recorded yet.</div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="p-2.5 rounded-lg border border-gray-200 text-xs flex items-center justify-between bg-white"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">v{ver.versionNumber}: {ver.title}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            ver.status === 'PUBLISHED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ver.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{ver.changelog}</p>
                      <span className="text-[10px] text-gray-400">
                        {new Date(ver.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {ver.status === 'DRAFT' && canEdit && (
                      <button
                        onClick={() => handlePublishVersion(ver.id)}
                        className="text-[11px] font-bold text-[#3a7536] hover:underline flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

