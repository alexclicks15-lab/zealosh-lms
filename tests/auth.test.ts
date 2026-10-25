import { describe, it, expect } from 'vitest';
import { signToken, verifyToken, hashPassword, comparePassword } from '../src/lib/auth/jwt';
import { User } from '../src/types';

describe('Auth & Cryptography Unit Tests', () => {
  const mockUser: User = {
    id: 'test-user-1',
    name: 'Test Student',
    email: 'test@zealosh.com',
    passwordHash: '',
    role: 'STUDENT',
    organizationId: 'org-zealosh',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('should correctly hash and compare passwords using bcrypt', () => {
    const rawPass = 'ZealoshSecurePass2026';
    const hash = hashPassword(rawPass);
    expect(hash).not.toBe(rawPass);
    expect(comparePassword(rawPass, hash)).toBe(true);
    expect(comparePassword('WrongPassword', hash)).toBe(false);
  });

  it('should issue and verify valid RS256/HS256 JWT tokens', () => {
    const token = signToken(mockUser);
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(20);

    const decoded = verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(mockUser.id);
    expect(decoded?.email).toBe(mockUser.email);
    expect(decoded?.role).toBe('STUDENT');
  });

  it('should reject tampered or invalid JWT tokens', () => {
    const invalidToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';
    const result = verifyToken(invalidToken);
    expect(result).toBeNull();
  });
});
