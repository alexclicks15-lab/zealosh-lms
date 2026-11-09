// Zealosh LMS — Classroom Announcement Persistence, Real PostgreSQL & Fail-Closed Integrity Suite
// Validates:
// 1. Real Isolated PostgreSQL table schema, constraints, sorting, and RLS policies for classroom_announcements
// 2. Elimination of silent in-memory fallback in db.getAnnouncements / saveAnnouncement
// 3. DatabasePersistenceError taxonomy with SCHEMA_MISSING and DATABASE_UNAVAILABLE classifications
// 4. Empty cohort announcement queries returning empty array without triggering seed data

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { db, DatabasePersistenceError } from '@/lib/store/db';
import { supabaseAdapter } from '@/lib/store/supabase-adapter';
import { createIsolatedPostgres, IsolatedPostgresInstance } from './helpers/isolated-postgres';
import { ClassroomAnnouncement } from '@/types';

describe('Zealosh Unified Classroom — Announcement Persistence & Fail-Closed Integrity', () => {
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
  // Part 1: Real Isolated PostgreSQL Verification
  // --------------------------------------------------------------------------
  describe('Part 1: Real Isolated PostgreSQL Schema & RLS Execution', () => {
    const announcement1 = {
      id: 'anc-pg-test-01',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      authorId: 'usr-inst-01',
      authorName: 'Dr. Ramesh Kumar',
      authorRole: 'INSTRUCTOR',
      title: 'ASP Midterm Review Guidelines',
      content: 'Detailed guidelines for the safety calculations midterm examination.',
      isPinned: false,
      audienceScope: 'COHORT_SPECIFIC',
      status: 'PUBLISHED',
      comments: [
        {
          id: 'cmt-pg-01',
          announcementId: 'anc-pg-test-01',
          authorId: 'usr-stud-01',
          authorName: 'Arjun Das',
          authorRole: 'STUDENT',
          content: 'Will the radiation formulas be included on the formula sheet?',
          createdAt: new Date().toISOString(),
        },
      ],
    };

    const announcement2Pinned = {
      id: 'anc-pg-test-02',
      courseId: 'crs-asp-01',
      batchId: 'btc-asp-nov26',
      authorId: 'usr-inst-01',
      authorName: 'Dr. Ramesh Kumar',
      authorRole: 'INSTRUCTOR',
      title: 'CRITICAL: Mandatory Formula Sheet Update',
      content: 'Please download the revised equation sheet from the materials repository.',
      isPinned: true,
      audienceScope: 'COURSE_WIDE',
      status: 'PUBLISHED',
      comments: [],
    };

    it('ANC-01: should insert and persist announcements into real PostgreSQL table', async () => {
      await dbInstance.pg.query(
        `INSERT INTO public.classroom_announcements (
          id, course_id, batch_id, author_id, author_name, author_role, title, content,
          is_pinned, audience_scope, status, comments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
        [
          announcement1.id,
          announcement1.courseId,
          announcement1.batchId,
          announcement1.authorId,
          announcement1.authorName,
          announcement1.authorRole,
          announcement1.title,
          announcement1.content,
          announcement1.isPinned,
          announcement1.audienceScope,
          announcement1.status,
          JSON.stringify(announcement1.comments),
        ]
      );

      const res = await dbInstance.pg.query<{ id: string; title: string; comments: any }>(
        `SELECT id, title, comments FROM public.classroom_announcements WHERE id = $1`,
        [announcement1.id]
      );

      expect(res.rows.length).toBe(1);
      expect(res.rows[0].id).toBe(announcement1.id);
      expect(res.rows[0].title).toBe(announcement1.title);
      expect(res.rows[0].comments.length).toBe(1);
      expect(res.rows[0].comments[0].authorName).toBe('Arjun Das');
    });

    it('ANC-02: should verify pinned announcements sort first in real PostgreSQL query', async () => {
      await dbInstance.pg.query(
        `INSERT INTO public.classroom_announcements (
          id, course_id, batch_id, author_id, author_name, author_role, title, content,
          is_pinned, audience_scope, status, comments
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)`,
        [
          announcement2Pinned.id,
          announcement2Pinned.courseId,
          announcement2Pinned.batchId,
          announcement2Pinned.authorId,
          announcement2Pinned.authorName,
          announcement2Pinned.authorRole,
          announcement2Pinned.title,
          announcement2Pinned.content,
          announcement2Pinned.isPinned,
          announcement2Pinned.audienceScope,
          announcement2Pinned.status,
          JSON.stringify(announcement2Pinned.comments),
        ]
      );

      const res = await dbInstance.pg.query<{ id: string; is_pinned: boolean }>(
        `SELECT id, is_pinned FROM public.classroom_announcements 
         WHERE course_id = $1 
         ORDER BY is_pinned DESC, created_at DESC`,
        [announcement1.courseId]
      );

      expect(res.rows.length).toBeGreaterThanOrEqual(2);
      expect(res.rows[0].id).toBe(announcement2Pinned.id);
      expect(res.rows[0].is_pinned).toBe(true);
    });

    it('ANC-03: should enforce foreign key constraint on course_id', async () => {
      await expect(
        dbInstance.pg.query(
          `INSERT INTO public.classroom_announcements (
            id, course_id, author_id, author_name, title, content
          ) VALUES ('anc-invalid-course', 'crs-nonexistent-99', 'usr-inst-01', 'Dr. Ramesh Kumar', 'Invalid', 'Test')`
        )
      ).rejects.toThrow();
    });

    it('ANC-04: should execute RLS policy allowing enrolled student to view active announcements', async () => {
      const studentResult = await dbInstance.withAuthContext(
        {
          pgRole: 'authenticated',
          userId: 'usr-std-01',
          appRole: 'STUDENT',
        },
        async (pg) => {
          return pg.query<{ id: string }>(
            `SELECT id FROM public.classroom_announcements WHERE course_id = 'crs-asp-01'`
          );
        }
      );

      expect(studentResult.rows.length).toBeGreaterThanOrEqual(1);
    });
  });

  // --------------------------------------------------------------------------
  // Part 2: Fail-Closed Persistence & Elimination of In-Memory Fallback
  // --------------------------------------------------------------------------
  describe('Part 2: Fail-Closed Persistence & Fallback Elimination', () => {
    const testCourseId = 'crs-test-empty-01';
    const testBatchId = 'btc-test-empty-01';

    beforeEach(() => {
      vi.restoreAllMocks();
      db.setStorageModeOverride('supabase');
    });

    afterEach(() => {
      vi.restoreAllMocks();
      db.setStorageModeOverride(undefined);
    });

    it('ANC-05: Empty announcements in PostgreSQL must return empty array without falling back to memory seed', async () => {
      // Mock supabaseAdapter to return empty array []
      const spy = vi.spyOn(supabaseAdapter, 'getAnnouncements').mockResolvedValue([]);

      const result = await db.getAnnouncements(testCourseId, testBatchId);

      expect(spy).toHaveBeenCalledWith(testCourseId, testBatchId);
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('ANC-06: Missing table error in getAnnouncements must throw DatabasePersistenceError with SCHEMA_MISSING', async () => {
      const pgrstError = {
        code: 'PGRST205',
        message: 'Could not find the table "public.classroom_announcements" in the schema cache',
      };
      // Mock client query failure
      vi.spyOn(supabaseAdapter as any, 'getClient').mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: null, error: pgrstError }),
              }),
            }),
          }),
        }),
      });

      await expect(supabaseAdapter.getAnnouncements(testCourseId)).rejects.toThrow(DatabasePersistenceError);

      try {
        await supabaseAdapter.getAnnouncements(testCourseId);
      } catch (err: any) {
        expect(err).toBeInstanceOf(DatabasePersistenceError);
        expect(err.category).toBe('SCHEMA_MISSING');
        expect(err.retryable).toBe(false);
      }
    });

    it('ANC-07: In Supabase mode, db.getAnnouncements must fail closed when adapter throws', async () => {
      vi.spyOn(supabaseAdapter, 'getAnnouncements').mockRejectedValue(
        new DatabasePersistenceError('Schema missing', {
          operation: 'getAnnouncements',
          entityType: 'ClassroomAnnouncement',
          category: 'SCHEMA_MISSING',
        })
      );

      await expect(db.getAnnouncements(testCourseId)).rejects.toThrow(DatabasePersistenceError);
    });

    it('ANC-08: Database connectivity outage must throw DatabasePersistenceError with DATABASE_UNAVAILABLE', async () => {
      const connError = new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:54321');
      vi.spyOn(supabaseAdapter as any, 'getClient').mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: null, error: connError }),
              }),
            }),
          }),
        }),
      });

      try {
        await supabaseAdapter.getAnnouncements(testCourseId);
      } catch (err: any) {
        expect(err).toBeInstanceOf(DatabasePersistenceError);
        expect(err.category).toBe('DATABASE_UNAVAILABLE');
        expect(err.retryable).toBe(true);
      }
    });

    it('ANC-09: saveAnnouncement must fail closed and never return fake success if table is missing', async () => {
      const announcementToSave: ClassroomAnnouncement = {
        id: 'anc-fail-test-01',
        courseId: 'crs-asp-01',
        batchId: 'btc-asp-nov26',
        authorId: 'usr-inst-01',
        authorName: 'Dr. Ramesh Kumar',
        authorRole: 'INSTRUCTOR',
        title: 'Draft Announcement',
        content: 'Content that should not be falsely marked saved',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const tableMissingError = {
        code: '42P01',
        message: 'relation "classroom_announcements" does not exist',
      };

      vi.spyOn(supabaseAdapter as any, 'getClient').mockReturnValue({
        from: () => ({
          upsert: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: tableMissingError }),
            }),
          }),
        }),
      });

      await expect(supabaseAdapter.saveAnnouncement(announcementToSave)).rejects.toThrow(DatabasePersistenceError);

      try {
        await supabaseAdapter.saveAnnouncement(announcementToSave);
      } catch (err: any) {
        expect(err).toBeInstanceOf(DatabasePersistenceError);
        expect(err.category).toBe('SCHEMA_MISSING');
        expect(err.retryable).toBe(false);
      }
    });

    it('ANC-10: deleteAnnouncement in Supabase mode must fail closed on missing table', async () => {
      const tableMissingError = {
        code: 'PGRST205',
        message: 'Could not find the table "public.classroom_announcements"',
      };

      vi.spyOn(supabaseAdapter as any, 'getClient').mockReturnValue({
        from: () => ({
          delete: () => ({
            eq: () => Promise.resolve({ error: tableMissingError }),
          }),
        }),
      });

      await expect(supabaseAdapter.deleteAnnouncement('anc-del-test')).rejects.toThrow(DatabasePersistenceError);
    });
  });
});
