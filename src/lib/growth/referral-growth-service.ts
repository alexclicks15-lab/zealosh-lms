// Zealosh LMS — Institutional Growth, Referral Tracking & Alumni Networking
// File: src/lib/growth/referral-growth-service.ts
// Governs referral code creation, anti-abuse attribution, conversion tracking,
// commission policy gating, partner registry, campaign models, and privacy-governed alumni networking.

import {
  ReferralCode,
  ReferralAttribution,
  ReferralConversion,
  InstitutionalPartner,
  InstitutionalCampaign,
  AlumniProfile,
} from '@/types';
import { db } from '@/lib/store/db';

export const inMemoryReferralCodes: Map<string, ReferralCode> = new Map(); // code -> ReferralCode
export const inMemoryReferralAttributions: Map<string, ReferralAttribution> = new Map(); // leadId -> attribution
export const inMemoryReferralConversions: Map<string, ReferralConversion> = new Map();
export const inMemoryPartners: Map<string, InstitutionalPartner> = new Map();
export const inMemoryCampaigns: Map<string, InstitutionalCampaign> = new Map();
export const inMemoryAlumniProfiles: Map<string, AlumniProfile> = new Map(); // studentId -> AlumniProfile

export class ReferralGrowthService {
  constructor() {
    this.seedDefaultGrowthEntities();
  }

  // --------------------------------------------------------------------------
  // Seed Default Growth Entities
  // --------------------------------------------------------------------------
  private seedDefaultGrowthEntities() {
    if (inMemoryReferralCodes.size === 0) {
      const defaultCode: ReferralCode = {
        id: 'ref-code-alex-01',
        code: 'REF-ALEX-9821',
        ownerUserId: 'usr-student-01',
        ownerName: 'Alex Chen',
        status: 'ACTIVE',
        clickCount: 12,
        conversionCount: 2,
        createdAt: '2026-11-01T00:00:00.000Z',
      };
      inMemoryReferralCodes.set(defaultCode.code, defaultCode);
    }

    if (inMemoryPartners.size === 0) {
      const partnerCode: ReferralCode = {
        id: 'ref-code-kerala-safety',
        code: 'REF-PARTNER-KSS-2026',
        ownerUserId: 'usr-partner-kss',
        ownerName: 'Kerala State Safety Council',
        status: 'ACTIVE',
        clickCount: 45,
        conversionCount: 8,
        createdAt: '2026-11-01T00:00:00.000Z',
      };
      inMemoryReferralCodes.set(partnerCode.code, partnerCode);

      const partner: InstitutionalPartner = {
        id: 'partner-kss-01',
        partnerName: 'Kerala State Safety Council',
        partnerType: 'CORPORATE',
        contactEmail: 'affiliates@keralasafety.org',
        contactPerson: 'K. S. Narayanan',
        referralCodeId: partnerCode.id,
        status: 'ACTIVE',
        agreementRef: 'AGR-ZEALOSH-KSS-2026-B',
        notes: 'State institutional partnership for ASP/CSP professional sponsorship.',
        createdAt: '2026-11-01T00:00:00.000Z',
      };
      inMemoryPartners.set(partner.id, partner);
    }

    if (inMemoryCampaigns.size === 0) {
      const campaign: InstitutionalCampaign = {
        id: 'camp-q4-asp-2026',
        name: 'Q4 2026 BCSP ASP Exam Prep Sprint',
        slug: 'asp-q4-2026',
        objective: 'Promote December ASP examination cohort across regional safety chapters.',
        targetCourseId: 'crs-asp-01',
        channel: 'WEB',
        status: 'ACTIVE',
        startDate: '2026-11-01',
        endDate: '2026-12-31',
        utmSource: 'zealosh_portal',
        utmCampaign: 'asp_december_sprint',
        leadsCount: 24,
        conversionsCount: 6,
        createdAt: '2026-11-01T00:00:00.000Z',
      };
      inMemoryCampaigns.set(campaign.id, campaign);
      inMemoryCampaigns.set(campaign.slug, campaign);
    }
  }

  // --------------------------------------------------------------------------
  // Referral Codes Engine
  // --------------------------------------------------------------------------
  public getOrCreateReferralCode(
    userId: string,
    userName: string,
    campaignId?: string,
    targetCourseId?: string
  ): ReferralCode {
    // Find existing active referral code for this user
    for (const ref of inMemoryReferralCodes.values()) {
      if (ref.ownerUserId === userId && ref.status === 'ACTIVE') {
        return ref;
      }
    }

    // Generate unique code: REF-[CLEAN_NAME]-[HASH]
    const cleanName = userName
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(0, 4) || 'USER';
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const codeString = `REF-${cleanName}-${randomSuffix}`;

    const newCode: ReferralCode = {
      id: `ref-${Date.now()}-${randomSuffix}`,
      code: codeString,
      ownerUserId: userId,
      ownerName: userName,
      campaignId,
      targetCourseId,
      status: 'ACTIVE',
      clickCount: 0,
      conversionCount: 0,
      createdAt: new Date().toISOString(),
    };

    inMemoryReferralCodes.set(codeString, newCode);
    return newCode;
  }

  public validateReferralCode(code: string): { valid: boolean; codeRecord?: ReferralCode; error?: string } {
    const cleanCode = code.trim().toUpperCase();
    const record = inMemoryReferralCodes.get(cleanCode);

    if (!record) {
      return { valid: false, error: 'Referral code not found' };
    }

    if (record.status !== 'ACTIVE') {
      return { valid: false, error: `Referral code is ${record.status.toLowerCase()}` };
    }

    if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) {
      return { valid: false, error: 'Referral code has expired' };
    }

    return { valid: true, codeRecord: record };
  }

  // --------------------------------------------------------------------------
  // Referral Attribution & Anti-Abuse
  // --------------------------------------------------------------------------
  public recordReferralAttribution(params: {
    leadId: string;
    referralCode: string;
    applicantUserId?: string;
  }): ReferralAttribution {
    const validation = this.validateReferralCode(params.referralCode);
    if (!validation.valid || !validation.codeRecord) {
      throw new Error(`Invalid referral code: ${validation.error}`);
    }

    const codeRecord = validation.codeRecord;

    // Anti-abuse Rule 1: Self-referral rejection
    if (params.applicantUserId && params.applicantUserId === codeRecord.ownerUserId) {
      throw new Error('SELF_REFERRAL_PROHIBITED: Cannot use your own referral code');
    }

    // Anti-abuse Rule 2: Prevent duplicate attribution for the same lead
    const existing = inMemoryReferralAttributions.get(params.leadId);
    if (existing) {
      return existing; // Preserve first-touch attribution without error
    }

    const attributionId = `attr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const attribution: ReferralAttribution = {
      id: attributionId,
      referralCode: codeRecord.code,
      referrerUserId: codeRecord.ownerUserId,
      leadId: params.leadId,
      status: 'ATTRIBUTED',
      attributedAt: new Date().toISOString(),
      auditTrail: [
        {
          event: 'ATTRIBUTION_RECORDED',
          timestamp: new Date().toISOString(),
          actor: params.applicantUserId || 'LEAD_CAPTURE',
        },
      ],
    };

    inMemoryReferralAttributions.set(params.leadId, attribution);

    // Increment click/usage counter
    codeRecord.clickCount += 1;

    return attribution;
  }

  // --------------------------------------------------------------------------
  // Conversion Tracking & Strict Commission Policy Boundary
  // --------------------------------------------------------------------------
  public recordReferralConversion(params: {
    leadId: string;
    referredUserId: string;
    courseId: string;
    orderId?: string;
    conversionEvent: 'ADMISSION_APPROVED' | 'PAYMENT_VERIFIED';
  }): ReferralConversion {
    const attribution = inMemoryReferralAttributions.get(params.leadId);
    if (!attribution) {
      throw new Error(`Attribution not found for leadId: ${params.leadId}`);
    }

    if (attribution.status === 'CONVERTED') {
      // Already converted
      const existingConversion = Array.from(inMemoryReferralConversions.values()).find(
        c => c.attributionId === attribution.id
      );
      if (existingConversion) return existingConversion;
    }

    // Advance attribution state
    attribution.status = 'CONVERTED';
    attribution.convertedAt = new Date().toISOString();
    attribution.orderId = params.orderId;
    attribution.auditTrail.push({
      event: `CONVERTED_VIA_${params.conversionEvent}`,
      timestamp: new Date().toISOString(),
      actor: params.referredUserId,
    });

    // Update referral code metric
    const codeRecord = inMemoryReferralCodes.get(attribution.referralCode);
    if (codeRecord) {
      codeRecord.conversionCount += 1;
    }

    // Strict Commission Policy Boundary:
    // Payouts and commission percentages remain unconfigured until institutional approval.
    // Zero financial transactions or payouts are triggered.
    const conversionId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const conversion: ReferralConversion = {
      id: conversionId,
      attributionId: attribution.id,
      referralCode: attribution.referralCode,
      referrerUserId: attribution.referrerUserId,
      referredUserId: params.referredUserId,
      courseId: params.courseId,
      orderId: params.orderId,
      conversionEvent: params.conversionEvent,
      convertedAt: new Date().toISOString(),
      commissionStatus: 'BLOCKED_PENDING_APPROVAL',
      commissionAmount: 0, // Unconfigured under freeze
    };

    inMemoryReferralConversions.set(conversionId, conversion);
    return conversion;
  }

  // --------------------------------------------------------------------------
  // Institutional Partners Management (Scoped Access)
  // --------------------------------------------------------------------------
  public registerPartner(params: {
    partnerName: string;
    partnerType: 'ACADEMIC' | 'CORPORATE' | 'AGENCY';
    contactEmail: string;
    contactPerson: string;
    agreementRef?: string;
    notes?: string;
  }): InstitutionalPartner {
    const partnerId = `partner-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const partnerCode = this.getOrCreateReferralCode(`user-${partnerId}`, params.partnerName);

    const partner: InstitutionalPartner = {
      id: partnerId,
      partnerName: params.partnerName,
      partnerType: params.partnerType,
      contactEmail: params.contactEmail,
      contactPerson: params.contactPerson,
      referralCodeId: partnerCode.id,
      status: 'ACTIVE',
      agreementRef: params.agreementRef,
      notes: params.notes,
      createdAt: new Date().toISOString(),
    };

    inMemoryPartners.set(partnerId, partner);
    return partner;
  }

  public getPartners(): InstitutionalPartner[] {
    return Array.from(inMemoryPartners.values());
  }

  // Partner portal statistics (strictly scoped: zero PII exposed)
  public getPartnerMetrics(partnerId: string): {
    totalClicks: number;
    totalConversions: number;
    partnerName: string;
  } {
    const partner = inMemoryPartners.get(partnerId);
    if (!partner) throw new Error('Partner not found');

    let totalClicks = 0;
    let totalConversions = 0;

    for (const code of inMemoryReferralCodes.values()) {
      if (code.id === partner.referralCodeId) {
        totalClicks += code.clickCount;
        totalConversions += code.conversionCount;
      }
    }

    return {
      partnerName: partner.partnerName,
      totalClicks,
      totalConversions,
    };
  }

  // --------------------------------------------------------------------------
  // Marketing Campaigns
  // --------------------------------------------------------------------------
  public createCampaign(campaign: InstitutionalCampaign): InstitutionalCampaign {
    inMemoryCampaigns.set(campaign.id, campaign);
    inMemoryCampaigns.set(campaign.slug, campaign);
    return campaign;
  }

  public getCampaigns(): InstitutionalCampaign[] {
    const map = new Map<string, InstitutionalCampaign>();
    for (const c of inMemoryCampaigns.values()) {
      map.set(c.id, c);
    }
    return Array.from(map.values());
  }

  // --------------------------------------------------------------------------
  // Alumni Networking & Privacy Governance
  // --------------------------------------------------------------------------
  public checkAlumniEligibility(studentId: string): { eligible: boolean; reason?: string } {
    // Must have at least 1 completed enrollment or issued certificate
    const hasCompletedCourse = Array.from(db.enrollments.values()).some(
      e => e.userId === studentId && e.status === 'COMPLETED'
    );

    const hasCertificate = Array.from(db.certificates.values()).some(
      c => (c.userId === studentId || (c as any).studentId === studentId) && (c.status === 'ISSUED' || (c as any).status === 'ISSUED')
    );

    if (!hasCompletedCourse && !hasCertificate) {
      return {
        eligible: false,
        reason: 'Alumni status requires verified completion of at least one Zealosh programme or credential',
      };
    }

    return { eligible: true };
  }

  public createOrUpdateAlumniProfile(
    studentId: string,
    profileData: {
      displayName: string;
      completedProgrammes: string[];
      verifiedCredentials: string[];
      industry: string;
      professionalTitle?: string;
      skills: string[];
      contactPreference?: 'PLATFORM_MESSAGE' | 'NONE';
      visibility?: 'ALUMNI_ONLY' | 'PUBLIC';
      isOptedIn: boolean;
    }
  ): AlumniProfile {
    const eligibility = this.checkAlumniEligibility(studentId);
    if (!eligibility.eligible) {
      throw new Error(`Ineligible for alumni profile: ${eligibility.reason}`);
    }

    const existing = inMemoryAlumniProfiles.get(studentId);
    const profileId = existing ? existing.id : `alum-${studentId}`;

    const profile: AlumniProfile = {
      id: profileId,
      studentId,
      displayName: profileData.displayName,
      completedProgrammes: profileData.completedProgrammes,
      verifiedCredentials: profileData.verifiedCredentials,
      industry: profileData.industry,
      professionalTitle: profileData.professionalTitle,
      skills: profileData.skills,
      contactPreference: profileData.contactPreference || 'PLATFORM_MESSAGE',
      visibility: profileData.visibility || 'ALUMNI_ONLY',
      isOptedIn: profileData.isOptedIn,
      consentAgreedAt: existing ? existing.consentAgreedAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryAlumniProfiles.set(studentId, profile);
    return profile;
  }

  public getAlumniDirectory(
    viewerUserId: string,
    filters?: { industry?: string; programme?: string }
  ): AlumniProfile[] {
    // Only return profiles where isOptedIn === true
    const profiles = Array.from(inMemoryAlumniProfiles.values()).filter(p => p.isOptedIn);

    return profiles.filter(p => {
      if (filters?.industry && !p.industry.toLowerCase().includes(filters.industry.toLowerCase())) {
        return false;
      }
      if (
        filters?.programme &&
        !p.completedProgrammes.some(prog => prog.toLowerCase().includes(filters.programme!.toLowerCase()))
      ) {
        return false;
      }
      return true;
    });
  }

  public deactivateAlumniProfile(studentId: string): AlumniProfile {
    const profile = inMemoryAlumniProfiles.get(studentId);
    if (!profile) {
      throw new Error(`Alumni profile not found for student: ${studentId}`);
    }

    profile.isOptedIn = false;
    profile.updatedAt = new Date().toISOString();
    return profile;
  }
}

export const referralGrowthService = new ReferralGrowthService();
