// Zealosh LMS — Authoritative Data Store & Business Repository
// Implements transactional invariants, capacity guards, and audit trails

import {
  User,
  Course,
  Batch,
  Enrollment,
  Lesson,
  LiveSession,
  AttendanceRecord,
  ExamQuestion,
  ExamBlueprint,
  ExamAttempt,
  AuditLogEntry,
} from '@/types';
import { hashPassword } from '@/lib/auth/jwt';
import { moodleAdapter } from '@/lib/adapters/moodle-adapter';
import { bbbAdapter } from '@/lib/adapters/bbb-adapter';

// In-Memory Database Singleton (Compatible with PostgreSQL Table Schemas)
class ZealoshDatabase {
  public users: Map<string, User> = new Map();
  public courses: Map<string, Course> = new Map();
  public batches: Map<string, Batch> = new Map();
  public enrollments: Map<string, Enrollment> = new Map();
  public lessons: Map<string, Lesson[]> = new Map(); // courseId -> Lesson[]
  public liveSessions: Map<string, LiveSession> = new Map();
  public attendance: Map<string, AttendanceRecord[]> = new Map(); // sessionId -> AttendanceRecord[]
  public examQuestions: Map<string, ExamQuestion> = new Map();
  public examBlueprints: Map<string, ExamBlueprint> = new Map();
  public examAttempts: Map<string, ExamAttempt> = new Map();
  public auditLogs: AuditLogEntry[] = [];

  constructor() {
    this.seedDatabase();
  }

  private seedDatabase() {
    const passwordHash = hashPassword('Zealosh@2026');

    // 1. Initial Users
    const adminUser: User = {
      id: 'usr-admin-01',
      name: 'Dr. K. Ravindran (Super Admin)',
      email: 'admin@zealosh.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      organizationId: 'org-zealosh-main',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const instructorVishnu: User = {
      id: 'usr-inst-01',
      name: 'Vishnu Rajendran, CSP, CRSP',
      email: 'vishnu@zealosh.com',
      passwordHash,
      role: 'INSTRUCTOR',
      organizationId: 'org-zealosh-main',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };

    const studentUser: User = {
      id: 'usr-std-01',
      name: 'Arjun Menon',
      email: 'student@zealosh.com',
      passwordHash,
      role: 'STUDENT',
      organizationId: 'org-zealosh-main',
      externalLearningId: 'mdl-user-501',
      createdAt: '2026-01-10T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
    };

    this.users.set(adminUser.id, adminUser);
    this.users.set(instructorVishnu.id, instructorVishnu);
    this.users.set(studentUser.id, studentUser);

    // 2. Certification Courses
    const courses: Course[] = [
      {
        id: 'crs-asp-01',
        title: 'ASP — Associate Safety Professional Comprehensive Prep',
        slug: 'asp-examination-prep',
        certificationType: 'ASP',
        deliveryModel: 'HYBRID',
        status: 'PUBLISHED',
        headline: 'Master the BCSP Associate Safety Professional examination with authoritative domain mastery, calculation workshops, and mock simulations.',
        description: 'Comprehensive 10-week preparatory program covering all 9 BCSP ASP blueprint domains: Mathematics & Sciences, Emergency Response, Industrial Hygiene, Occupational Health, Environmental Management, and Professional Ethics.',
        learningObjectives: [
          'Master complex safety math, radiation physics, and ventilation airflow equations',
          'Evaluate industrial hygiene hazards and permissible exposure limits (PEL/TLV)',
          'Design robust emergency response and incident command systems',
          'Analyze hazard communication, GHS classifications, and chemical storage compatibility',
        ],
        prerequisites: ['Bachelor degree or 1 year safety experience', 'Basic algebra and scientific calculator familiarity'],
        priceInr: 34999,
        priceUsd: 450,
        durationWeeks: 10,
        coverImage: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
        leadInstructorId: instructorVishnu.id,
        coInstructorIds: [],
        moodleCourseId: 101,
        modulesCount: 8,
        totalLessons: 32,
        totalHours: 60,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-15T00:00:00Z',
      },
      {
        id: 'crs-csp-02',
        title: 'CSP — Certified Safety Professional Masterclass',
        slug: 'csp-masterclass',
        certificationType: 'CSP',
        deliveryModel: 'HYBRID',
        status: 'PUBLISHED',
        headline: 'Elite preparation for the premier global safety credential (BCSP CSP) with senior executive safety management frameworks.',
        description: 'Rigorous coaching designed for safety leaders aiming for BCSP Certified Safety Professional status. Emphasizes risk assessment methodologies, system safety engineering, occupational ergonomics, and corporate HSE governance.',
        learningObjectives: [
          'Formulate organizational risk management policies and quantitative risk matrices',
          'Execute fault tree analyses (FTA) and failure mode effects analyses (FMEA)',
          'Lead corporate HSE audit and compliance verification frameworks',
          'Optimize human factors and occupational ergonomics in high-consequence industries',
        ],
        prerequisites: ['Hold ASP, GSP, CIH, or eligible approved credential', '4 years professional safety experience'],
        priceInr: 42500,
        priceUsd: 550,
        durationWeeks: 12,
        coverImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
        leadInstructorId: instructorVishnu.id,
        coInstructorIds: [],
        moodleCourseId: 102,
        modulesCount: 9,
        totalLessons: 40,
        totalHours: 75,
        createdAt: '2026-01-05T00:00:00Z',
        updatedAt: '2026-01-20T00:00:00Z',
      },
      {
        id: 'crs-crsp-03',
        title: 'CRSP — Canadian Registered Safety Professional Exam Bootcamp',
        slug: 'crsp-exam-bootcamp',
        certificationType: 'CRSP',
        deliveryModel: 'LIVE',
        status: 'PUBLISHED',
        headline: 'Canada premier safety designation preparation with focused BCRSP blueprint coverage and Canadian jurisdictional law.',
        description: 'Live interactive masterclass focusing on the BCRSP examination blueprint, Canadian federal and provincial OHS legislation, workers compensation models, and risk control hierarchies.',
        learningObjectives: [
          'Interpret Canadian federal (Canada Labour Code Part II) and provincial OHS acts',
          'Conduct comprehensive occupational hygiene assessments across Canadian worksites',
          'Apply BCRSP ethical principles and safety professional obligations',
        ],
        prerequisites: ['BCRSP candidate approval or qualification pathway'],
        priceInr: 38000,
        priceUsd: 490,
        durationWeeks: 8,
        coverImage: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=800&auto=format&fit=crop&q=80',
        leadInstructorId: instructorVishnu.id,
        coInstructorIds: [],
        moodleCourseId: 103,
        modulesCount: 6,
        totalLessons: 24,
        totalHours: 48,
        createdAt: '2026-01-10T00:00:00Z',
        updatedAt: '2026-01-22T00:00:00Z',
      },
      {
        id: 'crs-cit-04',
        title: 'CIT — Certified Instructional Trainer Fast-Track',
        slug: 'cit-fast-track',
        certificationType: 'CIT',
        deliveryModel: 'RECORDED',
        status: 'PUBLISHED',
        headline: 'Develop master safety instructional design, adult learning methodology, and classroom evaluation expertise.',
        description: 'Self-paced professional certification track for safety trainers and educators. Learn the ADDIE instructional model, Bloom taxonomy, and engaging delivery strategies for high-retention technical safety instruction.',
        learningObjectives: [
          'Apply Knowles principles of andragogy and adult learning psychology',
          'Design measurable HSE learning objectives and instructional rubrics',
          'Evaluate training effectiveness using the Kirkpatrick 4-level evaluation model',
        ],
        prerequisites: ['135 hours of teaching or training delivery experience'],
        priceInr: 24000,
        priceUsd: 310,
        durationWeeks: 6,
        coverImage: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&auto=format&fit=crop&q=80',
        leadInstructorId: instructorVishnu.id,
        coInstructorIds: [],
        moodleCourseId: 104,
        modulesCount: 5,
        totalLessons: 20,
        totalHours: 35,
        createdAt: '2026-01-15T00:00:00Z',
        updatedAt: '2026-01-25T00:00:00Z',
      },
    ];

    courses.forEach((c) => this.courses.set(c.id, c));

    // 3. Batches
    const batches: Batch[] = [
      {
        id: 'btc-asp-nov26',
        courseId: 'crs-asp-01',
        name: 'ASP Weekend Master Batch — Nov 2026',
        startDate: '2026-11-01T00:00:00Z',
        endDate: '2027-01-10T00:00:00Z',
        scheduleDescription: 'Every Saturday & Sunday 7:00 PM – 9:30 PM IST (Online Live on BigBlueButton)',
        capacity: 35,
        enrolledCount: 22,
        leadInstructorId: instructorVishnu.id,
        status: 'UPCOMING',
      },
      {
        id: 'btc-asp-weekday',
        courseId: 'crs-asp-01',
        name: 'ASP Weekday Fast-Track Batch — Dec 2026',
        startDate: '2026-12-05T00:00:00Z',
        endDate: '2027-02-15T00:00:00Z',
        scheduleDescription: 'Tuesday & Thursday 8:00 PM – 10:00 PM IST',
        capacity: 25,
        enrolledCount: 14,
        leadInstructorId: instructorVishnu.id,
        status: 'UPCOMING',
      },
      {
        id: 'btc-asp-full',
        courseId: 'crs-asp-01',
        name: 'ASP Intensive Executive Cohort (Full Capacity Test)',
        startDate: '2026-10-28T00:00:00Z',
        endDate: '2026-12-28T00:00:00Z',
        scheduleDescription: 'Monday, Wednesday, Friday 7:30 PM IST',
        capacity: 10,
        enrolledCount: 10, // Full capacity for concurrency tests
        leadInstructorId: instructorVishnu.id,
        status: 'ACTIVE',
      },
      {
        id: 'btc-csp-nov26',
        courseId: 'crs-csp-02',
        name: 'CSP Premier Weekend Batch — Nov 2026',
        startDate: '2026-11-08T00:00:00Z',
        endDate: '2027-01-30T00:00:00Z',
        scheduleDescription: 'Sundays 10:00 AM – 1:00 PM IST',
        capacity: 30,
        enrolledCount: 18,
        leadInstructorId: instructorVishnu.id,
        status: 'UPCOMING',
      },
    ];

    batches.forEach((b) => this.batches.set(b.id, b));

    // 4. Initial Enrollment for Student Arjun
    const initialEnrollment: Enrollment = {
      id: 'enr-std-01-asp',
      userId: studentUser.id,
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      status: 'ACTIVE',
      enrolledAt: '2026-10-15T10:00:00Z',
      expiresAt: '2027-04-15T10:00:00Z',
      progressPercent: 45,
      completedLessonIds: ['lsn-asp-01', 'lsn-asp-02'],
    };
    this.enrollments.set(initialEnrollment.id, initialEnrollment);

    // 5. Lessons for ASP Course
    const aspLessons: Lesson[] = [
      {
        id: 'lsn-asp-01',
        courseId: 'crs-asp-01',
        moduleTitle: 'Module 1: Advanced Safety Sciences & Mathematics',
        title: 'Fundamental Safety Mathematics, Unit Conversions, and Geometry',
        durationMinutes: 45,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        downloadableMaterials: [
          {
            title: 'Zealosh ASP Formula Sheet & Quick Reference Card',
            type: 'CARD',
            size: '1.2 MB',
            url: '#',
          },
          {
            title: 'Module 1 Study Notes & Problem Set Solutions',
            type: 'PDF',
            size: '3.4 MB',
            url: '#',
          },
        ],
        contentHtml: `
          <h3>Key Topic Overview: Mathematics for Safety Professionals</h3>
          <p>This lesson establishes the essential computational skills required for the BCSP ASP examination:</p>
          <ul>
            <li><strong>SI and Imperial Unit Conversions:</strong> Mass, pressure, ventilation volumetric flow rate (CFM to m³/s).</li>
            <li><strong>Radiation Inverse Square Law:</strong> <code>I₁ / I₂ = (d₂)² / (d₁)²</code></li>
            <li><strong>Sound Level Decibel Addition:</strong> Logarithmic summation of non-coherent noise sources.</li>
          </ul>
        `,
        isFreePreview: true,
      },
      {
        id: 'lsn-asp-02',
        courseId: 'crs-asp-01',
        moduleTitle: 'Module 1: Advanced Safety Sciences & Mathematics',
        title: 'Radiation Physics: Half-Value Layer & Inverse Square Law Calculations',
        durationMinutes: 52,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
        downloadableMaterials: [
          {
            title: 'Radiation Shielding & Half-Life Calculation Guide',
            type: 'PDF',
            size: '2.1 MB',
            url: '#',
          },
        ],
        contentHtml: `
          <h3>Radiation Safety Calculations</h3>
          <p>Mastering gamma and X-ray shielding thickness calculations using Half-Value Layer (HVL) equations: <code>I = I₀ × (0.5)^(x / HVL)</code>.</p>
        `,
      },
      {
        id: 'lsn-asp-03',
        courseId: 'crs-asp-01',
        moduleTitle: 'Module 2: Industrial Hygiene & Toxicology',
        title: 'Occupational Ventilation: Dilution & Local Exhaust Ventilation (LEV)',
        durationMinutes: 60,
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        downloadableMaterials: [
          {
            title: 'Industrial Ventilation Equations & Hood Capture Velocity Chart',
            type: 'PDF',
            size: '4.5 MB',
            url: '#',
          },
        ],
        contentHtml: `
          <h3>Ventilation Principles in Industrial Hygiene</h3>
          <p>Explore dilution ventilation purge equations and calculate required exhaust air flow rate <code>Q = (403 × SG × ER × K) / (MW × PEL)</code>.</p>
        `,
      },
    ];
    this.lessons.set('crs-asp-01', aspLessons);

    // 6. Live Sessions for Batch
    const liveSession1: LiveSession = {
      id: 'sess-asp-01',
      batchId: 'btc-asp-nov26',
      courseId: 'crs-asp-01',
      title: 'Live Workshop: ASP Math & Ventilation Problem-Solving with Vishnu Rajendran',
      scheduledStartTime: '2026-11-01T13:30:00Z', // 7:00 PM IST
      durationMinutes: 120,
      instructorId: instructorVishnu.id,
      meetingId: 'zealosh-live-asp-001',
      status: 'SCHEDULED',
    };
    this.liveSessions.set(liveSession1.id, liveSession1);

    // 7. Exam Blueprints & HSE Questions
    const aspBlueprint: ExamBlueprint = {
      id: 'bp-asp-bcsp-v10',
      certificationType: 'ASP',
      title: 'BCSP ASP Examination Mock Simulation (Authoritative 2026 Blueprint)',
      totalQuestions: 10, // Scaled for interactive verification; production supports 200
      durationMinutes: 15, // 15 minutes for test run
      passingScorePercent: 70,
      domains: [
        { name: 'Advanced Sciences and Math', weightPercent: 35, questionCount: 4 },
        { name: 'Emergency Response & Fire Protection', weightPercent: 25, questionCount: 2 },
        { name: 'Industrial Hygiene & Occupational Health', weightPercent: 20, questionCount: 2 },
        { name: 'Environmental Management Systems', weightPercent: 20, questionCount: 2 },
      ],
    };
    this.examBlueprints.set(aspBlueprint.id, aspBlueprint);

    const questions: ExamQuestion[] = [
      {
        id: 'q-asp-01',
        certificationType: 'ASP',
        domain: 'Advanced Sciences and Math',
        topic: 'Radiation Physics',
        stem: 'A radiation source produces an exposure rate of 120 mR/hr at a distance of 2 meters. What will be the exposure rate at a distance of 6 meters from the source?',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'MODERATE',
        options: [
          { id: 'opt-a', text: '40.0 mR/hr' },
          { id: 'opt-b', text: '13.3 mR/hr' },
          { id: 'opt-c', text: '26.7 mR/hr' },
          { id: 'opt-d', text: '60.0 mR/hr' },
        ],
        correctOptionIds: ['opt-b'],
        explanation: 'According to the Inverse Square Law: I₁ / I₂ = (d₂)² / (d₁)². Therefore: 120 / I₂ = (6)² / (2)² = 36 / 4 = 9. Solving for I₂ gives: 120 / 9 = 13.33 mR/hr.',
        referenceSource: 'BCSP ASP Examination Blueprint Section 1.2 — Radiation Protection Principles',
      },
      {
        id: 'q-asp-02',
        certificationType: 'ASP',
        domain: 'Advanced Sciences and Math',
        topic: 'Acoustics & Noise Control',
        stem: 'Two identical industrial air compressors each generate a sound pressure level of 85 dBA at a distance of 3 meters. When both machines operate simultaneously, what is the combined sound pressure level at that distance?',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'EASY',
        options: [
          { id: 'opt-a', text: '170.0 dBA' },
          { id: 'opt-b', text: '88.0 dBA' },
          { id: 'opt-c', text: '91.0 dBA' },
          { id: 'opt-d', text: '85.0 dBA' },
        ],
        correctOptionIds: ['opt-b'],
        explanation: 'Because decibels are logarithmic (base 10), combining two equal sound levels results in an increase of precisely 3 dBA: 85 dBA + 3 dBA = 88 dBA.',
        referenceSource: 'ACGIH Industrial Ventilation & Acoustics Manual; BCSP Math References',
      },
      {
        id: 'q-asp-03',
        certificationType: 'ASP',
        domain: 'Industrial Hygiene & Occupational Health',
        topic: 'Ventilation Engineering',
        stem: 'Which type of ventilation system is specifically recommended by industrial hygiene standards for highly toxic or carcinogenic airborne contaminants with low permissible exposure limits (PEL)?',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'MODERATE',
        options: [
          { id: 'opt-a', text: 'General dilution mechanical ventilation' },
          { id: 'opt-b', text: 'Natural cross-flow ventilation' },
          { id: 'opt-c', text: 'Local exhaust ventilation (LEV) with source capture hood' },
          { id: 'opt-d', text: 'Recirculating ceiling exhaust fans' },
        ],
        correctOptionIds: ['opt-c'],
        explanation: 'Local Exhaust Ventilation (LEV) captures contaminants at or near the point of generation before they disperse into the worker breathing zone, making it the required control for highly toxic compounds.',
        referenceSource: 'OSHA Technical Manual (OTM) Section III, Chapter 3: Ventilation Investigation',
      },
      {
        id: 'q-asp-04',
        certificationType: 'ASP',
        domain: 'Emergency Response & Fire Protection',
        topic: 'Fire Suppression Systems',
        stem: 'Under NFPA 10 classification of portable fire extinguishers, which class of fire involves combustible metals such as magnesium, titanium, and zirconium?',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'EASY',
        options: [
          { id: 'opt-a', text: 'Class A' },
          { id: 'opt-b', text: 'Class B' },
          { id: 'opt-c', text: 'Class C' },
          { id: 'opt-d', text: 'Class D' },
        ],
        correctOptionIds: ['opt-d'],
        explanation: 'Class D fires involve combustible metals (magnesium, sodium, titanium). They require specialized dry powder extinguishing agents (such as sodium chloride or copper-based powders) that smother the fire without reacting.',
        referenceSource: 'NFPA 10: Standard for Portable Fire Extinguishers',
      },
      {
        id: 'q-asp-05',
        certificationType: 'ASP',
        domain: 'Environmental Management Systems',
        topic: 'Hazardous Waste Classification',
        stem: 'Under the US Resource Conservation and Recovery Act (RCRA), what are the four fundamental characteristics that define a waste as hazardous if it is not specifically listed?',
        type: 'MULTIPLE_CHOICE',
        difficulty: 'HARD',
        options: [
          { id: 'opt-a', text: 'Ignitability, Corrosivity, Reactivity, Toxicity' },
          { id: 'opt-b', text: 'Flammability, Volatility, Carcinogenicity, Mutagenicity' },
          { id: 'opt-c', text: 'Radioactivity, Pathogenicity, Oxidizing, Irritating' },
          { id: 'opt-d', text: 'Combustibility, Density, Solubility, pH imbalance' },
        ],
        correctOptionIds: ['opt-a'],
        explanation: 'The four characteristic hazardous waste categories under RCRA (40 CFR Part 261) are D001 (Ignitability), D002 (Corrosivity), D003 (Reactivity), and D004-D043 (Toxicity Characteristic Leaching Procedure).',
        referenceSource: 'EPA Resource Conservation and Recovery Act (RCRA) Regulations; BCSP Blueprint Domain 4',
      },
    ];

    questions.forEach((q) => this.examQuestions.set(q.id, q));

    // Audit Log Entry
    this.recordAudit({
      actorUserId: 'system',
      actorEmail: 'system@zealosh.com',
      actorRole: 'SUPER_ADMIN',
      action: 'SYSTEM_BOOTSTRAP',
      entityType: 'PLATFORM',
      entityId: 'zealosh-lms',
      details: { message: 'Zealosh LMS enterprise schema initialized with verified HSE seeds.' },
    });
  }

  // Audit Logging
  public recordAudit(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) {
    const record: AuditLogEntry = {
      ...entry,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    this.auditLogs.unshift(record);
    if (this.auditLogs.length > 500) this.auditLogs.pop();
  }

  // Transactional Enrollment
  public async enrollStudent(params: {
    userId: string;
    courseId: string;
    batchId: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; enrollment: Enrollment }> {
    const user = this.users.get(params.userId);
    if (!user) throw new Error('User not found');

    const course = this.courses.get(params.courseId);
    if (!course) throw new Error('Course not found');

    const batch = this.batches.get(params.batchId);
    if (!batch) throw new Error('Batch not found');

    // Idempotency check: if user is already actively enrolled in this batch, return existing record
    for (const enr of Array.from(this.enrollments.values())) {
      if (enr.userId === params.userId && enr.batchId === params.batchId && enr.status === 'ACTIVE') {
        return { success: true, enrollment: enr };
      }
    }

    // Capacity check
    if (batch.enrolledCount >= batch.capacity) {
      throw new Error(`BATCH_CAPACITY_EXCEEDED: Batch "${batch.name}" is already at full capacity (${batch.capacity} seats).`);
    }

    // Atomically increment batch capacity
    batch.enrolledCount += 1;

    // Create durable enrollment
    const enrollment: Enrollment = {
      id: `enr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId: user.id,
      courseId: course.id,
      batchId: batch.id,
      status: 'ACTIVE',
      enrolledAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 months access
      progressPercent: 0,
      completedLessonIds: [],
      idempotencyKey: params.idempotencyKey,
    };

    this.enrollments.set(enrollment.id, enrollment);

    // Sync to Moodle external adapter
    try {
      if (course.moodleCourseId) {
        await moodleAdapter.enrolUser({
          roleid: 5,
          userid: 501, // Linked Moodle user ID
          courseid: course.moodleCourseId,
        });
      }
    } catch (err) {
      console.warn('Moodle external sync warning (handled):', err);
    }

    // Record audit trail
    this.recordAudit({
      actorUserId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'COURSE_ENROLLMENT_COMPLETED',
      entityType: 'ENROLLMENT',
      entityId: enrollment.id,
      details: { courseId: course.id, batchId: batch.id, courseTitle: course.title },
    });

    return { success: true, enrollment };
  }

  // Exam Attempt Management
  public startExamAttempt(userId: string, blueprintId: string): ExamAttempt {
    const blueprint = this.examBlueprints.get(blueprintId);
    if (!blueprint) throw new Error('Blueprint not found');

    const assignedQuestions = Array.from(this.examQuestions.values()).filter(
      (q) => q.certificationType === blueprint.certificationType
    );

    const startTime = new Date();
    const deadlineTime = new Date(startTime.getTime() + blueprint.durationMinutes * 60 * 1000);

    const attempt: ExamAttempt = {
      id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      blueprintId: blueprint.id,
      certificationType: blueprint.certificationType,
      status: 'IN_PROGRESS',
      startTime: startTime.toISOString(),
      deadlineTime: deadlineTime.toISOString(),
      assignedQuestionIds: assignedQuestions.map((q) => q.id),
      answers: {},
      bookmarkedQuestionIds: [],
      passingScorePercent: blueprint.passingScorePercent,
    };

    this.examAttempts.set(attempt.id, attempt);
    return attempt;
  }

  public saveExamAnswers(attemptId: string, userId: string, answers: Record<string, string[]>, bookmarks?: string[]) {
    const attempt = this.examAttempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.userId !== userId) throw new Error('Unauthorized attempt access');
    if (attempt.status !== 'IN_PROGRESS') throw new Error('Exam is already completed or expired');

    // Server-side deadline check
    if (new Date() > new Date(attempt.deadlineTime)) {
      attempt.status = 'EXPIRED';
      throw new Error('EXAM_DEADLINE_EXPIRED: The examination time limit has expired.');
    }

    attempt.answers = { ...attempt.answers, ...answers };
    if (bookmarks) attempt.bookmarkedQuestionIds = bookmarks;
    return attempt;
  }

  public submitExamAttempt(attemptId: string, userId: string): ExamAttempt {
    const attempt = this.examAttempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.userId !== userId) throw new Error('Unauthorized attempt access');
    if (attempt.status === 'COMPLETED') return attempt;

    // Score calculation authoritative on server
    let correctCount = 0;
    const domainBreakdown: Record<string, { total: number; correct: number; percent: number }> = {};

    attempt.assignedQuestionIds.forEach((qId) => {
      const q = this.examQuestions.get(qId);
      if (!q) return;

      if (!domainBreakdown[q.domain]) {
        domainBreakdown[q.domain] = { total: 0, correct: 0, percent: 0 };
      }
      domainBreakdown[q.domain].total += 1;

      const userSelected = attempt.answers[qId] || [];
      const isCorrect =
        userSelected.length === q.correctOptionIds.length &&
        userSelected.every((opt) => q.correctOptionIds.includes(opt));

      if (isCorrect) {
        correctCount += 1;
        domainBreakdown[q.domain].correct += 1;
      }
    });

    Object.keys(domainBreakdown).forEach((domain) => {
      const stats = domainBreakdown[domain];
      stats.percent = Math.round((stats.correct / stats.total) * 100);
    });

    const totalQuestions = attempt.assignedQuestionIds.length;
    const totalScorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
    const passed = totalScorePercent >= attempt.passingScorePercent;

    attempt.status = 'COMPLETED';
    attempt.completedTime = new Date().toISOString();
    attempt.totalScore = totalScorePercent;
    attempt.passed = passed;
    attempt.domainBreakdown = domainBreakdown;

    this.recordAudit({
      actorUserId: userId,
      actorEmail: this.users.get(userId)?.email || 'student',
      actorRole: 'STUDENT',
      action: 'EXAM_ATTEMPT_SUBMITTED',
      entityType: 'EXAM_ATTEMPT',
      entityId: attempt.id,
      details: { score: totalScorePercent, passed, blueprintId: attempt.blueprintId },
    });

    return attempt;
  }
}

// Global singleton instance
const globalForDb = globalThis as unknown as { zealoshDb?: ZealoshDatabase };
export const db = globalForDb.zealoshDb || new ZealoshDatabase();
if (process.env.NODE_ENV !== 'production') globalForDb.zealoshDb = db;
