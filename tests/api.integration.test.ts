import { describe, expect, test } from 'bun:test';
import { graphql } from 'graphql';
import { PrismaClient, Role } from '@prisma/client';
import { createSchema } from '../src/api/schema';
import type { Context } from '../src/api/resolvers';

const enabled = Boolean(process.env.TEST_DATABASE_URL);
describe('GraphQL PostgreSQL persistence flow', () => {
  test.skipIf(!enabled)('creates a ticket and atomically persists the first response comment', async () => {
    const db = new PrismaClient({ datasources: { db: { url: process.env.TEST_DATABASE_URL! } } });
    await db.$executeRawUnsafe('TRUNCATE TABLE "Comment", "TicketEvent", "ResolutionAttempt", "Ticket", "Holiday", "User" CASCADE');
    const reporter = await db.user.create({ data: { email: 'api-reporter@example.com', name: 'Reporter', passwordHash: 'hash', role: Role.REPORTER } });
    const agent = await db.user.create({ data: { email: 'api-agent@example.com', name: 'Agent', passwordHash: 'hash', role: Role.AGENT } });
    const schema = createSchema(db, () => new Date('2026-08-24T09:00:00.000Z'));
    const context = (id: string, role: Role): Context => ({ user: { id, role, email: `${role.toLowerCase()}@example.com` } });
    const created = await graphql({ schema, source: 'mutation { createTicket(title: "Outage", description: "Down", priority: URGENT) { id priority firstResponseAt comments { content } resolutionAttempts { dueAt state remainingBusinessMinutes } } }', contextValue: context(reporter.id, reporter.role) });
    expect(created.errors).toBeUndefined(); const createdData = created.data as { createTicket: { id: string } } | null; if (!createdData) throw new Error('ticket was not created'); const ticketId = createdData.createTicket.id;
    const commented = await graphql({ schema, source: `mutation { addComment(ticketId: "${ticketId}", content: "Working on it") { content } }`, contextValue: context(agent.id, agent.role) });
    expect(commented.errors).toBeUndefined(); expect((await db.ticket.findUniqueOrThrow({ where: { id: ticketId } })).firstResponseAt).not.toBeNull(); expect(await db.comment.count({ where: { ticketId } })).toBe(1);
    const forbidden = await graphql({ schema, source: 'mutation { register(name: "Agent", email: "should-not-register@example.com", password: "password", role: AGENT) { token } }' });
    expect(forbidden.errors?.[0]?.extensions.code).toBe('FORBIDDEN');
    const invalidTransition = await graphql({ schema, source: `mutation { changeTicketStatus(ticketId: "${ticketId}", status: RESOLVED) { id } }`, contextValue: context(agent.id, agent.role) });
    expect(invalidTransition.errors?.[0]?.extensions.code).toBe('INVALID_STATUS_TRANSITION'); await db.$disconnect();
  });
});
