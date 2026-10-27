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

export class BigBlueButtonAdapter {
  private baseUrl: string;
  private salt: string;
  private isMockMode: boolean;

  constructor(baseUrl?: string, salt?: string) {
    this.baseUrl = baseUrl || process.env.BBB_BASE_URL || process.env.BIGBLUEBUTTON_BASE_URL || 'https://media.staging.zealosh.com/bigbluebutton/api';
    this.salt = salt || process.env.BBB_SECURITY_SALT || process.env.BIGBLUEBUTTON_SALT || 'zealosh_bbb_shared_salt_2026';
    const isExplicitRemote = process.env.BBB_MODE === 'remote' || process.env.BIGBLUEBUTTON_MODE === 'remote';
    const hasConfiguredRemote = Boolean(process.env.BBB_BASE_URL || process.env.BIGBLUEBUTTON_BASE_URL);
    this.isMockMode = !isExplicitRemote && (!hasConfiguredRemote || process.env.NODE_ENV === 'test');
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

    const response = await fetch(requestUrl);
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
    fullName: string;
    password: string; // attendeePassword or moderatorPassword
    userId: string;
    role?: 'STUDENT' | 'INSTRUCTOR';
  }): string {
    const query = `fullName=${encodeURIComponent(params.fullName)}&meetingID=${encodeURIComponent(
      params.meetingId
    )}&password=${encodeURIComponent(params.password)}&userID=${encodeURIComponent(params.userId)}`;

    if (this.isMockMode) {
      // In local mode, route to the internal Zealosh interactive live-classroom simulator page
      return `/live/${params.meetingId}?role=${params.role || 'STUDENT'}&userId=${params.userId}&simulated=true`;
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

    const res = await fetch(url);
    const text = await res.text();
    return text.includes('<running>true</running>');
  }
}

export const bbbAdapter = new BigBlueButtonAdapter();
