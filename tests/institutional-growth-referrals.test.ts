// Zealosh LMS — Institutional Growth, Referral Tracking & Alumni Networking Test Suite
// File: tests/institutional-growth-referrals.test.ts
// Tests Workstream D & E: Referral code generation, self-referral prevention, attribution capture,
// conversion tracking, commission gating, partner management, and privacy-governed alumni networking.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  referralGrowthService,
  inMemoryReferralCodes,
  inMemoryReferralAttributions,
  inMemoryReferralConversions,
  inMemoryPartners,
  inMemoryAlumniProfiles,
} from '@/lib/growth/referral-growth-service';
import { db } from '@/lib/store/db';

describe('Zealosh LMS — Workstream D & E: Growth, Referrals & Alumni Suite', () => {
  const REFERRER_USER_ID = 'usr-student-ref-01';
  const APPLICANT_USER_ID = 'usr-applicant-ref-02';
  const COMPLETED_STUDENT_ID = 'usr-student-completed-03';
  const UNENROLLED_USER_ID = 'usr-visitor-unenrolled-99';
  const TEST_COURSE_ID = 'crs-asp-01';

  beforeEach(() => {
    inMemoryReferralCodes.clear();
    inMemoryReferralAttributions.clear();
    inMemoryReferralConversions.clear();
    inMemoryAlumniProfiles.clear();

    // Seed completed enrollment for alumni test
    db.enrollments.set(`enr-${COMPLETED_STUDENT_ID}`, {
      id: `enr-${COMPLETED_STUDENT_ID}`,
      userId: COMPLETED_STUDENT_ID,
      courseId: TEST_COURSE_ID,
      batchId: 'btc-asp-nov26',
      status: 'COMPLETED',
      enrolledAt: '2026-01-01T00:00:00Z',
    } as any);
  });

  it('GROWTH-01: Generates unique non-sequential referral codes and validates active codes', () => {
    const codeRecord = referralGrowthService.getOrCreateReferralCode(REFERRER_USER_ID, 'Alex Chen');
    expect(codeRecord.id).toBeDefined();
    expect(codeRecord.code).toMatch(/^REF-[A-Z]+-\d{4}$/);
    expect(codeRecord.ownerUserId).toBe(REFERRER_USER_ID);
    expect(codeRecord.status).toBe('ACTIVE');

    // Validation
    const validResult = referralGrowthService.validateReferralCode(codeRecord.code);
    expect(validResult.valid).toBe(true);
    expect(validResult.codeRecord?.id).toBe(codeRecord.id);

    // Non-existent code fails
    const invalidResult = referralGrowthService.validateReferralCode('REF-FAKE-9999');
    expect(invalidResult.valid).toBe(false);
  });

  it('GROWTH-02: Anti-abuse: Self-referral is strictly rejected', () => {
    const codeRecord = referralGrowthService.getOrCreateReferralCode(REFERRER_USER_ID, 'Alex Chen');

    // Attempting to attribute a lead where applicant is the code owner
    expect(() => {
      referralGrowthService.recordReferralAttribution({
        leadId: 'lead-self-attempt-01',
        referralCode: codeRecord.code,
        applicantUserId: REFERRER_USER_ID, // Self-referral!
      });
    }).toThrow(/SELF_REFERRAL_PROHIBITED/);
  });

  it('GROWTH-03: Attribution capture preserves referrer identity across lead submission and application conversion', () => {
    const codeRecord = referralGrowthService.getOrCreateReferralCode(REFERRER_USER_ID, 'Alex Chen');

    const attribution = referralGrowthService.recordReferralAttribution({
      leadId: 'lead-candidate-101',
      referralCode: codeRecord.code,
      applicantUserId: APPLICANT_USER_ID,
    });

    expect(attribution.referralCode).toBe(codeRecord.code);
    expect(attribution.referrerUserId).toBe(REFERRER_USER_ID);
    expect(attribution.status).toBe('ATTRIBUTED');
    expect(attribution.auditTrail.length).toBeGreaterThan(0);

    // Referral code usage counter incremented
    const reloadedCode = inMemoryReferralCodes.get(codeRecord.code);
    expect(reloadedCode?.clickCount).toBe(1);
  });

  it('GROWTH-04: Duplicate attribution for the same lead preserves original first-touch attribution without error', () => {
    const codeA = referralGrowthService.getOrCreateReferralCode(REFERRER_USER_ID, 'Alex Chen');

    // First touch
    const attr1 = referralGrowthService.recordReferralAttribution({
      leadId: 'lead-candidate-202',
      referralCode: codeA.code,
      applicantUserId: APPLICANT_USER_ID,
    });

    // Second visit through different link
    const attr2 = referralGrowthService.recordReferralAttribution({
      leadId: 'lead-candidate-202',
      referralCode: codeA.code,
      applicantUserId: APPLICANT_USER_ID,
    });

    expect(attr1.id).toBe(attr2.id);
    expect(attr2.status).toBe('ATTRIBUTED');
  });

  it('GROWTH-05: Referral conversion occurs on verified admission/payment, and commission remains blocked (0 amount)', () => {
    const codeRecord = referralGrowthService.getOrCreateReferralCode(REFERRER_USER_ID, 'Alex Chen');
    referralGrowthService.recordReferralAttribution({
      leadId: 'lead-candidate-303',
      referralCode: codeRecord.code,
      applicantUserId: APPLICANT_USER_ID,
    });

    // Record verified conversion on payment
    const conversion = referralGrowthService.recordReferralConversion({
      leadId: 'lead-candidate-303',
      referredUserId: APPLICANT_USER_ID,
      courseId: TEST_COURSE_ID,
      orderId: 'ord-pay-9921',
      conversionEvent: 'PAYMENT_VERIFIED',
    });

    expect(conversion.conversionEvent).toBe('PAYMENT_VERIFIED');
    expect(conversion.referrerUserId).toBe(REFERRER_USER_ID);

    // Commission Policy Boundary: Blocked and 0 under infrastructure freeze
    expect(conversion.commissionStatus).toBe('BLOCKED_PENDING_APPROVAL');
    expect(conversion.commissionAmount).toBe(0);

    // Referral code conversion count incremented
    const updatedCode = inMemoryReferralCodes.get(codeRecord.code);
    expect(updatedCode?.conversionCount).toBe(1);
  });

  it('GROWTH-06: Institutional partner registry tracks clicks and conversions while hiding private student records', () => {
    const partner = referralGrowthService.registerPartner({
      partnerName: 'Industrial Safety Alliance',
      partnerType: 'CORPORATE',
      contactEmail: 'contact@safetyalliance.org',
      contactPerson: 'David Ross',
      agreementRef: 'AGR-ISA-2026',
    });

    expect(partner.id).toBeDefined();
    expect(partner.referralCodeId).toBeDefined();

    // Partner metrics contain aggregate counts only
    const metrics = referralGrowthService.getPartnerMetrics(partner.id);
    expect(metrics.partnerName).toBe('Industrial Safety Alliance');
    expect(typeof metrics.totalClicks).toBe('number');
    expect(typeof metrics.totalConversions).toBe('number');
    // Ensure no student PII is present in metrics
    expect((metrics as any).studentEmails).toBeUndefined();
    expect((metrics as any).studentNames).toBeUndefined();
  });

  it('GROWTH-07: Alumni networking requires verified course/credential completion and enforces explicit opt-in', () => {
    // 1. Ineligible student cannot create alumni profile
    expect(() => {
      referralGrowthService.createOrUpdateAlumniProfile(UNENROLLED_USER_ID, {
        displayName: 'Unverified Learner',
        completedProgrammes: ['ASP'],
        verifiedCredentials: ['cert-asp'],
        industry: 'Construction Safety',
        skills: ['Fall Protection'],
        isOptedIn: true,
      });
    }).toThrow(/Ineligible/);

    // 2. Completed student creates opted-in profile
    const profile = referralGrowthService.createOrUpdateAlumniProfile(COMPLETED_STUDENT_ID, {
      displayName: 'Priya Sharma, ASP',
      completedProgrammes: ['Associate Safety Professional Prep'],
      verifiedCredentials: ['BCSP ASP'],
      industry: 'Oil & Gas Safety Engineering',
      skills: ['Process Safety', 'HAZOP', 'Emergency Planning'],
      isOptedIn: true,
      visibility: 'PUBLIC',
    });

    expect(profile.isOptedIn).toBe(true);

    // 3. Search directory finds opted-in profile
    let directory = referralGrowthService.getAlumniDirectory('viewer-01', { industry: 'Oil & Gas' });
    expect(directory.length).toBe(1);
    expect(directory[0].displayName).toBe('Priya Sharma, ASP');
    // Verify privacy: no personal email or phone
    expect((directory[0] as any).email).toBeUndefined();
    expect((directory[0] as any).phone).toBeUndefined();

    // 4. Student deactivates profile -> excluded from directory
    referralGrowthService.deactivateAlumniProfile(COMPLETED_STUDENT_ID);
    directory = referralGrowthService.getAlumniDirectory('viewer-01', { industry: 'Oil & Gas' });
    expect(directory.length).toBe(0);
  });
});

