// Zealosh LMS — HSE Career Certification Roadmap Engine
// File: src/lib/career/career-pathway-service.ts
// Governs certification catalogues, multi-year career pathways, prerequisite verification,
// external exam tracking, and tutor guidance sharing.

import {
  Certification,
  CertificationCategory,
  CertificationStatus,
  CareerPathway,
  CareerPathwayStage,
  PathwayPrerequisite,
  StudentCareerPlan,
  StudentCareerMilestone,
  ExternalExamPlan,
  ExternalCredentialEvidence,
  CredentialVerificationStatus,
  PrerequisiteEvaluationResult,
  PrerequisiteEvaluationStatus,
} from '@/types';
import { db } from '@/lib/store/db';

export const inMemoryCertifications: Map<string, Certification> = new Map();
export const inMemoryCareerPathways: Map<string, CareerPathway> = new Map();
export const inMemoryStudentCareerPlans: Map<string, StudentCareerPlan> = new Map(); // studentId -> plan
export const inMemoryCredentialEvidence: Map<string, ExternalCredentialEvidence> = new Map();

export class CareerPathwayService {
  constructor() {
    this.seedDefaultCertificationsAndPathways();
  }

  // --------------------------------------------------------------------------
  // Seed Approved Institutional Certifications & Pathways
  // --------------------------------------------------------------------------
  private seedDefaultCertificationsAndPathways() {
    if (inMemoryCertifications.size === 0) {
      const certAsp: Certification = {
        id: 'cert-asp',
        name: 'Associate Safety Professional (ASP)',
        shortName: 'ASP',
        awardingOrg: 'Board of Certified Safety Professionals (BCSP)',
        category: 'BCSP',
        description: 'First credential in the BCSP progression covering fundamental safety, environmental, and occupational health practices.',
        sourceUrl: 'https://www.bcsp.org/asp',
        status: 'PUBLISHED',
        prerequisites: [
          {
            minimumDegreeLevel: 'BACHELORS',
            minimumExperienceYears: 1,
            description: 'Bachelor degree in any field or Associate in safety, plus 1 year of professional safety experience.',
          },
        ],
        renewalRequirements: 'Annual renewal fee and 25 recertification points every 5 years.',
        relatedCourseIds: ['crs-asp-01'],
        lastReviewedAt: '2026-11-01T00:00:00.000Z',
      };

      const certCsp: Certification = {
        id: 'cert-csp',
        name: 'Certified Safety Professional (CSP)',
        shortName: 'CSP',
        awardingOrg: 'Board of Certified Safety Professionals (BCSP)',
        category: 'BCSP',
        description: 'Gold-standard practitioner credential for occupational health and safety professionals worldwide.',
        sourceUrl: 'https://www.bcsp.org/csp',
        status: 'PUBLISHED',
        prerequisites: [
          {
            prerequisiteCertificationId: 'cert-asp',
            minimumDegreeLevel: 'BACHELORS',
            minimumExperienceYears: 4,
            description: 'BCSP ASP or qualifying credential + Bachelor degree + 4 years of professional safety experience.',
          },
        ],
        renewalRequirements: 'Annual renewal fee and 25 recertification points every 5 years.',
        relatedCourseIds: ['crs-csp-01'],
        lastReviewedAt: '2026-11-01T00:00:00.000Z',
      };

      const certCrsp: Certification = {
        id: 'cert-crsp',
        name: 'Canadian Registered Safety Professional (CRSP)',
        shortName: 'CRSP',
        awardingOrg: 'Board of Canadian Registered Safety Professionals (BCRSP)',
        category: 'CRSP',
        description: 'Internationally recognized Canadian professional health and safety designation.',
        sourceUrl: 'https://bcrsp.ca/en/crsp',
        status: 'PUBLISHED',
        prerequisites: [
          {
            minimumDegreeLevel: 'BACHELORS',
            minimumExperienceYears: 4,
            description: 'Bachelor degree + professional development coursework + 48 months of professional safety practice.',
          },
        ],
        renewalRequirements: 'Continuous professional development (CPD) points triennially.',
        relatedCourseIds: ['crs-crsp-01'],
        lastReviewedAt: '2026-11-01T00:00:00.000Z',
      };

      const certNebosh: Certification = {
        id: 'cert-nebosh-idip',
        name: 'NEBOSH International Diploma in Occupational Health and Safety',
        shortName: 'NEBOSH IDip',
        awardingOrg: 'National Examination Board in Occupational Safety and Health',
        category: 'NEBOSH',
        description: 'Premier British qualification for aspiring health and safety professionals and consultants.',
        sourceUrl: 'https://www.nebosh.org.uk',
        status: 'PUBLISHED',
        prerequisites: [
          {
            description: 'NEBOSH International General Certificate (IGC) or equivalent level 3 health and safety qualification recommended.',
          },
        ],
        renewalRequirements: 'Permanent accreditation upon successful completion of units.',
        relatedCourseIds: ['crs-nebosh-01'],
        lastReviewedAt: '2026-11-01T00:00:00.000Z',
      };

      inMemoryCertifications.set(certAsp.id, certAsp);
      inMemoryCertifications.set(certCsp.id, certCsp);
      inMemoryCertifications.set(certCrsp.id, certCrsp);
      inMemoryCertifications.set(certNebosh.id, certNebosh);
    }

    if (inMemoryCareerPathways.size === 0) {
      const aspCspCrspStages: CareerPathwayStage[] = [
        {
          id: 'stage-asp-01',
          pathwayId: 'path-hse-master',
          stageOrder: 1,
          title: 'Stage 1: Associate Safety Professional (ASP)',
          description: 'Build core foundation in safety science, environmental management, and emergency response.',
          certificationId: 'cert-asp',
          isOptional: false,
          estimatedMonths: 6,
          prerequisites: [
            {
              id: 'prereq-asp-course',
              type: 'ZEALOSH_COURSE',
              refId: 'crs-asp-01',
              title: 'Zealosh ASP Examination Prep Course',
              description: 'Complete 100% curriculum of Zealosh ASP prep course.',
              isMandatory: true,
            },
          ],
          relatedCourseIds: ['crs-asp-01'],
        },
        {
          id: 'stage-csp-02',
          pathwayId: 'path-hse-master',
          stageOrder: 2,
          title: 'Stage 2: Certified Safety Professional (CSP)',
          description: 'Advance to senior occupational safety leadership, advanced risk assessment, and system safety.',
          certificationId: 'cert-csp',
          isOptional: false,
          estimatedMonths: 12,
          prerequisites: [
            {
              id: 'prereq-csp-asp',
              type: 'EXTERNAL_CERTIFICATION',
              refId: 'cert-asp',
              title: 'BCSP ASP Certification',
              description: 'Hold active BCSP Associate Safety Professional credential.',
              isMandatory: true,
            },
            {
              id: 'prereq-csp-course',
              type: 'ZEALOSH_COURSE',
              refId: 'crs-csp-01',
              title: 'Zealosh CSP Examination Prep Course',
              description: 'Complete 100% curriculum of Zealosh CSP prep course.',
              isMandatory: true,
            },
          ],
          relatedCourseIds: ['crs-csp-01'],
        },
        {
          id: 'stage-crsp-03',
          pathwayId: 'path-hse-master',
          stageOrder: 3,
          title: 'Stage 3: Canadian Registered Safety Professional (CRSP)',
          description: 'Achieve dual international accreditation for North American and global enterprise compliance.',
          certificationId: 'cert-crsp',
          isOptional: true,
          estimatedMonths: 12,
          prerequisites: [
            {
              id: 'prereq-crsp-csp',
              type: 'EXTERNAL_CERTIFICATION',
              refId: 'cert-csp',
              title: 'BCSP Certified Safety Professional',
              description: 'Hold active CSP credential under BCRSP/BCSP memorandum.',
              isMandatory: false,
            },
          ],
          relatedCourseIds: ['crs-crsp-01'],
        },
      ];

      const masterPathway: CareerPathway = {
        id: 'path-hse-master',
        slug: 'asp-csp-crsp-progression',
        title: 'Global HSE Leadership Progression (ASP → CSP → CRSP)',
        description: 'Structured multi-year career progression from Associate Safety Professional through to Certified Safety Professional and Canadian Registered Safety Professional.',
        targetRole: 'Senior Safety Director / Enterprise HSE Consultant',
        version: 1,
        status: 'PUBLISHED',
        stages: aspCspCrspStages,
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
      };

      inMemoryCareerPathways.set(masterPathway.id, masterPathway);
      inMemoryCareerPathways.set(masterPathway.slug, masterPathway);
    }
  }

  // --------------------------------------------------------------------------
  // Certifications Catalogue
  // --------------------------------------------------------------------------
  public getCertifications(category?: CertificationCategory, status?: CertificationStatus): Certification[] {
    let certs = Array.from(inMemoryCertifications.values());
    if (category) {
      certs = certs.filter(c => c.category === category);
    }
    if (status) {
      certs = certs.filter(c => c.status === status);
    }
    return certs;
  }

  public getCertification(id: string): Certification | null {
    return inMemoryCertifications.get(id) || null;
  }

  public createCertification(cert: Certification): Certification {
    inMemoryCertifications.set(cert.id, cert);
    return cert;
  }

  // --------------------------------------------------------------------------
  // Career Pathways
  // --------------------------------------------------------------------------
  public getPathways(status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'): CareerPathway[] {
    // Deduplicate by ID (in case stored by both id and slug)
    const map = new Map<string, CareerPathway>();
    for (const p of inMemoryCareerPathways.values()) {
      if (!status || p.status === status) {
        map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }

  public getPathway(idOrSlug: string): CareerPathway | null {
    return inMemoryCareerPathways.get(idOrSlug) || null;
  }

  public createPathway(pathway: CareerPathway): CareerPathway {
    inMemoryCareerPathways.set(pathway.id, pathway);
    inMemoryCareerPathways.set(pathway.slug, pathway);
    return pathway;
  }

  public publishPathway(id: string): CareerPathway {
    const pathway = inMemoryCareerPathways.get(id);
    if (!pathway) {
      throw new Error(`Pathway not found: ${id}`);
    }
    pathway.status = 'PUBLISHED';
    pathway.updatedAt = new Date().toISOString();
    return pathway;
  }

  // --------------------------------------------------------------------------
  // Student Career Plans
  // --------------------------------------------------------------------------
  public getStudentPlan(studentId: string): StudentCareerPlan | null {
    return inMemoryStudentCareerPlans.get(studentId) || null;
  }

  public createOrUpdatePlan(params: {
    studentId: string;
    pathwayId: string;
    targetCompletionDate: string;
    notes?: string;
  }): StudentCareerPlan {
    const pathway = this.getPathway(params.pathwayId);
    if (!pathway) {
      throw new Error(`Pathway not found: ${params.pathwayId}`);
    }

    const existingPlan = inMemoryStudentCareerPlans.get(params.studentId);
    const planId = existingPlan ? existingPlan.id : `plan-${params.studentId}-${Date.now()}`;

    // Initialize milestones based on pathway stages
    const milestones: StudentCareerMilestone[] = pathway.stages.map((stage, idx) => {
      const existingMilestone = existingPlan?.milestones.find(m => m.stageId === stage.id);
      if (existingMilestone) {
        return existingMilestone;
      }

      // Calculate default target date based on estimatedMonths
      const stageDate = new Date();
      stageDate.setMonth(stageDate.getMonth() + (stage.estimatedMonths * (idx + 1)));

      return {
        id: `ms-${planId}-${stage.id}`,
        planId,
        stageId: stage.id,
        certificationId: stage.certificationId,
        targetDate: stageDate.toISOString().split('T')[0],
        status: 'PLANNED',
      };
    });

    const plan: StudentCareerPlan = {
      id: planId,
      studentId: params.studentId,
      pathwayId: pathway.id,
      pathwayVersion: pathway.version,
      status: 'ACTIVE',
      targetCompletionDate: params.targetCompletionDate,
      notes: params.notes,
      milestones,
      sharedWithTutorId: existingPlan?.sharedWithTutorId,
      tutorGuidanceNotes: existingPlan?.tutorGuidanceNotes,
      tutorGuidanceUpdatedAt: existingPlan?.tutorGuidanceUpdatedAt,
      createdAt: existingPlan ? existingPlan.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    inMemoryStudentCareerPlans.set(params.studentId, plan);
    return plan;
  }

  public updateMilestone(
    studentId: string,
    milestoneId: string,
    updates: {
      targetDate?: string;
      status?: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
      externalExamPlan?: ExternalExamPlan;
    }
  ): StudentCareerMilestone {
    const plan = inMemoryStudentCareerPlans.get(studentId);
    if (!plan) {
      throw new Error(`Career plan not found for student: ${studentId}`);
    }

    const milestone = plan.milestones.find(m => m.id === milestoneId);
    if (!milestone) {
      throw new Error(`Milestone not found: ${milestoneId}`);
    }

    if (updates.targetDate) milestone.targetDate = updates.targetDate;
    if (updates.status) {
      milestone.status = updates.status;
      if (updates.status === 'COMPLETED' && !milestone.completedAt) {
        milestone.completedAt = new Date().toISOString();
      }
    }
    if (updates.externalExamPlan) {
      milestone.externalExamPlan = updates.externalExamPlan;
    }

    plan.updatedAt = new Date().toISOString();
    return milestone;
  }

  // --------------------------------------------------------------------------
  // Prerequisite Evaluation Engine
  // --------------------------------------------------------------------------
  public evaluatePrerequisites(studentId: string, stageId: string): PrerequisiteEvaluationResult[] {
    // Find stage across pathways
    let targetStage: CareerPathwayStage | null = null;
    for (const pathway of this.getPathways()) {
      const stage = pathway.stages.find(s => s.id === stageId);
      if (stage) {
        targetStage = stage;
        break;
      }
    }

    if (!targetStage) {
      throw new Error(`Career pathway stage not found: ${stageId}`);
    }

    const results: PrerequisiteEvaluationResult[] = [];

    for (const prereq of targetStage.prerequisites) {
      let status: PrerequisiteEvaluationStatus = 'NOT_SATISFIED';
      let evidenceDetails: string | undefined;

      switch (prereq.type) {
        case 'ZEALOSH_COURSE': {
          // Check completed course enrollment in db
          const courseId = prereq.refId;
          const userEnrollments = Array.from(db.enrollments.values()).filter(
            e => e.userId === studentId && e.courseId === courseId
          );
          const completedEnrollment = userEnrollments.find(e => e.status === 'COMPLETED');
          if (completedEnrollment) {
            status = 'SATISFIED';
            evidenceDetails = `Verified course completion on enrollment: ${completedEnrollment.id}`;
          } else {
            status = 'NOT_SATISFIED';
            evidenceDetails = 'Course not completed or not enrolled';
          }
          break;
        }

        case 'ZEALOSH_CERTIFICATE': {
          const courseId = prereq.refId;
          const cert = Array.from(db.certificates.values()).find(
            c => (c.userId === studentId || (c as any).studentId === studentId) && (c.courseId === courseId || !courseId) && (c.status === 'ISSUED' || (c as any).status === 'ISSUED')
          );
          if (cert) {
            status = 'SATISFIED';
            evidenceDetails = `Verified Zealosh certificate: ${cert.certificateCode}`;
          } else {
            status = 'NOT_SATISFIED';
          }
          break;
        }

        case 'EXTERNAL_CERTIFICATION': {
          // Check external credential evidence
          const evidenceList = Array.from(inMemoryCredentialEvidence.values()).filter(
            ev => ev.studentId === studentId && ev.credentialName.toLowerCase().includes(prereq.refId?.toLowerCase() || '')
          );
          const verifiedEvidence = evidenceList.find(ev => ev.verificationStatus === 'VERIFIED');
          const underReviewEvidence = evidenceList.find(ev => ev.verificationStatus === 'UNDER_REVIEW' || ev.verificationStatus === 'SELF_REPORTED');

          if (verifiedEvidence) {
            status = 'SATISFIED';
            evidenceDetails = `Verified credential: ${verifiedEvidence.credentialName} (Issued by: ${verifiedEvidence.issuingBody})`;
          } else if (underReviewEvidence) {
            status = 'PENDING_VERIFICATION';
            evidenceDetails = 'Evidence submitted; pending reviewer verification';
          } else {
            status = 'EXTERNAL_CONFIRMATION_REQUIRED';
            evidenceDetails = 'Official external credential evidence required';
          }
          break;
        }

        default:
          status = 'EXTERNAL_CONFIRMATION_REQUIRED';
          break;
      }

      results.push({
        prerequisiteId: prereq.id,
        type: prereq.type,
        title: prereq.title,
        status,
        evidenceDetails,
      });
    }

    return results;
  }

  // --------------------------------------------------------------------------
  // Tutor Sharing & Guidance
  // --------------------------------------------------------------------------
  public sharePlanWithTutor(studentId: string, tutorId: string): StudentCareerPlan {
    const plan = inMemoryStudentCareerPlans.get(studentId);
    if (!plan) {
      throw new Error(`Plan not found for student: ${studentId}`);
    }

    plan.sharedWithTutorId = tutorId;
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  public revokeTutorSharing(studentId: string): StudentCareerPlan {
    const plan = inMemoryStudentCareerPlans.get(studentId);
    if (!plan) {
      throw new Error(`Plan not found for student: ${studentId}`);
    }

    plan.sharedWithTutorId = undefined;
    plan.updatedAt = new Date().toISOString();
    return plan;
  }

  public addTutorGuidance(tutorId: string, planId: string, guidanceNotes: string): StudentCareerPlan {
    // Find plan by ID
    let targetPlan: StudentCareerPlan | null = null;
    for (const plan of inMemoryStudentCareerPlans.values()) {
      if (plan.id === planId) {
        targetPlan = plan;
        break;
      }
    }

    if (!targetPlan) {
      throw new Error(`Career plan not found: ${planId}`);
    }

    // Access control: tutor must be the designated tutor or superadmin
    if (targetPlan.sharedWithTutorId !== tutorId) {
      throw new Error('Unauthorized: Plan has not been shared with this tutor');
    }

    targetPlan.tutorGuidanceNotes = guidanceNotes;
    targetPlan.tutorGuidanceUpdatedAt = new Date().toISOString();
    targetPlan.updatedAt = new Date().toISOString();
    return targetPlan;
  }

  // --------------------------------------------------------------------------
  // External Credential Evidence Verification
  // --------------------------------------------------------------------------
  public submitEvidence(evidence: Omit<ExternalCredentialEvidence, 'id' | 'createdAt' | 'verificationStatus'>): ExternalCredentialEvidence {
    const id = `ev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const fullEvidence: ExternalCredentialEvidence = {
      ...evidence,
      id,
      verificationStatus: 'UNDER_REVIEW',
      createdAt: new Date().toISOString(),
    };

    inMemoryCredentialEvidence.set(id, fullEvidence);

    // Link evidence to milestone if milestoneId supplied
    if (evidence.milestoneId) {
      const plan = inMemoryStudentCareerPlans.get(evidence.studentId);
      if (plan) {
        const milestone = plan.milestones.find(m => m.id === evidence.milestoneId);
        if (milestone) {
          milestone.evidenceId = id;
          milestone.status = 'IN_PROGRESS';
        }
      }
    }

    return fullEvidence;
  }

  public reviewEvidence(params: {
    evidenceId: string;
    reviewerId: string;
    decision: 'VERIFIED' | 'REJECTED';
    rejectionReason?: string;
    auditNotes?: string;
  }): ExternalCredentialEvidence {
    const evidence = inMemoryCredentialEvidence.get(params.evidenceId);
    if (!evidence) {
      throw new Error(`Evidence not found: ${params.evidenceId}`);
    }

    evidence.verificationStatus = params.decision;
    evidence.reviewedBy = params.reviewerId;
    evidence.reviewedAt = new Date().toISOString();
    evidence.rejectionReason = params.rejectionReason;
    evidence.auditNotes = params.auditNotes;

    // If verified and attached to milestone, advance milestone status
    if (params.decision === 'VERIFIED' && evidence.milestoneId) {
      const plan = inMemoryStudentCareerPlans.get(evidence.studentId);
      if (plan) {
        const milestone = plan.milestones.find(m => m.id === evidence.milestoneId);
        if (milestone) {
          milestone.status = 'COMPLETED';
          milestone.completedAt = new Date().toISOString();
        }
      }
    }

    return evidence;
  }

  public getEvidenceForStudent(studentId: string): ExternalCredentialEvidence[] {
    return Array.from(inMemoryCredentialEvidence.values()).filter(e => e.studentId === studentId);
  }
}

export const careerPathwayService = new CareerPathwayService();
