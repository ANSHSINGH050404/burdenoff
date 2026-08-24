import jwt from 'jsonwebtoken';
import { gqlError } from '../../errors';
import { jwtSecret } from '../../config';

export type AuthUser = { id: string; role: 'REPORTER' | 'AGENT'; email: string };

export function authenticate(header: string | undefined): AuthUser {
  if (!header?.startsWith('Bearer ')) throw gqlError('UNAUTHENTICATED');
  try {
    return jwt.verify(header.slice(7), jwtSecret()) as AuthUser;
  } catch {
    throw gqlError('UNAUTHENTICATED');
  }
}

export function sign(user: AuthUser): string {
  return jwt.sign(user, jwtSecret(), { expiresIn: '8h' });
}
