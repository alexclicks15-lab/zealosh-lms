// ============================================================================
// Zealosh LMS — Milestone ZM-IMPL-01
// Test Suite: Persistent Messaging, TypeScript Fix & Classroom Route Consolidation
// ============================================================================

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/lib/store/db';
import { signToken } from '@/lib/auth/jwt';
import {
  mapDomainDirectMessageToDb,
  mapDbDirectMessageToDomain,
} from '@/lib/store/supabase-adapter';
import { GET as getMessages, POST as postMessage, PATCH as patchMessage } from '@/app/api/messages/route';
import { POST as joinLiveSession } from '@/app/api/live/[sessionId]/join/route';
import LegacyCourseClassroomPage from '@/app/courses/[slug]/classroom/page';
import { DirectMessage } from '@/types';

describe('ZM-IMPL-01: Core Verification Fix, Persistent Messaging & Route Consolidation', () => {
  const studentId = 'usr-std-01';
  const instructorId = 'usr-inst-01';
  const otherStudentId = 'usr-std-02';
  const courseId = 'crs-asp-01';
  const courseSlug = 'asp-examination-prep';
  const batchId = 'btc-asp-nov26';
  const sessionId = 'sess-asp-01';

  const studentToken = signToken({
    userId: studentId,
    email: 'student@zealosh.com',
    role: 'STUDENT',
    name: 'Arjun Menon',
  });

  const instructorToken = signToken({
    userId: instructorId,
    email: 'vishnu@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Vishnu Rajendran, CSP',
  });

  const intruderToken = signToken({
    userId: 'usr-intruder-99',
    email: 'intruder@unknown.com',
    role: 'STUDENT',
    name: 'Unauthorized User',
  });

  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-08T14:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    db.resetToSeed();
  });

  // --------------------------------------------------------------------------
  // 1. Task A Verification: Live Join Handler Contract & TypeScript Integrity
  // --------------------------------------------------------------------------
  describe('Task A: Live Session Join Contract Integrity', () => {
    it('1.1 should confirm joinLiveSession is strictly a POST route handler', async () => {
      expect(typeof joinLiveSession).toBe('function');
      const req = new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      const res = await joinLiveSession(req, { params: { sessionId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.joinUrl).toBeDefined();
    });

    it('1.2 should reject unauthenticated POST join requests', async () => {
      const req = new Request(`http://localhost:3000/api/live/${sessionId}/join`, {
        method: 'POST',
      });
      const res = await joinLiveSession(req, { params: { sessionId } });
      expect(res.status).toBe(401);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Task B: Direct-Message DTO Transformations & Data Fidelity
  // --------------------------------------------------------------------------
  describe('Task B: DTO Transformation Fidelity (Domain <-> PostgreSQL)', () => {
    it('2.1 should accurately map domain DirectMessage to database snake_case row', () => {
      const domainMsg: DirectMessage = {
        id: 'msg-test-01',
        senderId: studentId,
        senderName: 'Arjun Menon',
        senderRole: 'STUDENT',
        recipientId: instructorId,
        courseId,
        batchId,
        subject: 'Ventilation Formulas Question',
        content: 'Could you clarify Slide 12 equation?',
        read: false,
        clientMessageId: 'client-req-uuid-12345',
        createdAt: '2026-11-03T10:00:00.000Z',
      };

      const dbRow = mapDomainDirectMessageToDb(domainMsg);
      expect(dbRow.id).toBe('msg-test-01');
      expect(dbRow.sender_id).toBe(studentId);
      expect(dbRow.sender_name).toBe('Arjun Menon');
      expect(dbRow.sender_role).toBe('STUDENT');
      expect(dbRow.recipient_id).toBe(instructorId);
      expect(dbRow.course_id).toBe(courseId);
      expect(dbRow.batch_id).toBe(batchId);
      expect(dbRow.subject).toBe('Ventilation Formulas Question');
      expect(dbRow.content).toBe('Could you clarify Slide 12 equation?');
      expect(dbRow.read).toBe(false);
      expect(dbRow.client_message_id).toBe('client-req-uuid-12345');
      expect(dbRow.created_at).toBe('2026-11-03T10:00:00.000Z');
    });

    it('2.2 should accurately map database snake_case row to domain DirectMessage', () => {
      const dbRow = {
        id: 'msg-db-99',
        sender_id: instructorId,
        sender_name: 'Vishnu Rajendran',
        sender_role: 'INSTRUCTOR',
        recipient_id: studentId,
        course_id: courseId,
        batch_id: batchId,
        subject: 'Office Hours Confirmation',
        content: 'Let us discuss on Tuesday at 4 PM.',
        read: true,
        read_at: '2026-11-03T12:00:00.000Z',
        client_message_id: 'client-req-999',
        created_at: '2026-11-03T11:00:00.000Z',
        updated_at: '2026-11-03T12:00:00.000Z',
      };

      const domainMsg = mapDbDirectMessageToDomain(dbRow);
      expect(domainMsg.id).toBe('msg-db-99');
      expect(domainMsg.senderId).toBe(instructorId);
      expect(domainMsg.senderName).toBe('Vishnu Rajendran');
      expect(domainMsg.senderRole).toBe('INSTRUCTOR');
      expect(domainMsg.recipientId).toBe(studentId);
      expect(domainMsg.courseId).toBe(courseId);
      expect(domainMsg.batchId).toBe(batchId);
      expect(domainMsg.subject).toBe('Office Hours Confirmation');
      expect(domainMsg.content).toBe('Let us discuss on Tuesday at 4 PM.');
      expect(domainMsg.read).toBe(true);
      expect(domainMsg.readAt).toBe('2026-11-03T12:00:00.000Z');
      expect(domainMsg.clientMessageId).toBe('client-req-999');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Task B: Core Messaging Service Operations & Database Facade
  // --------------------------------------------------------------------------
  describe('Task B: Messaging Service Validation & Business Constraints', () => {
    it('3.1 should reject messages without courseId', async () => {
      await expect(
        db.sendDirectMessage({
          senderId: studentId,
          senderName: 'Arjun',
          senderRole: 'STUDENT',
          recipientId: instructorId,
          courseId: '',
          content: 'Hello',
        })
      ).rejects.toThrow(/courseId is required/);
    });

    it('3.2 should reject messages with empty or whitespace-only content', async () => {
      await expect(
        db.sendDirectMessage({
          senderId: studentId,
          senderName: 'Arjun',
          senderRole: 'STUDENT',
          recipientId: instructorId,
          courseId,
          content: '   ',
        })
      ).rejects.toThrow(/content cannot be empty/);
    });

    it('3.3 should reject messages exceeding 5000 characters', async () => {
      const hugeContent = 'A'.repeat(5001);
      await expect(
        db.sendDirectMessage({
          senderId: studentId,
          senderName: 'Arjun',
          senderRole: 'STUDENT',
          recipientId: instructorId,
          courseId,
          content: hugeContent,
        })
      ).rejects.toThrow(/exceeds 5000 characters/);
    });

    it('3.4 should reject sending a direct message to oneself', async () => {
      await expect(
        db.sendDirectMessage({
          senderId: studentId,
          senderName: 'Arjun',
          senderRole: 'STUDENT',
          recipientId: studentId, // Self messaging
          courseId,
          content: 'Note to self',
        })
      ).rejects.toThrow(/Cannot send direct message to yourself/);
    });

    it('3.5 should successfully send, list, and filter direct messages', async () => {
      const sent = await db.sendDirectMessage({
        senderId: studentId,
        senderName: 'Arjun Menon',
        senderRole: 'STUDENT',
        recipientId: instructorId,
        courseId,
        batchId,
        subject: 'Calculations Question',
        content: 'Is equation 4 mandatory for the quiz?',
      });

      expect(sent.id).toBeDefined();
      expect(sent.read).toBe(false);

      const msgs = await db.getDirectMessages(studentId, courseId, batchId);
      const found = msgs.find((m) => m.id === sent.id);
      expect(found).toBeDefined();
      expect(found?.content).toBe('Is equation 4 mandatory for the quiz?');
    });

    it('3.6 should enforce recipient authorization when marking a message as read', async () => {
      const sent = await db.sendDirectMessage({
        senderId: studentId,
        senderName: 'Arjun Menon',
        senderRole: 'STUDENT',
        recipientId: instructorId,
        courseId,
        content: 'Question for instructor',
      });

      // An intruder student cannot mark instructor's message as read
      const unauthorizedUpdate = await db.markDirectMessageRead(sent.id, intruderToken ? 'usr-intruder-99' : '');
      expect(unauthorizedUpdate).toBe(false);

      // The actual recipient can mark it as read
      const authorizedUpdate = await db.markDirectMessageRead(sent.id, instructorId);
      expect(authorizedUpdate).toBe(true);

      const updated = await db.getDirectMessageById(sent.id);
      expect(updated?.read).toBe(true);
      expect(updated?.readAt).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 4. Task B: API Route Security & Concurrency
  // --------------------------------------------------------------------------
  describe('Task B: API Route Handlers (/api/messages)', () => {
    it('4.1 POST /api/messages rejects unauthenticated requests', async () => {
      const req = new Request('http://localhost:3000/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, content: 'Test unauth' }),
      });
      const res = await postMessage(req);
      expect(res.status).toBe(401);
    });

    it('4.2 POST /api/messages validates body parameters', async () => {
      // Missing courseId
      const res1 = await postMessage(
        new Request('http://localhost:3000/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({ content: 'No course id' }),
        })
      );
      expect(res1.status).toBe(400);

      // Self messaging
      const res2 = await postMessage(
        new Request('http://localhost:3000/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({ courseId, recipientId: studentId, content: 'To self' }),
        })
      );
      expect(res2.status).toBe(400);
      const err = await res2.json();
      expect(err.error).toMatch(/Cannot send message to yourself/);
    });

    it('4.3 POST /api/messages sends message and derives sender identity from session', async () => {
      const res = await postMessage(
        new Request('http://localhost:3000/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${studentToken}`,
          },
          body: JSON.stringify({
            courseId,
            batchId,
            recipientId: instructorId,
            subject: 'Study Pack',
            content: 'Received the notes, thank you!',
            clientMessageId: 'client-req-abc-123',
          }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message.senderId).toBe(studentId); // Derived strictly from verified token
      expect(body.message.senderRole).toBe('STUDENT');
      expect(body.message.clientMessageId).toBe('client-req-abc-123');
    });

    it('4.4 GET /api/messages returns user messages and unreadCount', async () => {
      const res = await getMessages(
        new Request(`http://localhost:3000/api/messages?courseId=${courseId}&batchId=${batchId}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${instructorToken}` },
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(Array.isArray(body.messages)).toBe(true);
      expect(typeof body.unreadCount).toBe('number');
    });

    it('4.5 PATCH /api/messages marks message as read and enforces recipient identity', async () => {
      // Create unread message for student
      const sent = await db.sendDirectMessage({
        senderId: instructorId,
        senderName: 'Vishnu Rajendran',
        senderRole: 'INSTRUCTOR',
        recipientId: studentId,
        courseId,
        content: 'Please submit your draft by tomorrow',
      });

      // Intruder attempts to mark student message as read -> 404/403
      const badReq = new Request('http://localhost:3000/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${intruderToken}`,
        },
        body: JSON.stringify({ messageId: sent.id }),
      });
      const badRes = await patchMessage(badReq);
      expect(badRes.status).toBe(404);

      // Student marks own message as read -> 200
      const goodReq = new Request('http://localhost:3000/api/messages', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ messageId: sent.id }),
      });
      const goodRes = await patchMessage(goodReq);
      expect(goodRes.status).toBe(200);
      const goodBody = await goodRes.json();
      expect(goodBody.success).toBe(true);

      const verified = await db.getDirectMessageById(sent.id);
      expect(verified?.read).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Task C: Legacy Classroom Route Permanent Redirection
  // --------------------------------------------------------------------------
  describe('Task C: Legacy Course Classroom Route Consolidation', () => {
    it('5.1 should trigger permanentRedirect resolving course slug to canonical course ID', async () => {
      try {
        await LegacyCourseClassroomPage({
          params: { slug: courseSlug },
          searchParams: { batchId },
        });
        // permanentRedirect in Next.js throws NEXT_REDIRECT error
        expect.fail('Expected permanentRedirect to throw NEXT_REDIRECT');
      } catch (err: any) {
        expect(err.digest).toBeDefined();
        // NEXT_REDIRECT;replace;/classroom?courseId=crs-asp-01&batchId=btc-asp-nov26;308;
        expect(err.digest).toContain('/classroom');
        expect(err.digest).toContain('courseId=crs-asp-01');
        expect(err.digest).toContain('batchId=btc-asp-nov26');
        expect(err.digest).toContain('308'); // Standard Next.js permanent redirect status
      }
    });

    it('5.2 should handle direct course ID in legacy path gracefully', async () => {
      try {
        await LegacyCourseClassroomPage({
          params: { slug: courseId },
        });
        expect.fail('Expected permanentRedirect to throw NEXT_REDIRECT');
      } catch (err: any) {
        expect(err.digest).toContain('/classroom');
        expect(err.digest).toContain('courseId=crs-asp-01');
        expect(err.digest).toContain('308');
      }
    });

    it('5.3 should preserve unknown slug safely in courseId parameter without crashing', async () => {
      try {
        await LegacyCourseClassroomPage({
          params: { slug: 'nonexistent-custom-course' },
        });
        expect.fail('Expected permanentRedirect to throw NEXT_REDIRECT');
      } catch (err: any) {
        expect(err.digest).toContain('/classroom');
        expect(err.digest).toContain('courseId=nonexistent-custom-course');
        expect(err.digest).toContain('308');
      }
    });
  });

  // --------------------------------------------------------------------------
  // 6. Persistence Durability & Concurrency
  // --------------------------------------------------------------------------
  describe('Persistence Durability & Concurrency', () => {
    it('6.1 should persist messages and survive repeated queries', async () => {
      const msg = await db.sendDirectMessage({
        senderId: instructorId,
        senderName: 'Vishnu Rajendran',
        senderRole: 'INSTRUCTOR',
        recipientId: studentId,
        courseId,
        subject: 'Durability Check',
        content: 'This message verifies persistent storage.',
        clientMessageId: 'idemp-101',
      });

      const list1 = await db.getDirectMessages(studentId, courseId);
      expect(list1.some((m) => m.id === msg.id)).toBe(true);

      const fetched = await db.getDirectMessageById(msg.id);
      expect(fetched?.content).toBe('This message verifies persistent storage.');
      expect(fetched?.clientMessageId).toBe('idemp-101');
    });

    it('6.2 should support pagination with limit and offset', async () => {
      const msgs = await db.getDirectMessages(studentId, courseId, undefined, 2, 0);
      expect(msgs.length).toBeLessThanOrEqual(2);
    });
  });
});

