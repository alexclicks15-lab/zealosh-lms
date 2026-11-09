// Zealosh LMS — Unified Institutional Calendar & Scheduling Engine
// Aggregates batch timetables, live sessions, examinations, orientation sessions, and institutional holidays
// File: src/lib/scheduling/calendar-service.ts

import {
  CalendarEvent,
  CalendarEventType,
  CalendarEventStatus,
  ScheduleConflict,
  InstitutionalHoliday,
  InstructorAvailability,
  RecurringScheduleRule,
  LiveSession,
  Batch,
  UserRole,
} from '@/types';
import { db } from '@/lib/store/db';
import { OrientationService } from '@/lib/orientation/orientation-service';

export const DEFAULT_INSTITUTIONAL_TIMEZONE = 'Asia/Kolkata';

// In-memory holidays registry (seeded with official institutional academic calendar)
const inMemoryHolidays: Map<string, InstitutionalHoliday> = new Map([
  [
    'hol-2026-01-26',
    {
      id: 'hol-2026-01-26',
      name: 'Republic Day',
      date: '2026-01-26',
      description: 'National Holiday',
      affectsBatches: true,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    'hol-2026-08-15',
    {
      id: 'hol-2026-08-15',
      name: 'Independence Day',
      date: '2026-08-15',
      description: 'National Holiday',
      affectsBatches: true,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    'hol-2026-10-02',
    {
      id: 'hol-2026-10-02',
      name: 'Gandhi Jayanti',
      date: '2026-10-02',
      description: 'National Holiday',
      affectsBatches: true,
      createdAt: new Date().toISOString(),
    },
  ],
  [
    'hol-2026-11-01',
    {
      id: 'hol-2026-11-01',
      name: 'Kerala Piravi',
      date: '2026-11-01',
      description: 'Kerala State Formation Day',
      affectsBatches: true,
      createdAt: new Date().toISOString(),
    },
  ],
]);

// In-memory instructor availability blocks
const inMemoryInstructorAvailability: Map<string, InstructorAvailability> = new Map();

export class CalendarService {
  public static resetForTesting() {
    inMemoryInstructorAvailability.clear();
  }

  /**
   * Returns list of all institutional holidays
   */
  public static getHolidays(): InstitutionalHoliday[] {
    return Array.from(inMemoryHolidays.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  /**
   * Adds or updates an institutional holiday
   */
  public static addHoliday(holiday: Omit<InstitutionalHoliday, 'id' | 'createdAt'>): InstitutionalHoliday {
    const id = `hol-${holiday.date}`;
    const fullHoliday: InstitutionalHoliday = {
      ...holiday,
      id,
      createdAt: new Date().toISOString(),
    };
    inMemoryHolidays.set(id, fullHoliday);
    return fullHoliday;
  }

  /**
   * Checks whether a specific date (YYYY-MM-DD) is an institutional holiday
   */
  public static isHoliday(dateStr: string): boolean {
    const d = dateStr.slice(0, 10);
    return Array.from(inMemoryHolidays.values()).some(
      (h) => h.date === d && h.affectsBatches
    );
  }

  /**
   * Set instructor availability and blocked periods
   */
  public static setInstructorAvailability(availability: InstructorAvailability): void {
    inMemoryInstructorAvailability.set(availability.instructorId, availability);
  }

  /**
   * Get instructor availability
   */
  public static getInstructorAvailability(instructorId: string): InstructorAvailability | null {
    return inMemoryInstructorAvailability.get(instructorId) || null;
  }

  /**
   * Check schedule conflicts for a proposed live class or session slot
   */
  public static async checkScheduleConflicts(params: {
    instructorId?: string;
    batchId?: string;
    startTime: string; // ISO 8601 UTC
    endTime: string; // ISO 8601 UTC
    excludeEventId?: string;
  }): Promise<ScheduleConflict[]> {
    const conflicts: ScheduleConflict[] = [];
    const proposedStart = new Date(params.startTime).getTime();
    const proposedEnd = new Date(params.endTime).getTime();

    if (proposedEnd <= proposedStart) {
      conflicts.push({
        type: 'RESOURCE_OVERLAP',
        message: 'Invalid schedule slot: end time must be after start time',
        conflictingEventId: 'invalid-time',
        resourceId: 'time-slot',
        timeOverlap: { start: params.startTime, end: params.endTime },
      });
      return conflicts;
    }

    // 1. Check all live sessions for overlapping times
    const batches = await db.getBatches();
    for (const batch of batches) {
      const sessions = await db.getLiveSessions(batch.id);
      for (const s of sessions) {
        if (params.excludeEventId && s.id === params.excludeEventId) continue;
        if (s.status === 'ENDED') continue;

        const sessionStart = new Date(s.scheduledStartTime).getTime();
        const duration = s.durationMinutes || 120;
        const sessionEnd = sessionStart + duration * 60 * 1000;

        // Overlap condition: (StartA < EndB) and (EndA > StartB)
        const overlaps = proposedStart < sessionEnd && proposedEnd > sessionStart;
        if (!overlaps) continue;

        // Instructor conflict
        if (params.instructorId && s.instructorId === params.instructorId) {
          conflicts.push({
            type: 'INSTRUCTOR_OVERLAP',
            message: `Instructor is already assigned to session "${s.title}" in batch "${batch.name}" during this time window`,
            conflictingEventId: s.id,
            resourceId: params.instructorId,
            timeOverlap: {
              start: new Date(Math.max(proposedStart, sessionStart)).toISOString(),
              end: new Date(Math.min(proposedEnd, sessionEnd)).toISOString(),
            },
          });
        }

        // Batch conflict
        if (params.batchId && s.batchId === params.batchId) {
          conflicts.push({
            type: 'BATCH_OVERLAP',
            message: `Batch "${batch.name}" already has live session "${s.title}" scheduled during this time window`,
            conflictingEventId: s.id,
            resourceId: params.batchId,
            timeOverlap: {
              start: new Date(Math.max(proposedStart, sessionStart)).toISOString(),
              end: new Date(Math.min(proposedEnd, sessionEnd)).toISOString(),
            },
          });
        }
      }
    }

    // 2. Check instructor blocked periods
    if (params.instructorId) {
      const avail = inMemoryInstructorAvailability.get(params.instructorId);
      if (avail?.blockedPeriods) {
        for (const block of avail.blockedPeriods) {
          const blockStart = new Date(block.start).getTime();
          const blockEnd = new Date(block.end).getTime();
          if (proposedStart < blockEnd && proposedEnd > blockStart) {
            conflicts.push({
              type: 'INSTRUCTOR_OVERLAP',
              message: `Instructor has blocked availability: ${block.reason || 'Personal leave'}`,
              conflictingEventId: 'blocked-period',
              resourceId: params.instructorId,
              timeOverlap: {
                start: new Date(Math.max(proposedStart, blockStart)).toISOString(),
                end: new Date(Math.min(proposedEnd, blockEnd)).toISOString(),
              },
            });
          }
        }
      }
    }

    return conflicts;
  }

  /**
   * Expands a recurring schedule rule between startDate and endDate
   */
  public static expandRecurringSchedule(params: {
    rule: RecurringScheduleRule;
    startDate: string; // ISO 8601 or YYYY-MM-DD
    endDate: string;
    exceptionDates?: string[];
  }): { startTime: string; endTime: string; dayOfWeek: number }[] {
    const occurrences: { startTime: string; endTime: string; dayOfWeek: number }[] = [];
    const { rule, startDate, endDate, exceptionDates = [] } = params;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeZone = rule.timeZone || DEFAULT_INSTITUTIONAL_TIMEZONE;

    // Parse rule startTime ("HH:mm")
    const [hours, minutes] = rule.startTime.split(':').map((v) => parseInt(v, 10));
    const durationMs = (rule.durationMinutes || 120) * 60 * 1000;

    const current = new Date(start);
    // Iterate day by day
    while (current <= end) {
      const dayOfWeek = current.getUTCDay(); // 0 = Sun, 1 = Mon ...
      const isoDateStr = current.toISOString().slice(0, 10);

      // Check if day is selected and not an exception or institutional holiday
      if (
        rule.daysOfWeek.includes(dayOfWeek) &&
        !exceptionDates.includes(isoDateStr) &&
        !this.isHoliday(isoDateStr)
      ) {
        // Construct occurrence start time
        const occStart = new Date(current);
        occStart.setUTCHours(hours || 19, minutes || 0, 0, 0);

        const occEnd = new Date(occStart.getTime() + durationMs);

        occurrences.push({
          startTime: occStart.toISOString(),
          endTime: occEnd.toISOString(),
          dayOfWeek,
        });
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    return occurrences;
  }

  /**
   * Aggregates institutional calendar events across domain boundaries
   * Strictly permission-scoped per user role
   */
  public static async getCalendarEvents(params: {
    startDate: string; // ISO 8601 UTC
    endDate: string; // ISO 8601 UTC
    userId?: string;
    userRole?: UserRole;
    courseId?: string;
    batchId?: string;
    eventType?: CalendarEventType;
    timeZone?: string;
  }): Promise<CalendarEvent[]> {
    const {
      startDate,
      endDate,
      userId,
      userRole = 'STUDENT',
      courseId,
      batchId,
      eventType,
      timeZone = DEFAULT_INSTITUTIONAL_TIMEZONE,
    } = params;

    const queryStart = new Date(startDate).getTime();
    const queryEnd = new Date(endDate).getTime();
    const events: CalendarEvent[] = [];

    // Pre-load batches and courses
    const allCourses = await db.getCourses();
    const courseMap = new Map(allCourses.map((c) => [c.id, c]));

    const allBatches = await db.getBatches();
    const batchMap = new Map(allBatches.map((b) => [b.id, b]));

    // Resolve user's active enrollments for role-based filtering
    let userEnrolledBatchIds: Set<string> = new Set();
    let userEnrolledCourseIds: Set<string> = new Set();
    if (userId && (userRole === 'STUDENT' || userRole === 'INSTRUCTOR')) {
      const enrollments = await db.getEnrollments(userId);
      userEnrolledBatchIds = new Set(
        enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.batchId)
      );
      userEnrolledCourseIds = new Set(
        enrollments.filter((e) => e.status === 'ACTIVE').map((e) => e.courseId)
      );
    }

    // 1. LIVE SESSIONS & BATCH SESSIONS
    if (!eventType || eventType === 'BATCH_SESSION') {
      for (const batch of allBatches) {
        // Filter by course/batch if specified
        if (courseId && batch.courseId !== courseId) continue;
        if (batchId && batch.id !== batchId) continue;

        // Role-based visibility
        if (userRole === 'STUDENT' && userId && !userEnrolledBatchIds.has(batch.id)) {
          continue;
        }
        if (userRole === 'INSTRUCTOR' && userId && batch.leadInstructorId !== userId) {
          continue;
        }

        const sessions = await db.getLiveSessions(batch.id);
        const course = courseMap.get(batch.courseId);

        for (const s of sessions) {
          const sTime = new Date(s.scheduledStartTime).getTime();
          const duration = s.durationMinutes || 120;
          const eTime = sTime + duration * 60 * 1000;

          if (sTime >= queryStart && sTime <= queryEnd) {
            events.push({
              id: `ev-sess-${s.id}`,
              title: s.title,
              description: `Batch: ${batch.name}`,
              eventType: 'BATCH_SESSION',
              courseId: batch.courseId,
              courseName: course?.title || 'Course',
              batchId: batch.id,
              batchName: batch.name,
              instructorId: s.instructorId,
              startTime: new Date(sTime).toISOString(),
              endTime: new Date(eTime).toISOString(),
              timeZone,
              locationType: 'ONLINE',
              meetingId: s.meetingId,
              status: s.status === 'LIVE' ? 'IN_PROGRESS' : s.status === 'ENDED' ? 'COMPLETED' : 'SCHEDULED',
              sourceEntityId: s.id,
              sourceEntityType: 'LIVE_SESSION',
            });
          }
        }
      }
    }

    // 2. EXAMINATIONS
    if (!eventType || eventType === 'EXAM') {
      const examBlueprints = await db.getExamBlueprints();
      for (const ex of examBlueprints) {
        const matchingCourse = allCourses.find(
          (c) => c.certificationType === ex.certificationType || c.id === (ex as any).courseId
        );
        const resolvedCourseId = matchingCourse?.id;

        if (courseId && resolvedCourseId && resolvedCourseId !== courseId) continue;
        if (userRole === 'STUDENT' && userId && resolvedCourseId && !userEnrolledCourseIds.has(resolvedCourseId)) {
          continue;
        }

        // Project exam events
        const exStart = ex.scheduledStartTime
          ? new Date(ex.scheduledStartTime).getTime()
          : queryStart + 7 * 86400000;
        const exDuration = (ex.durationMinutes || 120) * 60 * 1000;
        const exEnd = ex.scheduledEndTime
          ? new Date(ex.scheduledEndTime).getTime()
          : exStart + exDuration;

        if (exStart >= queryStart && exStart <= queryEnd) {
          events.push({
            id: `ev-exam-${ex.id}`,
            title: `Certification Exam: ${ex.title}`,
            description: `Passing Score: ${ex.passingScorePercent || 70}% (${ex.durationMinutes} mins)`,
            eventType: 'EXAM',
            courseId: resolvedCourseId,
            courseName: matchingCourse?.title,
            startTime: new Date(exStart).toISOString(),
            endTime: new Date(exEnd).toISOString(),
            timeZone,
            locationType: 'ONLINE',
            status: 'SCHEDULED',
            sourceEntityId: ex.id,
            sourceEntityType: 'EXAM',
          });
        }
      }
    }

    // 3. ORIENTATION SESSIONS
    if (!eventType || eventType === 'ORIENTATION') {
      const orientationSessions = await OrientationService.getOrientationSessions({
        courseId,
      });

      for (const os of orientationSessions) {
        const osStart = new Date(os.scheduledStartTime).getTime();
        const osEnd = new Date(os.scheduledEndTime).getTime();

        if (osStart >= queryStart && osStart <= queryEnd) {
          const course = courseMap.get(os.courseId);
          events.push({
            id: `ev-orient-${os.id}`,
            title: `Orientation: ${os.title}`,
            description: os.instructions || `Session Capacity: ${os.bookedCount}/${os.capacity}`,
            eventType: 'ORIENTATION',
            courseId: os.courseId,
            courseName: course?.title,
            instructorId: os.coordinatorId,
            instructorName: os.coordinatorName,
            startTime: os.scheduledStartTime,
            endTime: os.scheduledEndTime,
            timeZone: os.timeZone || timeZone,
            locationType: os.mode,
            meetingId: os.meetingId,
            venueDetails: os.venueDetails,
            capacity: os.capacity,
            enrolledOrBookedCount: os.bookedCount,
            status: os.status === 'PUBLISHED' ? 'PUBLISHED' : os.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED',
            sourceEntityId: os.id,
            sourceEntityType: 'ORIENTATION',
          });
        }
      }
    }

    // 4. INSTITUTIONAL HOLIDAYS
    if (!eventType || eventType === 'HOLIDAY') {
      for (const hol of inMemoryHolidays.values()) {
        const holTime = new Date(`${hol.date}T00:00:00Z`).getTime();
        if (holTime >= queryStart && holTime <= queryEnd) {
          events.push({
            id: `ev-${hol.id}`,
            title: `Institutional Holiday: ${hol.name}`,
            description: hol.description,
            eventType: 'HOLIDAY',
            startTime: `${hol.date}T00:00:00.000Z`,
            endTime: `${hol.date}T23:59:59.999Z`,
            timeZone,
            locationType: 'PHYSICAL',
            status: 'PUBLISHED',
            sourceEntityId: hol.id,
            sourceEntityType: 'HOLIDAY',
          });
        }
      }
    }

    // Sort chronologically by start time
    return events.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  /**
   * Reschedule an authoritative session or orientation event
   */
  public static async rescheduleEvent(params: {
    sourceEntityType: 'LIVE_SESSION' | 'ORIENTATION';
    sourceEntityId: string;
    newStartTime: string;
    newDurationMinutes?: number;
    reason: string;
    actorUserId: string;
  }): Promise<{ success: boolean; event: any }> {
    const { sourceEntityType, sourceEntityId, newStartTime, newDurationMinutes, reason, actorUserId } = params;

    if (sourceEntityType === 'LIVE_SESSION') {
      const session = db.liveSessions.get(sourceEntityId);
      if (!session) throw new Error(`LiveSession ${sourceEntityId} not found`);

      const duration = newDurationMinutes || session.durationMinutes;
      const conflicts = await this.checkScheduleConflicts({
        instructorId: session.instructorId,
        batchId: session.batchId,
        startTime: newStartTime,
        endTime: new Date(new Date(newStartTime).getTime() + duration * 60 * 1000).toISOString(),
        excludeEventId: session.id,
      });

      if (conflicts.length > 0) {
        throw new Error(`SCHEDULE_CONFLICT: ${conflicts[0].message}`);
      }

      session.scheduledStartTime = newStartTime;
      session.durationMinutes = duration;
      db.liveSessions.set(session.id, session);
      db.persistToDisk();

      // Notify enrolled learners
      const batch = db.batches.get(session.batchId);
      if (batch) {
        try {
          const allEnrollments = await db.getEnrollments();
          const enrollments = allEnrollments.filter((e) => e.batchId === session.batchId);
          for (const enr of enrollments) {
            await db.createNotification({
              recipientUserId: enr.userId,
              type: 'LIVE_SESSION_SCHEDULED',
              title: `[RESCHEDULED] ${session.title}`,
              description: `Session has been moved to ${new Date(newStartTime).toLocaleString('en-IN')}`,
              entityType: 'LIVE_SESSION',
              entityId: session.id,
              courseId: session.courseId,
              batchId: session.batchId,
              actionUrl: `/classroom?courseId=${session.courseId}&batchId=${session.batchId}`,
            });
          }
        } catch {
          // safe notification fallback
        }
      }

      return { success: true, event: session };
    } else if (sourceEntityType === 'ORIENTATION') {
      const os = await OrientationService.rescheduleOrientationSession({
        sessionId: sourceEntityId,
        newStartTime,
        newDurationMinutes,
        reason,
        actorUserId,
      });
      return { success: true, event: os };
    }

    throw new Error(`Unsupported sourceEntityType: ${sourceEntityType}`);
  }
}
