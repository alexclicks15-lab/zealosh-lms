import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/store/db';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { POST as requestResetHandler } from '@/app/api/auth/password-reset/request/route';
import { POST as confirmResetHandler } from '@/app/api/auth/password-reset/confirm/route';
import { GET as getProfileHandler, PATCH as patchProfileHandler } from '@/app/api/users/profile/route';
import { signToken } from '@/lib/auth/jwt';

describe('Zealosh LMS — Phase 1 Workstream 1: Auth, Profiles & Multi-Role Governance', () => {
  beforeEach(() => {
    db.resetToSeed();
  });

  it('1. should resolve seeded user profile and student profile', async () => {
    const profile = await db.getProfile('usr-std-01');
    expect(profile).toBeDefined();
    expect(profile?.email).toBe('student@zealosh.com');
    expect(profile?.fullName).toBe('Arjun Menon');

    const studentProfile = await db.getStudentProfile('usr-std-01');
    expect(studentProfile).toBeDefined();
    expect(studentProfile?.registrationNumber).toBe('ZTC-2026-0042');
    expect(studentProfile?.educationLevel).toBe('B.Tech Chemical Engineering');
  });

  it('2. should resolve seeded instructor profile with qualifications', async () => {
    const instructorProfile = await db.getInstructorProfile('usr-inst-01');
    expect(instructorProfile).toBeDefined();
    expect(instructorProfile?.designation).toContain('CSP, CRSP');
    expect(instructorProfile?.specializations).toContain('Process Safety Management');
  });

  it('3. should lazily derive and persist profile from user if not previously initialized', async () => {
    const derived = await db.getProfile('usr-admin-01');
    expect(derived).toBeDefined();
    expect(derived?.id).toBe('usr-admin-01');
    expect(derived?.email).toBe('admin@zealosh.com');
  });

  it('4. should manage multi-role assignments and primary role elevation', async () => {
    const userId = 'usr-inst-01';
    const initialRoles = await db.getUserRoles(userId);
    expect(initialRoles.length).toBeGreaterThanOrEqual(1);
    expect(initialRoles[0].role).toBe('INSTRUCTOR');

    // Add secondary role
    const assigned = await db.assignUserRole({
      userId,
      role: 'STUDENT',
      isPrimary: false,
    });
    expect(assigned.role).toBe('STUDENT');
    expect(assigned.isPrimary).toBe(false);

    const hasStudentRole = await db.hasRole(userId, 'STUDENT');
    const hasInstructorRole = await db.hasRole(userId, 'INSTRUCTOR');
    expect(hasStudentRole).toBe(true);
    expect(hasInstructorRole).toBe(true);

    // Promote STUDENT to primary
    await db.assignUserRole({
      userId,
      role: 'STUDENT',
      isPrimary: true,
    });
    const user = await db.getUser(userId);
    expect(user?.role).toBe('STUDENT');

    // Cannot remove last role
    await db.removeUserRole(userId, 'INSTRUCTOR');
    await expect(db.removeUserRole(userId, 'STUDENT')).rejects.toThrow('CANNOT_REMOVE_LAST_ROLE');
  });

  it('5. should register new student with profile and student details via /api/auth/register', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Lakshmi Nair',
        email: 'lakshmi.nair@example.com',
        password: 'SecurePassword@2026',
        phone: '+91 984 711 2233',
        role: 'STUDENT',
        studentDetails: {
          educationLevel: 'M.Sc Environmental Science',
          industryExperienceYears: 3,
          currentEmployer: 'Cochin Refineries Ltd',
          currentDesignation: 'Safety Supervisor',
        },
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.email).toBe('lakshmi.nair@example.com');
    expect(body.verificationToken || body.token).toBeDefined();
    expect(body.studentProfile.educationLevel).toBe('M.Sc Environmental Science');

    // Verify stored in DB
    const savedProfile = await db.getProfile(body.user.id);
    expect(savedProfile?.fullName).toBe('Lakshmi Nair');
  });

  it('6. should reject registration when email is already registered', async () => {
    const req = new Request('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Arjun Duplicate',
        email: 'student@zealosh.com',
        password: 'Password@2026',
      }),
    });

    const res = await registerHandler(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('already exists');
  });

  it('7. should execute password reset lifecycle', async () => {
    // 1. Request Reset
    const reqReset = new Request('http://localhost:3000/api/auth/password-reset/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@zealosh.com' }),
    });
    const resReset = await requestResetHandler(reqReset);
    expect(resReset.status).toBe(200);
    const bodyReset = await resReset.json();
    expect(bodyReset.success).toBe(true);
    const token = bodyReset.token;
    expect(token).toBeDefined();

    // 2. Confirm Reset
    const reqConfirm = new Request('http://localhost:3000/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'NewZealoshPassword@2026' }),
    });
    const resConfirm = await confirmResetHandler(reqConfirm);
    expect(resConfirm.status).toBe(200);

    // 3. Replay attack rejection
    const reqReplay = new Request('http://localhost:3000/api/auth/password-reset/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, newPassword: 'NewZealoshPassword@2026' }),
    });
    const resReplay = await confirmResetHandler(reqReplay);
    expect(resReplay.status).toBe(400);
  });

  it('8. should get and update profile via /api/users/profile', async () => {
    const user = (await db.getUser('usr-std-01'))!;
    const token = signToken(user);

    // GET
    const getReq = new Request('http://localhost:3000/api/users/profile', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getRes = await getProfileHandler(getReq);
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.profile.email).toBe(user.email);
    expect(getBody.studentProfile.registrationNumber).toBe('ZTC-2026-0042');

    // PATCH
    const patchReq = new Request('http://localhost:3000/api/users/profile', {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fullName: 'Arjun Menon, GradIOSH',
        phone: '+91 949 600 9999',
        studentDetails: {
          currentDesignation: 'Senior HSE Specialist',
        },
      }),
    });
    const patchRes = await patchProfileHandler(patchReq);
    expect(patchRes.status).toBe(200);
    const patchBody = await patchRes.json();
    expect(patchBody.profile.fullName).toBe('Arjun Menon, GradIOSH');
    expect(patchBody.studentProfile.currentDesignation).toBe('Senior HSE Specialist');
  });
});
