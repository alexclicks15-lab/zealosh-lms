-- ============================================================================
-- ZEALOSH LMS — INITIAL PLATFORM SEED DATA
-- Migration: 20261023000001_zealosh_seed_data.sql
-- Architecture: ADR-001 & ADR-002
-- Standards: Idempotent Execution (ON CONFLICT DO NOTHING), Non-Destructive
-- ============================================================================

BEGIN;

-- 1. Platform Settings Singleton
INSERT INTO public.platform_settings (
  id, platform_name, organization_name, organization_email, support_email, support_phone,
  default_language, default_timezone, default_currency, date_format, time_format, maintenance_mode, registration_mode
)
VALUES (
  'singleton',
  'Zealosh LMS — Enterprise HSE Learning Platform',
  'Zealosh Training & Consultants',
  'contact@zealosh.com',
  'support@zealosh.com',
  '+91 949 600 0000',
  'en-US',
  'Asia/Kolkata',
  'INR',
  'DD/MM/YYYY',
  '12h',
  false,
  'PUBLIC'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Branding Theme Singleton (Official Zealosh Palette)
INSERT INTO public.branding_theme (
  id, primary_green, deep_green, accent_green, dark_neutral, surface_color, light_surface_color, secondary_surface,
  font_family, border_radius, layout_density, button_style, card_style, logo_url, favicon_url
)
VALUES (
  'singleton',
  '#4f8c4c',
  '#3a7536',
  '#2ea033',
  '#252c41',
  '#ffffff',
  '#f7f9fc',
  '#eaedf5',
  'Inter',
  'md',
  'comfortable',
  'rounded',
  'bordered',
  '/assets/brand/zealosh-logo.png',
  '/favicon.ico'
)
ON CONFLICT (id) DO NOTHING;

-- 3. Feature Flags Singleton
INSERT INTO public.feature_flags (
  id, course_catalog, cohort_management, instructor_portal, student_portal, recorded_learning,
  live_classrooms, practice_assessments, formal_examinations, certificate_issuance, attendance_tracking,
  assignment_submissions, announcements, messaging, reports_analytics, payment_gateway, pwa_offline_support,
  moodle_sync, bbb_integration
)
VALUES (
  'singleton',
  true, true, true, true, true,
  true, true, true, true, true,
  true, true, true, true, true, true,
  true, true
)
ON CONFLICT (id) DO NOTHING;

-- 4. Immutable Base Roles & Permission Sets
INSERT INTO public.roles (id, name, description, is_system, permissions)
VALUES 
  (
    'role-super-admin',
    'Super Administrator',
    'Unrestricted master governance over all configuration, courses, exams, and financials',
    true,
    ARRAY[
      'courses.read', 'courses.create', 'courses.update', 'courses.publish',
      'cohorts.manage', 'enrollments.manage', 'students.read', 'progress.read',
      'assessments.manage', 'exams.publish', 'exams.grade', 'certificates.issue',
      'payments.read', 'payments.refund', 'reports.export', 'settings.manage',
      'integrations.manage', 'users.manage', 'roles.manage', 'audit.read'
    ]
  ),
  (
    'role-instructor',
    'Certified Lead Instructor',
    'Manage assigned cohorts, live classroom moderation, grading, and syllabus materials',
    true,
    ARRAY[
      'courses.read', 'cohorts.manage', 'students.read', 'progress.read',
      'assessments.manage', 'exams.grade'
    ]
  ),
  (
    'role-student',
    'HSE Certification Candidate',
    'Access enrolled lessons, live classroom sessions, and timed exam simulators',
    true,
    ARRAY['courses.read', 'progress.read']
  )
ON CONFLICT (id) DO NOTHING;

-- 5. Baseline Users (Super Admin, Instructor, Student)
INSERT INTO public.users (id, name, email, password_hash, role, organization_id, external_learning_id)
VALUES 
  (
    'usr-admin-01',
    'Dr. K. Ravindran (Super Admin)',
    'admin@zealosh.com',
    '$2a$10$wT0jV1Y3W4M7VvW2g7W2ceUq4i8w.U/fF8Rk3V3eK1.z2',
    'SUPER_ADMIN',
    'org-zealosh-main',
    NULL
  ),
  (
    'usr-inst-01',
    'Vishnu Rajendran, CSP, CRSP',
    'vishnu@zealosh.com',
    '$2a$10$wT0jV1Y3W4M7VvW2g7W2ceUq4i8w.U/fF8Rk3V3eK1.z2',
    'INSTRUCTOR',
    'org-zealosh-main',
    NULL
  ),
  (
    'usr-std-01',
    'Arjun Menon',
    'student@zealosh.com',
    '$2a$10$wT0jV1Y3W4M7VvW2g7W2ceUq4i8w.U/fF8Rk3V3eK1.z2',
    'STUDENT',
    'org-zealosh-main',
    'mdl-user-501'
  )
ON CONFLICT (id) DO NOTHING;

-- 6. Core Certification Courses
INSERT INTO public.courses (
  id, title, slug, certification_type, delivery_model, status, headline, description,
  price_inr, price_usd, duration_weeks, cover_image, lead_instructor_id, modules_count, total_lessons, total_hours
)
VALUES 
  (
    'crs-asp-01',
    'ASP: Associate Safety Professional Certification Masterclass',
    'asp-associate-safety-professional',
    'ASP',
    'HYBRID',
    'PUBLISHED',
    'Comprehensive BCSP ASP Blueprint V.10 preparation with live problem-solving, math drills, and mock exams',
    'The Associate Safety Professional (ASP) credential represents high professional competence in safety fundamentals, mathematics, sciences, emergency response, and ergonomic principles. Zealosh provides structured syllabus coverage aligned with BCSP blueprint guidelines.',
    34999, 449, 10, 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80',
    'usr-inst-01', 8, 42, 60
  ),
  (
    'crs-csp-02',
    'CSP: Certified Safety Professional Comprehensive Prep',
    'csp-certified-safety-professional',
    'CSP',
    'HYBRID',
    'PUBLISHED',
    'Master advanced safety management systems, risk assessment methodology, and executive safety governance',
    'The Certified Safety Professional (CSP) is the gold standard for global safety leaders. This masterclass covers risk management, environmental management systems, occupational health, and security.',
    42999, 549, 12, 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=80',
    'usr-inst-01', 9, 48, 75
  ),
  (
    'crs-crsp-03',
    'CRSP: Canadian Registered Safety Professional Exam Pathway',
    'crsp-canadian-registered-safety-professional',
    'CRSP',
    'HYBRID',
    'PUBLISHED',
    'Complete preparation for the BCRSP Canadian safety framework, provincial legislation, and occupational hygiene',
    'Targeted at practitioners pursuing BCRSP certification in Canada or internationally. Features Canadian OHS regulatory frameworks, worker compensation systems, and hazard identification.',
    38999, 499, 10, 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=800&auto=format&fit=crop&q=80',
    'usr-inst-01', 8, 38, 55
  ),
  (
    'crs-cih-04',
    'CIH: Certified Industrial Hygienist Quantitative Review',
    'cih-certified-industrial-hygienist',
    'CUSTOM',
    'HYBRID',
    'PUBLISHED',
    'In-depth industrial hygiene calculations, chemical exposure assessments, toxicology, and ventilation engineering',
    'Designed for occupational health and industrial hygiene specialists preparing for the BGC CIH examination. Covers airborne contaminants, toxicological mechanisms, physical agents, and engineering controls.',
    49999, 649, 14, 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800&auto=format&fit=crop&q=80',
    'usr-inst-01', 10, 52, 80
  )
ON CONFLICT (id) DO NOTHING;

-- 7. Initial Scheduled Batches
INSERT INTO public.batches (
  id, course_id, name, start_date, end_date, schedule_description, capacity, enrolled_count, lead_instructor_id, status
)
VALUES
  (
    'btc-asp-weekday',
    'crs-asp-01',
    'Weekday Evening Batch — Nov 2026',
    '2026-11-02',
    '2027-01-15',
    'Mon, Wed, Fri 7:00 PM - 9:30 PM IST',
    30,
    4,
    'usr-inst-01',
    'UPCOMING'
  ),
  (
    'btc-asp-full',
    'crs-asp-01',
    'Weekend Fast-Track — Dec 2026',
    '2026-12-05',
    '2027-02-28',
    'Saturdays & Sundays 9:00 AM - 1:00 PM IST',
    25,
    25,
    'usr-inst-01',
    'UPCOMING'
  )
ON CONFLICT (id) DO NOTHING;

-- 8. BCSP ASP Blueprint V.10 Simulation Blueprint
INSERT INTO public.exam_blueprints (
  id, certification_type, title, total_questions, duration_minutes, passing_score_percent, domains
)
VALUES (
  'bp-asp-bcsp-v10',
  'ASP',
  'BCSP Associate Safety Professional (ASP) Examination Blueprint V.10 Simulation',
  100,
  180,
  70,
  '[
    {"name": "Domain 1: Advanced Safety Sciences and Math", "weightPercent": 21, "questionCount": 21},
    {"name": "Domain 2: Manufacturing, Construction, and Field Safety", "weightPercent": 18, "questionCount": 18},
    {"name": "Domain 3: Environmental Management Systems", "weightPercent": 15, "questionCount": 15},
    {"name": "Domain 4: Emergency Response, Fire Protection, and Security", "weightPercent": 16, "questionCount": 16},
    {"name": "Domain 5: Occupational Health and Industrial Hygiene", "weightPercent": 16, "questionCount": 16},
    {"name": "Domain 6: Executive Leadership and Professional Ethics", "weightPercent": 14, "questionCount": 14}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

COMMIT;
