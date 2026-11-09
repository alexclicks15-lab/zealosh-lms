// Zealosh LMS — Server-Authoritative Entitlement Engine
// Evaluates resource access and enforces strict separation of curriculum features
// File: src/lib/commerce/entitlement-service.ts

import {
  UserEntitlement,
  UserEntitlementStatus,
  EntitlementFeatureScope,
  EntitlementEvaluationResult,
} from '@/types';
import { ProductService } from '@/lib/commerce/product-service';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { db } from '@/lib/store/db';

// In-memory registry for development / test isolation
const inMemoryEntitlements = new Map<string, UserEntitlement>();

export class EntitlementService {
  /**
   * Reset store (useful for clean unit tests)
   */
  public static resetForTesting() {
    inMemoryEntitlements.clear();
  }

  /**
   * Evaluate whether a user has active, unexpired, non-revoked entitlement
   * for a given course and feature scope at a specific point in time.
   */
  public static async evaluateEntitlement(
    userId: string,
    courseId: string,
    featureScope: EntitlementFeatureScope,
    atTime?: Date | string
  ): Promise<EntitlementEvaluationResult> {
    if (!userId || !courseId) {
      return {
        hasAccess: false,
        featureScope,
        status: 'NOT_FOUND',
        reason: 'User ID and Course ID are required for entitlement evaluation',
        matchingEntitlements: [],
      };
    }

    const targetDate = atTime ? new Date(atTime) : new Date();

    // Check Supabase if live
    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        const { data, error } = await client.rpc('evaluate_user_entitlement', {
          p_user_id: userId,
          p_course_id: courseId,
          p_feature_scope: featureScope,
          p_at_time: targetDate.toISOString(),
        });
        if (!error && data) {
          return {
            hasAccess: Boolean(data.hasAccess),
            featureScope,
            status: data.hasAccess ? 'ACTIVE' : 'NOT_FOUND',
            validUntil: data.validUntil,
            reason: data.hasAccess
              ? 'Authorized by active database entitlement'
              : 'No active database entitlement found for requested scope',
            matchingEntitlements: [],
          };
        }
      } catch {
        // Fallback to in-memory evaluation
      }
    }

    // In-memory evaluation
    const userEntitlements = Array.from(inMemoryEntitlements.values()).filter(
      (e) => e.userId === userId && e.courseId === courseId
    );

    if (userEntitlements.length === 0) {
      return {
        hasAccess: false,
        featureScope,
        status: 'NOT_FOUND',
        reason: `No entitlements found for user ${userId} on course ${courseId}`,
        matchingEntitlements: [],
      };
    }

    // Check relevant entitlements: either matches the exact scope or grants ALL
    const relevant = userEntitlements.filter(
      (e) => e.featureScope === 'ALL' || e.featureScope === featureScope
    );

    if (relevant.length === 0) {
      const activeScopes = userEntitlements
        .filter((e) => e.status === 'ACTIVE')
        .map((e) => e.featureScope);
      return {
        hasAccess: false,
        featureScope,
        status: 'NOT_FOUND',
        reason: `Access denied: Requested scope '${featureScope}' is not included in user's active entitlements [${activeScopes.join(', ')}]`,
        matchingEntitlements: [],
      };
    }

    // Check for revocation
    const revoked = relevant.filter((e) => e.status === 'REVOKED' || e.revokedAt);
    if (revoked.length > 0 && !relevant.some((e) => e.status === 'ACTIVE' && !e.revokedAt)) {
      return {
        hasAccess: false,
        featureScope,
        status: 'REVOKED',
        reason: `Access revoked: ${revoked[0].revocationReason || 'Entitlement was revoked by administrator'}`,
        matchingEntitlements: revoked,
      };
    }

    // Check for suspension
    const suspended = relevant.filter((e) => e.status === 'SUSPENDED');
    if (suspended.length > 0 && !relevant.some((e) => e.status === 'ACTIVE')) {
      return {
        hasAccess: false,
        featureScope,
        status: 'SUSPENDED',
        reason: `Access suspended: ${suspended[0].revocationReason || 'Entitlement is currently suspended'}`,
        matchingEntitlements: suspended,
      };
    }

    // Check active and time validity
    const activeAndValid = relevant.filter((e) => {
      if (e.status !== 'ACTIVE') return false;
      const validFrom = new Date(e.validFrom);
      const validUntil = new Date(e.validUntil);
      return targetDate >= validFrom && targetDate <= validUntil;
    });

    if (activeAndValid.length > 0) {
      // Find latest validUntil
      const maxExpiry = new Date(
        Math.max(...activeAndValid.map((e) => new Date(e.validUntil).getTime()))
      ).toISOString();

      return {
        hasAccess: true,
        featureScope,
        status: 'ACTIVE',
        validUntil: maxExpiry,
        reason: `Authorized: Active entitlement covers scope '${featureScope}' until ${maxExpiry}`,
        matchingEntitlements: activeAndValid,
      };
    }

    // Check if expired
    const expired = relevant.filter((e) => {
      const validUntil = new Date(e.validUntil);
      return targetDate > validUntil;
    });

    if (expired.length > 0) {
      return {
        hasAccess: false,
        featureScope,
        status: 'EXPIRED',
        reason: `Entitlement expired on ${expired[0].validUntil}`,
        matchingEntitlements: expired,
      };
    }

    return {
      hasAccess: false,
      featureScope,
      status: 'NOT_FOUND',
      reason: 'No active entitlement valid for current timestamp',
      matchingEntitlements: relevant,
    };
  }

  /**
   * Grants server-authoritative entitlements to a user based on a purchased offering.
   */
  public static async grantEntitlementsForOffering(params: {
    userId: string;
    courseId: string;
    offeringId: string;
    sourceOrderId?: string;
    validFrom?: string;
  }): Promise<UserEntitlement[]> {
    const { userId, courseId, offeringId, sourceOrderId } = params;

    const offering = await ProductService.getOfferingById(offeringId);
    if (!offering) {
      throw new Error(`Offering ${offeringId} not found`);
    }

    const startDate = params.validFrom ? new Date(params.validFrom) : new Date();
    const expiryDate = new Date(startDate);
    expiryDate.setDate(expiryDate.getDate() + (offering.validityDays || 365));

    const scopesToGrant: EntitlementFeatureScope[] =
      offering.includedEntitlements.length > 0
        ? offering.includedEntitlements
        : ['ALL'];

    const granted: UserEntitlement[] = [];

    for (const scope of scopesToGrant) {
      // Check if user already has an active entitlement for this course and scope
      const existing = Array.from(inMemoryEntitlements.values()).find(
        (e) =>
          e.userId === userId &&
          e.courseId === courseId &&
          e.featureScope === scope &&
          e.status === 'ACTIVE'
      );

      if (existing) {
        // Extend validity
        const currentExpiry = new Date(existing.validUntil);
        const newExpiry = currentExpiry > startDate ? new Date(currentExpiry) : new Date(startDate);
        newExpiry.setDate(newExpiry.getDate() + (offering.validityDays || 365));

        existing.validUntil = newExpiry.toISOString();
        existing.sourceOrderId = sourceOrderId || existing.sourceOrderId;
        existing.updatedAt = new Date().toISOString();
        inMemoryEntitlements.set(existing.id, existing);
        granted.push(existing);
      } else {
        const id = `ent-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date().toISOString();
        const entitlement: UserEntitlement = {
          id,
          userId,
          courseId,
          offeringId,
          featureScope: scope,
          status: 'ACTIVE',
          validFrom: startDate.toISOString(),
          validUntil: expiryDate.toISOString(),
          sourceOrderId,
          createdAt: now,
          updatedAt: now,
        };

        inMemoryEntitlements.set(id, entitlement);
        granted.push(entitlement);

        // Sync to Supabase if live
        const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
        if (client) {
          try {
            await client.from('user_entitlements').insert({
              id: entitlement.id,
              user_id: entitlement.userId,
              course_id: entitlement.courseId,
              offering_id: entitlement.offeringId,
              feature_scope: entitlement.featureScope,
              status: entitlement.status,
              valid_from: entitlement.validFrom,
              valid_until: entitlement.validUntil,
              source_order_id: entitlement.sourceOrderId,
              created_at: entitlement.createdAt,
              updated_at: entitlement.updatedAt,
            });
          } catch {
            // Fallback
          }
        }
      }
    }

    return granted;
  }

  /**
   * Revoke an entitlement
   */
  public static async revokeEntitlement(
    entitlementId: string,
    reason: string
  ): Promise<UserEntitlement> {
    const entitlement = inMemoryEntitlements.get(entitlementId);
    if (!entitlement) {
      throw new Error(`Entitlement ${entitlementId} not found`);
    }

    const now = new Date().toISOString();
    entitlement.status = 'REVOKED';
    entitlement.revokedAt = now;
    entitlement.revocationReason = reason;
    entitlement.updatedAt = now;

    inMemoryEntitlements.set(entitlementId, entitlement);

    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        await client
          .from('user_entitlements')
          .update({
            status: 'REVOKED',
            revoked_at: now,
            revocation_reason: reason,
            updated_at: now,
          })
          .eq('id', entitlementId);
      } catch {
        // Fallback
      }
    }

    return entitlement;
  }

  /**
   * Suspend an entitlement
   */
  public static async suspendEntitlement(
    entitlementId: string,
    reason: string
  ): Promise<UserEntitlement> {
    const entitlement = inMemoryEntitlements.get(entitlementId);
    if (!entitlement) {
      throw new Error(`Entitlement ${entitlementId} not found`);
    }

    const now = new Date().toISOString();
    entitlement.status = 'SUSPENDED';
    entitlement.revocationReason = reason;
    entitlement.updatedAt = now;

    inMemoryEntitlements.set(entitlementId, entitlement);
    return entitlement;
  }

  /**
   * Reactivate an entitlement
   */
  public static async reactivateEntitlement(entitlementId: string): Promise<UserEntitlement> {
    const entitlement = inMemoryEntitlements.get(entitlementId);
    if (!entitlement) {
      throw new Error(`Entitlement ${entitlementId} not found`);
    }

    const now = new Date().toISOString();
    entitlement.status = 'ACTIVE';
    entitlement.revokedAt = undefined;
    entitlement.revocationReason = undefined;
    entitlement.updatedAt = now;

    inMemoryEntitlements.set(entitlementId, entitlement);
    return entitlement;
  }

  /**
   * Get all entitlements for a user
   */
  public static async getUserEntitlements(
    userId: string,
    filter?: { courseId?: string; status?: UserEntitlementStatus }
  ): Promise<UserEntitlement[]> {
    const client = db.getStorageMode() === 'supabase' ? supabaseAdapter.getClient() : null;
    if (client) {
      try {
        let query = client.from('user_entitlements').select('*').eq('user_id', userId);
        if (filter?.courseId) query = query.eq('course_id', filter.courseId);
        if (filter?.status) query = query.eq('status', filter.status);
        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            userId: d.user_id,
            courseId: d.course_id,
            offeringId: d.offering_id,
            featureScope: d.feature_scope,
            status: d.status,
            validFrom: d.valid_from,
            validUntil: d.valid_until,
            sourceOrderId: d.source_order_id,
            revokedAt: d.revoked_at,
            revocationReason: d.revocation_reason,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch {
        // Fallback
      }
    }

    let list = Array.from(inMemoryEntitlements.values()).filter((e) => e.userId === userId);
    if (filter?.courseId) {
      list = list.filter((e) => e.courseId === filter.courseId);
    }
    if (filter?.status) {
      list = list.filter((e) => e.status === filter.status);
    }
    return list;
  }
}
