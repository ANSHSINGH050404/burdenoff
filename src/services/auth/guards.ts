import { gqlError } from '../../errors';
import type { Context } from '../../graphql/context';
import type { AuthUser } from './jwt';

export type { AuthUser };

export function currentUser(context: Context): AuthUser {
  if (!context.user) throw gqlError('UNAUTHENTICATED');
  return context.user;
}

export function requireAgent(context: Context): AuthUser {
  const user = currentUser(context);
  if (user.role !== 'AGENT') throw gqlError('FORBIDDEN');
  return user;
}
