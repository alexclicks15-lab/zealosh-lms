import { describe, it, expect } from 'vitest';
import { moodleAdapter } from '../src/lib/adapters/moodle-adapter';
import { bbbAdapter, BigBlueButtonAdapter } from '../src/lib/adapters/bbb-adapter';
import crypto from 'crypto';

describe('External Upstream Integration Adapters', () => {
  describe('Moodle REST Adapter', () => {
    it('should create and link a Moodle user with deterministic ID', async () => {
      const res = await moodleAdapter.createUser({
        username: 'arjun_menon',
        firstname: 'Arjun',
        lastname: 'Menon',
        email: 'arjun@zealosh.com',
      });
      expect(res).toBeDefined();
      expect(res.id).toBeGreaterThan(0);
      expect(res.username).toBe('arjun_menon');
    });

    it('should synchronize course modules and sections', async () => {
      const contents = await moodleAdapter.getCourseContents(101);
      expect(Array.isArray(contents)).toBe(true);
      expect(contents.length).toBeGreaterThan(0);
      expect(contents[0].name).toContain('Module 1');
      expect(contents[0].modules.length).toBeGreaterThan(0);
    });

    it('should retrieve student completion status from Moodle core', async () => {
      const status = await moodleAdapter.getCourseCompletion(101, 501);
      expect(status).toBeDefined();
      expect(typeof status.percent).toBe('number');
    });
  });

  describe('BigBlueButton SHA-1 Adapter', () => {
    it('should compute exact SHA-1 checksum for API calls', () => {
      const customAdapter = new BigBlueButtonAdapter('https://bbb.example.com', 'test_salt_secret');
      const query = 'meetingID=room1&name=Class1';
      const expected = crypto.createHash('sha1').update(`create${query}test_salt_secret`).digest('hex');
      const actual = customAdapter.calculateChecksum('create', query);
      expect(actual).toBe(expected);
    });

    it('should generate signed join URLs without exposing shared secret', () => {
      const joinUrl = bbbAdapter.getJoinUrl({
        meetingId: 'zealosh-live-101',
        fullName: 'Arjun Menon',
        password: 'student_pass',
        userId: 'usr-std-01',
        role: 'STUDENT',
      });
      expect(joinUrl).toBeDefined();
      expect(joinUrl).toContain('zealosh-live-101');
      expect(joinUrl).not.toContain('mock_bbb_secret_salt'); // Shared secret must never leak into client URLs
    });

    it('should provision a meeting session successfully', async () => {
      const res = await bbbAdapter.createMeeting({
        meetingId: 'test-room-01',
        meetingName: 'ASP Math Masterclass',
      });
      expect(res.created).toBe(true);
      expect(res.meetingId).toBe('test-room-01');
    });
  });
});
