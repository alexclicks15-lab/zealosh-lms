// Zealosh LMS — Moodle Core REST Web Services Integration Adapter
// Authoritative for external Moodle learning activities, SCORM, and grade sync

export interface MoodleUserPayload {
  username: string;
  firstname: string;
  lastname: string;
  email: string;
}

export interface MoodleEnrolPayload {
  roleid: number; // 5 = Student, 3 = Teacher
  userid: number;
  courseid: number;
}

export interface MoodleCourseContent {
  id: number;
  name: string;
  summary: string;
  modules: {
    id: number;
    name: string;
    modname: string; // 'resource', 'assign', 'scorm', 'url'
    completion: number;
  }[];
}

export class MoodleClientAdapter {
  private baseUrl: string;
  private wsToken: string;
  private isMockMode: boolean;

  constructor(baseUrl?: string, wsToken?: string) {
    this.baseUrl = baseUrl || process.env.MOODLE_BASE_URL || 'https://moodle.internal.zealosh.com';
    this.wsToken = wsToken || process.env.MOODLE_WS_TOKEN || 'mock_token';
    this.isMockMode = process.env.MOODLE_MODE !== 'remote';
  }

  /**
   * Synchronize a user account to Moodle (core_user_create_users)
   */
  async createUser(payload: MoodleUserPayload): Promise<{ id: number; username: string }> {
    if (this.isMockMode) {
      // Deterministic mock Moodle ID based on email hash
      const mockId = Math.abs(payload.email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 1000));
      return { id: mockId, username: payload.username };
    }

    const url = `${this.baseUrl}/webservice/rest/server.php?wstoken=${this.wsToken}&wsfunction=core_user_create_users&moodlewsrestformat=json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ users: [payload] }),
    });

    if (!res.ok) {
      throw new Error(`Moodle API error: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.exception) {
      throw new Error(`Moodle exception: ${data.message}`);
    }

    return data[0];
  }

  /**
   * Enrol a user into a course (enrol_manual_enrol_users)
   */
  async enrolUser(payload: MoodleEnrolPayload): Promise<{ success: boolean }> {
    if (this.isMockMode) {
      return { success: true };
    }

    const url = `${this.baseUrl}/webservice/rest/server.php?wstoken=${this.wsToken}&wsfunction=enrol_manual_enrol_users&moodlewsrestformat=json`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enrolments: [payload] }),
    });

    const data = await res.json();
    if (data && data.exception) {
      throw new Error(`Moodle enrolment exception: ${data.message}`);
    }

    return { success: true };
  }

  /**
   * Fetch Course Sections & Modules (core_course_get_contents)
   */
  async getCourseContents(courseId: number): Promise<MoodleCourseContent[]> {
    if (this.isMockMode) {
      return [
        {
          id: 101,
          name: 'Module 1: Safety Fundamentals & Mathematics',
          summary: 'Core scientific foundations, basic probability, physics, and chemistry for safety professionals.',
          modules: [
            { id: 1001, name: 'Lecture 1.1: SI Unit Conversions and Radiation Math', modname: 'resource', completion: 1 },
            { id: 1002, name: 'Formulas and Quick Reference Card', modname: 'resource', completion: 1 },
            { id: 1003, name: 'Practice Problem Set 1', modname: 'assign', completion: 0 },
          ],
        },
        {
          id: 102,
          name: 'Module 2: Industrial Hygiene & Toxicology',
          summary: 'TLV, PEL, ventilation systems, noise monitoring, and toxicology equations.',
          modules: [
            { id: 1004, name: 'Lecture 2.1: Airborne Contaminant Calculations', modname: 'resource', completion: 0 },
            { id: 1005, name: 'Noise Dosimetry & Time-Weighted Average Math', modname: 'resource', completion: 0 },
          ],
        },
      ];
    }

    const url = `${this.baseUrl}/webservice/rest/server.php?wstoken=${this.wsToken}&wsfunction=core_course_get_contents&courseid=${courseId}&moodlewsrestformat=json`;
    const res = await fetch(url);
    return res.json();
  }

  /**
   * Fetch Course Completion Progress (core_completion_get_course_completion_status)
   */
  async getCourseCompletion(courseId: number, userId: number): Promise<{ completed: boolean; percent: number }> {
    if (this.isMockMode) {
      return { completed: false, percent: 35 };
    }

    const url = `${this.baseUrl}/webservice/rest/server.php?wstoken=${this.wsToken}&wsfunction=core_completion_get_course_completion_status&courseid=${courseId}&userid=${userId}&moodlewsrestformat=json`;
    const res = await fetch(url);
    const data = await res.json();
    return {
      completed: data?.completionstatus?.completed || false,
      percent: data?.completionstatus?.completed ? 100 : 50,
    };
  }
}

export const moodleAdapter = new MoodleClientAdapter();
