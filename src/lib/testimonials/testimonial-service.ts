// Zealosh LMS — Verified Student Reviews & Testimonial Management
// File: src/lib/testimonials/testimonial-service.ts
// Governs verified student review submissions, granular consent management,
// administrative moderation, public testimonial projections, and achievement showcase posters.

import {
  StudentReview,
  ReviewCategory,
  ReviewSubmissionStatus,
  TestimonialConsentRecord,
  PublicTestimonial,
  AchievementShowcase,
} from '@/types';
import { db } from '@/lib/store/db';

export const inMemoryStudentReviews: Map<string, StudentReview> = new Map();
export const inMemoryAchievementShowcases: Map<string, AchievementShowcase> = new Map();

export interface SubmitReviewParams {
  studentId: string;
  studentName: string;
  courseId: string;
  courseTitle: string;
  instructorId?: string;
  instructorName?: string;
  category: ReviewCategory;
  rating: number; // 1 to 5
  reviewText: string;
  mediaUrl?: string;
  consent: Omit<TestimonialConsentRecord, 'id' | 'reviewId' | 'studentId' | 'agreedAt'>;
}

export class TestimonialService {
  constructor() {
    this.seedDefaultTestimonials();
  }

  // --------------------------------------------------------------------------
  // Seed Default Verified Testimonials
  // --------------------------------------------------------------------------
  private seedDefaultTestimonials() {
    if (inMemoryStudentReviews.size === 0) {
      const review1Id = 'rev-asp-seed-01';
      const review1: StudentReview = {
        id: review1Id,
        studentId: 'usr-student-01',
        studentName: 'Alex Chen',
        courseId: 'crs-asp-01',
        courseTitle: 'Associate Safety Professional (ASP) Examination Prep',
        instructorId: 'usr-inst-asp',
        instructorName: 'Dr. Rajesh Nair, CSP',
        category: 'COURSE',
        rating: 5,
        reviewText: 'The psychometric mock exams and live sessions at Zealosh gave me the exact confidence needed to pass the BCSP ASP examination on my first attempt.',
        mediaUrl: '/testimonials/alex-chen.jpg',
        submissionStatus: 'PUBLISHED',
        consent: {
          id: `con-${review1Id}`,
          reviewId: review1Id,
          studentId: 'usr-student-01',
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
          agreedAt: '2026-11-01T00:00:00.000Z',
        },
        moderatedBy: 'usr-super-admin',
        moderatedAt: '2026-11-02T00:00:00.000Z',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-02T00:00:00.000Z',
      };

      const review2Id = 'rev-csp-seed-02';
      const review2: StudentReview = {
        id: review2Id,
        studentId: 'usr-student-02',
        studentName: 'Fatima Al-Mansoor',
        courseId: 'crs-csp-01',
        courseTitle: 'Certified Safety Professional (CSP) Comprehensive Masterclass',
        instructorId: 'usr-inst-csp',
        instructorName: 'Sarah Jenkins, CSP, CRSP',
        category: 'ACHIEVEMENT_STORY',
        rating: 5,
        reviewText: 'From ASP to CSP, Zealosh roadmap structure kept me disciplined through 18 months of rigorous safety management training.',
        mediaUrl: '/testimonials/fatima.jpg',
        submissionStatus: 'PUBLISHED',
        consent: {
          id: `con-${review2Id}`,
          reviewId: review2Id,
          studentId: 'usr-student-02',
          consentVersion: '1.0',
          allowInternalFeedback: true,
          allowPublicTestimonial: true,
          allowPublicDisplayName: false, // Mask name per consent
          allowPublicPhoto: false,
          allowPublicVideo: false,
          allowCourseAssociation: true,
          allowSocialMedia: false,
          allowAchievementPoster: false,
          allowPromotionalCampaign: false,
          agreedAt: '2026-11-03T00:00:00.000Z',
        },
        moderatedBy: 'usr-super-admin',
        moderatedAt: '2026-11-04T00:00:00.000Z',
        createdAt: '2026-11-03T00:00:00.000Z',
        updatedAt: '2026-11-04T00:00:00.000Z',
      };

      inMemoryStudentReviews.set(review1.id, review1);
      inMemoryStudentReviews.set(review2.id, review2);
    }
  }

  // --------------------------------------------------------------------------
  // Eligibility Evaluation
  // --------------------------------------------------------------------------
  public checkEligibility(studentId: string, courseId: string): { eligible: boolean; reason?: string } {
    // Check if student has valid enrollment for this course
    const enrollments = Array.from(db.enrollments.values()).filter(
      e => e.userId === studentId && e.courseId === courseId
    );

    if (enrollments.length === 0) {
      return { eligible: false, reason: 'Candidate is not enrolled in this course' };
    }

    const hasActiveOrCompleted = enrollments.some(
      e => e.status === 'ACTIVE' || e.status === 'COMPLETED'
    );

    if (!hasActiveOrCompleted) {
      return { eligible: false, reason: 'Enrollment is not in an active or completed state' };
    }

    return { eligible: true };
  }

  // --------------------------------------------------------------------------
  // Review Submission with Granular Consent
  // --------------------------------------------------------------------------
  public submitReview(params: SubmitReviewParams): StudentReview {
    // Verify eligibility from authoritative records
    const eligibility = this.checkEligibility(params.studentId, params.courseId);
    if (!eligibility.eligible) {
      throw new Error(`Ineligible to submit review: ${eligibility.reason}`);
    }

    if (params.rating < 1 || params.rating > 5) {
      throw new Error('Rating must be an integer between 1 and 5');
    }

    if (!params.reviewText || params.reviewText.trim().length < 10) {
      throw new Error('Review text must be at least 10 characters long');
    }

    if (!params.consent.allowInternalFeedback) {
      throw new Error('Consent to internal feedback storage is required to submit a review');
    }

    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const consentRecord: TestimonialConsentRecord = {
      ...params.consent,
      id: `con-${reviewId}`,
      reviewId,
      studentId: params.studentId,
      consentVersion: params.consent.consentVersion || '1.0',
      agreedAt: new Date().toISOString(),
    };

    const review: StudentReview = {
      id: reviewId,
      studentId: params.studentId,
      studentName: params.studentName,
      courseId: params.courseId,
      courseTitle: params.courseTitle,
      instructorId: params.instructorId,
      instructorName: params.instructorName,
      category: params.category,
      rating: params.rating,
      reviewText: params.reviewText.trim(),
      mediaUrl: params.mediaUrl,
      submissionStatus: 'SUBMITTED',
      consent: consentRecord,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryStudentReviews.set(reviewId, review);
    return review;
  }

  // --------------------------------------------------------------------------
  // Moderation Workflow
  // --------------------------------------------------------------------------
  public moderateReview(params: {
    reviewId: string;
    moderatorId: string;
    decision: 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'HIDDEN';
    notes?: string;
    rejectionReason?: string;
  }): StudentReview {
    const review = inMemoryStudentReviews.get(params.reviewId);
    if (!review) {
      throw new Error(`Review not found: ${params.reviewId}`);
    }

    // Segregation of duties: author cannot approve their own review
    if (review.studentId === params.moderatorId) {
      throw new Error('Conflict of interest: Authors cannot moderate or approve their own reviews');
    }

    if (params.decision === 'REJECTED' && !params.rejectionReason) {
      throw new Error('Mandatory rejection reason required when rejecting a review');
    }

    review.submissionStatus = params.decision;
    review.moderatedBy = params.moderatorId;
    review.moderatedAt = new Date().toISOString();
    review.moderationNotes = params.notes;
    review.rejectionReason = params.rejectionReason;
    review.updatedAt = new Date().toISOString();

    return review;
  }

  // --------------------------------------------------------------------------
  // Public Testimonials Projection (Zero Unconsented Exposure)
  // --------------------------------------------------------------------------
  public getPublicTestimonials(courseId?: string, category?: ReviewCategory): PublicTestimonial[] {
    const reviews = Array.from(inMemoryStudentReviews.values());
    const publicReviews: PublicTestimonial[] = [];

    for (const r of reviews) {
      // Must be PUBLISHED
      if (r.submissionStatus !== 'PUBLISHED') continue;

      // Must have active, unrevoked consent for public testimonial
      if (!r.consent.allowPublicTestimonial || r.consent.revokedAt) continue;

      if (courseId && r.courseId !== courseId) continue;
      if (category && r.category !== category) continue;

      // Granular consent redaction
      const displayName = r.consent.allowPublicDisplayName ? r.studentName : 'Verified Learner';
      const mediaUrl = r.consent.allowPublicPhoto ? r.mediaUrl : undefined;
      const courseTitle = r.consent.allowCourseAssociation ? r.courseTitle : undefined;

      publicReviews.push({
        id: `pub-${r.id}`,
        reviewId: r.id,
        category: r.category,
        rating: r.rating,
        reviewText: r.reviewText,
        displayName,
        courseTitle,
        mediaUrl,
        publishedAt: r.moderatedAt || r.updatedAt,
        verifiedStudent: true,
      });
    }

    return publicReviews;
  }

  // --------------------------------------------------------------------------
  // Consent Revocation Workflow
  // --------------------------------------------------------------------------
  public revokeConsent(reviewId: string, studentId: string, reason?: string): StudentReview {
    const review = inMemoryStudentReviews.get(reviewId);
    if (!review) {
      throw new Error(`Review not found: ${reviewId}`);
    }

    if (review.studentId !== studentId) {
      throw new Error('Unauthorized: Only the review author can revoke publication consent');
    }

    review.consent.revokedAt = new Date().toISOString();
    review.consent.revokedBy = studentId;
    review.consent.revocationReason = reason || 'Revoked by student';
    review.submissionStatus = 'CONSENT_REVOKED';
    review.updatedAt = new Date().toISOString();

    return review;
  }

  // --------------------------------------------------------------------------
  // Achievement Showcase & Poster Generation
  // --------------------------------------------------------------------------
  public generateAchievementShowcase(params: {
    studentId: string;
    courseId: string;
  }): AchievementShowcase {
    // Verify student has verified certificate or completed enrollment
    const cert = Array.from(db.certificates.values()).find(
      c => (c.userId === params.studentId || (c as any).studentId === params.studentId) && c.courseId === params.courseId && (c.status === 'ISSUED' || (c as any).status === 'ISSUED')
    );

    const enrollment = Array.from(db.enrollments.values()).find(
      e => e.userId === params.studentId && e.courseId === params.courseId && e.status === 'COMPLETED'
    );

    if (!cert && !enrollment) {
      throw new Error('Cannot generate achievement showcase: Student has not completed this course');
    }

    // Check student consent for achievement poster
    const studentReviews = Array.from(inMemoryStudentReviews.values()).filter(
      r => r.studentId === params.studentId && r.courseId === params.courseId
    );
    const hasConsent = studentReviews.some(
      r => r.consent.allowAchievementPoster && !r.consent.revokedAt
    );

    if (!hasConsent) {
      throw new Error('Explicit student consent is required to generate a public achievement showcase');
    }

    const course = db.courses.get(params.courseId);
    const user = db.users.get(params.studentId);
    const certificateCode = cert ? cert.certificateCode : `ZEAL-ACCRED-${Date.now()}`;
    const displayName = user?.name || 'Verified Learner';
    const courseTitle = course?.title || 'HSE Certification Programme';
    const certDate = cert?.issueDate || (cert as any)?.issuedAt;
    const completionDate = certDate ? String(certDate).split('T')[0] : new Date().toISOString().split('T')[0];

    const showcaseId = `showcase-${params.studentId}-${params.courseId}`;
    const showcase: AchievementShowcase = {
      id: showcaseId,
      studentId: params.studentId,
      displayName,
      courseTitle,
      certificateCode,
      completionDate,
      scoreAchieved: (cert as any)?.scoreAchieved || 85,
      posterImageUrl: `/showcases/${showcaseId}.png`,
      consentGranted: true,
      publishedAt: new Date().toISOString(),
    };

    inMemoryAchievementShowcases.set(showcaseId, showcase);
    return showcase;
  }

  public getReviewsForStudent(studentId: string): StudentReview[] {
    return Array.from(inMemoryStudentReviews.values()).filter(r => r.studentId === studentId);
  }

  public getAllReviewsForAdmin(): StudentReview[] {
    return Array.from(inMemoryStudentReviews.values());
  }
}

export const testimonialService = new TestimonialService();
