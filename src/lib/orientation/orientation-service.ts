// Zealosh LMS — Course Orientation Configuration, Booking Engine & Admission Gating
// File: src/lib/orientation/orientation-service.ts

import {
  CourseOrientationConfig,
  OrientationSession,
  OrientationBooking,
  OrientationBookingStatus,
  OrientationMode,
  OrientationSessionStatus,
} from '@/types';
import { db } from '@/lib/store/db';
import { classroomProvider } from '@/lib/classroom';

// In-memory configs, sessions, and bookings
const inMemoryConfigs: Map<string, CourseOrientationConfig> = new Map();
const inMemorySessions: Map<string, OrientationSession> = new Map();
const inMemoryBookings: Map<string, OrientationBooking> = new Map();

// Concurrency mutex lock for atomic booking operations
let isBookingLocked = false;
const acquireBookingLock = async (maxWaitMs: number = 2000): Promise<boolean> => {
  const start = Date.now();
  while (isBookingLocked) {
    if (Date.now() - start > maxWaitMs) return false;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  isBookingLocked = true;
  return true;
};
const releaseBookingLock = () => {
  isBookingLocked = false;
};

export class OrientationService {
  public static resetForTesting() {
    inMemoryConfigs.clear();
    inMemorySessions.clear();
    inMemoryBookings.clear();
    db.courseOrientationConfigs.clear();
    db.orientationSessions.clear();
    db.orientationBookings.clear();
    isBookingLocked = false;
    this.seedDefaultCourseConfigs();
  }

  /**
   * Seed default course configuration (ASP requires orientation by institutional policy)
   */
  public static seedDefaultCourseConfigs() {
    if (inMemoryConfigs.size === 0) {
      const config: CourseOrientationConfig = {
        courseId: 'crs-asp-01',
        isRequired: true,
        mode: 'ONLINE',
        sessionCapacity: 35,
        bookingWindowDays: 14,
        instructions: 'Comprehensive orientation covering syllabus structure, WebRTC live classroom guidelines, examination blueprints, and academic integrity policies.',
        venueDetails: 'Zealosh Virtual Classroom',
        reminderHoursBefore: 24,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      inMemoryConfigs.set('crs-asp-01', config);
      db.courseOrientationConfigs.set('crs-asp-01', config);

      // Seed one active orientation session for immediate testing
      const now = new Date();
      const sessionDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days in future
      const startIso = sessionDate.toISOString();
      const endIso = new Date(sessionDate.getTime() + 60 * 60 * 1000).toISOString();

      const session: OrientationSession = {
        id: 'orient-asp-01',
        courseId: 'crs-asp-01',
        title: 'ASP Candidate Cohort Orientation & Platform Walkthrough',
        mode: 'ONLINE',
        scheduledStartTime: startIso,
        scheduledEndTime: endIso,
        durationMinutes: 60,
        timeZone: 'Asia/Kolkata',
        capacity: 35,
        bookedCount: 0,
        coordinatorId: 'usr-admin-01',
        coordinatorName: 'Admissions Lead',
        meetingId: 'meet-orient-asp-01',
        instructions: 'Please test your audio and microphone 10 minutes prior to session start.',
        status: 'PUBLISHED',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      inMemorySessions.set('orient-asp-01', session);
      db.orientationSessions.set('orient-asp-01', session);
    }
  }

  /**
   * Get orientation configuration for a course
   */
  public static async getCourseOrientationConfig(courseId: string): Promise<CourseOrientationConfig> {
    this.seedDefaultCourseConfigs();
    const config = inMemoryConfigs.get(courseId);
    if (config) return config;

    // Default configuration if none explicitly saved (orientation not required by default)
    const defaultConfig: CourseOrientationConfig = {
      courseId,
      isRequired: false,
      mode: 'ONLINE',
      sessionCapacity: 50,
      bookingWindowDays: 14,
      instructions: 'Welcome to Zealosh Training & Consultants. Orientation is optional for this program.',
      reminderHoursBefore: 24,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    inMemoryConfigs.set(courseId, defaultConfig);
    return defaultConfig;
  }

  /**
   * Save orientation configuration for a course
   */
  public static async saveCourseOrientationConfig(
    config: Partial<CourseOrientationConfig> & { courseId: string }
  ): Promise<CourseOrientationConfig> {
    const existing = await this.getCourseOrientationConfig(config.courseId);
    const now = new Date().toISOString();

    const updated: CourseOrientationConfig = {
      ...existing,
      ...config,
      updatedAt: now,
    };

    inMemoryConfigs.set(config.courseId, updated);
    db.courseOrientationConfigs.set(config.courseId, updated);
    return updated;
  }

  /**
   * Create an orientation session
   */
  public static async createOrientationSession(params: {
    courseId: string;
    title: string;
    mode: OrientationMode;
    scheduledStartTime: string;
    durationMinutes?: number;
    timeZone?: string;
    capacity?: number;
    coordinatorId: string;
    coordinatorName?: string;
    venueDetails?: string;
    instructions?: string;
  }): Promise<OrientationSession> {
    const {
      courseId,
      title,
      mode,
      scheduledStartTime,
      durationMinutes = 60,
      timeZone = 'Asia/Kolkata',
      capacity = 50,
      coordinatorId,
      coordinatorName = 'Orientation Coordinator',
      venueDetails,
      instructions,
    } = params;

    const course = await db.getCourse(courseId);
    if (!course) {
      throw new Error(`Course ${courseId} not found`);
    }

    if (capacity <= 0) {
      throw new Error('Session capacity must be strictly greater than 0');
    }

    const start = new Date(scheduledStartTime);
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const now = new Date().toISOString();
    const id = `orient-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

    let meetingId: string | undefined = undefined;
    if (mode === 'ONLINE' || mode === 'HYBRID') {
      meetingId = `meet-${id}`;
      // Initialize classroom provider session if online (respecting provider honest status)
      try {
        await classroomProvider.provisionSession({
          sessionId: id,
          sessionTitle: title,
          meetingId,
          courseId,
          metadata: { orientationSessionId: id },
        });
      } catch {
        // Honest unconfigured behavior preserved
      }
    }

    const session: OrientationSession = {
      id,
      courseId,
      title,
      mode,
      scheduledStartTime: start.toISOString(),
      scheduledEndTime: end.toISOString(),
      durationMinutes,
      timeZone,
      capacity,
      bookedCount: 0,
      coordinatorId,
      coordinatorName,
      meetingId,
      venueDetails,
      instructions,
      status: 'PUBLISHED',
      createdAt: now,
      updatedAt: now,
    };

    inMemorySessions.set(id, session);
    db.orientationSessions.set(id, session);
    return session;
  }

  /**
   * List orientation sessions
   */
  public static async getOrientationSessions(filter?: {
    courseId?: string;
    status?: OrientationSessionStatus;
    onlyUpcoming?: boolean;
  }): Promise<OrientationSession[]> {
    this.seedDefaultCourseConfigs();
    let list = Array.from(inMemorySessions.values());

    if (filter?.courseId) {
      list = list.filter((s) => s.courseId === filter.courseId);
    }
    if (filter?.status) {
      list = list.filter((s) => s.status === filter.status);
    }
    if (filter?.onlyUpcoming) {
      const now = Date.now();
      list = list.filter((s) => new Date(s.scheduledEndTime).getTime() > now);
    }

    return list.sort(
      (a, b) => new Date(a.scheduledStartTime).getTime() - new Date(b.scheduledStartTime).getTime()
    );
  }

  /**
   * Get an orientation session by ID
   */
  public static async getOrientationSessionById(id: string): Promise<OrientationSession | null> {
    this.seedDefaultCourseConfigs();
    return inMemorySessions.get(id) || null;
  }

  /**
   * Atomic booking engine preventing overbooking under simultaneous requests
   */
  public static async bookOrientationSession(params: {
    sessionId: string;
    applicationId: string;
    userId: string;
    userEmail: string;
    userName: string;
    notes?: string;
    idempotencyKey?: string;
  }): Promise<{ success: boolean; booking: OrientationBooking; error?: string }> {
    const { sessionId, applicationId, userId, userEmail, userName, notes, idempotencyKey } = params;

    // Check idempotency first
    if (idempotencyKey) {
      const existingIdem = Array.from(inMemoryBookings.values()).find(
        (b) => b.idempotencyKey === idempotencyKey
      );
      if (existingIdem) {
        return { success: true, booking: existingIdem };
      }
    }

    const locked = await acquireBookingLock();
    if (!locked) {
      throw new Error('CONCURRENCY_TIMEOUT: Could not acquire booking lock. Please retry.');
    }

    try {
      const session = inMemorySessions.get(sessionId);
      if (!session) {
        throw new Error(`Orientation session ${sessionId} not found`);
      }

      if (session.status === 'CANCELLED') {
        throw new Error('SESSION_CANCELLED: Cannot book a cancelled orientation session');
      }

      // Check if user already booked an active slot for this course
      const existing = Array.from(inMemoryBookings.values()).find(
        (b) =>
          b.userId === userId &&
          b.courseId === session.courseId &&
          (b.status === 'BOOKED' || b.status === 'CONFIRMED' || b.status === 'ATTENDED')
      );

      if (existing) {
        throw new Error(
          `ALREADY_BOOKED: You already have an active orientation booking for this course (Booking ID: ${existing.id})`
        );
      }

      // Atomic capacity check
      if (session.bookedCount >= session.capacity) {
        throw new Error(
          `SESSION_FULL: This orientation session is fully booked (Capacity: ${session.capacity})`
        );
      }

      const now = new Date().toISOString();
      const bookingId = `obk-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;

      const booking: OrientationBooking = {
        id: bookingId,
        sessionId,
        applicationId,
        userId,
        userEmail,
        userName,
        courseId: session.courseId,
        status: 'CONFIRMED',
        bookedAt: now,
        notes,
        idempotencyKey,
      };

      // Atomic state mutation
      session.bookedCount += 1;
      session.updatedAt = now;
      inMemorySessions.set(sessionId, session);
      inMemoryBookings.set(bookingId, booking);
      db.orientationSessions.set(sessionId, session);
      db.orientationBookings.set(bookingId, booking);

      // Trigger notification
      try {
        await db.createNotification({
          recipientUserId: userId,
          type: 'LIVE_SESSION_SCHEDULED',
          title: `Orientation Booked: ${session.title}`,
          description: `Your orientation session has been confirmed for ${new Date(session.scheduledStartTime).toLocaleString()}.`,
          entityType: 'LIVE_SESSION',
          entityId: session.id,
          courseId: session.courseId,
          actionUrl: '/student',
        });
      } catch {
        // Safe notification delivery
      }

      return { success: true, booking };
    } finally {
      releaseBookingLock();
    }
  }

  /**
   * Reschedule an active booking to another available session
   */
  public static async rescheduleBooking(params: {
    bookingId: string;
    newSessionId: string;
    userId: string;
  }): Promise<{ success: boolean; booking: OrientationBooking }> {
    const { bookingId, newSessionId, userId } = params;

    const locked = await acquireBookingLock();
    if (!locked) {
      throw new Error('CONCURRENCY_TIMEOUT: Could not acquire booking lock. Please retry.');
    }

    try {
      const booking = inMemoryBookings.get(bookingId);
      if (!booking) throw new Error(`Booking ${bookingId} not found`);

      if (booking.userId !== userId) {
        throw new Error('UNAUTHORIZED: You are not authorized to reschedule this booking');
      }

      if (booking.sessionId === newSessionId) {
        return { success: true, booking };
      }

      const oldSession = inMemorySessions.get(booking.sessionId);
      const newSession = inMemorySessions.get(newSessionId);

      if (!newSession) throw new Error(`Target orientation session ${newSessionId} not found`);
      if (newSession.courseId !== booking.courseId) {
        throw new Error('CROSS_COURSE_INVALID: Target session belongs to a different course');
      }

      if (newSession.bookedCount >= newSession.capacity) {
        throw new Error('TARGET_SESSION_FULL: The requested session is fully booked');
      }

      const now = new Date().toISOString();

      // Decrement old session count
      if (oldSession && oldSession.bookedCount > 0) {
        oldSession.bookedCount -= 1;
        oldSession.updatedAt = now;
        inMemorySessions.set(oldSession.id, oldSession);
        db.orientationSessions.set(oldSession.id, oldSession);
      }

      // Increment new session count
      newSession.bookedCount += 1;
      newSession.updatedAt = now;
      inMemorySessions.set(newSession.id, newSession);
      db.orientationSessions.set(newSession.id, newSession);

      // Update booking
      booking.sessionId = newSessionId;
      booking.status = 'RESCHEDULED';
      inMemoryBookings.set(booking.id, booking);
      db.orientationBookings.set(booking.id, booking);

      return { success: true, booking };
    } finally {
      releaseBookingLock();
    }
  }

  /**
   * Cancel an active booking
   */
  public static async cancelBooking(
    bookingId: string,
    userId: string
  ): Promise<{ success: boolean; booking: OrientationBooking }> {
    const locked = await acquireBookingLock();
    if (!locked) {
      throw new Error('CONCURRENCY_TIMEOUT: Could not acquire booking lock. Please retry.');
    }

    try {
      const booking = inMemoryBookings.get(bookingId);
      if (!booking) throw new Error(`Booking ${bookingId} not found`);

      if (booking.userId !== userId) {
        throw new Error('UNAUTHORIZED: You are not authorized to cancel this booking');
      }

      const session = inMemorySessions.get(booking.sessionId);
      const now = new Date().toISOString();

      if (session && session.bookedCount > 0) {
        session.bookedCount -= 1;
        session.updatedAt = now;
        inMemorySessions.set(session.id, session);
        db.orientationSessions.set(session.id, session);
      }

      booking.status = 'CANCELLED';
      inMemoryBookings.set(booking.id, booking);
      db.orientationBookings.set(booking.id, booking);

      return { success: true, booking };
    } finally {
      releaseBookingLock();
    }
  }

  /**
   * Reschedule an entire orientation session (administrative action)
   */
  public static async rescheduleOrientationSession(params: {
    sessionId: string;
    newStartTime: string;
    newDurationMinutes?: number;
    reason: string;
    actorUserId: string;
  }): Promise<OrientationSession> {
    const { sessionId, newStartTime, newDurationMinutes, reason } = params;
    const session = inMemorySessions.get(sessionId);
    if (!session) throw new Error(`OrientationSession ${sessionId} not found`);

    const duration = newDurationMinutes || session.durationMinutes;
    const start = new Date(newStartTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const now = new Date().toISOString();

    session.scheduledStartTime = start.toISOString();
    session.scheduledEndTime = end.toISOString();
    session.durationMinutes = duration;
    session.updatedAt = now;
    session.status = 'PUBLISHED';
    inMemorySessions.set(session.id, session);

    return session;
  }

  /**
   * Record attendance for an orientation booking
   */
  public static async markAttendance(params: {
    bookingId: string;
    status: 'ATTENDED' | 'ABSENT';
    actorUserId: string;
    attendanceSource?: 'MANUAL_COORDINATOR' | 'VC_PROVIDER' | 'ADMIN_OVERRIDE';
    notes?: string;
  }): Promise<OrientationBooking> {
    const { bookingId, status, actorUserId, attendanceSource = 'MANUAL_COORDINATOR', notes } = params;

    const booking = inMemoryBookings.get(bookingId);
    if (!booking) {
      throw new Error(`Orientation booking ${bookingId} not found`);
    }

    booking.status = status;
    booking.attendanceMarkedAt = new Date().toISOString();
    booking.attendanceMarkedBy = actorUserId;
    booking.attendanceSource = attendanceSource;
    if (notes) booking.notes = notes;

    inMemoryBookings.set(booking.id, booking);
    db.orientationBookings.set(booking.id, booking);
    return booking;
  }

  /**
   * Get all bookings for a user
   */
  public static async getUserBookings(userId: string): Promise<OrientationBooking[]> {
    return Array.from(inMemoryBookings.values())
      .filter((b) => b.userId === userId)
      .sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime());
  }

  /**
   * Get all bookings for a specific session
   */
  public static async getSessionBookings(sessionId: string): Promise<OrientationBooking[]> {
    return Array.from(inMemoryBookings.values())
      .filter((b) => b.sessionId === sessionId)
      .sort((a, b) => new Date(a.bookedAt).getTime() - new Date(b.bookedAt).getTime());
  }

  /**
   * Evaluates whether an applicant has satisfied the orientation requirement for admission
   */
  public static async isOrientationSatisfied(
    courseId: string,
    applicationId: string,
    userId: string
  ): Promise<{ satisfied: boolean; isRequired: boolean; booking?: OrientationBooking; reason?: string }> {
    const config = await this.getCourseOrientationConfig(courseId);

    // If orientation is not required for this course, it is satisfied automatically
    if (!config.isRequired) {
      return { satisfied: true, isRequired: false };
    }

    // If required, verify whether an ATTENDED booking exists for this applicant and course
    const bookings = Array.from(inMemoryBookings.values()).filter(
      (b) =>
        (b.applicationId === applicationId || b.userId === userId) &&
        b.courseId === courseId &&
        b.status === 'ATTENDED'
    );

    if (bookings.length > 0) {
      return { satisfied: true, isRequired: true, booking: bookings[0] };
    }

    return {
      satisfied: false,
      isRequired: true,
      reason: 'Course policy mandates attendance at a live orientation session prior to admission approval.',
    };
  }
}

export const orientationService = new OrientationService();

