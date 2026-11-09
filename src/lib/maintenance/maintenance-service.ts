// Zealosh LMS — Administrative Maintenance Mode & Write-Protection Engine
// Path: src/lib/maintenance/maintenance-service.ts
// Enforces server-authoritative operational states (NORMAL, READ_ONLY, FULL_MAINTENANCE),
// scheduling, administrative bypass, and audit history.

import crypto from 'crypto';
import { db } from '@/lib/store/db';
import {
  MaintenanceConfig,
  MaintenanceMode,
  MaintenanceHistoryEntry,
  UserRole,
} from '@/types';

export class MaintenanceService {
  /**
   * Retrieves authoritative maintenance configuration, resolving any scheduled window activations/expirations.
   */
  public async getEffectiveConfig(): Promise<MaintenanceConfig> {
    const config = await db.getMaintenanceConfig();
    const now = new Date();

    // Check if scheduled window should auto-activate
    if (!config.enabled && config.scheduledStartTime && config.scheduledEndTime) {
      const start = new Date(config.scheduledStartTime);
      const end = new Date(config.scheduledEndTime);

      if (now >= start && now < end) {
        // Auto-activate
        const updated: MaintenanceConfig = {
          ...config,
          enabled: true,
          mode: config.mode === 'NORMAL' ? 'READ_ONLY' : config.mode,
          activatedAt: now.toISOString(),
          version: config.version + 1,
        };
        await db.updateMaintenanceConfig(updated);
        await this.logHistory(updated.mode, 'ACTIVATED', 'Scheduled maintenance window started', 'system');
        return updated;
      }
    }

    // Check if scheduled window has elapsed and should auto-complete
    if (config.enabled && config.scheduledEndTime) {
      const end = new Date(config.scheduledEndTime);
      if (now >= end) {
        const updated: MaintenanceConfig = {
          ...config,
          enabled: false,
          mode: 'NORMAL',
          completedAt: now.toISOString(),
          version: config.version + 1,
        };
        await db.updateMaintenanceConfig(updated);
        await this.logHistory('NORMAL', 'COMPLETED', 'Scheduled maintenance window elapsed', 'system');
        return updated;
      }
    }

    return config;
  }

  /**
   * Updates maintenance configuration with administrative actor auditing
   */
  public async updateConfig(
    params: Partial<MaintenanceConfig>,
    actorUserId: string
  ): Promise<MaintenanceConfig> {
    const current = await db.getMaintenanceConfig();
    const now = new Date().toISOString();

    const newMode = params.mode || current.mode;
    const isEnabling = params.enabled ?? current.enabled;

    const updated: MaintenanceConfig = {
      ...current,
      ...params,
      version: current.version + 1,
      updatedBy: actorUserId,
      activatedAt: isEnabling && !current.enabled ? now : current.activatedAt,
      completedAt: !isEnabling && current.enabled ? now : current.completedAt,
    };

    await db.updateMaintenanceConfig(updated);

    const action = isEnabling
      ? params.scheduledStartTime ? 'SCHEDULED' : 'ACTIVATED'
      : 'COMPLETED';

    await this.logHistory(
      newMode,
      action,
      params.reason || 'Administrative maintenance state change',
      actorUserId
    );

    return updated;
  }

  /**
   * Validates if a request method and route is permitted under the current maintenance mode.
   * Throws or returns structured refusal for blocked operations.
   */
  public async assertWritePermitted(options: {
    method: string;
    pathname: string;
    userRole?: UserRole;
    isBypassHeaderPresent?: boolean;
  }): Promise<{ allowed: boolean; status?: number; error?: string; mode?: MaintenanceMode }> {
    const { method, pathname, userRole, isBypassHeaderPresent } = options;
    const config = await this.getEffectiveConfig();

    if (!config.enabled || config.mode === 'NORMAL') {
      return { allowed: true };
    }

    // 1. Health, Diagnostic Liveness, and Admin Auth Endpoints are always exempt
    if (
      pathname.startsWith('/api/health') ||
      pathname.startsWith('/api/auth/login') ||
      pathname.startsWith('/api/auth/me') ||
      pathname.startsWith('/api/maintenance/status') ||
      pathname.startsWith('/api/admin/maintenance')
    ) {
      return { allowed: true };
    }

    // 2. Administrative Bypass: SUPER_ADMIN and ORG_ADMIN retain emergency access
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ORG_ADMIN';
    if (isAdmin) {
      return { allowed: true };
    }

    // 3. READ_ONLY Mode: Block state mutations (POST, PUT, PATCH, DELETE)
    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
    if (config.mode === 'READ_ONLY') {
      if (isMutation) {
        return {
          allowed: false,
          status: 503,
          mode: 'READ_ONLY',
          error: config.maintenanceMessage || 'Platform is currently in Read-Only Maintenance mode. Modifications are suspended.',
        };
      }
      return { allowed: true };
    }

    // 4. FULL_MAINTENANCE Mode: Block all non-exempt traffic
    if (config.mode === 'FULL_MAINTENANCE') {
      return {
        allowed: false,
        status: 503,
        mode: 'FULL_MAINTENANCE',
        error: config.maintenanceMessage || 'Platform is undergoing scheduled maintenance. Please check back shortly.',
      };
    }

    return { allowed: true };
  }

  private async logHistory(
    mode: MaintenanceMode,
    action: 'SCHEDULED' | 'ACTIVATED' | 'EXTENDED' | 'COMPLETED' | 'CANCELLED',
    reason: string,
    actor: string
  ): Promise<void> {
    const entry: MaintenanceHistoryEntry = {
      id: `maint-hist-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      mode,
      action,
      reason,
      actor,
      timestamp: new Date().toISOString(),
    };
    await db.saveMaintenanceHistory(entry);
  }
}

export const maintenanceService = new MaintenanceService();

