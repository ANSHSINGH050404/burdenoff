import jwt from 'jsonwebtoken';
import { GraphQLError } from 'graphql';
import type { Role } from '@prisma/client';
export type AuthUser = { id: string; role: Role; email: string };
export function authenticate(header: string | undefined): AuthUser {
  if (!header?.startsWith('Bearer ')) throw new GraphQLError('UNAUTHENTICATED', { extensions: { code: 'UNAUTHENTICATED' } });
  try { return jwt.verify(header.slice(7), process.env.JWT_SECRET ?? 'development-secret') as AuthUser; } catch { throw new GraphQLError('UNAUTHENTICATED', { extensions: { code: 'UNAUTHENTICATED' } }); }
}
export function sign(user: AuthUser): string { return jwt.sign(user, process.env.JWT_SECRET ?? 'development-secret', { expiresIn: '8h' }); }
