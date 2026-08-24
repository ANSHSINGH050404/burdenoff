import { describe, expect, test } from 'bun:test';
import { PrismaClient } from '@prisma/client';
describe('PostgreSQL integration setup', () => {
  test.skipIf(!process.env.TEST_DATABASE_URL)('connects to test database and resets tables', async () => {
    const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
    await db.$executeRawUnsafe('TRUNCATE TABLE "Comment", "TicketEvent", "ResolutionAttempt", "Ticket", "Holiday", "User" CASCADE');
    expect(await db.user.count()).toBe(0); await db.$disconnect();
  });
});
