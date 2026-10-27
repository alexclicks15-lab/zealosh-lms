'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ShieldCheck, 
  Settings, 
  Palette, 
  Navigation, 
  ToggleLeft, 
  Key, 
  BookOpen, 
  Calendar, 
  Award, 
  FileBadge, 
  GitFork, 
  Mail, 
  Activity, 
  History, 
  BarChart3, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Download, 
  RefreshCw, 
  Search, 
  Clock, 
  Users,
  Eye,
  Check,
  ChevronRight,
  Flame,
  Globe,
  Sliders,
  DollarSign,
  FileText,
  Video,
  Lock,
  Unlock,
  Play
} from 'lucide-react';
import { 
  PlatformSettings, 
  BrandingTheme, 
  NavigationItem, 
  FeatureFlags, 
  RoleDefinition, 
  PermissionDefinition, 
  Course, 
  Batch, 
  ExamBlueprint, 
  ExamQuestion, 
  CertificateRecord, 
  WorkflowDefinition, 
  NotificationTemplate, 
  IntegrationServiceConfig, 
  AuditLogEntry, 
  ConfigAuditEntry,
  ClassRecording,
  RecordingBatchAccess
} from '@/types';
import { useTheme } from '@/components/ThemeProvider';

export default function SuperadminControlCenter() {
  const { updateTheme: setLiveTheme } = useTheme();

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'settings' | 'branding' | 'navigation' | 'features' | 'users' | 'enrollments' | 'assignments' | 'roles' | 
    'courses' | 'batches' | 'recordings' | 'exams' | 'certificates' | 'workflows' | 'templates' | 
    'integrations' | 'audits' | 'reports'
  >('overview');

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Configuration State
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [branding, setBranding] = useState<BrandingTheme | null>(null);
  const [navItems, setNavItems] = useState<NavigationItem[]>([]);
  const [features, setFeatures] = useState<FeatureFlags | null>(null);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [blueprints, setBlueprints] = useState<ExamBlueprint[]>([]);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowDefinition[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [integrations, setIntegrations] = useState<IntegrationServiceConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [configAudits, setConfigAudits] = useState<ConfigAuditEntry[]>([]);
  const [metrics, setMetrics] = useState<any>(null);

  // Core LMS Enterprise Collections
  const [usersList, setUsersList] = useState<any[]>([]);
  const [enrollmentsList, setEnrollmentsList] = useState<any[]>([]);
  const [assignmentsList, setAssignmentsList] = useState<any[]>([]);

  // Class Recordings Governance State
  const [recordingsList, setRecordingsList] = useState<ClassRecording[]>([]);
  const [grantsList, setGrantsList] = useState<RecordingBatchAccess[]>([]);
  const [recordingSearch, setRecordingSearch] = useState('');
  const [recordingStatusFilter, setRecordingStatusFilter] = useState<'ALL' | 'AVAILABLE' | 'ARCHIVED' | 'REVOKED'>('ALL');
  const [grantModalOpen, setGrantModalOpen] = useState(false);
  const [selectedRecForGrant, setSelectedRecForGrant] = useState<ClassRecording | null>(null);
  const [grantTargetBatchId, setGrantTargetBatchId] = useState('');
  const [grantAllowDownload, setGrantAllowDownload] = useState(false);
  const [grantExpiresAt, setGrantExpiresAt] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [submittingGrant, setSubmittingGrant] = useState(false);

  // Compliance Reporting State
  const [selectedReportDataset, setSelectedReportDataset] = useState<'enrollments' | 'exams' | 'certificates' | 'revenue'>('enrollments');
  const [reportData, setReportData] = useState<any[]>([]);
  const [loadingReport, setLoadingReport] = useState(false);

  // Search/Filter states
  const [courseSearch, setCourseSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [testingService, setTestingService] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);

  // Modals / Editors
  const [newRoleModal, setNewRoleModal] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDesc, setNewRoleDesc] = useState('');
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([]);

  const [newUserModal, setNewUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<string>('STUDENT');

  const [newAssignmentModal, setNewAssignmentModal] = useState(false);
  const [newAsgTitle, setNewAsgTitle] = useState('');
  const [newAsgCourseId, setNewAsgCourseId] = useState('crs-asp-01');
  const [newAsgDueDate, setNewAsgDueDate] = useState('');
  const [newAsgMaxScore, setNewAsgMaxScore] = useState(100);
  const [newAsgDesc, setNewAsgDesc] = useState('');

  // Fetch complete configuration
  const loadConfiguration = async () => {
    try {
      setLoading(true);
      const [configRes, usersRes, enrollmentsRes, assignmentsRes, recordingsRes, grantsRes] = await Promise.all([
        fetch('/api/admin/config'),
        fetch('/api/admin/users'),
        fetch('/api/admin/enrollments'),
        fetch('/api/assignments'),
        fetch('/api/recordings?userRole=ADMIN'),
        fetch('/api/admin/recordings/access'),
      ]);

      if (configRes.ok) {
        const json = await configRes.json();
        const d = json.data;
        setSettings(d.platformSettings);
        setBranding(d.brandingTheme);
        setNavItems(d.navigationConfig);
        setFeatures(d.featureFlags);
        setRoles(d.roles);
        setPermissions(d.permissions);
        setCourses(d.courses);
        setBatches(d.batches);
        setBlueprints(d.blueprints);
        setQuestions(d.questions);
        setCertificates(d.certificates);
        setWorkflows(d.workflows);
        setTemplates(d.templates);
        setIntegrations(d.integrations);
        setAuditLogs(d.auditLogs);
        setConfigAudits(d.configAudits);
        setMetrics(d.metrics);
      }

      if (usersRes.ok) {
        const uJson = await usersRes.json();
        if (uJson.users) setUsersList(uJson.users);
      }

      if (enrollmentsRes.ok) {
        const eJson = await enrollmentsRes.json();
        if (eJson.enrollments) setEnrollmentsList(eJson.enrollments);
      }

      if (assignmentsRes.ok) {
        const aJson = await assignmentsRes.json();
        if (aJson.assignments) setAssignmentsList(aJson.assignments);
      }

      if (recordingsRes.ok) {
        const rJson = await recordingsRes.json();
        if (rJson.recordings) setRecordingsList(rJson.recordings);
      }

      if (grantsRes.ok) {
        const gJson = await grantsRes.json();
        if (gJson.grants) setGrantsList(gJson.grants);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', message: 'Failed to load configuration: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfiguration();
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  // 1. Save Platform Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch('/api/admin/config/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings, reason: 'Superadmin saved platform general settings' }),
      });
      if (res.ok) {
        showNotification('General platform settings updated and persisted successfully.');
        loadConfiguration();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to save settings', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 2. Save Branding Theme
  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branding) return;
    try {
      const res = await fetch('/api/admin/config/branding', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: branding, reason: 'Superadmin saved branding design tokens' }),
      });
      if (res.ok) {
        setLiveTheme(branding);
        showNotification('Visual design tokens & branding updated across entire platform.');
        loadConfiguration();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to save branding', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // Reset to official Zealosh brand
  const handleResetBrand = async () => {
    if (!confirm('Are you sure you want to reset all branding tokens to official Zealosh brand standards?')) return;
    try {
      const res = await fetch('/api/admin/config/reset-brand', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBranding(data.theme);
        setLiveTheme(data.theme);
        showNotification('Branding theme restored to official Zealosh green palette.');
        loadConfiguration();
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 3. Save Feature Flags
  const handleToggleFeature = async (key: keyof FeatureFlags) => {
    if (!features) return;
    const updated = { ...features, [key]: !features[key] };
    setFeatures(updated);
    try {
      const res = await fetch('/api/admin/config/features', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flags: updated, reason: `Toggled feature flag: ${String(key)}` }),
      });
      if (res.ok) {
        showNotification(`Module "${String(key)}" ${updated[key] ? 'ENABLED' : 'DISABLED'}`);
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 4. Test Integration Connection
  const handleTestIntegration = async (serviceName: string) => {
    setTestingService(serviceName);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceName }),
      });
      const data = await res.json();
      setTestResult({ serviceName, ...data.result });
      loadConfiguration();
    } catch (e: any) {
      setTestResult({ serviceName, success: false, message: e.message });
    } finally {
      setTestingService(null);
    }
  };

  // 5. Rollback Version
  const handleRollback = async (auditId: string) => {
    if (!confirm('Are you sure you want to rollback this configuration change?')) return;
    try {
      const res = await fetch('/api/admin/config/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ auditId }),
      });
      if (res.ok) {
        showNotification('Configuration successfully rolled back to selected version.');
        loadConfiguration();
      } else {
        const data = await res.json();
        showNotification(data.error || 'Rollback failed', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 6. Create Custom Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoleName) return;
    try {
      const res = await fetch('/api/admin/config/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: {
            name: newRoleName,
            description: newRoleDesc,
            permissions: newRolePermissions,
            isSystem: false,
          },
        }),
      });
      if (res.ok) {
        showNotification(`Role "${newRoleName}" created successfully.`);
        setNewRoleModal(false);
        setNewRoleName('');
        setNewRoleDesc('');
        setNewRolePermissions([]);
        loadConfiguration();
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 7. Delete Custom Role
  const handleDeleteRole = async (roleId: string) => {
    if (!confirm('Delete this custom role? Users assigned will lose these role privileges.')) return;
    try {
      const res = await fetch('/api/admin/config/roles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      if (res.ok) {
        showNotification('Custom role deleted.');
        loadConfiguration();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to delete role', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 8. Revoke Certificate
  const handleRevokeCertificate = async (code: string) => {
    const reason = prompt('Specify official reason for certificate revocation:');
    if (!reason) return;
    try {
      const res = await fetch('/api/admin/certificates/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, reason }),
      });
      if (res.ok) {
        showNotification(`Certificate ${code} revoked.`);
        loadConfiguration();
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // 9. Compliance Reports & Analytics
  const loadReportPreview = async (dataset: 'enrollments' | 'exams' | 'certificates' | 'revenue') => {
    setLoadingReport(true);
    setSelectedReportDataset(dataset);
    try {
      const res = await fetch(`/api/admin/reports?dataset=${dataset}&format=json`);
      if (res.ok) {
        const json = await res.json();
        setReportData(json.data || []);
      }
    } catch (e: any) {
      showNotification('Failed to load report: ' + e.message, 'error');
    } finally {
      setLoadingReport(false);
    }
  };

  const handleDownloadReportCSV = () => {
    const url = `/api/admin/reports?dataset=${selectedReportDataset}&format=csv`;
    const link = document.createElement('a');
    link.href = url;
    link.download = `zealosh_${selectedReportDataset}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Downloading ${selectedReportDataset} compliance CSV report.`);
  };

  const handleDownloadReportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(reportData, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `zealosh_${selectedReportDataset}_report_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showNotification(`Downloading ${selectedReportDataset} JSON dataset.`);
  };

  // User Management Handlers
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: {
            name: newUserName,
            email: newUserEmail,
            role: newUserRole,
          },
        }),
      });
      if (res.ok) {
        showNotification(`User account created successfully.`);
        setNewUserModal(false);
        setNewUserName('');
        setNewUserEmail('');
        loadConfiguration();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to create user', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    const targetUser = usersList.find((u) => u.id === userId);
    if (!targetUser) return;
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user: { ...targetUser, role: newRole },
        }),
      });
      if (res.ok) {
        showNotification(`User role updated to ${newRole}.`);
        loadConfiguration();
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // Enrollment Status Handler
  const handleUpdateEnrollmentStatus = async (enrollmentId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enrollmentId, status }),
      });
      if (res.ok) {
        showNotification(`Enrollment status set to ${status}.`);
        loadConfiguration();
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // Assignment Handler
  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsgTitle || !newAsgCourseId) return;
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment: {
            title: newAsgTitle,
            courseId: newAsgCourseId,
            description: newAsgDesc,
            dueDate: newAsgDueDate || new Date(Date.now() + 30 * 86400000).toISOString(),
            maxScore: Number(newAsgMaxScore),
            status: 'PUBLISHED',
          },
        }),
      });
      if (res.ok) {
        showNotification('Coursework assignment created successfully.');
        setNewAssignmentModal(false);
        setNewAsgTitle('');
        setNewAsgDesc('');
        loadConfiguration();
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to create assignment', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  // Recordings Governance Handlers
  const handleToggleDownload = async (rec: ClassRecording) => {
    try {
      const nextVal = !rec.isDownloadable;
      const res = await fetch(`/api/recordings/${rec.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDownloadable: nextVal, allowDownload: nextVal }),
      });
      if (res.ok) {
        setRecordingsList((prev) =>
          prev.map((r) => (r.id === rec.id ? { ...r, isDownloadable: nextVal, allowDownload: nextVal } : r))
        );
        showNotification(
          `Download policy for "${rec.title}" set to ${nextVal ? 'DOWNLOAD PERMITTED' : 'STREAMING ONLY'}.`
        );
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to update download policy', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const handleUpdateRecordingStatus = async (recId: string, status: string) => {
    try {
      const res = await fetch(`/api/recordings/${recId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setRecordingsList((prev) =>
          prev.map((r) => (r.id === recId ? { ...r, status: status as any } : r))
        );
        showNotification(`Recording status updated to ${status}.`);
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to update status', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const handleOpenGrantModal = (rec: ClassRecording) => {
    setSelectedRecForGrant(rec);
    const otherBatches = batches.filter((b) => b.id !== rec.batchId);
    setGrantTargetBatchId(otherBatches.length > 0 ? otherBatches[0].id : (batches[0]?.id || ''));
    setGrantAllowDownload(false);
    setGrantExpiresAt('');
    setGrantReason('');
    setGrantModalOpen(true);
  };

  const handleSubmitGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecForGrant || !grantTargetBatchId) return;
    setSubmittingGrant(true);
    try {
      const res = await fetch('/api/admin/recordings/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordingId: selectedRecForGrant.id,
          sourceBatchId: selectedRecForGrant.batchId,
          targetBatchId: grantTargetBatchId,
          allowDownload: grantAllowDownload,
          expiresAt: grantExpiresAt || undefined,
          reason: grantReason || 'Superadmin granted cohort access',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setGrantsList((prev) => [...prev.filter((g) => g.id !== data.grant.id), data.grant]);
        showNotification(`Cross-cohort access granted for "${selectedRecForGrant.title}".`);
        setGrantModalOpen(false);
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to grant access', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    } finally {
      setSubmittingGrant(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    if (!confirm('Are you sure you want to revoke this batch access grant? Learners in the target cohort will immediately lose access.')) return;
    try {
      const res = await fetch('/api/admin/recordings/access', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grantId }),
      });
      if (res.ok) {
        setGrantsList((prev) =>
          prev.map((g) => (g.id === grantId ? { ...g, status: 'REVOKED' } : g))
        );
        showNotification('Batch access grant revoked successfully.');
      } else {
        const err = await res.json();
        showNotification(err.error || 'Failed to revoke grant', 'error');
      }
    } catch (e: any) {
      showNotification(e.message, 'error');
    }
  };

  const navTabs = [
    { id: 'overview', label: 'Platform Telemetry', icon: Activity },
    { id: 'settings', label: 'General Settings', icon: Settings },
    { id: 'branding', label: 'Branding & Themes', icon: Palette },
    { id: 'features', label: 'Feature Governance', icon: ToggleLeft },
    { id: 'users', label: 'Users & Roles', icon: Users },
    { id: 'enrollments', label: 'Student Enrollments', icon: CheckCircle2 },
    { id: 'assignments', label: 'Coursework & Rubrics', icon: FileText },
    { id: 'roles', label: 'Custom Permissions', icon: Key },
    { id: 'courses', label: 'Courses & Curriculum', icon: BookOpen },
    { id: 'batches', label: 'Cohorts & Batches', icon: Calendar },
    { id: 'recordings', label: 'Class Recordings & Access', icon: Video },
    { id: 'exams', label: 'Exam Engine & Bank', icon: Award },
    { id: 'certificates', label: 'Certificates Registry', icon: FileBadge },
    { id: 'workflows', label: 'Workflow Automations', icon: GitFork },
    { id: 'templates', label: 'Notification Templates', icon: Mail },
    { id: 'integrations', label: 'Integration Health', icon: Sliders },
    { id: 'audits', label: 'Audit & Rollback', icon: History },
    { id: 'reports', label: 'Reports & Export', icon: BarChart3 },
  ];

  return (
    <div className="py-8 px-4 sm:px-8 max-w-7xl mx-auto w-full">
      {/* Top Banner */}
      <div className="bg-[#252c41] text-white rounded-2xl p-6 sm:p-8 mb-8 shadow-xl border border-white/10 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-[#4f8c4c]/20 to-transparent pointer-events-none" />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#4f8c4c] text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full mb-2 tracking-wider">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SUPERADMIN CENTRAL GOVERNANCE CONSOLE</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Zealosh Operations & Configuration Center
            </h1>
            <p className="text-xs text-gray-300 mt-1 max-w-2xl">
              Authoritative platform governance without source-code edits. Configure business parameters, branding tokens, course catalogs, examination blueprints, and integration adapters in real-time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={loadConfiguration}
              className="inline-flex items-center gap-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors border border-white/10"
              title="Refresh State from Authoritative Store"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/"
              className="inline-flex items-center gap-1.5 bg-[#4f8c4c] hover:bg-[#3a7536] text-white text-xs font-bold px-4 py-2 rounded-xl transition-colors shadow-sm"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View Learner Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {feedback && (
        <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 mb-6 shadow-sm border ${
          feedback.type === 'success' 
            ? 'bg-[#e1f0df] text-[#3a7536] border-[#4f8c4c]/30' 
            : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Tabbed Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Navigation Sidebar */}
        <aside className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-[#eaedf5] p-2 shadow-xs sticky top-20">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-3 py-2">
              Control Modules
            </div>
            <nav className="space-y-1">
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-[#4f8c4c] text-white font-bold shadow-xs'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-[#252c41]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                      <span>{tab.label}</span>
                    </div>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Tab Content Area */}
        <main className="lg:col-span-4 min-h-[600px]">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card-elevated p-4">
                  <div className="text-xs text-gray-500 font-bold uppercase">Active Students</div>
                  <div className="text-2xl font-black text-[#252c41] mt-1">{metrics?.activeStudents || '1,250+'}</div>
                  <div className="text-[10px] text-[#4f8c4c] mt-1 font-semibold">Registered Candidates</div>
                </div>

                <div className="card-elevated p-4">
                  <div className="text-xs text-gray-500 font-bold uppercase">Published Courses</div>
                  <div className="text-2xl font-black text-[#252c41] mt-1">{courses.length}</div>
                  <div className="text-[10px] text-gray-500 mt-1 font-semibold">ASP, CSP, CRSP, CIT</div>
                </div>

                <div className="card-elevated p-4">
                  <div className="text-xs text-gray-500 font-bold uppercase">Exam Pass Rate</div>
                  <div className="text-2xl font-black text-[#3a7536] mt-1">{metrics?.passRate || 100}%</div>
                  <div className="text-[10px] text-gray-500 mt-1 font-semibold">Diagnostic Simulations</div>
                </div>

                <div className="card-elevated p-4">
                  <div className="text-xs text-gray-500 font-bold uppercase">Estimated Revenue</div>
                  <div className="text-2xl font-black text-[#4f8c4c] mt-1">₹{(metrics?.estimatedRevenue || 140000).toLocaleString()}</div>
                  <div className="text-[10px] text-gray-500 mt-1 font-semibold">Verified Enrollments</div>
                </div>
              </div>

              {/* Integration Telemetry Quick Cards */}
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-[#252c41] flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#4f8c4c]" />
                    <span>Real-Time Integration Telemetry</span>
                  </h2>
                  <button
                    onClick={() => setActiveTab('integrations')}
                    className="text-xs text-[#4f8c4c] font-bold hover:underline"
                  >
                    View Diagnostics &rarr;
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {integrations.slice(0, 3).map((item) => (
                    <div key={item.name} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-xs text-[#252c41]">{item.name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          item.status === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{item.endpointUrl}</p>
                      <div className="mt-2 text-[10px] text-gray-400 font-mono">
                        Mode: {item.isMockMode ? 'Resilient Mock Adapter' : 'Live Remote Endpoint'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Security & Operational Audit Log */}
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-bold text-[#252c41] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#4f8c4c]" />
                    <span>Authoritative Security & Operational Audit Trail</span>
                  </h2>
                  <span className="text-xs text-gray-500 font-mono">{auditLogs.length} immutable entries</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Role</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Entity</th>
                        <th className="py-2.5 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaedf5]">
                      {auditLogs.slice(0, 8).map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 text-gray-500 font-mono whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#252c41]">{log.actorEmail}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] bg-[#eaedf5] text-[#252c41] font-bold px-2 py-0.5 rounded">
                              {log.actorRole}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-[#3a7536]">{log.action}</td>
                          <td className="py-2.5 px-3 text-gray-600">{log.entityType}</td>
                          <td className="py-2.5 px-3 text-gray-500 font-mono text-[11px] max-w-xs truncate">
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL SETTINGS */}
          {activeTab === 'settings' && settings && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#eaedf5] pb-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">General Platform Configuration</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Control global branding identity, operational defaults, contact routes, and security limits.</p>
                </div>
                <button
                  onClick={handleSaveSettings}
                  className="btn-primary text-xs"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Configuration</span>
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Platform Display Name</label>
                    <input
                      type="text"
                      value={settings.platformName}
                      onChange={(e) => setSettings({ ...settings, platformName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Organization Legal Name</label>
                    <input
                      type="text"
                      value={settings.organizationName}
                      onChange={(e) => setSettings({ ...settings, organizationName: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Support Email</label>
                    <input
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Support Phone / WhatsApp</label>
                    <input
                      type="text"
                      value={settings.supportPhone}
                      onChange={(e) => setSettings({ ...settings, supportPhone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Default Timezone</label>
                    <select
                      value={settings.defaultTimezone}
                      onChange={(e) => setSettings({ ...settings, defaultTimezone: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                      <option value="America/Toronto">America/Toronto (EST -5:00)</option>
                      <option value="America/New_York">America/New_York (EST -5:00)</option>
                      <option value="UTC">UTC (Universal Coordinated Time)</option>
                      <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Default Platform Currency</label>
                    <select
                      value={settings.defaultCurrency}
                      onChange={(e) => setSettings({ ...settings, defaultCurrency: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                    >
                      <option value="INR">INR — Indian Rupee (₹)</option>
                      <option value="USD">USD — US Dollar ($)</option>
                      <option value="CAD">CAD — Canadian Dollar (C$)</option>
                      <option value="EUR">EUR — Euro (€)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Registration Policy</label>
                    <select
                      value={settings.registrationMode}
                      onChange={(e) => setSettings({ ...settings, registrationMode: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                    >
                      <option value="PUBLIC">Public Self-Registration (Open)</option>
                      <option value="INVITE_ONLY">Invitation / Cohort Link Only</option>
                      <option value="DISABLED">Disabled (Administrator Provisioned)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Session Timeout (Minutes)</label>
                    <input
                      type="number"
                      value={settings.sessionTimeoutMinutes}
                      onChange={(e) => setSettings({ ...settings, sessionTimeoutMinutes: parseInt(e.target.value) || 1440 })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs focus:ring-2 focus:ring-[#4f8c4c] outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-[#eaedf5] pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.maintenanceMode}
                      onChange={(e) => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                      className="w-4 h-4 text-[#4f8c4c] rounded focus:ring-[#4f8c4c]"
                    />
                    <div>
                      <span className="font-bold text-gray-800">Platform Maintenance Mode</span>
                      <p className="text-gray-500 text-[11px]">When activated, non-administrative learners see a maintenance notice.</p>
                    </div>
                  </label>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="btn-primary text-xs">
                    <Save className="w-4 h-4" />
                    <span>Save Platform Settings</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: BRANDING & THEMES */}
          {activeTab === 'branding' && branding && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#eaedf5] pb-4 mb-6 gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">Branding & Visual Design System</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Customise brand tokens, theme palettes, and UI styles. All changes dynamically apply across the application.</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleResetBrand}
                    className="btn-outline text-xs"
                    title="Restore official Zealosh color palette"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Brand</span>
                  </button>
                  <button
                    onClick={handleSaveBranding}
                    className="btn-primary text-xs"
                  >
                    <Save className="w-4 h-4" />
                    <span>Publish Brand Tokens</span>
                  </button>
                </div>
              </div>

              {/* Live Preview Strip */}
              <div className="p-4 rounded-xl border border-[#eaedf5] mb-6 bg-gray-50">
                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Live Theme Token Preview</div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: branding.primaryGreen }}>
                    <span>Primary Green ({branding.primaryGreen})</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: branding.deepGreen }}>
                    <span>Deep Green ({branding.deepGreen})</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: branding.accentGreen }}>
                    <span>Accent Green ({branding.accentGreen})</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ backgroundColor: branding.darkNeutral }}>
                    <span>Dark Neutral ({branding.darkNeutral})</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSaveBranding} className="space-y-6 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Primary Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.primaryGreen}
                        onChange={(e) => setBranding({ ...branding, primaryGreen: e.target.value })}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.primaryGreen}
                        onChange={(e) => setBranding({ ...branding, primaryGreen: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg p-2 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Deep Green (Hover/Active)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.deepGreen}
                        onChange={(e) => setBranding({ ...branding, deepGreen: e.target.value })}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.deepGreen}
                        onChange={(e) => setBranding({ ...branding, deepGreen: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg p-2 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Accent Green</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.accentGreen}
                        onChange={(e) => setBranding({ ...branding, accentGreen: e.target.value })}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.accentGreen}
                        onChange={(e) => setBranding({ ...branding, accentGreen: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg p-2 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Dark Neutral (Header/Cards)</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={branding.darkNeutral}
                        onChange={(e) => setBranding({ ...branding, darkNeutral: e.target.value })}
                        className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={branding.darkNeutral}
                        onChange={(e) => setBranding({ ...branding, darkNeutral: e.target.value })}
                        className="flex-1 border border-gray-300 rounded-lg p-2 font-mono text-xs uppercase"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-[#eaedf5] pt-4">
                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Font Family</label>
                    <select
                      value={branding.fontFamily}
                      onChange={(e) => setBranding({ ...branding, fontFamily: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                    >
                      <option value="Inter">Inter (Clean Enterprise Modern)</option>
                      <option value="Outfit">Outfit (Geometric & Expressive)</option>
                      <option value="System">System Native UI</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Border Radius Style</label>
                    <select
                      value={branding.borderRadius}
                      onChange={(e) => setBranding({ ...branding, borderRadius: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                    >
                      <option value="none">Sharp Edges (None)</option>
                      <option value="sm">Subtle (sm - 4px)</option>
                      <option value="md">Rounded (md - 8px)</option>
                      <option value="lg">Curved (lg - 12px)</option>
                      <option value="full">Pill / Circular (Full)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-700 mb-1">Layout Density</label>
                    <select
                      value={branding.layoutDensity}
                      onChange={(e) => setBranding({ ...branding, layoutDensity: e.target.value as any })}
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                    >
                      <option value="compact">Compact (High Information Density)</option>
                      <option value="comfortable">Comfortable (Balanced Enterprise)</option>
                      <option value="spacious">Spacious (Open Focus Reading)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button type="submit" className="btn-primary text-xs">
                    <Save className="w-4 h-4" />
                    <span>Apply Theme Tokens</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: FEATURE GOVERNANCE */}
          {activeTab === 'features' && features && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Modular Feature Governance</h2>
                <p className="text-xs text-gray-500 mt-0.5">Enable or disable LMS core modules without redeploying code. Dependencies are automatically safeguarded.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(features).map(([key, isEnabled]) => (
                  <div
                    key={key}
                    onClick={() => handleToggleFeature(key as keyof FeatureFlags)}
                    className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                      isEnabled ? 'border-[#4f8c4c]/40 bg-[#f7fbf6]' : 'border-gray-200 bg-gray-50/60 opacity-80'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-xs text-[#252c41] flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-[#4f8c4c]' : 'bg-gray-400'}`} />
                        <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}</span>
                      </div>
                      <span className="text-[11px] text-gray-500 mt-0.5 block">
                        {isEnabled ? 'Active in learner & staff portals' : 'Disabled platform-wide'}
                      </span>
                    </div>

                    <div className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${isEnabled ? 'bg-[#4f8c4c]' : 'bg-gray-300'}`}>
                      <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: USERS & ROLES */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#eaedf5] pb-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">User Account & Role Governance</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Authoritative user accounts, role delegations, and enterprise identity management.</p>
                </div>
                <button
                  onClick={() => setNewUserModal(true)}
                  className="btn-primary text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create User Account</span>
                </button>
              </div>

              {/* User Metric Pills & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-[#eaedf5] text-gray-700 font-semibold px-2.5 py-1 rounded-lg">
                    Total: <strong className="text-[#252c41]">{usersList.length}</strong>
                  </span>
                  <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2.5 py-1 rounded-lg border border-emerald-200">
                    Students: <strong>{usersList.filter(u => u.role === 'STUDENT').length}</strong>
                  </span>
                  <span className="text-xs bg-blue-50 text-blue-700 font-semibold px-2.5 py-1 rounded-lg border border-blue-200">
                    Instructors: <strong>{usersList.filter(u => u.role === 'INSTRUCTOR').length}</strong>
                  </span>
                  <span className="text-xs bg-purple-50 text-purple-700 font-semibold px-2.5 py-1 rounded-lg border border-purple-200">
                    Admins: <strong>{usersList.filter(u => u.role === 'SUPER_ADMIN' || u.role === 'ORG_ADMIN').length}</strong>
                  </span>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email, or role..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-[#4f8c4c]"
                  />
                </div>
              </div>

              {/* Users Table */}
              <div className="overflow-x-auto border border-[#eaedf5] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
                    <tr>
                      <th className="py-3 px-4">User</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Current Role</th>
                      <th className="py-3 px-4">Change Role</th>
                      <th className="py-3 px-4">Organization</th>
                      <th className="py-3 px-4">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaedf5]">
                    {usersList
                      .filter((u) => {
                        if (!userSearch) return true;
                        const q = userSearch.toLowerCase();
                        return (
                          u.name.toLowerCase().includes(q) ||
                          u.email.toLowerCase().includes(q) ||
                          u.role.toLowerCase().includes(q)
                        );
                      })
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-[#252c41] text-white flex items-center justify-center font-bold text-xs uppercase">
                                {u.name.slice(0, 2)}
                              </div>
                              <span className="font-bold text-[#252c41]">{u.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono text-gray-600">{u.email}</td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              u.role === 'SUPER_ADMIN' ? 'bg-purple-100 text-purple-800' :
                              u.role === 'INSTRUCTOR' ? 'bg-blue-100 text-blue-800' :
                              u.role === 'COURSE_MANAGER' ? 'bg-amber-100 text-amber-800' :
                              'bg-green-100 text-green-800'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-[#4f8c4c]"
                            >
                              <option value="STUDENT">STUDENT</option>
                              <option value="INSTRUCTOR">INSTRUCTOR</option>
                              <option value="COURSE_MANAGER">COURSE_MANAGER</option>
                              <option value="ORG_ADMIN">ORG_ADMIN</option>
                              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                              <option value="SUPPORT_STAFF">SUPPORT_STAFF</option>
                            </select>
                          </td>
                          <td className="py-3 px-4 text-gray-500 font-mono text-[11px]">{u.organizationId}</td>
                          <td className="py-3 px-4 text-gray-500 text-[11px]">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Create User Modal */}
              {newUserModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
                    <h3 className="text-base font-bold text-[#252c41] mb-2">Create Enterprise User Account</h3>
                    <p className="text-xs text-gray-500 mb-4">Provision credentials for a candidate, instructor, or administrator.</p>
                    <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={newUserName}
                          onChange={(e) => setNewUserName(e.target.value)}
                          placeholder="e.g. Dr. Ramesh Kumar"
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Email Address</label>
                        <input
                          type="email"
                          value={newUserEmail}
                          onChange={(e) => setNewUserEmail(e.target.value)}
                          placeholder="e.g. ramesh@example.com"
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Initial Role</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none bg-white"
                        >
                          <option value="STUDENT">STUDENT (Learner)</option>
                          <option value="INSTRUCTOR">INSTRUCTOR (Faculty)</option>
                          <option value="COURSE_MANAGER">COURSE_MANAGER (Curriculum Lead)</option>
                          <option value="ORG_ADMIN">ORG_ADMIN (Corporate Sponsor)</option>
                          <option value="SUPER_ADMIN">SUPER_ADMIN (Platform Governance)</option>
                          <option value="SUPPORT_STAFF">SUPPORT_STAFF</option>
                        </select>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setNewUserModal(false)}
                          className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary text-xs">
                          Create Account
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB: ENROLLMENTS */}
          {activeTab === 'enrollments' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Student Enrollments & Cohort Roster</h2>
                <p className="text-xs text-gray-500 mt-0.5">Authoritative student lifecycle management, syllabus progression tracking, and status overrides.</p>
              </div>

              {/* Enrollment Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-3 bg-gray-50 rounded-xl border border-[#eaedf5]">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Total Enrollments</div>
                  <div className="text-2xl font-black text-[#252c41] mt-1">{enrollmentsList.length}</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <div className="text-[11px] text-emerald-700 font-bold uppercase">Active Students</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">
                    {enrollmentsList.filter(e => e.status === 'ACTIVE').length}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <div className="text-[11px] text-blue-700 font-bold uppercase">Completed</div>
                  <div className="text-2xl font-black text-blue-700 mt-1">
                    {enrollmentsList.filter(e => e.status === 'COMPLETED').length}
                  </div>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                  <div className="text-[11px] text-amber-700 font-bold uppercase">Expired / Revoked</div>
                  <div className="text-2xl font-black text-amber-700 mt-1">
                    {enrollmentsList.filter(e => e.status === 'EXPIRED' || e.status === 'REVOKED').length}
                  </div>
                </div>
              </div>

              {/* Enrollments Table */}
              <div className="overflow-x-auto border border-[#eaedf5] rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
                    <tr>
                      <th className="py-3 px-4">Student</th>
                      <th className="py-3 px-4">Cohort Batch</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Syllabus Progress</th>
                      <th className="py-3 px-4">Enrolled Date</th>
                      <th className="py-3 px-4">Lifecycle Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eaedf5]">
                    {enrollmentsList.map((e) => {
                      const student = usersList.find(u => u.id === e.userId);
                      const batch = batches.find(b => b.id === e.batchId);
                      return (
                        <tr key={e.id} className="hover:bg-gray-50/60 transition-colors">
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-bold text-[#252c41] block">{student?.name || e.userId}</span>
                              <span className="text-[11px] text-gray-400 font-mono">{student?.email || e.userId}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-semibold text-gray-700 block">{batch?.name || e.batchId}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{e.batchId}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              e.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-800' :
                              e.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                              e.status === 'REVOKED' ? 'bg-red-100 text-red-800' :
                              'bg-amber-100 text-amber-800'
                            }`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="w-36">
                              <div className="flex items-center justify-between text-[11px] font-bold text-gray-700 mb-1">
                                <span>{e.progressPercentage || 0}%</span>
                                <span className="text-[10px] text-gray-400 font-normal">
                                  {e.completedLessons?.length || 0} lessons
                                </span>
                              </div>
                              <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#4f8c4c] h-full rounded-full transition-all duration-300"
                                  style={{ width: `${e.progressPercentage || 0}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-500 text-[11px]">
                            {new Date(e.enrolledAt).toLocaleDateString()}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {e.status !== 'ACTIVE' && (
                                <button
                                  onClick={() => handleUpdateEnrollmentStatus(e.id, 'ACTIVE')}
                                  className="text-[10px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2 py-1 rounded"
                                >
                                  Activate
                                </button>
                              )}
                              {e.status !== 'EXPIRED' && (
                                <button
                                  onClick={() => handleUpdateEnrollmentStatus(e.id, 'EXPIRED')}
                                  className="text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded"
                                >
                                  Expire
                                </button>
                              )}
                              {e.status !== 'REVOKED' && (
                                <button
                                  onClick={() => handleUpdateEnrollmentStatus(e.id, 'REVOKED')}
                                  className="text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 rounded"
                                >
                                  Revoke
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB: ASSIGNMENTS & RUBRICS */}
          {activeTab === 'assignments' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#eaedf5] pb-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">Coursework Assignments & Grading Rubrics</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Author authoritative technical case studies, HAZOP matrices, and multi-criteria rubrics.</p>
                </div>
                <button
                  onClick={() => setNewAssignmentModal(true)}
                  className="btn-primary text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Assignment</span>
                </button>
              </div>

              {/* Assignment Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {assignmentsList.map((asg) => (
                  <div key={asg.id} className="p-5 rounded-xl border border-[#eaedf5] bg-gray-50/40 hover:border-[#4f8c4c]/40 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-bold bg-[#4f8c4c]/10 text-[#3a7536] px-2.5 py-0.5 rounded-full border border-[#4f8c4c]/20 uppercase">
                          {asg.courseId}
                        </span>
                        <span className="text-xs font-mono font-bold text-[#252c41] bg-white px-2 py-0.5 rounded border border-[#eaedf5]">
                          {asg.maxScore} Pts Max
                        </span>
                      </div>
                      <h3 className="font-extrabold text-sm text-[#252c41] mb-1.5">{asg.title}</h3>
                      <p className="text-xs text-gray-600 line-clamp-2 mb-3">{asg.description}</p>
                      
                      {asg.rubric?.criteria && (
                        <div className="mb-3 p-2.5 bg-white rounded-lg border border-[#eaedf5]">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">
                            Grading Rubric Breakdown ({asg.rubric.criteria.length} Criteria)
                          </span>
                          <div className="space-y-1">
                            {asg.rubric.criteria.map((c: any) => (
                              <div key={c.id} className="flex items-center justify-between text-[11px] text-gray-700">
                                <span>• {c.title}</span>
                                <span className="font-mono text-gray-500">{c.maxPoints} pts</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#eaedf5] text-[11px] text-gray-500">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-gray-400" />
                        Due: {new Date(asg.dueDate).toLocaleDateString()}
                      </span>
                      <span className="font-bold text-[#3a7536] bg-green-50 px-2 py-0.5 rounded border border-green-200">
                        {asg.status || 'PUBLISHED'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Create Assignment Modal */}
              {newAssignmentModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl">
                    <h3 className="text-base font-bold text-[#252c41] mb-2">Create Technical Coursework Assignment</h3>
                    <p className="text-xs text-gray-500 mb-4">Assign problem sets, industrial hygiene calculations, or HAZOP worksheets.</p>
                    <form onSubmit={handleCreateAssignment} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Assignment Title</label>
                        <input
                          type="text"
                          value={newAsgTitle}
                          onChange={(e) => setNewAsgTitle(e.target.value)}
                          placeholder="e.g. Ergonomic Workplace Assessment Report"
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">Associated Course</label>
                          <select
                            value={newAsgCourseId}
                            onChange={(e) => setNewAsgCourseId(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none bg-white"
                          >
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>{c.title}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-bold text-gray-700 mb-1">Max Score (Points)</label>
                          <input
                            type="number"
                            value={newAsgMaxScore}
                            onChange={(e) => setNewAsgMaxScore(Number(e.target.value))}
                            className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Due Date</label>
                        <input
                          type="date"
                          value={newAsgDueDate}
                          onChange={(e) => setNewAsgDueDate(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Instructions & Problem Statement</label>
                        <textarea
                          value={newAsgDesc}
                          onChange={(e) => setNewAsgDesc(e.target.value)}
                          placeholder="Detail required methodologies, equations, and submission formatting..."
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none"
                          rows={3}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setNewAssignmentModal(false)}
                          className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn-primary text-xs">
                          Create Assignment
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: ROLES & PERMISSIONS */}
          {activeTab === 'roles' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex items-center justify-between border-b border-[#eaedf5] pb-4 mb-6">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">Roles & Permission Matrix</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Authoritative role-based access control. Assign granular permissions across modules.</p>
                </div>
                <button
                  onClick={() => setNewRoleModal(true)}
                  className="btn-primary text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Custom Role</span>
                </button>
              </div>

              {/* Roles List */}
              <div className="space-y-4">
                {roles.map((r) => (
                  <div key={r.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-xs text-[#252c41]">{r.name}</span>
                        {r.isSystem && (
                          <span className="text-[10px] bg-[#eaedf5] text-gray-700 font-bold px-2 py-0.5 rounded">
                            IMMUTABLE SYSTEM ROLE
                          </span>
                        )}
                      </div>

                      {!r.isSystem && (
                        <button
                          onClick={() => handleDeleteRole(r.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete Role</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-gray-500 mb-3">{r.description}</p>

                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                        Assigned Permissions ({r.permissions.length}):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {r.permissions.map((p) => (
                          <span key={p} className="text-[10px] bg-white border border-[#eaedf5] text-gray-700 font-mono px-2 py-0.5 rounded">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* New Role Modal */}
              {newRoleModal && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                    <h3 className="text-base font-bold text-[#252c41] mb-2">Create Custom Operational Role</h3>
                    <form onSubmit={handleCreateRole} className="space-y-4 text-xs">
                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Role Title</label>
                        <input
                          type="text"
                          value={newRoleName}
                          onChange={(e) => setNewRoleName(e.target.value)}
                          placeholder="e.g. Academic Moderator"
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none"
                          required
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Description</label>
                        <textarea
                          value={newRoleDesc}
                          onChange={(e) => setNewRoleDesc(e.target.value)}
                          placeholder="Explain responsibilities of this custom role"
                          className="w-full border border-gray-300 rounded-lg p-2 text-xs outline-none"
                          rows={2}
                        />
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1.5">Select Granular Permissions</label>
                        <div className="grid grid-cols-2 gap-2 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                          {permissions.map((perm) => (
                            <label key={perm.code} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newRolePermissions.includes(perm.code)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewRolePermissions([...newRolePermissions, perm.code]);
                                  } else {
                                    setNewRolePermissions(newRolePermissions.filter((c) => c !== perm.code));
                                  }
                                }}
                                className="w-3.5 h-3.5 text-[#4f8c4c] rounded"
                              />
                              <span className="text-[11px] font-mono text-gray-700 truncate">{perm.code}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setNewRoleModal(false)}
                          className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn-primary text-xs"
                        >
                          Create Role
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: COURSES & CURRICULUM */}
          {activeTab === 'courses' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#eaedf5] pb-4 mb-6 gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">Course Catalog & Program Offerings</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Authoritative HSE certification prep courses, duration, pricing, and curriculum modules.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    placeholder="Search courses..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {courses
                  .filter((c) => c.title.toLowerCase().includes(courseSearch.toLowerCase()) || c.certificationType.toLowerCase().includes(courseSearch.toLowerCase()))
                  .map((course) => (
                    <div key={course.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] bg-[#e1f0df] text-[#3a7536] font-bold px-2 py-0.5 rounded">
                            {course.certificationType}
                          </span>
                          <span className="text-[10px] bg-[#eaedf5] text-gray-700 font-bold px-2 py-0.5 rounded">
                            {course.deliveryModel}
                          </span>
                          <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
                            {course.status}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-sm text-[#252c41] mt-1.5">{course.title}</h3>
                        <p className="text-[11px] text-gray-500 mt-0.5">{course.headline}</p>
                        <div className="flex items-center gap-4 mt-2 text-[11px] text-gray-600 font-semibold">
                          <span>₹{course.priceInr.toLocaleString()} (${course.priceUsd})</span>
                          <span>&bull;</span>
                          <span>{course.durationWeeks} Weeks</span>
                          <span>&bull;</span>
                          <span>{course.totalLessons} Lessons ({course.totalHours} Hrs)</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/courses/${course.slug}`}
                          className="btn-outline text-xs py-1.5 px-3"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Inspect View</span>
                        </Link>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB 7: COHORTS & BATCHES */}
          {activeTab === 'batches' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Scheduled Cohort Batches & Seat Capacity</h2>
                <p className="text-xs text-gray-500 mt-0.5">Manage live class schedules, multi-instructor cohort allocations, and transaction-safe seat caps.</p>
              </div>

              <div className="space-y-4">
                {batches.map((batch) => {
                  const course = courses.find((c) => c.id === batch.courseId);
                  const isFull = batch.enrolledCount >= batch.capacity;
                  return (
                    <div key={batch.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-[#252c41]">{batch.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              batch.status === 'ACTIVE' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                            }`}>
                              {batch.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5">
                            Course: {course?.title || batch.courseId}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-xs font-extrabold ${isFull ? 'text-red-600' : 'text-[#3a7536]'}`}>
                            {batch.enrolledCount} / {batch.capacity} Seats Filled
                          </span>
                          {isFull && (
                            <span className="block text-[10px] text-red-600 font-bold uppercase tracking-wider">
                              CAPACITY LIMIT REACHED
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-3 bg-white border border-[#eaedf5] rounded-lg text-[11px] text-gray-600 flex flex-wrap justify-between items-center gap-2 mt-3">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#4f8c4c]" />
                          <span>{batch.scheduleDescription}</span>
                        </div>
                        <div className="text-gray-400 font-mono">
                          Window: {new Date(batch.startDate).toLocaleDateString()} &mdash; {new Date(batch.endDate).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB: CLASS RECORDINGS GOVERNANCE & ACCESS CONTROL */}
          {activeTab === 'recordings' && (
            <div className="space-y-6">
              {/* Header Card */}
              <div className="bg-white rounded-xl border border-[#eaedf5] p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#eaedf5] pb-4 mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#e1f0df] flex items-center justify-center text-[#3a7536]">
                        <Video className="w-4 h-4" />
                      </div>
                      <h2 className="text-base font-bold text-[#252c41]">
                        Class Recordings Governance & Cross-Cohort Access
                      </h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Manage authoritative recordings, toggle offline MP4 download policies, and grant governed access to previous learner batches.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={loadConfiguration}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Sync Catalog</span>
                    </button>
                  </div>
                </div>

                {/* Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Total Recordings</span>
                    <div className="text-xl font-black text-[#252c41] mt-1">{recordingsList.length}</div>
                    <span className="text-[10px] text-gray-400">In authoritative catalog</span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Downloads Enabled</span>
                    <div className="text-xl font-black text-[#3a7536] mt-1">
                      {recordingsList.filter((r) => r.isDownloadable).length}
                    </div>
                    <span className="text-[10px] text-gray-400">Offline MP4 authorized</span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Active Cross-Batch Grants</span>
                    <div className="text-xl font-black text-[#4f8c4c] mt-1">
                      {grantsList.filter((g) => g.status === 'ACTIVE').length}
                    </div>
                    <span className="text-[10px] text-gray-400">Previous cohorts enabled</span>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Archived / Revoked</span>
                    <div className="text-xl font-black text-amber-600 mt-1">
                      {recordingsList.filter((r) => r.status !== 'AVAILABLE').length}
                    </div>
                    <span className="text-[10px] text-gray-400">Gated from learners</span>
                  </div>
                </div>

                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mb-6 bg-gray-50/70 p-3 rounded-xl border border-[#eaedf5]">
                  <div className="relative w-full sm:w-80">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={recordingSearch}
                      onChange={(e) => setRecordingSearch(e.target.value)}
                      placeholder="Search recordings by title, course, or batch..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg outline-none focus:border-[#4f8c4c]"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-xs text-gray-500 font-semibold whitespace-nowrap">Filter Status:</span>
                    <select
                      value={recordingStatusFilter}
                      onChange={(e) => setRecordingStatusFilter(e.target.value as any)}
                      className="text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none font-medium text-gray-700"
                    >
                      <option value="ALL">All Statuses</option>
                      <option value="AVAILABLE">Available Only</option>
                      <option value="ARCHIVED">Archived</option>
                      <option value="REVOKED">Revoked</option>
                    </select>
                  </div>
                </div>

                {/* Recordings Catalog Table */}
                <div className="border border-[#eaedf5] rounded-xl overflow-hidden mb-8">
                  <div className="bg-[#f7f9fc] px-4 py-2.5 border-b border-[#eaedf5] flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                      Authoritative Class Recordings ({recordingsList.length})
                    </span>
                    <span className="text-[10px] text-gray-400">HMAC-SHA256 Tokenized Delivery</span>
                  </div>

                  {recordingsList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-gray-400">
                      <Video className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p>No class recordings found in the catalog.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
                          <tr>
                            <th className="py-2.5 px-4">Recording Details</th>
                            <th className="py-2.5 px-4">Course & Batch</th>
                            <th className="py-2.5 px-4">Duration & Size</th>
                            <th className="py-2.5 px-4">Download Policy</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-center">Grants</th>
                            <th className="py-2.5 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eaedf5]">
                          {recordingsList
                            .filter((rec) => {
                              if (recordingStatusFilter !== 'ALL' && rec.status !== recordingStatusFilter) return false;
                              if (!recordingSearch) return true;
                              const q = recordingSearch.toLowerCase();
                              return (
                                rec.title.toLowerCase().includes(q) ||
                                (rec.description && rec.description.toLowerCase().includes(q)) ||
                                rec.courseId.toLowerCase().includes(q) ||
                                rec.batchId.toLowerCase().includes(q)
                              );
                            })
                            .map((rec) => {
                              const crs = courses.find((c) => c.id === rec.courseId);
                              const btc = batches.find((b) => b.id === rec.batchId);
                              const recGrants = grantsList.filter(
                                (g) => g.recordingId === rec.id && g.status === 'ACTIVE'
                              );

                              return (
                                <tr key={rec.id} className="hover:bg-gray-50/50">
                                  <td className="py-3 px-4">
                                    <div className="font-bold text-[#252c41]">{rec.title}</div>
                                    <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {rec.id}</div>
                                    {rec.description && (
                                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-1">{rec.description}</p>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-gray-700">{crs?.title || rec.courseId}</div>
                                    <div className="text-[10px] text-gray-400 font-medium">Batch: {btc?.name || rec.batchId}</div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <div className="font-medium text-gray-700">
                                      {Math.floor(rec.durationSeconds / 60)}m {rec.durationSeconds % 60}s
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                      {(rec.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB &bull; {rec.storageProvider}
                                    </div>
                                  </td>
                                  <td className="py-3 px-4">
                                    <button
                                      onClick={() => handleToggleDownload(rec)}
                                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all border ${
                                        rec.isDownloadable
                                          ? 'bg-[#e1f0df] text-[#3a7536] border-[#4f8c4c]/30 hover:bg-[#d2e8cf]'
                                          : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                      }`}
                                      title="Click to toggle download permissions"
                                    >
                                      {rec.isDownloadable ? (
                                        <>
                                          <Unlock className="w-3 h-3 text-[#3a7536]" />
                                          <span>Downloads Allowed</span>
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="w-3 h-3 text-gray-400" />
                                          <span>Streaming Only</span>
                                        </>
                                      )}
                                    </button>
                                  </td>
                                  <td className="py-3 px-4">
                                    <select
                                      value={rec.status}
                                      onChange={(e) => handleUpdateRecordingStatus(rec.id, e.target.value)}
                                      className={`text-[10px] font-bold rounded px-2 py-1 border outline-none ${
                                        rec.status === 'AVAILABLE'
                                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          : rec.status === 'ARCHIVED'
                                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                                          : 'bg-red-50 text-red-800 border-red-200'
                                      }`}
                                    >
                                      <option value="AVAILABLE">AVAILABLE</option>
                                      <option value="ARCHIVED">ARCHIVED</option>
                                      <option value="REVOKED">REVOKED</option>
                                    </select>
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    <span
                                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                        recGrants.length > 0
                                          ? 'bg-[#e1f0df] text-[#3a7536]'
                                          : 'bg-gray-100 text-gray-500'
                                      }`}
                                    >
                                      {recGrants.length} {recGrants.length === 1 ? 'batch' : 'batches'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => handleOpenGrantModal(rec)}
                                        className="text-[10px] font-bold text-[#3a7536] bg-[#e1f0df] hover:bg-[#d2e8cf] border border-[#4f8c4c]/30 px-2.5 py-1 rounded transition-colors"
                                      >
                                        + Grant Access
                                      </button>
                                      <Link
                                        href={`/recordings/${rec.id}`}
                                        target="_blank"
                                        className="text-[10px] font-bold text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 px-2.5 py-1 rounded inline-flex items-center gap-1 transition-colors"
                                      >
                                        <Play className="w-3 h-3 text-[#4f8c4c]" />
                                        <span>Player</span>
                                      </Link>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Section: Cross-Cohort Access Grants Governance */}
                <div>
                  <div className="flex items-center justify-between border-b border-[#eaedf5] pb-3 mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#252c41]">Active Cross-Cohort Access Grants</h3>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Batches authorized to stream or download classes originally recorded for another cohort.
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-[#4f8c4c]">
                      {grantsList.filter((g) => g.status === 'ACTIVE').length} Active Rules
                    </span>
                  </div>

                  {grantsList.length === 0 ? (
                    <div className="p-6 bg-gray-50 rounded-xl border border-[#eaedf5] text-center text-xs text-gray-400">
                      No cross-batch access grants active. Click &quot;+ Grant Access&quot; on any recording above to grant access to previous or parallel batches.
                    </div>
                  ) : (
                    <div className="border border-[#eaedf5] rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
                          <tr>
                            <th className="py-2.5 px-4">Recording</th>
                            <th className="py-2.5 px-4">Source Cohort</th>
                            <th className="py-2.5 px-4">Target Cohort</th>
                            <th className="py-2.5 px-4">Download Access</th>
                            <th className="py-2.5 px-4">Granted At & Expiry</th>
                            <th className="py-2.5 px-4">Status</th>
                            <th className="py-2.5 px-4 text-right">Governance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#eaedf5]">
                          {grantsList.map((g) => {
                            const rec = recordingsList.find((r) => r.id === g.recordingId);
                            const srcBtc = batches.find((b) => b.id === g.sourceBatchId);
                            const tgtBtc = batches.find((b) => b.id === g.targetBatchId);

                            return (
                              <tr key={g.id} className="hover:bg-gray-50/50">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-[#252c41]">{rec?.title || g.recordingId}</div>
                                  <div className="text-[10px] text-gray-400 font-mono">Grant ID: {g.id}</div>
                                </td>
                                <td className="py-3 px-4 text-gray-600 font-medium">
                                  {srcBtc?.name || g.sourceBatchId}
                                </td>
                                <td className="py-3 px-4 font-bold text-[#3a7536]">
                                  {tgtBtc?.name || g.targetBatchId}
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                      g.allowDownload
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {g.allowDownload ? 'Download Allowed' : 'Streaming Only'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-gray-600">
                                  <div>{new Date(g.grantedAt).toLocaleDateString()}</div>
                                  <div className="text-[10px] text-gray-400">
                                    {g.expiresAt ? `Expires: ${new Date(g.expiresAt).toLocaleDateString()}` : 'No Expiry'}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <span
                                    className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                      g.status === 'ACTIVE'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-red-100 text-red-800'
                                    }`}
                                  >
                                    {g.status}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  {g.status === 'ACTIVE' ? (
                                    <button
                                      onClick={() => handleRevokeGrant(g.id)}
                                      className="text-[10px] font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1 rounded transition-colors"
                                    >
                                      Revoke Grant
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-gray-400 italic">Revoked</span>
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
              </div>

              {/* Grant Access Modal */}
              {grantModalOpen && selectedRecForGrant && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#eaedf5] animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between border-b border-[#eaedf5] pb-3 mb-4">
                      <div>
                        <h3 className="text-base font-bold text-[#252c41]">
                          Grant Previous-Batch Recording Access
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Authorize learners in another cohort to access this class recording.
                        </p>
                      </div>
                      <button
                        onClick={() => setGrantModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 p-1"
                      >
                        &times;
                      </button>
                    </div>

                    <form onSubmit={handleSubmitGrant} className="space-y-4 text-xs">
                      <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Selected Recording</span>
                        <div className="font-bold text-[#252c41] text-sm mt-0.5">{selectedRecForGrant.title}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          Original Batch: {batches.find((b) => b.id === selectedRecForGrant.batchId)?.name || selectedRecForGrant.batchId}
                        </div>
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">Target Learner Cohort / Batch *</label>
                        <select
                          value={grantTargetBatchId}
                          onChange={(e) => setGrantTargetBatchId(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none focus:border-[#4f8c4c]"
                          required
                        >
                          <option value="">-- Select Target Batch --</option>
                          {batches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name} ({b.id}) &mdash; {courses.find((c) => c.id === b.courseId)?.title || b.courseId}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <input
                          type="checkbox"
                          id="grantAllowDownload"
                          checked={grantAllowDownload}
                          onChange={(e) => setGrantAllowDownload(e.target.checked)}
                          className="w-4 h-4 text-[#4f8c4c] rounded focus:ring-0 cursor-pointer"
                        />
                        <label htmlFor="grantAllowDownload" className="font-semibold text-gray-700 cursor-pointer">
                          Permit offline MP4 download for learners in this cohort
                        </label>
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">
                          Access Expiration Date <span className="text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="date"
                          value={grantExpiresAt}
                          onChange={(e) => setGrantExpiresAt(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none focus:border-[#4f8c4c]"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">Leave blank for permanent cohort revision access.</p>
                      </div>

                      <div>
                        <label className="block font-bold text-gray-700 mb-1">
                          Governance / Audit Reason <span className="text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={grantReason}
                          onChange={(e) => setGrantReason(e.target.value)}
                          placeholder="e.g. Previous batch revision access prior to BCSP examination"
                          className="w-full border border-gray-300 rounded-lg p-2.5 text-xs outline-none focus:border-[#4f8c4c]"
                        />
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                        <button
                          type="button"
                          onClick={() => setGrantModalOpen(false)}
                          className="px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={submittingGrant}
                          className="btn-primary text-xs flex items-center gap-1.5"
                        >
                          {submittingGrant ? 'Granting...' : 'Authorize Cohort Access'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: EXAM ENGINE & QUESTION BANK */}
          {activeTab === 'exams' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Examination Engine & Question Bank</h2>
                <p className="text-xs text-gray-500 mt-0.5">Authoritative blueprints, BCSP/BCRSP domain weighting, and calculation stem bank.</p>
              </div>

              {/* Blueprints */}
              <div className="mb-8">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Examination Blueprints</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {blueprints.map((bp) => (
                    <div key={bp.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[10px] bg-[#e1f0df] text-[#3a7536] font-bold px-2 py-0.5 rounded">
                          {bp.certificationType} Track
                        </span>
                        <span className="text-xs font-mono font-bold text-gray-500">ID: {bp.id}</span>
                      </div>
                      <h4 className="font-bold text-xs text-[#252c41]">{bp.title}</h4>
                      <div className="mt-2 text-[11px] text-gray-600 flex items-center gap-3">
                        <span>{bp.totalQuestions} Questions</span>
                        <span>&bull;</span>
                        <span>{bp.durationMinutes} Minutes</span>
                        <span>&bull;</span>
                        <span>Pass: {bp.passingScorePercent}%</span>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-200/60 text-[10px] text-gray-500 space-y-1">
                        {bp.domains.map((d) => (
                          <div key={d.name} className="flex justify-between">
                            <span className="truncate pr-2">{d.name}</span>
                            <span className="font-bold font-mono">{d.weightPercent}% ({d.questionCount} Qs)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Questions Bank */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Authoritative Questions Bank ({questions.length} Items)
                </h3>
                <div className="space-y-3">
                  {questions.map((q) => (
                    <div key={q.id} className="p-4 rounded-xl border border-[#eaedf5] bg-white">
                      <div className="flex items-center justify-between mb-1.5 text-[10px]">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-[#4f8c4c]">{q.id}</span>
                          <span className="bg-gray-100 font-semibold px-2 py-0.5 rounded text-gray-600">{q.domain}</span>
                        </div>
                        <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">{q.difficulty}</span>
                      </div>
                      <p className="text-xs font-semibold text-[#252c41] mt-1">{q.stem}</p>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[11px]">
                        {q.options.map((opt) => {
                          const isCorrect = q.correctOptionIds.includes(opt.id);
                          return (
                            <div key={opt.id} className={`p-2 rounded border ${isCorrect ? 'border-green-300 bg-green-50/70 text-green-900 font-bold' : 'border-gray-200 text-gray-600'}`}>
                              <span className="font-mono text-[10px] uppercase mr-1">[{opt.id}]</span>
                              <span>{opt.text}</span>
                              {isCorrect && <span className="ml-1 text-[9px] text-green-700 uppercase font-black">(Answer Key)</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 9: CERTIFICATES REGISTRY */}
          {activeTab === 'certificates' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Issued Credentials & Accreditation Registry</h2>
                <p className="text-xs text-gray-500 mt-0.5">Authoritative certificate records. Inspect cryptographic codes, print verification sheets, and manage revocations.</p>
              </div>

              {certificates.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No certificates issued yet. Certificates automatically issue when learners pass high-stakes diagnostic mock examinations.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5]">
                      <tr>
                        <th className="py-2.5 px-3">Certificate Code</th>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Course / Track</th>
                        <th className="py-2.5 px-3">Score</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eaedf5]">
                      {certificates.map((cert) => (
                        <tr key={cert.id} className="hover:bg-gray-50/50">
                          <td className="py-2.5 px-3 font-mono font-bold text-[#3a7536]">
                            <Link href={`/verify/${cert.certificateCode}`} className="hover:underline flex items-center gap-1">
                              <span>{cert.certificateCode}</span>
                              <ExternalLink className="w-3 h-3 text-gray-400" />
                            </Link>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-[#252c41]">{cert.userName}</div>
                            <div className="text-[10px] text-gray-400">{cert.userEmail}</div>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-gray-700">{cert.courseTitle}</div>
                            <span className="text-[10px] bg-[#eaedf5] text-[#252c41] font-bold px-1.5 py-0.2 rounded">
                              {cert.certificationType}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-bold text-[#252c41]">{cert.scorePercent}%</td>
                          <td className="py-2.5 px-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              cert.status === 'ISSUED' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {cert.status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {cert.status === 'ISSUED' && (
                              <button
                                onClick={() => handleRevokeCertificate(cert.certificateCode)}
                                className="text-red-500 hover:text-red-700 font-semibold text-xs"
                              >
                                Revoke
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 10: WORKFLOW AUTOMATION */}
          {activeTab === 'workflows' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Workflow Automation Engine</h2>
                <p className="text-xs text-gray-500 mt-0.5">Automated business triggers for exam pass events, automated credential generation, and compliance alerts.</p>
              </div>

              <div className="space-y-4">
                {workflows.map((wf) => (
                  <div key={wf.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-[#252c41]">{wf.title}</span>
                        <span className="text-[10px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">
                          ACTIVE
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-400">ID: {wf.id}</span>
                    </div>
                    <p className="text-[11px] text-gray-500 mb-3">{wf.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-white p-3 rounded-lg border border-[#eaedf5]">
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Trigger Event:</div>
                        <div className="font-mono font-bold text-[#3a7536] mt-0.5">{wf.trigger}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Configured Actions:</div>
                        <div className="space-y-1 mt-0.5">
                          {wf.actions.map((a, i) => (
                            <div key={i} className="text-[11px] font-mono text-gray-700">
                              &rarr; {a.type}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 11: NOTIFICATION TEMPLATES */}
          {activeTab === 'templates' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Notification & Message Templates</h2>
                <p className="text-xs text-gray-500 mt-0.5">Configurable email, in-app, and push message templates supporting dynamic learner variables.</p>
              </div>

              <div className="space-y-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-xs text-[#252c41]">{tpl.titleTemplate}</span>
                      <span className="text-[10px] bg-[#eaedf5] text-gray-700 font-bold px-2 py-0.5 rounded">
                        Channel: {tpl.channel}
                      </span>
                    </div>
                    <div className="p-3 bg-white rounded-lg border border-[#eaedf5] text-xs text-gray-700 font-mono">
                      {tpl.bodyTemplate}
                    </div>
                    <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                      <span>Supported Variables:</span>
                      {tpl.variables.map((v) => (
                        <span key={v} className="bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-mono">
                          {`{${v}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 12: INTEGRATION HEALTH & TELEMETRY */}
          {activeTab === 'integrations' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="border-b border-[#eaedf5] pb-4 mb-6">
                <h2 className="text-base font-bold text-[#252c41]">Integrated External Services Telemetry</h2>
                <p className="text-xs text-gray-500 mt-0.5">Diagnostic handshakes, latency monitoring, and resilient adapter verification.</p>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl text-xs mb-6 border ${testResult.success ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
                  <div className="font-bold flex items-center gap-2">
                    {testResult.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    <span>Handshake Result for {testResult.serviceName}</span>
                  </div>
                  <p className="mt-1">{testResult.message}</p>
                </div>
              )}

              <div className="space-y-4">
                {integrations.map((srv) => (
                  <div key={srv.name} className="p-5 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-sm text-[#252c41]">{srv.name}</h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            srv.status === 'CONNECTED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {srv.status}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{srv.endpointUrl}</p>
                      </div>

                      <button
                        onClick={() => handleTestIntegration(srv.name)}
                        disabled={testingService === srv.name}
                        className="btn-outline text-xs py-1.5 px-3"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${testingService === srv.name ? 'animate-spin' : ''}`} />
                        <span>{testingService === srv.name ? 'Testing Handshake...' : 'Test Connection'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-200/60 text-[11px] text-gray-600">
                      <div>
                        <span className="text-gray-400 block text-[10px]">Adapter Mode:</span>
                        <span className="font-semibold">{srv.isMockMode ? 'Resilient Local Adapter' : 'Live Production Endpoint'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Last Handshake Check:</span>
                        <span className="font-mono">{new Date(srv.lastCheckedAt).toLocaleTimeString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px]">Sync Interval:</span>
                        <span>{srv.syncIntervalMinutes || 15} Minutes</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 13: CONFIG AUDIT & ROLLBACK */}
          {activeTab === 'audits' && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#eaedf5] pb-4 mb-6 gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">Configuration Version History & Rollback</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Every administrative change is versioned. Roll back unintended changes with one click.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Filter audit log..."
                    className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              {configAudits.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  No configuration updates recorded yet. Modifications to settings, branding, or feature flags automatically generate rollback snapshots.
                </div>
              ) : (
                <div className="space-y-4">
                  {configAudits
                    .filter((a) => a.section.toLowerCase().includes(auditSearch.toLowerCase()) || (a.changeReason && a.changeReason.toLowerCase().includes(auditSearch.toLowerCase())))
                    .map((item) => (
                      <div key={item.id} className="p-4 rounded-xl border border-[#eaedf5] bg-gray-50/40">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] bg-[#252c41] text-white font-bold px-2 py-0.5 rounded">
                              v{item.version}
                            </span>
                            <span className="font-bold text-xs text-[#252c41]">{item.section}</span>
                            {item.isRollback && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                                ROLLBACK EVENT
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="text-[11px] text-gray-400 font-mono">
                              {new Date(item.timestamp).toLocaleString()}
                            </span>
                            <button
                              onClick={() => handleRollback(item.id)}
                              className="text-xs text-[#3a7536] hover:text-[#4f8c4c] font-bold inline-flex items-center gap-1 bg-white border border-[#eaedf5] px-2.5 py-1 rounded-lg shadow-2xs hover:bg-gray-50"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Rollback to this state</span>
                            </button>
                          </div>
                        </div>

                        <p className="text-xs text-gray-600 mb-2">{item.changeReason || 'Administrative update'}</p>

                        <div className="text-[10px] text-gray-400 font-mono">
                          Changed by: {item.actorEmail}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 14: REPORTS & ANALYTICS */}
          {activeTab === 'reports' && metrics && (
            <div className="bg-white rounded-xl border border-[#eaedf5] p-6 sm:p-8 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-[#eaedf5] pb-4 mb-6 gap-3">
                <div>
                  <h2 className="text-base font-bold text-[#252c41]">Enterprise Analytics & Compliance Reports</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Authoritative audit ledger and regulatory reports for BCSP, ISO 9001/29993, and financial governance.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadReportJSON}
                    className="inline-flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-[#252c41] text-xs font-bold px-3 py-2 rounded-lg transition-colors border border-gray-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export JSON</span>
                  </button>
                  <button
                    onClick={handleDownloadReportCSV}
                    className="btn-primary text-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {/* KPI Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Pass Rate</div>
                  <div className="text-2xl font-black text-[#3a7536] mt-1">{metrics.passRate}%</div>
                  <p className="text-[10px] text-gray-500 mt-0.5">BCSP benchmarked</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Enrolled Students</div>
                  <div className="text-2xl font-black text-[#252c41] mt-1">{metrics.activeStudents}</div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Active candidates</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Certificates Issued</div>
                  <div className="text-2xl font-black text-[#4f8c4c] mt-1">{metrics.totalCertificates}</div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Cryptographically signed</p>
                </div>

                <div className="p-4 bg-gray-50 rounded-xl border border-[#eaedf5]">
                  <div className="text-[11px] text-gray-500 font-bold uppercase">Verified Revenue</div>
                  <div className="text-2xl font-black text-[#252c41] mt-1">₹{Number(metrics.estimatedRevenue || 34999).toLocaleString()}</div>
                  <p className="text-[10px] text-gray-500 mt-0.5">Inclusive of 18% GST</p>
                </div>
              </div>

              {/* Dataset Selector Tabs */}
              <div className="flex flex-wrap items-center gap-2 mb-4 p-1 bg-gray-100 rounded-xl">
                {[
                  { id: 'enrollments', label: 'Cohort Enrollments' },
                  { id: 'exams', label: 'Exam Performance' },
                  { id: 'certificates', label: 'Certificates Registry' },
                  { id: 'revenue', label: 'Invoices & Revenue Ledger' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => loadReportPreview(tab.id as any)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${
                      selectedReportDataset === tab.id
                        ? 'bg-white text-[#252c41] shadow-xs'
                        : 'text-gray-500 hover:text-[#252c41]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Live Preview Table */}
              <div className="border border-[#eaedf5] rounded-xl overflow-hidden">
                <div className="bg-[#f7f9fc] px-4 py-2.5 border-b border-[#eaedf5] flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">
                    Live Dataset Preview: {selectedReportDataset.toUpperCase()} ({reportData.length} Records)
                  </span>
                  <button
                    onClick={() => loadReportPreview(selectedReportDataset)}
                    className="text-xs text-[#4f8c4c] hover:underline font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingReport ? 'animate-spin' : ''}`} />
                    <span>Refresh Preview</span>
                  </button>
                </div>

                {loadingReport ? (
                  <div className="py-12 text-center">
                    <div className="w-8 h-8 border-3 border-[#4f8c4c] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs text-gray-400">Loading dataset records...</p>
                  </div>
                ) : reportData.length === 0 ? (
                  <div className="py-12 text-center text-xs text-gray-400">
                    <p>No records found for the selected dataset.</p>
                    <button
                      onClick={() => loadReportPreview(selectedReportDataset)}
                      className="mt-2 text-[#4f8c4c] font-bold hover:underline"
                    >
                      Click to load preview
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-gray-500 uppercase border-b border-[#eaedf5] sticky top-0">
                        <tr>
                          {Object.keys(reportData[0]).map((header) => (
                            <th key={header} className="py-2.5 px-3 whitespace-nowrap">
                              {header.replace(/([A-Z])/g, ' $1')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#eaedf5]">
                        {reportData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            {Object.values(row).map((val: any, cIdx) => (
                              <td key={cIdx} className="py-2 px-3 whitespace-nowrap text-gray-700">
                                {typeof val === 'number' && val > 1000
                                  ? val.toLocaleString()
                                  : String(val ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
