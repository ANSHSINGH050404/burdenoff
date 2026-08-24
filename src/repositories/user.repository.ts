import type { Prisma, PrismaClient, Role } from '@prisma/client';

export type Database = PrismaClient | Prisma.TransactionClient;

export type UserRecord = Prisma.UserGetPayload<object>;

export type UserRepository = typeof userRepository;

export const userRepository = {
  findById(db: Database, id: string): Promise<UserRecord | null> {
    return db.user.findUnique({ where: { id } });
  },
  findByEmail(db: Database, email: string): Promise<UserRecord | null> {
    return db.user.findUnique({ where: { email } });
  },
  create(
    db: Database,
    data: { email: string; name: string; passwordHash: string; role: Role },
  ): Promise<UserRecord> {
    return db.user.create({ data });
  },
  list(db: PrismaClient, role?: Role): Promise<UserRecord[]> {
    return db.user.findMany({ where: role ? { role } : {}, orderBy: { name: 'asc' } });
  },
};
