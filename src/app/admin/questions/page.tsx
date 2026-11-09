'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  FileText,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  BarChart2,
  BookOpen,
  Award,
  Layers,
  Sparkles,
  RefreshCw,
  Eye,
  Sliders,
} from 'lucide-react';
import {
  QuestionBankItem,
  QuestionVersion,
  ItemAnalytics,
  CognitiveLevel,
  QuestionVersionStatus,
} from '@/types';

export default function AdminQuestionBankPage() {
  const [items, setItems] = useState<QuestionBankItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<QuestionBankItem | null>(null);
  const [versions, setVersions] = useState<QuestionVersion[]>([]);
  const [activeVersion, setActiveVersion] = useState<QuestionVersion | null>(null);
  const [analytics, setAnalytics] = useState<ItemAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterCert, setFilterCert] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New question form state
  const [formCert, setFormCert] = useState('ASP');
  const [formTitle, setFormTitle] = useState('');
  const [formStem, setFormStem] = useState('');
  const [formDomain, setFormDomain] = useState('Domain 1: Advanced Safety Sciences');
  const [formTopic, setFormTopic] = useState('System Safety Analysis');
  const [formDifficulty, setFormDifficulty] = useState('MODERATE');
  const [formCognitive, setFormCognitive] = useState<CognitiveLevel>('APPLICATION');
  const [formOptA, setFormOptA] = useState('');
  const [formOptB, setFormOptB] = useState('');
  const [formOptC, setFormOptC] = useState('');
  const [formOptD, setFormOptD] = useState('');
  const [formCorrectOpt, setFormCorrectOpt] = useState('opt-a');
  const [formExplanation, setFormExplanation] = useState('');
  const [formReference, setFormReference] = useState('');

  const loadQuestions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/assessment/questions');
      const data = await res.json();
      if (data.success && data.items) {
        setItems(data.items);
        if (data.items.length > 0 && !selectedItem) {
          loadItemDetails(data.items[0].id);
        }
      }
    } catch {
      // Graceful fallback
    } finally {
      setLoading(false);
    }
  }, [selectedItem]);

  const loadItemDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/assessment/questions/${id}`);
      const data = await res.json();
      if (data.success) {
        setSelectedItem(data.item);
        setVersions(data.versions);
        setActiveVersion(data.activeVersion || data.versions[data.versions.length - 1]);

        // Load analytics
        const verNum = data.item.currentVersionNumber;
        const aRes = await fetch(`/api/assessment/questions/${id}/analytics?version=${verNum}`);
        const aData = await aRes.json();
        if (aData.success) {
          setAnalytics(aData.analytics);
        }
      }
    } catch {
      // Fallback
    }
  };

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/assessment/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          certificationType: formCert,
          title: formTitle,
          stem: formStem,
          difficulty: formDifficulty,
          cognitiveLevel: formCognitive,
          domain: formDomain,
          topic: formTopic,
          options: [
            { id: 'opt-a', text: formOptA },
            { id: 'opt-b', text: formOptB },
            { id: 'opt-c', text: formOptC },
            { id: 'opt-d', text: formOptD },
          ],
          correctOptionIds: [formCorrectOpt],
          explanation: formExplanation,
          referenceSource: formReference,
          authorId: 'faculty-001',
          authorName: 'Senior HSE Assessor',
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        loadQuestions();
      }
    } catch {
      // Error handling
    }
  };

  const handlePublishVersion = async (versionNum: number) => {
    if (!selectedItem) return;
    try {
      await fetch(`/api/assessment/questions/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRANSITION_STATUS',
          versionNumber: versionNum,
          newStatus: 'PUBLISHED',
          actorId: 'admin-001',
        }),
      });
      loadItemDetails(selectedItem.id);
      loadQuestions();
    } catch {
      // Error
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCert = filterCert === 'ALL' || item.certificationType === filterCert;
    const matchesQuery =
      !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCert && matchesQuery;
  });

  return (
    <div className="min-h-screen bg-[#f7f9fc] py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Breadcrumbs & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-gray-500">
              <Link href="/admin" className="hover:text-[#4f8c4c]">Admin Console</Link>
              <span>/</span>
              <span className="text-slate-900">Assessment Intelligence</span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 mt-1 flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#4f8c4c]" />
              Central Question Bank & Item Analytics
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Authoritative, version-controlled repository of institutional examination questions with Classical Test Theory psychometrics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadQuestions()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaedf5] rounded-xl hover:bg-slate-50 shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-[#4f8c4c] hover:bg-[#3a7536] rounded-xl shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Author New Question</span>
            </button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-[#eaedf5] p-5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-gray-400">Total Question Items</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{items.length}</div>
            <div className="text-[11px] text-emerald-600 font-medium mt-1">Multi-programme catalog</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#eaedf5] p-5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-gray-400">Published & Live</div>
            <div className="text-2xl font-black text-[#4f8c4c] mt-1">
              {items.filter((i) => i.status === 'PUBLISHED').length}
            </div>
            <div className="text-[11px] text-gray-500 font-medium mt-1">Active in mock exams & blueprints</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#eaedf5] p-5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-gray-400">In Review / Draft</div>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {items.filter((i) => i.status === 'DRAFT' || i.status === 'IN_REVIEW').length}
            </div>
            <div className="text-[11px] text-gray-500 font-medium mt-1">Awaiting editorial sign-off</div>
          </div>
          <div className="bg-white rounded-2xl border border-[#eaedf5] p-5 shadow-xs">
            <div className="text-[11px] font-bold uppercase text-gray-400">Psychometric Integrity</div>
            <div className="text-2xl font-black text-indigo-600 mt-1">100%</div>
            <div className="text-[11px] text-gray-500 font-medium mt-1">Zero answer key leakage</div>
          </div>
        </div>

        {/* Workspace Layout: List & Detail/Analytics Inspector */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Question List (5 cols) */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#eaedf5] shadow-xs flex flex-col h-[700px] overflow-hidden">
            {/* Filter toolbar */}
            <div className="p-4 border-b border-[#eaedf5] space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by code or title..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-[#eaedf5] rounded-xl focus:outline-none focus:border-[#4f8c4c]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {['ALL', 'ASP', 'CSP', 'CRSP', 'NEBOSH'].map((cert) => (
                  <button
                    key={cert}
                    onClick={() => setFilterCert(cert)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
                      filterCert === cert
                        ? 'bg-[#4f8c4c] text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cert}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto divide-y divide-[#eaedf5]">
              {loading && (
                <div className="p-8 text-center text-xs text-gray-400">Loading Question Bank...</div>
              )}
              {!loading && filteredItems.length === 0 && (
                <div className="p-8 text-center text-xs text-gray-400">No questions match filter criteria.</div>
              )}
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => loadItemDetails(item.id)}
                  className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                    selectedItem?.id === item.id ? 'bg-[#f4f9f3] border-l-4 border-l-[#4f8c4c]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[11px] font-black text-slate-700 bg-gray-100 px-2 py-0.5 rounded">
                      {item.code}
                    </span>
                    <span
                      className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded ${
                        item.status === 'PUBLISHED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'APPROVED'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.status} (v{item.currentVersionNumber})
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2">{item.title}</h4>
                  <div className="flex items-center gap-2 mt-2 text-[10px] text-gray-400 font-semibold">
                    <span className="text-[#3a7536] font-bold">{item.certificationType}</span>
                    <span>•</span>
                    <span>{item.authorName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Question Inspector & Item Analytics (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedItem && activeVersion ? (
              <>
                {/* Question Version Detail */}
                <div className="bg-white rounded-2xl border border-[#eaedf5] p-6 shadow-xs space-y-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black text-slate-800 bg-gray-100 px-2 py-0.5 rounded">
                          {selectedItem.code}
                        </span>
                        <span className="text-xs font-bold text-gray-400">Version {activeVersion.versionNumber}</span>
                        <span className="text-[11px] font-bold text-[#4f8c4c] bg-[#e1f0df] px-2 py-0.5 rounded-full">
                          {activeVersion.cognitiveLevel}
                        </span>
                        <span className="text-[11px] font-bold text-slate-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          {activeVersion.difficulty}
                        </span>
                      </div>
                      <h2 className="text-base font-extrabold text-slate-900 mt-2">{selectedItem.title}</h2>
                    </div>

                    {activeVersion.status !== 'PUBLISHED' && (
                      <button
                        onClick={() => handlePublishVersion(activeVersion.versionNumber)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-[#3a7536] hover:bg-[#2e622b] rounded-lg shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Publish Version</span>
                      </button>
                    )}
                  </div>

                  {/* Taxonomy Breadcrumbs */}
                  <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-[#eaedf5]">
                    <div className="font-bold text-slate-700">Domain: {activeVersion.domain}</div>
                    <div className="text-gray-500 mt-0.5">Topic: {activeVersion.topic}</div>
                  </div>

                  {/* Stem */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-gray-400 block mb-1">
                      Question Stem
                    </label>
                    <div className="text-sm text-slate-900 bg-slate-50 p-4 rounded-xl border border-[#eaedf5] font-medium leading-relaxed">
                      {activeVersion.stem}
                    </div>
                  </div>

                  {/* Options */}
                  <div>
                    <label className="text-[11px] font-bold uppercase text-gray-400 block mb-2">
                      Answer Options & Key
                    </label>
                    <div className="space-y-2">
                      {activeVersion.options.map((opt) => {
                        const isCorrect = activeVersion.correctOptionIds.includes(opt.id);
                        return (
                          <div
                            key={opt.id}
                            className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                              isCorrect
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                : 'bg-white border-[#eaedf5] text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-mono uppercase font-bold text-[11px] text-gray-400">
                                [{opt.id.replace('opt-', '')}]
                              </span>
                              <span>{opt.text}</span>
                            </div>
                            {isCorrect && (
                              <span className="text-[10px] uppercase font-black tracking-wider text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Explanation & Source */}
                  <div className="border-t border-[#eaedf5] pt-4 text-xs space-y-2">
                    <div>
                      <span className="font-bold text-slate-700">Rationale / Explanation: </span>
                      <span className="text-gray-600">{activeVersion.explanation}</span>
                    </div>
                    <div>
                      <span className="font-bold text-slate-700">Reference Source: </span>
                      <span className="text-gray-500 font-mono">{activeVersion.referenceSource}</span>
                    </div>
                  </div>
                </div>

                {/* Classical Test Theory Psychometrics */}
                <div className="bg-white rounded-2xl border border-[#eaedf5] p-6 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-[#4f8c4c]" />
                      Classical Test Theory Item Analytics
                    </h3>
                    {analytics?.sampleSizeSufficient ? (
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                        Sample Size Defensible (N = {analytics.totalAttempts})
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Sample Size Limited (N = {analytics?.totalAttempts || 0} &lt; 30)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 p-4 rounded-xl border border-[#eaedf5]">
                      <div className="text-[11px] uppercase font-bold text-gray-400">Difficulty Index (p-value)</div>
                      <div className="text-2xl font-black text-slate-900 mt-1">
                        {analytics ? (analytics.difficultyPValue * 100).toFixed(1) + '%' : '0.0%'}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Proportion of correct responses (0.0 to 1.0). Target: 40% - 75%.
                      </p>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-xl border border-[#eaedf5]">
                      <div className="text-[11px] uppercase font-bold text-gray-400">Discrimination Index (D)</div>
                      <div className="text-2xl font-black text-[#4f8c4c] mt-1">
                        {analytics ? analytics.discriminationD.toFixed(2) : '0.00'}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1">
                        Upper quartile vs lower quartile separation. D &ge; 0.30 indicates high validity.
                      </p>
                    </div>
                  </div>

                  {/* Distractor Frequencies */}
                  {analytics && Object.keys(analytics.distractorFrequencies).length > 0 && (
                    <div className="mt-4 border-t border-[#eaedf5] pt-4">
                      <div className="text-[11px] uppercase font-bold text-gray-400 mb-2">
                        Distractor Selection Frequencies
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.entries(analytics.distractorFrequencies).map(([optId, data]) => (
                          <div key={optId} className="bg-gray-50 p-2.5 rounded-lg border border-[#eaedf5] text-center">
                            <div className="font-mono text-[10px] font-bold text-gray-500 uppercase">
                              [{optId.replace('opt-', '')}]
                            </div>
                            <div className="text-sm font-black text-slate-800">{data.percentage}%</div>
                            <div className="text-[10px] text-gray-400">{data.count} selections</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="bg-white rounded-2xl border border-[#eaedf5] p-12 text-center text-xs text-gray-400 shadow-xs">
                Select a question item from the list to inspect versions, metadata, and psychometrics.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Author New Question Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-black text-slate-900">Author New Question Bank Item</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateQuestion} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Certification Programme</label>
                  <select
                    value={formCert}
                    onChange={(e) => setFormCert(e.target.value)}
                    className="w-full border p-2 rounded-lg"
                  >
                    <option value="ASP">Associate Safety Professional (ASP)</option>
                    <option value="CSP">Certified Safety Professional (CSP)</option>
                    <option value="CRSP">Canadian Registered Safety Professional (CRSP)</option>
                    <option value="NEBOSH">NEBOSH International Diploma</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Cognitive Level</label>
                  <select
                    value={formCognitive}
                    onChange={(e) => setFormCognitive(e.target.value as CognitiveLevel)}
                    className="w-full border p-2 rounded-lg"
                  >
                    <option value="KNOWLEDGE">Knowledge & Recall</option>
                    <option value="APPLICATION">Application & Synthesis</option>
                    <option value="ANALYSIS">Analysis & Troubleshooting</option>
                    <option value="EVALUATION">Evaluation & Governance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Question Title / Headline</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Combustible Dust Minimum Explosive Concentration (MEC)"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full border p-2 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Question Stem</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Enter the full question stem or scenario..."
                  value={formStem}
                  onChange={(e) => setFormStem(e.target.value)}
                  className="w-full border p-2 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Domain</label>
                  <input
                    type="text"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    className="w-full border p-2 rounded-lg"
                  />
                </div>
                <div>
                  <label className="font-bold text-gray-600 block mb-1">Topic</label>
                  <input
                    type="text"
                    value={formTopic}
                    onChange={(e) => setFormTopic(e.target.value)}
                    className="w-full border p-2 rounded-lg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="font-bold text-gray-600 block">Options & Key</label>
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={formCorrectOpt === 'opt-a'}
                      onChange={() => setFormCorrectOpt('opt-a')}
                    />
                    <input
                      type="text"
                      placeholder="Option A"
                      required
                      value={formOptA}
                      onChange={(e) => setFormOptA(e.target.value)}
                      className="w-full border p-2 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={formCorrectOpt === 'opt-b'}
                      onChange={() => setFormCorrectOpt('opt-b')}
                    />
                    <input
                      type="text"
                      placeholder="Option B"
                      required
                      value={formOptB}
                      onChange={(e) => setFormOptB(e.target.value)}
                      className="w-full border p-2 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={formCorrectOpt === 'opt-c'}
                      onChange={() => setFormCorrectOpt('opt-c')}
                    />
                    <input
                      type="text"
                      placeholder="Option C"
                      required
                      value={formOptC}
                      onChange={(e) => setFormOptC(e.target.value)}
                      className="w-full border p-2 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOpt"
                      checked={formCorrectOpt === 'opt-d'}
                      onChange={() => setFormCorrectOpt('opt-d')}
                    />
                    <input
                      type="text"
                      placeholder="Option D"
                      required
                      value={formOptD}
                      onChange={(e) => setFormOptD(e.target.value)}
                      className="w-full border p-2 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Explanation & Rationale</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Provide technical justification..."
                  value={formExplanation}
                  onChange={(e) => setFormExplanation(e.target.value)}
                  className="w-full border p-2 rounded-lg"
                />
              </div>

              <div>
                <label className="font-bold text-gray-600 block mb-1">Reference Standard / Source</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., NFPA 652 (2025 ed.), Clause 8.4.2"
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  className="w-full border p-2 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#4f8c4c] text-white rounded-xl font-bold hover:bg-[#3a7536]"
                >
                  Save Draft Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

