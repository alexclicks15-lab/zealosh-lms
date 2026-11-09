// Zealosh LMS — Enterprise Telemetry, Structured Logging & Observability
// Path: src/lib/telemetry/enterprise-telemetry.ts
// Redacts sensitive PII and secrets, collects real operational metrics,
// and correlates traces across Frontend -> API -> Outbox -> Workers.

import { db } from '@/lib/store/db';
import {
  OperationalDashboardMetrics,
  TelemetryMetric,
  DomainIdentifier,
} from '@/types';
import { generateCorrelationId, extractCorrelationId } from '@/lib/diagnostics/correlation';
import { redactSensitiveData, sanitizeString } from '@/lib/diagnostics/redaction';
import { DomainRegistryService } from '@/lib/events/domain-registry';

export interface StructuredLogEntry {
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  service: string;
  message: string;
  correlationId: string;
  route?: string;
  actorType?: string;
  actorId?: string;
  errorCategory?: string;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export class EnterpriseTelemetryService {
  private static metrics: TelemetryMetric[] = [];

  /**
   * Records a sanitized structured log entry
   */
  public static log(entry: Omit<StructuredLogEntry, 'timestamp' | 'correlationId'> & { correlationId?: string }): StructuredLogEntry {
    const correlationId = entry.correlationId || generateCorrelationId();
    const sanitizedMessage = sanitizeString(entry.message);
    const sanitizedMetadata = entry.metadata ? redactSensitiveData(entry.metadata) : undefined;

    const structuredLog: StructuredLogEntry = {
      timestamp: new Date().toISOString(),
      severity: entry.severity,
      service: entry.service,
      message: sanitizedMessage,
      correlationId,
      route: entry.route,
      actorType: entry.actorType,
      actorId: entry.actorId,
      errorCategory: entry.errorCategory,
      durationMs: entry.durationMs,
      metadata: sanitizedMetadata,
    };

    // Emit to stdout in structured format
    if (entry.severity === 'ERROR' || entry.severity === 'CRITICAL') {
      console.error(JSON.stringify(structuredLog));
    } else {
      console.log(JSON.stringify(structuredLog));
    }

    return structuredLog;
  }

  /**
   * Records an empirical telemetry metric
   */
  public static recordMetric(metricName: string, metricValue: number, tags: Record<string, string> = {}): void {
    const metric: TelemetryMetric = {
      metricName,
      metricValue,
      tags,
      timestamp: new Date().toISOString(),
    };
    this.metrics.push(metric);
    if (this.metrics.length > 1000) {
      this.metrics.shift(); // Keep bounded memory window
    }
  }

  /**
   * Compiles the authoritative operational dashboard metrics
   */
  public static async getDashboardMetrics(): Promise<OperationalDashboardMetrics> {
    const domains = DomainRegistryService.getRegisteredDomains();
    const outboxCounts = await db.getEventOutboxCounts();
    const deadLetterCount = await db.getDeadLetterCount();
    const reconciliationMismatches = await db.getOpenReconciliationMismatchCount();
    const maintenanceConfig = await db.getMaintenanceConfig();
    const auditArchivesCount = await db.getAuditArchivesCount();

    let systemHealth: 'HEALTHY' | 'DEGRADED' | 'MAINTENANCE' = 'HEALTHY';
    if (maintenanceConfig.enabled) {
      systemHealth = 'MAINTENANCE';
    } else if (deadLetterCount > 0 || reconciliationMismatches > 0) {
      systemHealth = 'DEGRADED';
    }

    return {
      domainsCount: domains.length,
      outboxBacklogCount: outboxCounts.pending,
      deliveriesPendingCount: outboxCounts.pendingDeliveries,
      deliveriesFailedCount: outboxCounts.failedDeliveries,
      deadLetterCount,
      reconciliationMismatchCount: reconciliationMismatches,
      maintenanceMode: maintenanceConfig.mode,
      auditArchivesCount,
      systemHealth,
    };
  }
}

