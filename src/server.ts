import { createYoga } from 'graphql-yoga';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { PrismaClient, Role, TicketStatus, EventType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { authenticate, sign, type AuthUser } from './context';
import { addBusinessHours, slaState, localDate } from './domain/sla';

const db = new PrismaClient();
const typeDefs = readFileSync(new URL('./schema.graphql', import.meta.url), 'utf8');
const auth = (ctx: Ctx) => { if (!ctx.user) throw new Error('UNAUTHENTICATED'); return ctx.user; };
type Ctx = { user?: AuthUser };
const userView = (u: { id: string; email: string; name: string; role: Role }) => u;
const resolvers = {
  DateTime: { serialize: (v: Date | string) => new Date(v).toISOString() },
  Query: {
    users: async (_: unknown, __: unknown, ctx: Ctx) => { auth(ctx); return db.user.findMany({ orderBy: { name: 'asc' } }); },
    tickets: async (_: unknown, args: any, ctx: Ctx) => {
      const me = auth(ctx); const take = Math.min(args.first ?? 20, 100); const cursor = args.after ? { id: Buffer.from(args.after, 'base64url').toString() } : undefined;
      const where: any = me.role === Role.REPORTER ? { reporterId: me.id } : {}; if (args.filter?.status) where.status = args.filter.status;
      const holidays = new Set((await db.holiday.findMany()).map(h => localDate(h.date)));
      let rows = await db.ticket.findMany({ where, include: { reporter: true, assignee: true, events: { include: { actor: true }, orderBy: { createdAt: 'desc' } } }, orderBy: { [args.sortBy === 'updatedAt' ? 'updatedAt' : 'createdAt']: args.sortOrder === 'asc' ? 'asc' : 'desc' } });
      if (args.filter?.sla) rows = rows.filter(t => slaState(t.responseDeadline, new Date(), t.firstRespondedAt) === args.filter.sla || slaState(t.resolutionDeadline, new Date(), t.resolvedAt) === args.filter.sla);
      const start = cursor ? rows.findIndex(t => t.id === cursor.id) + 1 : 0; const nodes = rows.slice(start, start + take); const end = nodes.at(-1)?.id;
      return { nodes, pageInfo: { hasNextPage: start + take < rows.length, endCursor: end ? Buffer.from(end).toString('base64url') : null } };
    }
  },
  Ticket: { sla: async (t: any) => ({ response: slaState(t.responseDeadline, new Date(), t.firstRespondedAt), resolution: slaState(t.resolutionDeadline, new Date(), t.resolvedAt), responseDeadline: t.responseDeadline, resolutionDeadline: t.resolutionDeadline }) },
  Mutation: {
    register: async (_: unknown, a: any) => { const passwordHash = await bcrypt.hash(a.password, 12); const user = await db.user.create({ data: { email: a.email, name: a.name, passwordHash, role: Role.REPORTER } }); return { user: userView(user), token: sign({ id: user.id, email: user.email, role: user.role }) }; },
    login: async (_: unknown, a: any) => { const user = await db.user.findUnique({ where: { email: a.email } }); if (!user || !(await bcrypt.compare(a.password, user.passwordHash))) throw new Error('INVALID_CREDENTIALS'); return { user: userView(user), token: sign({ id: user.id, email: user.email, role: user.role }) }; },
    createTicket: async (_: unknown, a: any, ctx: Ctx) => { const me = auth(ctx); const now = new Date(); const holidays = new Set((await db.holiday.findMany()).map(h => localDate(h.date))); if (a.assigneeId && me.role !== Role.AGENT) throw new Error('FORBIDDEN'); return db.$transaction(async tx => { const t = await tx.ticket.create({ data: { title: a.title, description: a.description, reporterId: me.id, assigneeId: a.assigneeId, responseDeadline: addBusinessHours(now, 4, holidays), resolutionDeadline: addBusinessHours(now, 16, holidays), resolutionAttempts: { create: {} } } }); await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: me.id, type: EventType.CREATED } }); return t; }); },
    transitionTicket: async (_: unknown, a: any, ctx: Ctx) => { const me = auth(ctx); if (me.role !== Role.AGENT) throw new Error('FORBIDDEN'); const t = await db.ticket.findUniqueOrThrow({ where: { id: a.id } }); if (!validStatus(t.status, a.status)) throw new Error('INVALID_TRANSITION'); return db.$transaction(async tx => { const updated = await tx.ticket.update({ where: { id: t.id }, data: { status: a.status, resolvedAt: a.status === TicketStatus.RESOLVED ? new Date() : undefined } }); await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: me.id, type: a.status === 'RESOLVED' ? EventType.RESOLVED : a.status === 'CLOSED' ? EventType.CLOSED : EventType.STATUS_CHANGED, fromStatus: t.status, toStatus: a.status, body: a.body } }); if (a.status === 'RESOLVED') await tx.resolutionAttempt.updateMany({ where: { ticketId: t.id, resolvedAt: null }, data: { resolvedAt: new Date() } }); return updated; }); },
    reopenTicket: async (_: unknown, a: any, ctx: Ctx) => { const me = auth(ctx); if (me.role !== Role.AGENT) throw new Error('FORBIDDEN'); const t = await db.ticket.findUniqueOrThrow({ where: { id: a.id } }); if (t.status !== TicketStatus.RESOLVED) throw new Error('INVALID_TRANSITION'); return db.$transaction(async tx => { const updated = await tx.ticket.update({ where: { id: t.id }, data: { status: TicketStatus.OPEN, resolvedAt: null } }); await tx.resolutionAttempt.create({ data: { ticketId: t.id } }); await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: me.id, type: EventType.REOPENED, fromStatus: TicketStatus.RESOLVED, toStatus: TicketStatus.OPEN, body: a.body } }); return updated; }); },
    respondToTicket: async (_: unknown, a: any, ctx: Ctx) => { const me = auth(ctx); const t = await db.ticket.findUniqueOrThrow({ where: { id: a.id } }); if (me.role !== Role.AGENT || t.status === TicketStatus.CLOSED) throw new Error('FORBIDDEN'); return db.$transaction(async tx => { const updated = await tx.ticket.update({ where: { id: t.id }, data: t.firstRespondedAt ? {} : { firstRespondedAt: new Date() } }); await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: me.id, type: EventType.FIRST_RESPONSE, body: a.body } }); return updated; }); }
  }
};
function validStatus(from: TicketStatus, to: TicketStatus): boolean { return ({ OPEN: ['IN_PROGRESS'], IN_PROGRESS: ['OPEN', 'RESOLVED'], RESOLVED: ['CLOSED'], CLOSED: [] } as Record<string, string[]>)[from]?.includes(to) ?? false; }
const schema = makeExecutableSchema({ typeDefs, resolvers });
const yoga = createYoga({ schema, context: ({ request }: { request: Request }): Ctx => { const header = request.headers.get('authorization'); return header ? { user: authenticate(header) } : {}; }, formatError: (error: any) => ({ ...error, extensions: { ...error.extensions, code: error.message } }) } as any);
createServer(yoga).listen(Number(process.env.PORT ?? 4000), () => console.log(`GraphQL running on http://localhost:${process.env.PORT ?? 4000}/graphql`));
