import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User, UserRole } from '@/types';

const JWT_SECRET = process.env.JWT_SECRET || 'zealosh-development-secret-jwt-key-2026-secure';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  sessionId?: string;
  tokenVersion?: number;
  mfaVerified?: boolean;
  aal?: string;
}

export function signToken(
  user:
    | User
    | TokenPayload
    | { id?: string; userId?: string; email: string; role: UserRole; name: string; sessionId?: string; tokenVersion?: number; mfaVerified?: boolean; aal?: string }
): string {
  const uid = ('id' in user && user.id) ? user.id : ('userId' in user && user.userId) ? user.userId : '';
  const tokenVersion = ('tokenVersion' in user && typeof user.tokenVersion === 'number') ? user.tokenVersion : 1;
  const mfaVerified = ('mfaVerified' in user) ? Boolean(user.mfaVerified) : false;
  const aal = ('aal' in user && typeof user.aal === 'string') ? user.aal : undefined;
  const sessionId = ('sessionId' in user && typeof user.sessionId === 'string') ? user.sessionId : undefined;

  const payload: TokenPayload = {
    userId: uid,
    email: user.email,
    role: user.role,
    name: user.name,
    sessionId,
    tokenVersion,
    mfaVerified,
    aal,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    return null;
  }
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function comparePassword(password: string, hash: string): boolean {
  if (!password || !hash) return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
