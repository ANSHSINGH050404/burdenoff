import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { gqlError } from '../../errors';
import { userRepository as users } from '../../repositories/user.repository';
import { requireEmail, requirePassword, requireText } from '../../validation/validation';
import { sign } from './jwt';

type RegisterInput = { name: string; email: string; password: string; role?: 'REPORTER' | 'AGENT' };
type LoginInput = { email: string; password: string };

export function createAuthService(db: PrismaClient) {
  return {
    async register(input: RegisterInput) {
      const role = input.role ?? 'REPORTER';
      if (role !== 'REPORTER' && role !== 'AGENT') throw gqlError('VALIDATION_ERROR', 'Invalid role');
      const name = requireText(input.name, 'VALIDATION_ERROR', { min: 1, max: 200 });
      const email = requireEmail(input.email);
      const password = requirePassword(input.password);
      const passwordHash = await bcrypt.hash(password, 12);
      const created = await users
        .create(db, { email, name, passwordHash, role })
        .catch(() => {
          throw gqlError('VALIDATION_ERROR', 'Registration failed');
        });
      return {
        user: created,
        token: sign({ id: created.id, email: created.email, role: created.role }),
      };
    },
    async login(input: LoginInput) {
      const email = requireEmail(input.email);
      const user = await users.findByEmail(db, email);
      if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
        throw gqlError('INVALID_CREDENTIALS');
      return { user, token: sign({ id: user.id, email: user.email, role: user.role }) };
    },
  };
}
