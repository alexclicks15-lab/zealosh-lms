// Zealosh LMS — Verified Student Reviews & Testimonials Test Suite
// File: tests/student-testimonials-reviews.test.ts
// Tests Workstream B: Student eligibility, review submission, granular consent matrix,
// moderation segregation of duties, public projection filtering, consent revocation, and achievement showcase posters.

import { describe, it, expect, beforeEach } from 'vitest';
import {
  testimonialService,
  inMemoryStudentReviews,
  inMemoryAchievementShowcases,
} from '@/lib/testimonials/testimonial-service';
import { db } from '@/lib/store/db';

describe('Zealosh LMS — Workstream B: Verified Student Reviews & Testimonials Suite', () => {
  const ELIGIBLE_STUDENT = 'usr-student-test-01';
  const UNENROLLED_STUDENT = 'usr-student-unenrolled-99';
  const MODERATOR_ADMIN = 'usr-admin-moderator-01';
  const TEST_COURSE_ID = 'crs-asp-01';

  beforeEach(() => {
    inMemoryStudentReviews.clear();
    inMemoryAchievementShowcases.clear();

    // Seed active enrollment for eligible student
    db.enrollments.set(`enr-${ELIGIBLE_STUDENT}-${TEST_COURSE_ID}`, {
      id: `enr-${ELIGIBLE_STUDENT}-${TEST_COURSE_ID}`,
      userId: ELIGIBLE_STUDENT,
      courseId: TEST_COURSE_ID,
      batchId: 'btc-asp-nov26',
      status: 'ACTIVE',
      enrolledAt: '2026-01-01T00:00:00Z',
    } as any);

    // Seed issued certificate for achievement showcase
    db.certificates.set(`cert-${ELIGIBLE_STUDENT}-${TEST_COURSE_ID}`, {
      id: `cert-${ELIGIBLE_STUDENT}-${TEST_COURSE_ID}`,
      userId: ELIGIBLE_STUDENT,
      courseId: TEST_COURSE_ID,
      certificateCode: 'ZEAL-2026-ASP-9821',
      certificationType: 'ASP',
      issueDate: '2026-11-01T00:00:00Z',
      status: 'ISSUED',
    } as any);
  });

  it('TESTIMONIAL-01: Eligible enrolled or completed student can submit a review with rating and category', () => {
    const review = testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'COURSE',
      rating: 5,
      reviewText: 'Outstanding instructor guidance and very realistic exam question bank.',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: true,
        allowPublicPhoto: true,
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: true,
        allowAchievementPoster: true,
        allowPromotionalCampaign: true,
      },
    });

    expect(review.id).toBeDefined();
    expect(review.submissionStatus).toBe('SUBMITTED');
    expect(review.rating).toBe(5);
    expect(review.consent.allowPublicTestimonial).toBe(true);
  });

  it('TESTIMONIAL-02: Ineligible non-enrolled student is rejected from submitting a review', () => {
    expect(() => {
      testimonialService.submitReview({
        studentId: UNENROLLED_STUDENT,
        studentName: 'Fake User',
        courseId: TEST_COURSE_ID,
        courseTitle: 'ASP Examination Prep',
        category: 'COURSE',
        rating: 5,
        reviewText: 'Fake review attempt by an unenrolled visitor.',
        consent: {
          consentVersion: '1.0',
          allowInternalFeedback: true,
          allowPublicTestimonial: true,
          allowPublicDisplayName: false,
          allowPublicPhoto: false,
          allowPublicVideo: false,
          allowCourseAssociation: false,
          allowSocialMedia: false,
          allowAchievementPoster: false,
          allowPromotionalCampaign: false,
        },
      });
    }).toThrow(/Ineligible/);
  });

  it('TESTIMONIAL-03: Granular consent matrix captures independent booleans for display name, photo, and marketing', () => {
    const review = testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'COURSE',
      rating: 4,
      reviewText: 'Very structured syllabus and thorough coverage of industrial hygiene.',
      mediaUrl: '/avatars/alex.jpg',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: false, // Mask name
        allowPublicPhoto: false, // Redact photo
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: false,
        allowAchievementPoster: true,
        allowPromotionalCampaign: false,
      },
    });

    expect(review.consent.allowInternalFeedback).toBe(true);
    expect(review.consent.allowPublicDisplayName).toBe(false);
    expect(review.consent.allowPublicPhoto).toBe(false);
    expect(review.consent.allowAchievementPoster).toBe(true);
  });

  it('TESTIMONIAL-04: Moderation workflow enforces segregation of duties and mandatory rejection reasons', () => {
    const review = testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'COURSE',
      rating: 5,
      reviewText: 'Great experience overall.',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: true,
        allowPublicPhoto: false,
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: false,
        allowAchievementPoster: false,
        allowPromotionalCampaign: false,
      },
    });

    // 1. Author attempting to approve their own review is blocked (Conflict of interest)
    expect(() => {
      testimonialService.moderateReview({
        reviewId: review.id,
        moderatorId: ELIGIBLE_STUDENT, // Same user!
        decision: 'APPROVED',
      });
    }).toThrow(/Conflict of interest/);

    // 2. Rejecting without a reason is blocked
    expect(() => {
      testimonialService.moderateReview({
        reviewId: review.id,
        moderatorId: MODERATOR_ADMIN,
        decision: 'REJECTED',
      });
    }).toThrow(/Mandatory rejection reason/);

    // 3. Authorized admin approves review
    const approved = testimonialService.moderateReview({
      reviewId: review.id,
      moderatorId: MODERATOR_ADMIN,
      decision: 'APPROVED',
      notes: 'Verified enrollment and genuine student feedback.',
    });
    expect(approved.submissionStatus).toBe('APPROVED');
    expect(approved.moderatedBy).toBe(MODERATOR_ADMIN);
  });

  it('TESTIMONIAL-05: Public testimonial projection exposes ONLY published + consented reviews, applying redactions', () => {
    // Review A: Real name permitted
    const reviewA = testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'COURSE',
      rating: 5,
      reviewText: 'Exceptional test prep experience.',
      mediaUrl: '/photos/alex.jpg',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: true,
        allowPublicPhoto: true,
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: true,
        allowAchievementPoster: true,
        allowPromotionalCampaign: true,
      },
    });
    testimonialService.moderateReview({
      reviewId: reviewA.id,
      moderatorId: MODERATOR_ADMIN,
      decision: 'PUBLISHED',
    });

    // Review B: Name masked, photo redacted
    const reviewB = testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'COURSE',
      rating: 4,
      reviewText: 'Constructive course modules and strong homework exercises.',
      mediaUrl: '/photos/alex.jpg',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: false, // Mask name
        allowPublicPhoto: false, // Redact photo
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: false,
        allowAchievementPoster: false,
        allowPromotionalCampaign: false,
      },
    });
    testimonialService.moderateReview({
      reviewId: reviewB.id,
      moderatorId: MODERATOR_ADMIN,
      decision: 'PUBLISHED',
    });

    const publicList = testimonialService.getPublicTestimonials(TEST_COURSE_ID);
    expect(publicList.length).toBe(2);

    const pubA = publicList.find(p => p.reviewId === reviewA.id);
    expect(pubA?.displayName).toBe('Alex Chen');
    expect(pubA?.mediaUrl).toBe('/photos/alex.jpg');

    const pubB = publicList.find(p => p.reviewId === reviewB.id);
    expect(pubB?.displayName).toBe('Verified Learner'); // Redacted!
    expect(pubB?.mediaUrl).toBeUndefined(); // Redacted!
  });

  it('TESTIMONIAL-06: Consent revocation immediately suppresses review from public projections', () => {
    const review = testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'COURSE',
      rating: 5,
      reviewText: 'Publish me then let me revoke.',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: true,
        allowPublicPhoto: false,
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: false,
        allowAchievementPoster: false,
        allowPromotionalCampaign: false,
      },
    });
    testimonialService.moderateReview({
      reviewId: review.id,
      moderatorId: MODERATOR_ADMIN,
      decision: 'PUBLISHED',
    });

    // Check visible before revocation
    let publicList = testimonialService.getPublicTestimonials(TEST_COURSE_ID);
    expect(publicList.some(p => p.reviewId === review.id)).toBe(true);

    // Student revokes consent
    testimonialService.revokeConsent(review.id, ELIGIBLE_STUDENT, 'Privacy preference changed');

    // Check suppressed after revocation
    publicList = testimonialService.getPublicTestimonials(TEST_COURSE_ID);
    expect(publicList.some(p => p.reviewId === review.id)).toBe(false);

    // Internal record retains audit history
    const stored = inMemoryStudentReviews.get(review.id);
    expect(stored?.submissionStatus).toBe('CONSENT_REVOKED');
    expect(stored?.consent.revokedAt).toBeDefined();
    expect(stored?.consent.revocationReason).toBe('Privacy preference changed');
  });

  it('TESTIMONIAL-07: Achievement showcase & poster generation checks verified course/certificate AND explicit student poster consent', () => {
    // 1. Submit review WITH poster consent
    testimonialService.submitReview({
      studentId: ELIGIBLE_STUDENT,
      studentName: 'Alex Chen',
      courseId: TEST_COURSE_ID,
      courseTitle: 'ASP Examination Prep',
      category: 'ACHIEVEMENT_STORY',
      rating: 5,
      reviewText: 'Passed my ASP certification with flying colors.',
      consent: {
        consentVersion: '1.0',
        allowInternalFeedback: true,
        allowPublicTestimonial: true,
        allowPublicDisplayName: true,
        allowPublicPhoto: false,
        allowPublicVideo: false,
        allowCourseAssociation: true,
        allowSocialMedia: true,
        allowAchievementPoster: true, // Consent granted!
        allowPromotionalCampaign: true,
      },
    });

    // Generate achievement showcase
    const showcase = testimonialService.generateAchievementShowcase({
      studentId: ELIGIBLE_STUDENT,
      courseId: TEST_COURSE_ID,
    });

    expect(showcase.id).toBeDefined();
    expect(showcase.certificateCode).toBe('ZEAL-2026-ASP-9821');
    expect(showcase.consentGranted).toBe(true);
    expect(showcase.posterImageUrl).toContain('.png');

    // If student has NOT completed course, generation must throw
    expect(() => {
      testimonialService.generateAchievementShowcase({
        studentId: UNENROLLED_STUDENT,
        courseId: TEST_COURSE_ID,
      });
    }).toThrow(/Cannot generate achievement showcase/);
  });
});

