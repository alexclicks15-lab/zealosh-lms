// Zealosh LMS — Centralized Diagnostics Service
// Path: src/lib/diagnostics/diagnostics-service.ts
// Handles event ingestion, deterministic fingerprinting, deduplication, incident lifecycle & alerts

import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  DiagnosticCategory,
  DiagnosticSeverity,
  DiagnosticSource,
  DiagnosticIssueStatus,
  DiagnosticIssue,
  DiagnosticEvent,
  SystemHealthOverview,
} from '@/types';
import { generateCorrelationId } from './correlation';
import { sanitizeString, redactSensitiveData } from './redaction';
import { generateFingerprint } from './fingerprint';
import { runAllHealthChecks } from './health-checker';

export interface RecordEventInput {
  category: DiagnosticCategory;
  severity?: DiagnosticSeverity;
  source?: DiagnosticSource;
  message: string;
  errorCode?: string;
  route?: string;
  service?: string;
  method?: string;
  statusCode?: number;
  stackTrace?: string;
  componentStack?: string;
  userId?: string;
  userEmail?: string;
  correlationId?: string;
  clientInfo?: {
    userAgent?: string;
    ip?: string;
    url?: string;
  };
  metadata?: Record<string, any>;
}

export class DiagnosticsService {
  /**
   * Ingests a new diagnostic event, scrubbed of sensitive data, and groups it into
   * a deduplicated issue. Automatically reopens resolved issues if new events recur.
   */
  public async recordEvent(input: RecordEventInput): Promise<{
    event: DiagnosticEvent;
    issue: DiagnosticIssue;
    correlationId: string;
    reopened: boolean;
  }> {
    const correlationId = input.correlationId || generateCorrelationId();
    const severity: DiagnosticSeverity = input.severity || 'MEDIUM';
    const source: DiagnosticSource = input.source || 'BACKEND';
    const category: DiagnosticCategory = input.category || 'API_FAILURE';
    const now = new Date().toISOString();

    // 1. Scrub and sanitize sensitive contents
    const sanitizedMessage = sanitizeString(input.message || 'Unknown Diagnostic Event');
    const sanitizedStack = input.stackTrace ? sanitizeString(input.stackTrace) : undefined;
    const sanitizedCompStack = input.componentStack ? sanitizeString(input.componentStack) : undefined;
    const redactedMetadata = input.metadata ? redactSensitiveData(input.metadata) : {};

    // 2. Deterministic fingerprint computation
    const fingerprint = generateFingerprint({
      category,
      errorCode: input.errorCode,
      route: input.route,
      service: input.service,
      message: sanitizedMessage,
    });

    // 3. Find existing issue or create new one
    let issue = await db.getDiagnosticIssueByFingerprint(fingerprint);
    let reopened = false;

    if (issue) {
      // Recurring issue: update aggregate telemetry
      issue.occurrenceCount += 1;
      issue.lastSeenAt = now;
      issue.lastCorrelationId = correlationId;
      issue.lastErrorMessage = sanitizedMessage;
      issue.updatedAt = now;

      if (input.route && !issue.affectedRoutes.includes(input.route)) {
        issue.affectedRoutes = [...issue.affectedRoutes, input.route];
      }
      if (input.service && !issue.affectedServices.includes(input.service)) {
        issue.affectedServices = [...issue.affectedServices, input.service];
      }

      // If issue was marked RESOLVED, a new occurrence automatically moves it to REOPENED
      if (issue.status === 'RESOLVED') {
        issue.status = 'REOPENED';
        reopened = true;
      }

      await db.upsertDiagnosticIssue(issue);
    } else {
      // First occurrence: create new issue record
      const issueId = `iss-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
      const prefix = input.errorCode ? `[${input.errorCode}] ` : '';
      const rawTitle = `${prefix}${sanitizedMessage}`;
      const title = rawTitle.length > 250 ? `${rawTitle.slice(0, 247)}...` : rawTitle;

      issue = {
        id: issueId,
        fingerprint,
        title,
        category,
        severity,
        status: 'OPEN',
        occurrenceCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        affectedRoutes: input.route ? [input.route] : [],
        affectedServices: input.service ? [input.service] : [],
        lastCorrelationId: correlationId,
        lastErrorMessage: sanitizedMessage,
        sampleStackTrace: sanitizedStack,
        sampleComponentStack: sanitizedCompStack,
        metadata: redactedMetadata,
        createdAt: now,
        updatedAt: now,
      };

      await db.upsertDiagnosticIssue(issue);
    }

    // 4. Record the immutable diagnostic event occurrence
    const eventId = `dbev-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const event: DiagnosticEvent = {
      id: eventId,
      issueId: issue.id,
      correlationId,
      category,
      severity,
      source,
      route: input.route,
      service: input.service,
      method: input.method,
      statusCode: input.statusCode,
      errorCode: input.errorCode,
      sanitizedMessage,
      stackTrace: sanitizedStack,
      componentStack: sanitizedCompStack,
      userId: input.userId,
      userEmail: input.userEmail ? sanitizeString(input.userEmail) : undefined,
      clientInfo: input.clientInfo ? redactSensitiveData(input.clientInfo) : undefined,
      metadata: redactedMetadata,
      createdAt: now,
    };

    await db.recordDiagnosticEvent(event);

    // 5. In-App Administrative Incident Alert for CRITICAL Severity
    if (severity === 'CRITICAL') {
      try {
        await this.dispatchAdminIncidentAlert(issue, event);
      } catch (alertErr: any) {
        console.warn('Failed to dispatch administrative diagnostic alert:', alertErr.message);
      }
    }

    return { event, issue, correlationId, reopened };
  }

  /**
   * Dispatches real-time in-app notification alerts to administrative operators
   * when a CRITICAL severity issue is logged.
   */
  private async dispatchAdminIncidentAlert(issue: DiagnosticIssue, event: DiagnosticEvent): Promise<void> {
    const users = Array.from(db.users.values());
    const admins = users.filter(
      (u) => u.role === 'SUPER_ADMIN' || u.role === 'ORG_ADMIN' || (u.role as string) === 'ADMIN'
    );

    for (const admin of admins) {
      await db.createNotification({
        recipientUserId: admin.id,
        type: 'SYSTEM_ALERT',
        entityType: 'SYSTEM',
        entityId: issue.id,
        title: `CRITICAL Incident: ${issue.title}`,
        description: `${event.sanitizedMessage} (Correlation ID: ${event.correlationId})`,
        actionUrl: `/admin/diagnostics?issueId=${issue.id}`,
      });
    }
  }

  /**
   * Retrieves list of issues with optional filtering and pagination.
   */
  public async getIssues(filter?: {
    status?: DiagnosticIssueStatus;
    severity?: DiagnosticSeverity;
    category?: DiagnosticCategory;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ issues: DiagnosticIssue[]; total: number }> {
    return db.getDiagnosticIssues(filter);
  }

  /**
   * Retrieves full issue details including recent events.
   */
  public async getIssueById(id: string): Promise<{
    issue: DiagnosticIssue | null;
    events: DiagnosticEvent[];
  }> {
    const issue = await db.getDiagnosticIssueById(id);
    if (!issue) {
      return { issue: null, events: [] };
    }
    const events = await db.getDiagnosticEventsForIssue(id, 50);
    return { issue, events };
  }

  /**
   * Acknowledges an issue, assigning ownership to the acknowledging admin.
   */
  public async acknowledgeIssue(id: string, actorId: string): Promise<DiagnosticIssue | null> {
    return db.updateDiagnosticIssueStatus(id, 'ACKNOWLEDGED', actorId);
  }

  /**
   * Resolves an issue with recorded resolution notes.
   */
  public async resolveIssue(id: string, actorId: string, notes?: string): Promise<DiagnosticIssue | null> {
    return db.updateDiagnosticIssueStatus(id, 'RESOLVED', actorId, notes);
  }

  /**
   * Executes live dependency health checks and compiles complete system health telemetry.
   */
  public async getHealthOverview(): Promise<SystemHealthOverview> {
    const healthResult = await runAllHealthChecks();

    // Persist latest health status in DB
    for (const check of Object.values(healthResult.services)) {
      await db.upsertServiceHealthCheck(check);
    }

    // Compute active issue statistics
    const issues = Array.from(db.diagnosticIssues.values());
    const openCriticalIssues = issues.filter(
      (i) => i.severity === 'CRITICAL' && (i.status === 'OPEN' || i.status === 'REOPENED')
    ).length;

    const openHighIssues = issues.filter(
      (i) => i.severity === 'HIGH' && (i.status === 'OPEN' || i.status === 'REOPENED')
    ).length;

    const totalOpenIssues = issues.filter(
      (i) => i.status === 'OPEN' || i.status === 'REOPENED' || i.status === 'ACKNOWLEDGED'
    ).length;

    // Count events in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const eventsLast24Hours = Array.from(db.diagnosticEvents.values()).filter(
      (e) => e.createdAt >= oneDayAgo
    ).length;

    return {
      status: healthResult.status,
      services: healthResult.services,
      openCriticalIssues,
      openHighIssues,
      totalOpenIssues,
      eventsLast24Hours,
      checkedAt: healthResult.checkedAt,
    };
  }
}

export const diagnosticsService = new DiagnosticsService();
