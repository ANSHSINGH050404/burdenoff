import type { Priority, Role, TicketStatus } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { businessTimezone } from '../config';
import { createAuthService } from '../services/auth/auth.service';
import { currentUser, requireAgent } from '../services/auth/guards';
import { holidayDates, listHolidays } from '../services/holiday/holiday.service';
import { localDate } from '../services/sla/engine';
import { attemptRemainingMinutes, attemptState, computeSlaInfo } from '../services/sla/presenter';
import type { TicketRecord } from '../repositories/ticket.repository';
import { createTicketQueryService } from '../services/ticket/ticket.query.service';
import { createTicketService } from '../services/ticket/ticket.service';
import type { Context } from './context';
import { dateTimeScalar } from './scalars';

type ListArgs = Parameters<ReturnType<typeof createTicketQueryService>['list']>[1];

export function createResolvers(db: PrismaClient, clock: () => Date = () => new Date()) {
  const authService = createAuthService(db);
  const ticketService = createTicketService(db, clock);
  const ticketQueries = createTicketQueryService(db, clock);

  const queries = {
    tickets: (_parent: unknown, args: ListArgs, context: Context) =>
      ticketQueries.list(currentUser(context), args),
    ticket: (_parent: unknown, args: { id: string }, context: Context) =>
      ticketQueries.get(currentUser(context), args.id),
    dashboard: (_parent: unknown, _args: Record<string, never>, context: Context) =>
      ticketQueries.dashboard(currentUser(context)),
    agentStats: (_parent: unknown, _args: Record<string, never>, context: Context) => {
      requireAgent(context);
      return ticketQueries.agentStats();
    },
    users: (_parent: unknown, args: { role?: Role }, context: Context) => {
      currentUser(context);
      return db.user.findMany({
        where: args.role ? { role: args.role } : {},
        orderBy: { name: 'asc' },
      });
    },
    holidays: (_parent: unknown, _args: Record<string, never>, context: Context) => {
      currentUser(context);
      return listHolidays(db);
    },
  };

  const mutations = {
    register: (
      _parent: unknown,
      args: { name: string; email: string; password: string; role?: Role },
    ) => authService.register(args),
    login: (_parent: unknown, args: { email: string; password: string }) => authService.login(args),
    createTicket: (
      _parent: unknown,
      args: { title: string; description: string; priority?: Priority },
      context: Context,
    ) => ticketService.createTicket(currentUser(context), args),
    assignTicket: (
      _parent: unknown,
      args: { ticketId: string; assigneeId: string },
      context: Context,
    ) => ticketService.assign(requireAgent(context), args),
    changeTicketStatus: (
      _parent: unknown,
      args: { ticketId: string; status: TicketStatus },
      context: Context,
    ) => ticketService.changeStatus(requireAgent(context), args),
    resolveTicket: (_parent: unknown, args: { ticketId: string }, context: Context) =>
      ticketService.resolve(requireAgent(context), args.ticketId),
    reopenTicket: (_parent: unknown, args: { ticketId: string }, context: Context) =>
      ticketService.reopen(requireAgent(context), args.ticketId),
    addComment: (_parent: unknown, args: { ticketId: string; content: string }, context: Context) =>
      ticketService.addComment(currentUser(context), args),
  };

  return {
    DateTime: dateTimeScalar,
    Query: queries,
    Mutation: mutations,
    Ticket: {
      sla: async (parent: unknown) =>
        computeSlaInfo(parent as TicketRecord, await holidayDates(db), clock),
    },
    Comment: { author: (parent: unknown) => (parent as { author: unknown }).author },
    TicketEvent: {
      fromAssignee: (parent: unknown) => {
        const id = (parent as { fromAssigneeId?: string }).fromAssigneeId;
        return id ? db.user.findUnique({ where: { id } }) : null;
      },
      toAssignee: (parent: unknown) => {
        const id = (parent as { toAssigneeId?: string }).toAssigneeId;
        return id ? db.user.findUnique({ where: { id } }) : null;
      },
    },
    Holiday: {
      date: (parent: unknown) => localDate((parent as { date: Date }).date, businessTimezone()),
    },
    ResolutionAttempt: {
      state: async (parent: unknown) =>
        attemptState(parent as never, await holidayDates(db), clock),
      remainingBusinessMinutes: async (parent: unknown) =>
        attemptRemainingMinutes(parent as never, await holidayDates(db), clock),
    },
  };
}
