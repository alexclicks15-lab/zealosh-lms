// Zealosh LMS — Classroom Provider Contract & Abstraction Boundary
// Authoritative vendor-neutral interface decoupling Zealosh LMS from specific virtual classroom implementations.

import { bbbAdapter, BigBlueButtonAdapter, BBBRecordingItem } from '@/lib/adapters/bbb-adapter';
import {
  formatClassroomTitle,
  getBrandedWelcomeMessage,
} from './branding';

export type ClassroomParticipantRole = 'STUDENT' | 'INSTRUCTOR' | 'MODERATOR' | 'GUEST';

export interface ProvisionClassroomSessionParams {
  sessionId: string;
  sessionTitle: string;
  meetingId: string;
  courseId: string;
  batchId?: string;
  record?: boolean;
  welcomeMessage?: string;
  attendeePassword?: string;
  moderatorPassword?: string;
  metadata?: Record<string, string>;
}

export interface ProvisionClassroomSessionResult {
  success: boolean;
  meetingId: string;
  providerSessionId?: string;
  created: boolean;
  moderatorPassword?: string;
  attendeePassword?: string;
  rawStatus?: string;
}

export interface GenerateJoinUrlParams {
  meetingId: string;
  sessionId: string;
  userId: string;
  fullName: string;
  role: ClassroomParticipantRole;
  password?: string;
}

export interface ClassroomSessionStatusResult {
  meetingId: string;
  isRunning: boolean;
  participantCount?: number;
  moderatorCount?: number;
  startTime?: number | string;
  hasEnded?: boolean;
}

export interface ClassroomRecordingMetadata {
  recordId: string;
  meetingId: string;
  name: string;
  published: boolean;
  state: 'published' | 'processing' | 'unpublished' | 'deleted' | string;
  playbackUrl?: string;
  playbackFormat?: string;
  durationSeconds?: number;
  lengthMinutes?: number;
  startTime?: number | string;
  endTime?: number | string;
  sizeBytes?: number;
  metadata?: Record<string, string>;
}

export interface ClassroomRecordingQueryFilter {
  meetingId?: string;
  recordId?: string;
  state?: string;
}

export class ClassroomProviderError extends Error {
  public code:
    | 'CONFIG_MISSING'
    | 'PROVIDER_UNAVAILABLE'
    | 'AUTHENTICATION_FAILED'
    | 'MEETING_NOT_FOUND'
    | 'RECORDING_NOT_FOUND'
    | 'RATE_LIMITED'
    | 'INVALID_RESPONSE'
    | 'UPSTREAM_ERROR';
  public statusCode: number;
  public details?: unknown;

  constructor(
    message: string,
    code: ClassroomProviderError['code'] = 'UPSTREAM_ERROR',
    statusCode: number = 500,
    details?: unknown
  ) {
    super(message);
    this.name = 'ClassroomProviderError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

/**
 * Canonical Classroom Provider Contract
 * Decouples Zealosh LMS business logic from underlying WebRTC conferencing engines.
 */
export interface ClassroomProvider {
  /**
   * Unique identifier of this provider implementation (e.g. 'bbb-api', 'zealosh-classroom-selfhosted')
   */
  readonly providerId: string;

  /**
   * Provisions or validates an active classroom session on the media cluster.
   */
  provisionSession(params: ProvisionClassroomSessionParams): Promise<ProvisionClassroomSessionResult>;

  /**
   * Generates a signed, single-use participant join URL.
   * Enforces server-side credentials and role elevation.
   */
  generateJoinUrl(params: GenerateJoinUrlParams): Promise<string>;

  /**
   * Checks whether a classroom session is currently active.
   */
  getSessionStatus(meetingId: string): Promise<ClassroomSessionStatusResult>;

  /**
   * Retrieves recording metadata from the media cluster.
   */
  getRecordings(filter?: ClassroomRecordingQueryFilter): Promise<ClassroomRecordingMetadata[]>;

  /**
   * Ends an active classroom session on the media cluster.
   */
  endSession?(meetingId: string, moderatorPassword?: string): Promise<boolean>;
}

export interface BbbProviderConfig {
  baseUrl?: string;
  salt?: string;
}

/**
 * BigBlueButton API Classroom Provider Implementation
 * Adapts BigBlueButton 4.0 media cluster behind the vendor-neutral ClassroomProvider interface.
 */
export class BbbApiClassroomProvider implements ClassroomProvider {
  public readonly providerId = 'bbb-api';
  private adapter: BigBlueButtonAdapter;
  private config?: BbbProviderConfig;

  constructor(
    adapterOrConfig?: BigBlueButtonAdapter | BbbProviderConfig,
    customAdapter?: BigBlueButtonAdapter
  ) {
    if (customAdapter) {
      this.adapter = customAdapter;
      if (adapterOrConfig && !('createMeeting' in adapterOrConfig)) {
        this.config = adapterOrConfig as BbbProviderConfig;
      }
    } else if (
      adapterOrConfig &&
      (typeof (adapterOrConfig as any).createMeeting === 'function' ||
        typeof (adapterOrConfig as any).getRecordings === 'function' ||
        typeof (adapterOrConfig as any).getJoinUrl === 'function' ||
        typeof (adapterOrConfig as any).isMeetingRunning === 'function')
    ) {
      this.adapter = adapterOrConfig as BigBlueButtonAdapter;
    } else if (
      adapterOrConfig &&
      typeof adapterOrConfig === 'object' &&
      ('baseUrl' in adapterOrConfig || 'salt' in adapterOrConfig)
    ) {
      this.config = adapterOrConfig as BbbProviderConfig;
      this.adapter = new BigBlueButtonAdapter(this.config.baseUrl, this.config.salt);
    } else {
      this.adapter = bbbAdapter;
    }
  }

  public async provisionSession(
    params: ProvisionClassroomSessionParams
  ): Promise<ProvisionClassroomSessionResult> {
    if (this.config && (!this.config.baseUrl || !this.config.salt)) {
      throw new ClassroomProviderError(
        'Classroom provider credentials are not properly configured on server',
        'CONFIG_MISSING',
        500
      );
    }

    try {
      const formattedTitle = formatClassroomTitle(params.sessionTitle);
      const welcome = params.welcomeMessage || getBrandedWelcomeMessage(params.sessionTitle);

      const rawResult = await (this.adapter as any).createMeeting({
        meetingID: params.meetingId,
        meetingId: params.meetingId,
        meetingName: formattedTitle,
        name: formattedTitle,
        attendeePassword: params.attendeePassword || 'student_pass',
        moderatorPassword: params.moderatorPassword || 'instructor_pass',
        record: params.record ?? true,
        welcomeMessage: welcome,
        welcome,
        meta_courseId: params.courseId,
        meta_batchId: params.batchId,
        meta_sessionId: params.sessionId,
      });

      const isCreated =
        rawResult?.messageKey === 'duplicateWarning' ? false : (rawResult?.created ?? true);

      return {
        success: true,
        meetingId: rawResult?.meetingID || rawResult?.meetingId || params.meetingId,
        created: isCreated,
        moderatorPassword:
          rawResult?.moderatorPW ||
          rawResult?.moderatorPassword ||
          params.moderatorPassword ||
          'instructor_pass',
        attendeePassword:
          rawResult?.attendeePW ||
          rawResult?.attendeePassword ||
          params.attendeePassword ||
          'student_pass',
      };
    } catch (err: any) {
      if (err instanceof ClassroomProviderError) throw err;
      const message = err.message || 'Failed to provision classroom session';
      if (message.includes('not configured') || message.includes('missing')) {
        throw new ClassroomProviderError(
          'Classroom provider is not properly configured on server',
          'CONFIG_MISSING',
          500,
          err
        );
      }
      if (
        message.includes('checksum') ||
        message.includes('auth') ||
        message.includes('checksumError')
      ) {
        throw new ClassroomProviderError(
          'Classroom provider authentication failed',
          'AUTHENTICATION_FAILED',
          401,
          err
        );
      }
      throw new ClassroomProviderError(
        'Classroom provider is currently unavailable',
        'PROVIDER_UNAVAILABLE',
        503,
        err
      );
    }
  }

  public async generateJoinUrl(params: GenerateJoinUrlParams): Promise<string> {
    if (this.config && (!this.config.baseUrl || !this.config.salt)) {
      throw new ClassroomProviderError(
        'Classroom provider credentials are not properly configured on server',
        'CONFIG_MISSING',
        500
      );
    }

    try {
      const isModerator = params.role === 'INSTRUCTOR' || params.role === 'MODERATOR';
      const password = params.password || (isModerator ? 'instructor_pass' : 'student_pass');

      return await (this.adapter as any).getJoinUrl({
        meetingID: params.meetingId,
        meetingId: params.meetingId,
        sessionId: params.sessionId,
        fullName: params.fullName,
        password,
        userID: params.userId,
        userId: params.userId,
        role: isModerator ? 'INSTRUCTOR' : 'STUDENT',
      });
    } catch (err: any) {
      if (err instanceof ClassroomProviderError) throw err;
      throw new ClassroomProviderError(
        'Failed to generate classroom join URL',
        'UPSTREAM_ERROR',
        500,
        err
      );
    }
  }

  public async getSessionStatus(meetingId: string): Promise<ClassroomSessionStatusResult> {
    if (this.config && (!this.config.baseUrl || !this.config.salt)) {
      throw new ClassroomProviderError(
        'Classroom provider credentials are not properly configured on server',
        'CONFIG_MISSING',
        500
      );
    }

    try {
      if ((this.adapter as any).getMeetingInfo) {
        const info = await (this.adapter as any).getMeetingInfo(meetingId);
        const isRunning = info.running === 'true' || info.running === true;
        return {
          meetingId,
          isRunning,
          hasEnded: !isRunning,
          participantCount: info.participantCount ? Number(info.participantCount) : undefined,
          moderatorCount: info.moderatorCount ? Number(info.moderatorCount) : undefined,
          startTime: info.startTime,
        };
      }

      const isRunning = await this.adapter.isMeetingRunning(meetingId);
      return {
        meetingId,
        isRunning,
        hasEnded: !isRunning,
      };
    } catch (err: any) {
      if (err instanceof ClassroomProviderError) throw err;
      const msg = err.message || '';
      if (msg.includes('NotFound') || msg.includes('does not exist') || msg.includes('not found')) {
        return {
          meetingId,
          isRunning: false,
          hasEnded: true,
        };
      }
      throw new ClassroomProviderError(
        'Failed to query classroom session status',
        'PROVIDER_UNAVAILABLE',
        503,
        err
      );
    }
  }

  public async getRecordings(
    filter?: ClassroomRecordingQueryFilter
  ): Promise<ClassroomRecordingMetadata[]> {
    if (this.config && (!this.config.baseUrl || !this.config.salt)) {
      throw new ClassroomProviderError(
        'Classroom provider credentials are not properly configured on server',
        'CONFIG_MISSING',
        500
      );
    }

    try {
      const rawList = await this.adapter.getRecordings({
        meetingId: filter?.meetingId,
        recordId: filter?.recordId,
        state: filter?.state,
      });

      return rawList.map((r: BBBRecordingItem) => ({
        recordId: r.recordId || r.recordID || '',
        meetingId: r.meetingId || r.meetingID || '',
        name: r.name,
        published: r.published,
        state: r.state,
        playbackUrl: r.playbackUrl,
        playbackFormat: r.playbackFormat || r.playbackType,
        durationSeconds: r.durationSeconds,
        lengthMinutes: r.lengthMinutes,
        startTime: r.startTime,
        endTime: r.endTime,
        sizeBytes: r.sizeBytes || r.size,
        metadata: r.metadata,
      }));
    } catch (err: any) {
      if (err instanceof ClassroomProviderError) throw err;
      throw new ClassroomProviderError(
        'Failed to retrieve classroom recordings',
        'PROVIDER_UNAVAILABLE',
        503,
        err
      );
    }
  }

  public async endSession(meetingId: string, moderatorPassword?: string): Promise<boolean> {
    if (this.config && (!this.config.baseUrl || !this.config.salt)) {
      throw new ClassroomProviderError(
        'Classroom provider credentials are not properly configured on server',
        'CONFIG_MISSING',
        500
      );
    }

    try {
      if ((this.adapter as any).endMeeting) {
        return await (this.adapter as any).endMeeting({
          meetingId,
          password: moderatorPassword || 'instructor_pass',
        });
      }
      return true;
    } catch (err: any) {
      if (err instanceof ClassroomProviderError) throw err;
      throw new ClassroomProviderError(
        'Failed to end classroom session',
        'PROVIDER_UNAVAILABLE',
        503,
        err
      );
    }
  }

  // Test Seams for Vitest Mocking
  public setMockRecordings(recordings: (BBBRecordingItem | ClassroomRecordingMetadata)[]): void {
    this.adapter.setMockRecordings(recordings);
  }

  public addMockRecording(recording: BBBRecordingItem | ClassroomRecordingMetadata): void {
    this.adapter.addMockRecording(recording);
  }

  public clearMockRecordings(): void {
    this.adapter.clearMockRecordings();
  }

  public getRawAdapter(): BigBlueButtonAdapter {
    return this.adapter;
  }
}

// Singletons
export const bbbClassroomProvider = new BbbApiClassroomProvider(bbbAdapter);
export const classroomProvider: ClassroomProvider = bbbClassroomProvider;
