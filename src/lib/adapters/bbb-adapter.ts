// Zealosh LMS — BigBlueButton Live Classroom Integration Adapter
// Authoritative for live conferencing, audio bridge, whiteboard, and recordings

import crypto from 'crypto';

export interface BBBMeetingConfig {
  meetingId: string;
  meetingName: string;
  attendeePassword?: string;
  moderatorPassword?: string;
  record?: boolean;
  welcomeMessage?: string;
}

export interface BBBRecordingItem {
  recordId?: string;
  recordID?: string;
  meetingId?: string;
  meetingID?: string;
  name: string;
  published: boolean;
  state: 'published' | 'processing' | 'unpublished' | 'deleted' | string;
  startTime?: number | string;
  endTime?: number | string;
  playbackUrl?: string;
  playbackFormat?: string;
  playbackType?: string;
  lengthMinutes?: number;
  durationSeconds?: number;
  playbackLength?: number;
  sizeBytes?: number;
  size?: number;
  metadata?: Record<string, string>;
}

export class BigBlueButtonAdapter {
  private baseUrl: string;
  private salt: string;
  private isMockMode: boolean;
  private mockRecordings: Map<string, BBBRecordingItem> = new Map();

  constructor(baseUrl?: string, salt?: string) {
    this.baseUrl = baseUrl || process.env.BBB_BASE_URL || process.env.BIGBLUEBUTTON_BASE_URL || 'https://media.staging.zealosh.com/bigbluebutton/api';
    this.salt = salt || process.env.BBB_SECURITY_SALT || process.env.BIGBLUEBUTTON_SALT || 'zealosh_bbb_shared_salt_2026';
    const rawMode = (process.env.BBB_MODE || process.env.BIGBLUEBUTTON_MODE || '').split('#')[0].trim().replace(/^["']|["']$/g, '').toLowerCase();
    const isExplicitRemote = rawMode === 'remote';
    const isExplicitMock = rawMode === 'mock';
    const hasConfiguredRemote = Boolean(process.env.BBB_BASE_URL || process.env.BIGBLUEBUTTON_BASE_URL);
    this.isMockMode = isExplicitMock || (!isExplicitRemote && (!hasConfiguredRemote || process.env.NODE_ENV === 'test'));
  }

  public isOperatingInMockMode(): boolean {
    return this.isMockMode;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  /**
   * Computes BigBlueButton API SHA-1 checksum: SHA1(callName + queryString + salt)
   */
  public calculateChecksum(callName: string, queryParams: string): string {
    const raw = `${callName}${queryParams}${this.salt}`;
    return crypto.createHash('sha1').update(raw).digest('hex');
  }

  /**
   * Provisions a live meeting session on BigBlueButton (/create)
   */
  async createMeeting(config: BBBMeetingConfig): Promise<{ meetingId: string; created: boolean; moderatorPassword: string }> {
    const attendeePassword = config.attendeePassword || 'student_pass';
    const moderatorPassword = config.moderatorPassword || 'moderator_pass';
    const record = config.record ?? true;

    if (this.isMockMode) {
      return {
        meetingId: config.meetingId,
        created: true,
        moderatorPassword,
      };
    }

    const query = `attendeePW=${encodeURIComponent(attendeePassword)}&meetingID=${encodeURIComponent(
      config.meetingId
    )}&moderatorPW=${encodeURIComponent(moderatorPassword)}&name=${encodeURIComponent(
      config.meetingName
    )}&record=${record}`;

    const checksum = this.calculateChecksum('create', query);
    const requestUrl = `${this.baseUrl}/create?${query}&checksum=${checksum}`;

    const response = await fetch(requestUrl, { signal: AbortSignal.timeout(5000) });
    const xmlText = await response.text();

    if (!xmlText.includes('<returncode>SUCCESS</returncode>')) {
      throw new Error(`BigBlueButton create meeting failed: ${xmlText}`);
    }

    return {
      meetingId: config.meetingId,
      created: true,
      moderatorPassword,
    };
  }

  /**
   * Generates single-use signed join URL for attendee or moderator (/join)
   */
  getJoinUrl(params: {
    meetingId: string;
    sessionId?: string;
    fullName: string;
    password: string; // attendeePassword or moderatorPassword
    userId: string;
    role?: 'STUDENT' | 'INSTRUCTOR';
  }): string {
    const query = `fullName=${encodeURIComponent(params.fullName)}&meetingID=${encodeURIComponent(
      params.meetingId
    )}&password=${encodeURIComponent(params.password)}&userID=${encodeURIComponent(params.userId)}`;

    if (this.isMockMode) {
      // In local mode, route to the internal Zealosh interactive live-classroom simulator page using session ID
      const targetId = params.sessionId || params.meetingId;
      return `/live/${targetId}?role=${params.role || 'STUDENT'}&userId=${params.userId}&simulated=true`;
    }

    const checksum = this.calculateChecksum('join', query);
    return `${this.baseUrl}/join?${query}&checksum=${checksum}`;
  }

  /**
   * Check if meeting is currently running (/isMeetingRunning)
   */
  async isMeetingRunning(meetingId: string): Promise<boolean> {
    if (this.isMockMode) {
      return true;
    }

    const query = `meetingID=${encodeURIComponent(meetingId)}`;
    const checksum = this.calculateChecksum('isMeetingRunning', query);
    const url = `${this.baseUrl}/isMeetingRunning?${query}&checksum=${checksum}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text();
    return text.includes('<running>true</running>');
  }

  /**
   * Ends an active live meeting session on BigBlueButton (/end)
   */
  async endMeeting(params: { meetingId: string; password?: string }): Promise<boolean> {
    const password = params.password || 'instructor_pass';

    if (this.isMockMode) {
      return true;
    }

    const query = `meetingID=${encodeURIComponent(params.meetingId)}&password=${encodeURIComponent(password)}`;
    const checksum = this.calculateChecksum('end', query);
    const url = `${this.baseUrl}/end?${query}&checksum=${checksum}`;

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const text = await res.text();
      return text.includes('<returncode>SUCCESS</returncode>') || text.includes('meetingAlreadyEnded');
    } catch {
      return false;
    }
  }

  // ==========================================================================
  // Recording API Operations & Test Seams (/getRecordings)
  // ==========================================================================

  public setMockRecordings(recordings: (BBBRecordingItem | any)[]) {
    this.mockRecordings.clear();
    recordings.forEach((r) => this.addMockRecording(r));
  }

  public addMockRecording(recording: BBBRecordingItem | any) {
    const recId = recording.recordId || recording.recordID || `rec-${Date.now()}`;
    const mtgId = recording.meetingId || recording.meetingID || '';
    const normalized: BBBRecordingItem = {
      recordId: recId,
      recordID: recId,
      meetingId: mtgId,
      meetingID: mtgId,
      name: recording.name || '',
      published: Boolean(recording.published ?? (recording.state === 'published')),
      state: recording.state || (recording.published ? 'published' : 'processing'),
      startTime: recording.startTime,
      endTime: recording.endTime,
      playbackUrl: recording.playbackUrl,
      playbackFormat: recording.playbackFormat || recording.playbackType,
      playbackType: recording.playbackType || recording.playbackFormat,
      lengthMinutes:
        typeof recording.lengthMinutes === 'number'
          ? recording.lengthMinutes
          : typeof recording.playbackLength === 'number'
            ? recording.playbackLength
            : typeof recording.durationSeconds === 'number'
              ? Math.round(recording.durationSeconds / 60)
              : typeof recording.length === 'number'
                ? (recording.length > 300 ? Math.round(recording.length / 60) : recording.length)
                : undefined,
      durationSeconds:
        typeof recording.durationSeconds === 'number'
          ? recording.durationSeconds
          : typeof recording.length === 'number' && recording.length > 300
            ? recording.length
            : typeof recording.lengthMinutes === 'number'
              ? recording.lengthMinutes * 60
              : undefined,
      playbackLength:
        typeof recording.playbackLength === 'number'
          ? recording.playbackLength
          : typeof recording.lengthMinutes === 'number'
            ? recording.lengthMinutes
            : undefined,
      sizeBytes: typeof recording.sizeBytes === 'number' ? recording.sizeBytes : recording.size,
      size: typeof recording.size === 'number' ? recording.size : recording.sizeBytes,
      metadata: recording.metadata,
    };
    this.mockRecordings.set(recId, normalized);
  }

  public clearMockRecordings() {
    this.mockRecordings.clear();
  }

  /**
   * Retrieves recordings from BigBlueButton cluster (/getRecordings)
   */
  async getRecordings(params?: {
    meetingId?: string;
    meetingID?: string;
    recordId?: string;
    recordID?: string;
    state?: string;
  }): Promise<BBBRecordingItem[]> {
    const targetMeetingId = params?.meetingId || params?.meetingID;
    const targetRecordId = params?.recordId || params?.recordID;

    if (this.isMockMode) {
      let list = Array.from(this.mockRecordings.values());
      if (targetMeetingId) {
        list = list.filter((r) => r.meetingId === targetMeetingId || r.meetingID === targetMeetingId);
      }
      if (targetRecordId) {
        list = list.filter((r) => r.recordId === targetRecordId || r.recordID === targetRecordId);
      }
      if (params?.state) {
        list = list.filter((r) => r.state === params.state);
      }
      return list;
    }

    const queryParts: string[] = [];
    if (targetMeetingId) queryParts.push(`meetingID=${encodeURIComponent(targetMeetingId)}`);
    if (targetRecordId) queryParts.push(`recordID=${encodeURIComponent(targetRecordId)}`);
    if (params?.state) queryParts.push(`state=${encodeURIComponent(params.state)}`);
    const query = queryParts.join('&');

    const checksum = this.calculateChecksum('getRecordings', query);
    const url = `${this.baseUrl}/getRecordings?${query}${query ? '&' : ''}checksum=${checksum}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const xml = await res.text();
    if (!xml.includes('<returncode>SUCCESS</returncode>')) {
      if (xml.includes('noRecordings')) return [];
      throw new Error(`BigBlueButton getRecordings failed: ${xml}`);
    }

    return this.parseRecordingsXml(xml);
  }

  private parseRecordingsXml(xml: string): BBBRecordingItem[] {
    const items: BBBRecordingItem[] = [];
    const recordingRegex = /<recording>([\s\S]*?)<\/recording>/g;
    let match: RegExpExecArray | null;

    while ((match = recordingRegex.exec(xml)) !== null) {
      const block = match[1];
      const getTag = (tag: string) => {
        const m = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`).exec(block);
        return m ? m[1].trim() : '';
      };

      const recordId = getTag('recordID') || getTag('recordId');
      const meetingId = getTag('meetingID') || getTag('meetingId');
      const name = getTag('name');
      const published = getTag('published') === 'true';
      const state = getTag('state') || (published ? 'published' : 'processing');
      const playbackUrl = getTag('url');
      const rawLength = Number(getTag('length')) || undefined;
      const startTime = getTag('startTime') || undefined;
      const endTime = getTag('endTime') || undefined;

      let durationSeconds: number | undefined;
      let lengthMinutes: number | undefined;

      if (rawLength !== undefined) {
        if (rawLength > 300) {
          // Length > 300 is expressed in seconds (e.g. 3600 = 1 hour)
          durationSeconds = rawLength;
          lengthMinutes = Math.round(rawLength / 60);
        } else {
          // Length <= 300 might be minutes or seconds
          lengthMinutes = rawLength;
          durationSeconds = rawLength * 60;
        }
      }

      if (startTime && endTime) {
        const startMs = Number(startTime);
        const endMs = Number(endTime);
        if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
          const calculatedSec = Math.round((endMs - startMs) / 1000);
          durationSeconds = calculatedSec;
          lengthMinutes = Math.round(calculatedSec / 60);
        }
      }

      if (recordId && meetingId) {
        items.push({
          recordId,
          recordID: recordId,
          meetingId,
          meetingID: meetingId,
          name: name || meetingId,
          published,
          state,
          playbackUrl: playbackUrl || undefined,
          lengthMinutes,
          durationSeconds,
          startTime,
          endTime,
        });
      }
    }

    return items;
  }
}

export const bbbAdapter = new BigBlueButtonAdapter();
