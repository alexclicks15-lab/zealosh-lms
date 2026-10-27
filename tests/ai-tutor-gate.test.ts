import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { db } from '../src/lib/store/db';
import { isAiTutorEnabled, assertAiTutorEnabled } from '../src/lib/ai-tutor/gate';
import { AiTutorService } from '../src/lib/ai-tutor/service';
import { AiTutorDisabledError, validateAiTutorConfig } from '../src/lib/ai-tutor/types';
import { signToken } from '../src/lib/auth/jwt';
import { POST as aiTutorQueryHandler } from '../src/app/api/ai-tutor/query/route';
import { PUT as updateFeaturesHandler } from '../src/app/api/admin/config/features/route';

describe('Zealosh LMS — AI Tutor Feature Gate & Integration Boundary Suite', () => {
  const studentToken = signToken({
    userId: 'usr-std-01',
    email: 'student@example.com',
    role: 'STUDENT',
    name: 'Test Student',
  });

  const instructorToken = signToken({
    userId: 'usr-inst-01',
    email: 'instructor@zealosh.com',
    role: 'INSTRUCTOR',
    name: 'Test Instructor',
  });

  const orgAdminToken = signToken({
    userId: 'usr-org-01',
    email: 'orgadmin@client.com',
    role: 'ORG_ADMIN',
    name: 'Test Org Admin',
  });

  const superAdminToken = signToken({
    userId: 'usr-admin-01',
    email: 'admin@zealosh.com',
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
  });

  beforeEach(() => {
    // Ensure default seeded state
    db.featureFlags.aiTutorEnabled = false;
  });

  afterAll(async () => {
    // Ensure cleanup
    db.featureFlags.aiTutorEnabled = false;
  });

  // --------------------------------------------------------------------------
  // 1. Feature Gate Invariants & Defaults
  // --------------------------------------------------------------------------
  describe('Capability Gate Default State', () => {
    it('should default aiTutorEnabled to false in db store and feature flags', async () => {
      expect(db.featureFlags.aiTutorEnabled).toBe(false);
      const enabled = await isAiTutorEnabled();
      expect(enabled).toBe(false);
    });

    it('should throw AiTutorDisabledError with code AI_TUTOR_DISABLED when disabled', async () => {
      await expect(assertAiTutorEnabled()).rejects.toThrowError(AiTutorDisabledError);
      try {
        await assertAiTutorEnabled();
      } catch (err: any) {
        expect(err.code).toBe('AI_TUTOR_DISABLED');
        expect(err.status).toBe(403);
      }
    });

    it('should preserve disabled state after db.resetToSeed()', () => {
      db.resetToSeed();
      expect(db.featureFlags.aiTutorEnabled).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Direct API Gate & Protection
  // --------------------------------------------------------------------------
  describe('Direct API Endpoint Protection (/api/ai-tutor/query)', () => {
    it('should reject unauthenticated requests with 401 UNAUTHORIZED', async () => {
      const req = new Request('http://localhost:3000/api/ai-tutor/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: 'crs-asp-01', query: 'What is OSHA 1910?' }),
      });

      const res = await aiTutorQueryHandler(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('should reject authenticated student requests with 403 AI_TUTOR_DISABLED when feature is disabled', async () => {
      const req = new Request('http://localhost:3000/api/ai-tutor/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ courseId: 'crs-asp-01', query: 'Explain lock-out tag-out' }),
      });

      const res = await aiTutorQueryHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('AI_TUTOR_DISABLED');
      expect(body.message).toContain('disabled');
    });

    it('should reject authenticated instructor requests with 403 AI_TUTOR_DISABLED when feature is disabled', async () => {
      const req = new Request('http://localhost:3000/api/ai-tutor/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${instructorToken}`,
        },
        body: JSON.stringify({ courseId: 'crs-asp-01', query: 'Generate revision quiz' }),
      });

      const res = await aiTutorQueryHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('AI_TUTOR_DISABLED');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Service Layer Boundary & Zero Outbound Inference
  // --------------------------------------------------------------------------
  describe('Service Layer Invariants & Zero Outbound Invocations', () => {
    it('should throw AiTutorDisabledError before any provider or network calls', async () => {
      let providerCalled = false;
      const mockProvider = {
        providerName: 'mock_provider',
        healthCheck: async () => {
          providerCalled = true;
          return { ok: true, latencyMs: 10 };
        },
        generateResponse: async () => {
          providerCalled = true;
          throw new Error('Should not be called');
        },
      };

      const service = new AiTutorService(mockProvider as any);

      await expect(
        service.query({
          userId: 'usr-std-01',
          userRole: 'STUDENT',
          courseId: 'crs-asp-01',
          query: 'Test query',
        })
      ).rejects.toThrowError(AiTutorDisabledError);

      expect(providerCalled).toBe(false);

      await expect(service.checkHealth()).rejects.toThrowError(AiTutorDisabledError);
      expect(providerCalled).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Governance & Role-Based Capability Authorization
  // --------------------------------------------------------------------------
  describe('Feature Flag Governance & Role Permissions', () => {
    it('should reject ordinary organization admin from altering aiTutorEnabled flag', async () => {
      const req = new Request('http://localhost:3000/api/admin/config/features', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${orgAdminToken}`,
        },
        body: JSON.stringify({
          flags: { aiTutorEnabled: true },
          reason: 'Unauthorized attempt to activate AI Tutor',
        }),
      });

      const res = await updateFeaturesHandler(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Only Superadmin can modify the AI Tutor capability');
      expect(db.featureFlags.aiTutorEnabled).toBe(false);
    });

    it('should allow authorized Superadmin to manage feature flags', async () => {
      const req = new Request('http://localhost:3000/api/admin/config/features', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${superAdminToken}`,
        },
        body: JSON.stringify({
          flags: { announcements: true },
          reason: 'Verifying standard Superadmin feature flag update',
        }),
      });

      const res = await updateFeaturesHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 5. Future Configuration Schema Validation
  // --------------------------------------------------------------------------
  describe('Candidate AI Configuration Validation Schema', () => {
    it('should reject invalid configuration shapes', () => {
      expect(validateAiTutorConfig(null).valid).toBe(false);
      expect(validateAiTutorConfig('not an object').valid).toBe(false);
      expect(validateAiTutorConfig({}).valid).toBe(false);
    });

    it('should reject non-HTTP protocols and empty model names', () => {
      const res = validateAiTutorConfig({
        provider: 'self_hosted_ollama',
        providerUrl: 'ftp://bad-url.com',
        modelName: '',
        timeoutMs: 500,
        maxTokens: 10,
        temperature: 2.5,
      });

      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('protocol'))).toBe(true);
      expect(res.errors.some((e) => e.includes('modelName'))).toBe(true);
      expect(res.errors.some((e) => e.includes('timeoutMs'))).toBe(true);
      expect(res.errors.some((e) => e.includes('maxTokens'))).toBe(true);
      expect(res.errors.some((e) => e.includes('temperature'))).toBe(true);
    });

    it('should validate and accept well-formed candidate configuration', () => {
      const validCandidate = {
        provider: 'self_hosted_ollama',
        providerUrl: 'https://internal-ai.zealosh.local:11434',
        modelName: 'zealosh-hse-tutor-v1',
        timeoutMs: 15000,
        maxTokens: 1024,
        temperature: 0.2,
      };

      const res = validateAiTutorConfig(validCandidate);
      expect(res.valid).toBe(true);
      expect(res.errors.length).toBe(0);
    });
  });
});
