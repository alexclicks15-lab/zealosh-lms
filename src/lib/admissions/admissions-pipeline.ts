// Zealosh LMS — 14-Stage Admissions Pipeline State Machine & Document Review Engine
// Governs institutional admissions progression, strict state transitions, and audit trails
// File: src/lib/admissions/admissions-pipeline.ts

import {
  AdmissionsPipelineStage,
  AdmissionApplication,
  ApplicationDocument,
  ApplicantDocumentStatus,
  AdmissionOffer,
  AdmissionOfferStatus,
} from '@/types';
import { db } from '@/lib/store/db';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { OrientationService } from '@/lib/orientation/orientation-service';

// Transition validation matrix
const ALLOWED_TRANSITIONS: Record<AdmissionsPipelineStage, AdmissionsPipelineStage[]> = {
  NEW: ['CONTACTED', 'APPLICATION_STARTED', 'REJECTED', 'CLOSED'],
  CONTACTED: ['APPLICATION_STARTED', 'SUBMITTED', 'REJECTED', 'CLOSED'],
  APPLICATION_STARTED: ['SUBMITTED', 'WITHDRAWN', 'CLOSED'],
  SUBMITTED: ['DOCUMENT_REVIEW', 'ELIGIBILITY_REVIEW', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  DOCUMENT_REVIEW: ['ELIGIBILITY_REVIEW', 'SUBMITTED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  ELIGIBILITY_REVIEW: ['ORIENTATION_PENDING', 'APPROVED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  ORIENTATION_PENDING: ['APPROVED', 'WAITLISTED', 'REJECTED', 'WITHDRAWN'],
  APPROVED: ['OFFER_PAYMENT_PENDING', 'ADMITTED', 'WAITLISTED', 'WITHDRAWN'],
  OFFER_PAYMENT_PENDING: ['ADMITTED', 'WAITLISTED', 'WITHDRAWN', 'CLOSED'],
  ADMITTED: ['WITHDRAWN', 'CLOSED'],
  WAITLISTED: [
    'DOCUMENT_REVIEW',
    'ELIGIBILITY_REVIEW',
    'APPROVED',
    'OFFER_PAYMENT_PENDING',
    'ADMITTED',
    'REJECTED',
    'WITHDRAWN',
    'CLOSED',
  ],
  REJECTED: ['SUBMITTED', 'CLOSED'],
  WITHDRAWN: ['APPLICATION_STARTED', 'SUBMITTED', 'CLOSED'],
  CLOSED: ['APPLICATION_STARTED'],
};

// In-memory document and offer registries for test/local isolation
const inMemoryOffers = new Map<string, AdmissionOffer>();

export class AdmissionsPipelineService {
  public static resetForTesting() {
    inMemoryOffers.clear();
  }

  /**
   * Check if a stage transition is valid under the standard state machine rules
   */
  public static isValidTransition(
    currentStage: AdmissionsPipelineStage,
    targetStage: AdmissionsPipelineStage
  ): boolean {
    if (currentStage === targetStage) return true;
    const allowed = ALLOWED_TRANSITIONS[currentStage];
    return allowed ? allowed.includes(targetStage) : false;
  }

  /**
   * Transition an application to a new stage
   */
  public static async transitionStage(params: {
    applicationId: string;
    targetStage: AdmissionsPipelineStage;
    actorUserId: string;
    reason?: string;
    isOverride?: boolean;
  }): Promise<AdmissionApplication> {
    const { applicationId, targetStage, actorUserId, reason, isOverride } = params;

    const application = await db.getAdmissionApplication(applicationId);
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    const currentStage = (application.pipelineStage || application.status) as AdmissionsPipelineStage;

    if (!isOverride && !this.isValidTransition(currentStage, targetStage)) {
      throw new Error(
        `INVALID_STAGE_TRANSITION: Cannot transition application from '${currentStage}' to '${targetStage}'. Transition is not permitted by admissions policy.`
      );
    }

    if (isOverride && (!reason || reason.trim().length < 10)) {
      throw new Error(
        'OVERRIDE_REASON_MANDATORY: Manual administrative overrides strictly require a detailed audit explanation (at least 10 characters).'
      );
    }

    // Enforce prerequisites for critical stages
    if (targetStage === 'APPROVED') {
      // Check document statuses
      const documents = await db.getApplicationDocuments(applicationId);
      const hasPendingDocs = documents.some(
        (d) => d.status === 'UNDER_REVIEW' || d.status === 'UPLOADED' || d.status === 'REQUIRED'
      );
      if (hasPendingDocs && !isOverride) {
        throw new Error(
          'CANNOT_APPROVE_PENDING_DOCS: Cannot approve application while documents are pending review. Verify all required documents or issue an override.'
        );
      }

      // Check orientation requirement if application is in ORIENTATION_PENDING stage and course mandates it
      if (
        application.pipelineStage === 'ORIENTATION_PENDING' ||
        application.status === 'ORIENTATION_PENDING'
      ) {
        const orientationCheck = await OrientationService.isOrientationSatisfied(
          application.courseId,
          application.id,
          application.userId || ''
        );
        if (orientationCheck.isRequired && !orientationCheck.satisfied && !isOverride) {
          throw new Error(
            'ORIENTATION_ATTENDANCE_REQUIRED: Candidate must attend course orientation session before admission can be approved (or provide administrative override with justification).'
          );
        }
      }
    }

    const now = new Date().toISOString();
    const historyEntry = {
      stage: targetStage,
      changedAt: now,
      changedBy: actorUserId,
      reason: isOverride ? `[ADMIN_OVERRIDE] ${reason}` : reason,
    };

    const stageHistory = application.stageHistory || [];
    stageHistory.push(historyEntry);

    // Update application
    application.status = targetStage;
    application.pipelineStage = targetStage;
    application.stageHistory = stageHistory;
    application.updatedAt = now;

    // Persist in db store
    db.admissionApplications.set(application.id, application);
    db.persistToDisk();

    // Sync to Supabase if available
    const client = supabaseAdapter.getClient();
    if (client) {
      try {
        await client
          .from('admission_applications')
          .update({
            status: targetStage,
            updated_at: now,
          })
          .eq('id', applicationId);
      } catch {
        // Fallback
      }
    }

    return application;
  }

  // --------------------------------------------------------------------------
  // Document Review Queue & Versioning
  // --------------------------------------------------------------------------

  /**
   * Verify and approve an applicant document
   */
  public static async verifyDocument(
    documentId: string,
    reviewerUserId: string
  ): Promise<ApplicationDocument> {
    const doc = db.applicationDocuments.get(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const now = new Date().toISOString();
    doc.status = 'VERIFIED';
    doc.isVerified = true;
    doc.verified = true;
    doc.reviewerUserId = reviewerUserId;
    doc.reviewedAt = now;
    doc.rejectionReason = undefined;

    db.applicationDocuments.set(documentId, doc);
    db.persistToDisk();

    return doc;
  }

  /**
   * Reject an applicant document or request resubmission
   */
  public static async rejectDocument(params: {
    documentId: string;
    reviewerUserId: string;
    rejectionReason: string;
    requestResubmission?: boolean;
  }): Promise<ApplicationDocument> {
    const { documentId, reviewerUserId, rejectionReason, requestResubmission } = params;

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    const doc = db.applicationDocuments.get(documentId);
    if (!doc) {
      throw new Error(`Document ${documentId} not found`);
    }

    const now = new Date().toISOString();
    doc.status = requestResubmission ? 'RESUBMISSION_REQUESTED' : 'REJECTED';
    doc.isVerified = false;
    doc.verified = false;
    doc.reviewerUserId = reviewerUserId;
    doc.reviewedAt = now;
    doc.rejectionReason = rejectionReason.trim();

    db.applicationDocuments.set(documentId, doc);
    db.persistToDisk();

    return doc;
  }

  /**
   * Upload a replacement document: preserves historical version and marks old document as SUPERSEDED
   */
  public static async replaceDocument(params: {
    oldDocumentId: string;
    storagePath: string;
    filename: string;
    fileSizeBytes?: number;
    mimeType?: string;
    mediaAssetId?: string;
  }): Promise<ApplicationDocument> {
    const oldDoc = db.applicationDocuments.get(params.oldDocumentId);
    if (!oldDoc) {
      throw new Error(`Previous document ${params.oldDocumentId} not found`);
    }

    const now = new Date().toISOString();
    oldDoc.status = 'SUPERSEDED';
    db.applicationDocuments.set(params.oldDocumentId, oldDoc);

    const currentVersion = oldDoc.version || 1;
    const newDocId = `doc-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    const newDoc: ApplicationDocument = {
      id: newDocId,
      applicationId: oldDoc.applicationId,
      applicantUserId: oldDoc.applicantUserId,
      documentType: oldDoc.documentType,
      filename: params.filename,
      fileName: params.filename,
      storagePath: params.storagePath,
      mediaAssetId: params.mediaAssetId,
      fileSizeBytes: params.fileSizeBytes || 0,
      fileSize: params.fileSizeBytes || 0,
      mimeType: params.mimeType || 'application/pdf',
      uploadedAt: now,
      isVerified: false,
      verified: false,
      status: 'UPLOADED',
      version: currentVersion + 1,
    };

    db.applicationDocuments.set(newDocId, newDoc);
    db.persistToDisk();

    return newDoc;
  }

  // --------------------------------------------------------------------------
  // Admission Offers
  // --------------------------------------------------------------------------

  public static async issueAdmissionOffer(params: {
    applicationId: string;
    courseId: string;
    offeringId: string;
    offeredPriceInr: number;
    currency?: 'INR' | 'USD';
    validityDays?: number;
    issuedBy: string;
  }): Promise<AdmissionOffer> {
    const { applicationId, courseId, offeringId, offeredPriceInr, issuedBy } = params;

    const application = await db.getAdmissionApplication(applicationId);
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    const now = new Date().toISOString();
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + (params.validityDays || 14)); // default 14-day offer validity

    const id = `offer-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const offer: AdmissionOffer = {
      id,
      applicationId,
      courseId,
      offeringId,
      offeredPriceInr,
      currency: params.currency || 'INR',
      validUntil: expiry.toISOString(),
      status: 'ISSUED',
      issuedBy,
      issuedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    inMemoryOffers.set(id, offer);

    // Transition application to OFFER_PAYMENT_PENDING
    await this.transitionStage({
      applicationId,
      targetStage: 'OFFER_PAYMENT_PENDING',
      actorUserId: issuedBy,
      reason: `Admission offer ${id} issued at price ₹${offeredPriceInr}`,
    });

    return offer;
  }

  public static async getOfferById(id: string): Promise<AdmissionOffer | null> {
    return inMemoryOffers.get(id) || null;
  }

  public static async getOffersByApplication(applicationId: string): Promise<AdmissionOffer[]> {
    return Array.from(inMemoryOffers.values()).filter((o) => o.applicationId === applicationId);
  }
}

