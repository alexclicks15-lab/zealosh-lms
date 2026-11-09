'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Search,
  Filter,
  FileText,
  UserCheck,
  ArrowRight,
  Package,
  Layers,
  ChevronRight,
  RotateCcw,
  AlertTriangle,
  Send,
  Eye,
  Check,
  X,
  Lock,
  Kanban
} from 'lucide-react';
import {
  AdmissionsPipelineStage,
  AdmissionApplication,
  ApplicationDocument,
  ProvisioningJob,
  ProductOffering,
  Lead,
} from '@/types';

export default function AdminAdmissionsPage() {
  const [activeTab, setActiveTab] = useState<'pipeline' | 'documents' | 'provisioning' | 'offerings' | 'leads'>('pipeline');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Pipeline Data
  const [stages, setStages] = useState<AdmissionsPipelineStage[]>([]);
  const [stageCounts, setStageCounts] = useState<Record<string, number>>({});
  const [applications, setApplications] = useState<AdmissionApplication[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('');

  // Leads Data
  const [leads, setLeads] = useState<Lead[]>([]);

  // Provisioning Data
  const [provisioningJobs, setProvisioningJobs] = useState<ProvisioningJob[]>([]);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  // Offerings Data
  const [offerings, setOfferings] = useState<ProductOffering[]>([]);

  // Override Modal
  const [overrideApp, setOverrideApp] = useState<AdmissionApplication | null>(null);
  const [overrideTargetStage, setOverrideTargetStage] = useState<AdmissionsPipelineStage>('ADMITTED');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [submittingOverride, setSubmittingOverride] = useState(false);

  // Document Review Action Modal
  const [rejectDocTarget, setRejectDocTarget] = useState<ApplicationDocument | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [requestResubmission, setRequestResubmission] = useState(true);

  const loadData = async () => {
    setRefreshing(true);
    try {
      const [pipeRes, provRes, prodRes, leadsRes] = await Promise.all([
        fetch('/api/admin/admissions/pipeline').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/admin/provisioning').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/commerce/products').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/leads').then((r) => (r.ok ? r.json() : null)),
      ]);

      if (pipeRes?.success) {
        setStages(pipeRes.stages || []);
        setStageCounts(pipeRes.stageCounts || {});
        setApplications(pipeRes.applications || []);
      }

      if (provRes?.success) {
        setProvisioningJobs(provRes.jobs || []);
      }

      if (prodRes?.success && prodRes.products) {
        const allOfferings = prodRes.products.flatMap((p: any) => p.offerings || []);
        setOfferings(allOfferings);
      }

      if (leadsRes?.success) {
        setLeads(leadsRes.leads || []);
      }
    } catch {
      // Handled
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStageTransition = async (applicationId: string, targetStage: AdmissionsPipelineStage) => {
    try {
      const res = await fetch(`/api/admin/admissions/${applicationId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetStage, reason: `Standard pipeline move to ${targetStage}` }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(`Transition Failed: ${data.error}`);
        return;
      }
      await loadData();
    } catch (err: any) {
      alert(`Network error: ${err.message}`);
    }
  };

  const handleExecuteOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideApp) return;
    if (!overrideReason || overrideReason.trim().length < 10) {
      setOverrideError('Detailed reason (at least 10 characters) is required for audit logs.');
      return;
    }

    setSubmittingOverride(true);
    setOverrideError('');

    try {
      const res = await fetch(`/api/admin/admissions/${overrideApp.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStage: overrideTargetStage,
          reason: overrideReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Override failed');
      }

      setOverrideApp(null);
      setOverrideReason('');
      await loadData();
    } catch (err: any) {
      setOverrideError(err.message);
    } finally {
      setSubmittingOverride(false);
    }
  };

  const handleVerifyDocument = async (appId: string, docId: string) => {
    try {
      const res = await fetch(`/api/admin/admissions/${appId}/documents/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, action: 'VERIFY' }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRejectDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectDocTarget) return;

    try {
      const res = await fetch(`/api/admin/admissions/${rejectDocTarget.applicationId}/documents/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: rejectDocTarget.id,
          action: 'REJECT',
          rejectionReason,
          requestResubmission,
        }),
      });
      if (res.ok) {
        setRejectDocTarget(null);
        setRejectionReason('');
        await loadData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const res = await fetch(`/api/admin/provisioning/${jobId}/retry`, {
        method: 'POST',
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRetryingJobId(null);
    }
  };

  // Filtered applications
  const filteredApplications = applications.filter((app) => {
    if (selectedCourseFilter && app.courseId !== selectedCourseFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        app.applicantName.toLowerCase().includes(q) ||
        app.applicantEmail.toLowerCase().includes(q) ||
        app.applicationNumber.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  // Extract all documents from applications
  const allDocuments: Array<{ app: AdmissionApplication; doc: ApplicationDocument }> = [];
  for (const app of applications) {
    if (app.documents && app.documents.length > 0) {
      for (const doc of app.documents) {
        allDocuments.push({ app, doc });
      }
    }
  }

  return (
    <div className="py-8 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="glass-card-green p-6 sm:p-8 mb-8 shadow-sm border border-emerald-500/20 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#4f8c4c] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-2 tracking-wider shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>ZEALOSH ADMISSIONS & COMMERCE COMMAND CENTER</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              14-Stage Admissions Pipeline & Entitlement Provisioning
            </h1>
            <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
              Decoupled commerce products, server-authoritative entitlements, strict 14-stage state transitions, applicant document audit review, and 10-step resumable student provisioning.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors border border-white/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 bg-white text-gray-800 hover:bg-gray-100 text-xs font-bold px-3 py-2 rounded-xl shadow-xs"
            >
              <span>Back to Admin Console</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Top Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="card-elevated p-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Leads Inquiry</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{leads.length}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Public inquiries</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Pipeline Apps</div>
          <div className="text-2xl font-black text-[#3a7536] mt-1">{applications.length}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">In 14-stage matrix</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Under Review</div>
          <div className="text-2xl font-black text-amber-600 mt-1">
            {(stageCounts['DOCUMENT_REVIEW'] || 0) + (stageCounts['ELIGIBILITY_REVIEW'] || 0)}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Docs & Eligibility</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Admitted</div>
          <div className="text-2xl font-black text-[#4f8c4c] mt-1">
            {stageCounts['ADMITTED'] || 0}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">Fully enrolled</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Offerings</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{offerings.length}</div>
          <div className="text-[10px] text-gray-400 mt-0.5">Sellable packages</div>
        </div>

        <div className="card-elevated p-4">
          <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Provisioning</div>
          <div className="text-2xl font-black text-slate-900 mt-1">
            {provisioningJobs.filter((j) => j.status === 'SUCCEEDED').length} / {provisioningJobs.length}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5">10-step sagas</div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#eaedf5] mb-6 gap-2 overflow-x-auto pb-1">
        {[
          { id: 'pipeline', label: '14-Stage Kanban Pipeline', count: applications.length },
          { id: 'documents', label: 'Document Review Queue', count: allDocuments.length },
          { id: 'provisioning', label: '10-Step Provisioning Sagas', count: provisioningJobs.length },
          { id: 'offerings', label: 'Product Offerings & Entitlements', count: offerings.length },
          { id: 'leads', label: 'Admissions CRM Leads', count: leads.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-[#4f8c4c] text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* TAB 1: 14-STAGE KANBAN PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          {/* Controls: Search and Filter */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-[#eaedf5]">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search applicant name, email, APP#..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
              />
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select
                value={selectedCourseFilter}
                onChange={(e) => setSelectedCourseFilter(e.target.value)}
                className="text-xs border px-3 py-2 rounded-lg bg-white focus:outline-hidden focus:border-[#4f8c4c]"
              >
                <option value="">All Courses</option>
                <option value="crs-asp-001">ASP Exam Prep</option>
                <option value="crs-csp-002">CSP Exam Prep</option>
                <option value="crs-crsp-003">CRSP Exam Prep</option>
              </select>
            </div>
          </div>

          {/* Horizontal Scrollable 14-Stage Kanban Columns */}
          <div className="flex gap-4 overflow-x-auto pb-6">
            {stages.map((stage) => {
              const stageApps = filteredApplications.filter(
                (a) => (a.pipelineStage || a.status) === stage
              );

              return (
                <div
                  key={stage}
                  className="w-72 shrink-0 bg-slate-50/70 border border-[#eaedf5] rounded-xl flex flex-col max-h-[750px]"
                >
                  {/* Column Header */}
                  <div className="p-3 border-b border-[#eaedf5] bg-white rounded-t-xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-xs text-slate-800">
                        {stage.replace(/_/g, ' ')}
                      </h4>
                      <span className="text-[10px] text-gray-500">
                        {stageApps.length} applicants
                      </span>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-[#4f8c4c]" />
                  </div>

                  {/* Cards List */}
                  <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                    {stageApps.length === 0 ? (
                      <div className="text-center py-6 text-[11px] text-gray-400">
                        No applications
                      </div>
                    ) : (
                      stageApps.map((app) => (
                        <div
                          key={app.id}
                          className="bg-white p-3 rounded-lg border border-[#eaedf5] hover:border-gray-300 shadow-2xs transition-all text-xs"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-mono text-gray-500 font-bold">
                              {app.applicationNumber}
                            </span>
                            <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-semibold">
                              {app.courseId.replace('crs-', '').toUpperCase()}
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 leading-snug mb-0.5">
                            {app.applicantName}
                          </div>
                          <div className="text-[11px] text-gray-500 truncate mb-2">
                            {app.applicantEmail}
                          </div>

                          {app.documents && app.documents.length > 0 && (
                            <div className="text-[10px] text-gray-600 bg-gray-50 px-2 py-1 rounded mb-2 flex items-center gap-1.5">
                              <FileText className="w-3 h-3 text-[#4f8c4c]" />
                              <span>{app.documents.length} documents attached</span>
                            </div>
                          )}

                          {/* Quick Stage Transitions */}
                          <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
                            <div className="text-[10px] text-gray-400 font-semibold">Actions</div>

                            <div className="flex items-center gap-1">
                              {stage === 'NEW' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'CONTACTED')}
                                  className="text-[10px] bg-[#f1f8f0] text-[#3a7536] hover:bg-[#e1f0df] px-2 py-0.5 rounded font-bold"
                                >
                                  Contact
                                </button>
                              )}

                              {stage === 'CONTACTED' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'APPLICATION_STARTED')}
                                  className="text-[10px] bg-[#f1f8f0] text-[#3a7536] hover:bg-[#e1f0df] px-2 py-0.5 rounded font-bold"
                                >
                                  Start Form
                                </button>
                              )}

                              {stage === 'SUBMITTED' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'DOCUMENT_REVIEW')}
                                  className="text-[10px] bg-[#f1f8f0] text-[#3a7536] hover:bg-[#e1f0df] px-2 py-0.5 rounded font-bold"
                                >
                                  Review Docs
                                </button>
                              )}

                              {stage === 'DOCUMENT_REVIEW' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'ELIGIBILITY_REVIEW')}
                                  className="text-[10px] bg-[#f1f8f0] text-[#3a7536] hover:bg-[#e1f0df] px-2 py-0.5 rounded font-bold"
                                >
                                  Eligibility
                                </button>
                              )}

                              {stage === 'ELIGIBILITY_REVIEW' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'APPROVED')}
                                  className="text-[10px] bg-[#4f8c4c] text-white hover:bg-[#3a7536] px-2 py-0.5 rounded font-bold"
                                >
                                  Approve
                                </button>
                              )}

                              {stage === 'APPROVED' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'OFFER_PAYMENT_PENDING')}
                                  className="text-[10px] bg-amber-500 text-white hover:bg-amber-600 px-2 py-0.5 rounded font-bold"
                                >
                                  Issue Offer
                                </button>
                              )}

                              {stage === 'OFFER_PAYMENT_PENDING' && (
                                <button
                                  onClick={() => handleStageTransition(app.id, 'ADMITTED')}
                                  className="text-[10px] bg-[#4f8c4c] text-white hover:bg-[#3a7536] px-2 py-0.5 rounded font-bold"
                                >
                                  Admit
                                </button>
                              )}

                              {/* Manual Override Button */}
                              <button
                                onClick={() => {
                                  setOverrideApp(app);
                                  setOverrideReason('');
                                  setOverrideError('');
                                }}
                                title="Controlled Administrative Override"
                                className="text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-semibold"
                              >
                                Override
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: DOCUMENT REVIEW QUEUE */}
      {activeTab === 'documents' && (
        <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Applicant Credentials & Verification Queue
              </h3>
              <p className="text-xs text-gray-500">
                Staff document review workspace with version history and verified audit stamps.
              </p>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {allDocuments.length} total applicant documents
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-[#eaedf5] text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Application #</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">Filename & Version</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {allDocuments.map(({ app, doc }) => (
                  <tr key={doc.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{app.applicantName}</div>
                      <div className="text-[11px] text-gray-500">{app.applicantEmail}</div>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold">{app.applicationNumber}</td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {doc.documentType.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{doc.filename}</div>
                      <div className="text-[10px] text-gray-400">Version {doc.version || 1}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          doc.status === 'VERIFIED'
                            ? 'bg-green-100 text-green-700'
                            : doc.status === 'REJECTED'
                            ? 'bg-red-100 text-red-700'
                            : doc.status === 'RESUBMISSION_REQUESTED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {doc.status || 'UPLOADED'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        {doc.status !== 'VERIFIED' && (
                          <button
                            onClick={() => handleVerifyDocument(app.id, doc.id)}
                            className="bg-[#4f8c4c] text-white hover:bg-[#3a7536] px-2.5 py-1 rounded text-[11px] font-bold"
                          >
                            Verify
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setRejectDocTarget(doc);
                            setRejectionReason('');
                          }}
                          className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded text-[11px] font-semibold"
                        >
                          Reject / Resubmit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: 10-STEP PROVISIONING SAGAS */}
      {activeTab === 'provisioning' && (
        <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                10-Step Resumable Student Provisioning Orchestrator
              </h3>
              <p className="text-xs text-gray-500">
                Monitors transactional sagas across GoTrue auth, profile sync, enrollment, batch capacity, entitlements, and classroom provisioning.
              </p>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {provisioningJobs.length} active jobs
            </span>
          </div>

          <div className="space-y-4">
            {provisioningJobs.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs">
                No provisioning jobs executed yet. Sagas trigger automatically on admission payment completion.
              </div>
            ) : (
              provisioningJobs.map((job) => (
                <div
                  key={job.id}
                  className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/50 hover:border-gray-300 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900">{job.id}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            job.status === 'SUCCEEDED'
                              ? 'bg-green-100 text-green-700'
                              : job.status === 'RETRYABLE_FAILED' || job.status === 'TERMINAL_FAILED'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {job.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        Course: {job.courseId} • User: {job.userId} • Attempt: {job.attemptCount}/{job.maxAttempts}
                      </div>
                    </div>

                    {job.status !== 'SUCCEEDED' && (
                      <button
                        onClick={() => handleRetryJob(job.id)}
                        disabled={retryingJobId === job.id}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <RotateCcw className={`w-3.5 h-3.5 ${retryingJobId === job.id ? 'animate-spin' : ''}`} />
                        <span>Retry From Failed Step</span>
                      </button>
                    )}
                  </div>

                  {job.lastError && (
                    <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{job.lastError}</span>
                    </div>
                  )}

                  {/* 10 Step Progress Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[10px] font-semibold">
                    {[
                      'RESOLVE_IDENTITY',
                      'SYNC_PROFILE',
                      'ASSIGN_ROLE',
                      'PERSIST_ADMISSION',
                      'CREATE_ENROLLMENT',
                      'ALLOCATE_BATCH_SEAT',
                      'GRANT_ENTITLEMENTS',
                      'PROVISION_CLASSROOM',
                      'ACTIVATE_MATERIALS',
                      'QUEUE_ONBOARDING_NOTIFICATION',
                    ].map((stepName, i) => {
                      const stepRecord = (job as any).steps?.find((s: any) => s.stepName === stepName);
                      const isComplete = stepRecord?.status === 'SUCCEEDED';
                      const isFailed = stepRecord?.status === 'FAILED';
                      const isProcessing = stepRecord?.status === 'PROCESSING';

                      return (
                        <div
                          key={stepName}
                          className={`p-2 rounded-lg border flex items-center gap-1.5 ${
                            isComplete
                              ? 'bg-green-50/80 border-green-200 text-green-800'
                              : isFailed
                              ? 'bg-red-50 border-red-200 text-red-700'
                              : isProcessing
                              ? 'bg-blue-50 border-blue-200 text-blue-700 animate-pulse'
                              : 'bg-white border-gray-200 text-gray-500'
                          }`}
                        >
                          <span className="w-4 h-4 rounded-full bg-black/10 flex items-center justify-center text-[9px] font-bold shrink-0">
                            {i + 1}
                          </span>
                          <span className="truncate">{stepName.replace(/_/g, ' ')}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 4: PRODUCT OFFERINGS & ENTITLEMENTS */}
      {activeTab === 'offerings' && (
        <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Decoupled Commercial Product Offerings
              </h3>
              <p className="text-xs text-gray-500">
                Commercial packages mapped to academic courses with server-authoritative feature entitlements.
              </p>
            </div>
            <span className="text-xs text-gray-500 font-mono">
              {offerings.length} published packages
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {offerings.map((off) => (
              <div
                key={off.id}
                className="p-5 rounded-xl border border-[#eaedf5] hover:border-gray-300 transition-all bg-gray-50/30 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-[#f1f8f0] text-[#3a7536] px-2 py-0.5 rounded">
                      {off.offeringType}
                    </span>
                    <span className="text-[11px] text-gray-500 font-mono">
                      {off.validityDays}d validity
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 mb-1">{off.title}</h4>
                  <div className="text-lg font-black text-slate-900 mb-3">
                    ₹{off.priceInr.toLocaleString()}
                    {off.priceUsd && (
                      <span className="text-xs font-normal text-gray-500 ml-1.5">
                        (${off.priceUsd} USD)
                      </span>
                    )}
                  </div>

                  <div className="mb-3">
                    <div className="text-[10px] font-bold uppercase text-gray-400 mb-1">
                      Included Entitlements
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {off.includedEntitlements?.map((ent) => (
                        <span
                          key={ent}
                          className="bg-slate-200/80 text-slate-800 text-[10px] font-semibold px-2 py-0.5 rounded"
                        >
                          {ent}
                        </span>
                      ))}
                    </div>
                  </div>

                  <ul className="text-xs text-gray-600 space-y-1.5 mb-4">
                    {off.featuresList?.map((feat, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4f8c4c] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span>Offering ID: {off.id}</span>
                  <span className="text-[#3a7536] font-bold">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 5: LEADS CRM */}
      {activeTab === 'leads' && (
        <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-base text-slate-900">
                Admissions CRM Leads & Inquiries
              </h3>
              <p className="text-xs text-gray-500">
                Public website course inquiries ready for counselor outreach and application conversion.
              </p>
            </div>
            <span className="text-xs text-gray-500 font-mono">{leads.length} leads</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 border-b border-[#eaedf5] text-gray-600 font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Course Interest</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-gray-50/60">
                    <td className="py-3 px-4 font-bold text-slate-900">{l.fullName}</td>
                    <td className="py-3 px-4">
                      <div>{l.email}</div>
                      {l.phone && <div className="text-[11px] text-gray-400">{l.phone}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {l.courseInterest || 'General'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium">{l.source}</td>
                    <td className="py-3 px-4">
                      <span className="bg-[#f1f8f0] text-[#3a7536] font-bold px-2 py-0.5 rounded text-[10px]">
                        {l.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-500 max-w-xs truncate">{l.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Controlled Manual Administrative Override Modal */}
      {overrideApp && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative border border-[#eaedf5]">
            <div className="flex items-center gap-2 mb-2 text-amber-600 font-bold">
              <AlertTriangle className="w-5 h-5" />
              <h3>Controlled Administrative Admission Override</h3>
            </div>
            <p className="text-xs text-gray-600 mb-4">
              You are manually forcing a stage transition for{' '}
              <strong className="text-slate-900">{overrideApp.applicantName}</strong> (
              <span className="font-mono">{overrideApp.applicationNumber}</span>). This action will bypass standard matrix checks and is logged with your immutable administrator signature.
            </p>

            {overrideError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {overrideError}
              </div>
            )}

            <form onSubmit={handleExecuteOverride} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Target Stage</label>
                <select
                  value={overrideTargetStage}
                  onChange={(e) => setOverrideTargetStage(e.target.value as any)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                >
                  {stages.map((s) => (
                    <option key={s} value={s}>
                      {s.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1">
                  Mandatory Audit Reason (At least 10 characters) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Approved by Director of Admissions following physical document verification..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setOverrideApp(null)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingOverride}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors"
                >
                  {submittingOverride ? 'Executing Override...' : 'Confirm Administrative Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject / Resubmission Document Modal */}
      {rejectDocTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative border border-[#eaedf5]">
            <h3 className="font-bold text-base text-slate-900 mb-2">
              Reject or Request Document Resubmission
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              Document: <span className="font-semibold text-slate-900">{rejectDocTarget.filename}</span>
            </p>

            <form onSubmit={handleRejectDocument} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-gray-700 mb-1">Reason for Rejection *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Scanned copy is illegible. Please upload a clear color PDF scan of the original certificate."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-hidden focus:border-[#4f8c4c]"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="resub"
                  checked={requestResubmission}
                  onChange={(e) => setRequestResubmission(e.target.checked)}
                  className="rounded text-[#4f8c4c]"
                />
                <label htmlFor="resub" className="text-gray-700 font-medium">
                  Allow applicant to upload a replacement version (Version {((rejectDocTarget.version || 1) + 1)})
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectDocTarget(null)}
                  className="btn-secondary py-2 px-4 text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-5 rounded-xl text-xs transition-colors"
                >
                  Submit Decision
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

