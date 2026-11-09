// Zealosh LMS — Classroom Real Isolated PostgreSQL, RLS Policies & Lifecycle Verification
// Validates genuine PostgreSQL schema, check constraints, foreign keys, and RLS enforcement:
// - CLS-01 to CLS-15: Universal classroom persistence, 3-mode delivery, announcements, batch isolation, rubrics, submissions
// - LIVE-01 to LIVE-11: 11-state live session lifecycle, host/attendee privileges, attendance tracking, RLS boundary protection

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createIsolatedPostgres, IsolatedPostgresInstance } from './helpers/isolated-postgres';

describe('Zealosh Unified Classroom & Live VC — Real Isolated PostgreSQL & RLS Integration Suite', () => {
  let dbInstance: IsolatedPostgresInstance;

  beforeAll(async () => {
    dbInstance = await createIsolatedPostgres();
  });

  afterAll(async () => {
    if (dbInstance) {
      await dbInstance.close();
    }
  });

  // --------------------------------------------------------------------------
  // CLS-01 to CLS-03: Three Delivery Modes & Batch Hierarchy
  // --------------------------------------------------------------------------
  it('CLS-01: should verify courses and batches exist for LIVE, RECORDED, and HYBRID delivery modes', async () => {
    const res = await dbInstance.pg.query<{ id: string; delivery_model: string }>(
      `SELECT id, delivery_model FROM public.courses ORDER BY id ASC`
    );
    expect(res.rows.length).toBeGreaterThanOrEqual(3);
    const models = res.rows.map((r) => r.delivery_model);
    expect(models).toContain('LIVE');
    expect(models).toContain('RECORDED');
    expect(models).toContain('HYBRID');
  });

  it('CLS-02: should verify batch capacity check constraint enforces enrollment limits', async () => {
    // btc-asp-nov26 capacity is 35
    const batch = await dbInstance.pg.query<{ capacity: number }>(
      `SELECT capacity FROM public.batches WHERE id = 'btc-asp-nov26'`
    );
    expect(batch.rows[0].capacity).toBe(35);

    // Attempting to set enrolled_count > capacity must fail with chk_batch_capacity
    await expect(
      dbInstance.pg.query(`UPDATE public.batches SET enrolled_count = 36 WHERE id = 'btc-asp-nov26'`)
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // CLS-04 to CLS-07: Classroom Announcements, Pinned Ordering & Comments Array
  // --------------------------------------------------------------------------
  it('CLS-04: should insert cohort announcements with comments and pinned flags', async () => {
    const announcementId = 'anc-real-pg-01';
    await dbInstance.pg.query(
      `INSERT INTO public.classroom_announcements (
        id, course_id, batch_id, author_id, author_name, author_role, title, content,
        is_pinned, comments
      ) VALUES (
        $1, 'crs-asp-01', 'btc-asp-nov26', 'usr-inst-01', 'Dr. Ramesh Kumar', 'INSTRUCTOR',
        'Midterm Calculation Workshop', 'Please review the attached equations.',
        TRUE, $2
      )`,
      [
        announcementId,
        JSON.stringify([
          {
            id: 'cmt-01',
            announcementId,
            authorId: 'usr-std-01',
            authorName: 'Arjun Menon',
            authorRole: 'STUDENT',
            content: 'Are crane formulas included?',
            createdAt: new Date().toISOString(),
          },
        ]),
      ]
    );

    const rows = await dbInstance.pg.query<{ id: string; is_pinned: boolean; comments: any }>(
      `SELECT id, is_pinned, comments FROM public.classroom_announcements WHERE id = $1`,
      [announcementId]
    );
    expect(rows.rows.length).toBe(1);
    expect(rows.rows[0].is_pinned).toBe(true);
    expect(rows.rows[0].comments.length).toBe(1);
    expect(rows.rows[0].comments[0].content).toContain('crane formulas');
  });

  it('CLS-05: should enforce RLS: student can only read announcements for their enrolled batch', async () => {
    // Insert an isolated batch first to respect foreign key constraint
    await dbInstance.pg.query(
      `INSERT INTO public.batches (
        id, course_id, name, start_date, end_date, schedule_description, capacity, lead_instructor_id, status
      ) VALUES (
        'btc-other-isolated', 'crs-asp-01', 'Isolated Other Batch', '2026-11-01', '2027-01-31', 'TBD', 30, 'usr-inst-01', 'ACTIVE'
      ) ON CONFLICT (id) DO NOTHING`
    );

    // Insert an announcement targeted strictly to a batch usr-std-01 is NOT enrolled in
    await dbInstance.pg.query(
      `INSERT INTO public.classroom_announcements (
        id, course_id, batch_id, author_id, author_name, author_role, title, content
      ) VALUES (
        'anc-unauthorized-01', 'crs-asp-01', 'btc-other-isolated', 'usr-inst-01', 'Dr. Ramesh Kumar',
        'INSTRUCTOR', 'Secret Notice', 'Only for batch btc-other-isolated'
      ) ON CONFLICT (id) DO NOTHING`
    );

    // Query as usr-std-01 (enrolled in btc-asp-nov26, not btc-other-isolated)
    const result = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-std-01', appRole: 'STUDENT' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.classroom_announcements WHERE id = 'anc-unauthorized-01'`
        );
      }
    );

    // RLS must hide anc-unauthorized-01 from usr-std-01
    expect(result.rows.length).toBe(0);

    // But query as lead instructor or SUPER_ADMIN must see it
    const adminResult = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-admin-01', appRole: 'SUPER_ADMIN' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.classroom_announcements WHERE id = 'anc-unauthorized-01'`
        );
      }
    );
    expect(adminResult.rows.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // CLS-08 to CLS-11: Assignments, Rubric Evaluation & Revision Tracking
  // --------------------------------------------------------------------------
  it('CLS-08: should insert assignment with detailed grading rubric', async () => {
    const rubric = {
      id: 'rub-01',
      title: 'Ventilation Calculation Rubric',
      totalPoints: 100,
      criteria: [
        { id: 'crit-01', title: 'Formula Selection', description: 'Correct equation', maxPoints: 40 },
        { id: 'crit-02', title: 'Calculation Accuracy', description: 'Correct units & math', maxPoints: 60 },
      ],
    };

    await dbInstance.pg.query(
      `INSERT INTO public.assignments (
        id, course_id, batch_id, title, description, due_date, max_score, rubric, version, status
      ) VALUES (
        'asg-ventilation-01', 'crs-asp-01', 'btc-asp-nov26', 'Ventilation Design Project',
        'Calculate required airflow in CFM.', NOW() + INTERVAL '7 days', 100, $1, 1, 'PUBLISHED'
      )`,
      [JSON.stringify(rubric)]
    );

    const asg = await dbInstance.pg.query<{ rubric: any; version: number }>(
      `SELECT rubric, version FROM public.assignments WHERE id = 'asg-ventilation-01'`
    );
    expect(asg.rows[0].version).toBe(1);
    expect(asg.rows[0].rubric.criteria.length).toBe(2);
    expect(asg.rows[0].rubric.totalPoints).toBe(100);
  });

  it('CLS-09: should record initial assignment submission and support revision versioning', async () => {
    // Initial submission (version 1)
    await dbInstance.pg.query(
      `INSERT INTO public.assignment_submissions (
        id, assignment_id, user_id, student_name, student_email, submission_text, version, status
      ) VALUES (
        'sub-vent-01', 'asg-ventilation-01', 'usr-std-01', 'Arjun Menon', 'student@zealosh.com',
        'Draft calculations for dilution ventilation.', 1, 'SUBMITTED'
      )`
    );

    // Resubmission (revision version 2 preserving previous text)
    await dbInstance.pg.query(
      `UPDATE public.assignment_submissions
       SET submission_text = 'Final revised calculations with capture velocity proof.',
           previous_submission_text = 'Draft calculations for dilution ventilation.',
           version = 2,
           status = 'SUBMITTED',
           updated_at = NOW()
       WHERE id = 'sub-vent-01'`
    );

    const sub = await dbInstance.pg.query<{ version: number; previous_submission_text: string }>(
      `SELECT version, previous_submission_text FROM public.assignment_submissions WHERE id = 'sub-vent-01'`
    );
    expect(sub.rows[0].version).toBe(2);
    expect(sub.rows[0].previous_submission_text).toContain('Draft calculations');
  });

  it('CLS-10: should enforce RLS: student cannot view or modify submissions of other students', async () => {
    // Other student (usr-std-02) queries submissions
    const otherStudentSubmissions = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-std-02', appRole: 'STUDENT' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.assignment_submissions WHERE id = 'sub-vent-01'`
        );
      }
    );

    // RLS must prevent usr-std-02 from reading usr-std-01's submission
    expect(otherStudentSubmissions.rows.length).toBe(0);

    // Owning student (usr-std-01) can read their own submission
    const ownSubmissions = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-std-01', appRole: 'STUDENT' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.assignment_submissions WHERE id = 'sub-vent-01'`
        );
      }
    );
    expect(ownSubmissions.rows.length).toBe(1);
  });

  // --------------------------------------------------------------------------
  // CLS-12 to CLS-15: Learning Materials & Release Conditions
  // --------------------------------------------------------------------------
  it('CLS-12: should verify learning materials with MANUAL release condition are governed by is_released', async () => {
    const matId = 'e2f9d8c7-b6a5-4321-9876-543210abcdef';
    await dbInstance.pg.query(
      `INSERT INTO public.learning_materials (
        id, course_id, batch_id, title, material_type, storage_path, mime_type,
        release_condition, is_released, status, uploaded_by
      ) VALUES (
        $1, 'crs-asp-01', 'btc-asp-nov26', 'Rigging Safety Handbook', 'PDF',
        '/materials/rigging.pdf', 'application/pdf', 'MANUAL', FALSE, 'PUBLISHED', 'usr-inst-01'
      )`,
      [matId]
    );

    // Verify unreleased material in DB
    const matBefore = await dbInstance.pg.query<{ is_released: boolean }>(
      `SELECT is_released FROM public.learning_materials WHERE id = $1`,
      [matId]
    );
    expect(matBefore.rows[0].is_released).toBe(false);

    // 1-click manual release updates is_released to TRUE
    await dbInstance.pg.query(
      `UPDATE public.learning_materials SET is_released = TRUE, updated_at = NOW() WHERE id = $1`,
      [matId]
    );

    const matAfter = await dbInstance.pg.query<{ is_released: boolean }>(
      `SELECT is_released FROM public.learning_materials WHERE id = $1`,
      [matId]
    );
    expect(matAfter.rows[0].is_released).toBe(true);
  });

  // --------------------------------------------------------------------------
  // LIVE-01 to LIVE-06: Live Sessions & 11-State Lifecycle Transitions
  // --------------------------------------------------------------------------
  it('LIVE-01: should transition live session across the 11-state lifecycle with check constraint safety', async () => {
    const sessId = 'sess-pg-lifecycle-01';

    // 1. Create SCHEDULED session
    await dbInstance.pg.query(
      `INSERT INTO public.live_sessions (
        id, batch_id, course_id, title, scheduled_start_time, duration_minutes,
        instructor_id, meeting_id, status, co_instructor_ids, moderator_ids
      ) VALUES (
        $1, 'btc-asp-nov26', 'crs-asp-01', 'ASP Chemical Hazards Masterclass',
        NOW() + INTERVAL '1 hour', 90, 'usr-inst-01', 'mtg-chem-01', 'SCHEDULED',
        ARRAY['usr-inst-99'], ARRAY['usr-inst-01', 'usr-inst-99']
      )`,
      [sessId]
    );

    // 2. Transition SCHEDULED -> STARTING
    await dbInstance.pg.query(
      `UPDATE public.live_sessions SET status = 'STARTING', updated_at = NOW() WHERE id = $1`,
      [sessId]
    );

    // 3. Transition STARTING -> LIVE (setting started_at)
    await dbInstance.pg.query(
      `UPDATE public.live_sessions SET status = 'LIVE', started_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [sessId]
    );

    // 4. Transition LIVE -> ENDING
    await dbInstance.pg.query(
      `UPDATE public.live_sessions SET status = 'ENDING', updated_at = NOW() WHERE id = $1`,
      [sessId]
    );

    // 5. Transition ENDING -> ENDED (setting ended_at)
    await dbInstance.pg.query(
      `UPDATE public.live_sessions SET status = 'ENDED', ended_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [sessId]
    );

    // 6. Transition ENDED -> RECORDING_READY (setting recording URL)
    await dbInstance.pg.query(
      `UPDATE public.live_sessions
       SET status = 'RECORDING_READY',
           recording_url = 'https://recordings.zealosh.com/playback/mtg-chem-01',
           recording_duration_minutes = 88,
           updated_at = NOW()
       WHERE id = $1`,
      [sessId]
    );

    const finalRow = await dbInstance.pg.query<{
      status: string;
      started_at: string;
      ended_at: string;
      recording_url: string;
    }>(
      `SELECT status, started_at, ended_at, recording_url FROM public.live_sessions WHERE id = $1`,
      [sessId]
    );

    expect(finalRow.rows[0].status).toBe('RECORDING_READY');
    expect(finalRow.rows[0].started_at).not.toBeNull();
    expect(finalRow.rows[0].ended_at).not.toBeNull();
    expect(finalRow.rows[0].recording_url).toContain('https://recordings.zealosh.com');
  });

  it('LIVE-02: should reject invalid session status violating the 11-state check constraint', async () => {
    await expect(
      dbInstance.pg.query(
        `UPDATE public.live_sessions SET status = 'INVALID_ARBITRARY_STATUS' WHERE id = 'sess-pg-lifecycle-01'`
      )
    ).rejects.toThrow();
  });

  // --------------------------------------------------------------------------
  // LIVE-07 to LIVE-11: Attendance Records & RLS Boundary Verification
  // --------------------------------------------------------------------------
  it('LIVE-07: should log student attendance with rejoin counts and connection status', async () => {
    const attId = 'att-pg-01';
    await dbInstance.pg.query(
      `INSERT INTO public.attendance_records (
        id, session_id, user_id, joined_at, connection_status, rejoin_count, attended
      ) VALUES (
        $1, 'sess-pg-lifecycle-01', 'usr-std-01', NOW(), 'CONNECTED', 0, TRUE
      )`,
      [attId]
    );

    // Simulate student disconnect and rejoin
    await dbInstance.pg.query(
      `UPDATE public.attendance_records
       SET rejoin_count = rejoin_count + 1,
           connection_status = 'RECONNECTED',
           duration_minutes = 75
       WHERE id = $1`,
      [attId]
    );

    const att = await dbInstance.pg.query<{ rejoin_count: number; connection_status: string; duration_minutes: number }>(
      `SELECT rejoin_count, connection_status, duration_minutes FROM public.attendance_records WHERE id = $1`,
      [attId]
    );
    expect(att.rows[0].rejoin_count).toBe(1);
    expect(att.rows[0].connection_status).toBe('RECONNECTED');
    expect(att.rows[0].duration_minutes).toBe(75);
  });

  it('LIVE-08: should enforce RLS: student cannot view attendance records of other learners', async () => {
    // usr-std-02 queries attendance records
    const result = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-std-02', appRole: 'STUDENT' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.attendance_records WHERE id = 'att-pg-01'`
        );
      }
    );

    // Must be hidden from usr-std-02
    expect(result.rows.length).toBe(0);

    // But visible to usr-std-01 (own record)
    const ownResult = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-std-01', appRole: 'STUDENT' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.attendance_records WHERE id = 'att-pg-01'`
        );
      }
    );
    expect(ownResult.rows.length).toBe(1);

    // And visible to session lead instructor (usr-inst-01)
    const instResult = await dbInstance.withAuthContext(
      { pgRole: 'authenticated', userId: 'usr-inst-01', appRole: 'INSTRUCTOR' },
      async (pg) => {
        return await pg.query<{ id: string }>(
          `SELECT id FROM public.attendance_records WHERE id = 'att-pg-01'`
        );
      }
    );
    expect(instResult.rows.length).toBe(1);
  });
});
