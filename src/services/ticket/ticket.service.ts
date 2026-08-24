import { gqlError } from '../../errors';
import type { PrismaClient, TicketStatus } from '@prisma/client';
import type { TicketRecord } from '../../repositories/ticket.repository';
import { ticketRepository as tickets } from '../../repositories/ticket.repository';
import type { Database } from '../../repositories/user.repository';
import { userRepository as users } from '../../repositories/user.repository';
import { requireText } from '../../validation/validation';
import type { AuthUser } from '../auth/guards';
import { holidayDates } from '../holiday/holiday.service';
import { addBusinessMinutes, calculateDeadlines, remainingBusinessMinutes } from '../sla/engine';
import { validTransition } from './transitions';

type Clock = () => Date;
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export function createTicketService(db: PrismaClient, clock: Clock) {
  function canSee(ticket: { reporterId: string }, user: AuthUser): boolean {
    return user.role === 'AGENT' || ticket.reporterId === user.id;
  }

  async function assertVisibleCore(dbOrTx: Database, ticketId: string, user: AuthUser) {
    const ticket = await tickets.findCoreById(dbOrTx, ticketId);
    if (!ticket) throw gqlError('TICKET_NOT_FOUND');
    if (!canSee(ticket, user)) throw gqlError('FORBIDDEN');
    return ticket;
  }

  return {
    async createTicket(
      user: AuthUser,
      input: { title: string; description: string; priority?: Priority },
    ): Promise<TicketRecord> {
      const title = requireText(input.title, 'VALIDATION_ERROR', { min: 1, max: 200 });
      const description = requireText(input.description, 'VALIDATION_ERROR', {
        min: 1,
        max: 10000,
      });
      const priority = input.priority ?? 'MEDIUM';
      const deadlines = calculateDeadlines(clock(), priority, await holidayDates(db));
      return db.$transaction(async (tx) => {
        const ticket = await tickets.create(tx, {
          title,
          description,
          priority,
          reporterId: user.id,
          responseDeadline: deadlines.response,
          resolutionDeadline: deadlines.resolution,
        });
        await tickets.createEvent(tx, { ticketId: ticket.id, actorId: user.id, type: 'CREATED' });
        return ticket;
      });
    },

    async assign(user: AuthUser, input: { ticketId: string; assigneeId: string }) {
      if (user.role !== 'AGENT') throw gqlError('FORBIDDEN');
      const assignee = await users.findById(db, input.assigneeId);
      if (!assignee || assignee.role !== 'AGENT') throw gqlError('INVALID_ASSIGNEE');
      const ticket = await tickets.findCoreById(db, input.ticketId);
      if (!ticket) throw gqlError('TICKET_NOT_FOUND');
      if (ticket.status === 'CLOSED') throw gqlError('CLOSED_TICKET');
      return db.$transaction(async (tx) => {
        const record = await tickets.updateAssignee(tx, ticket.id, assignee.id);
        await tickets.createEvent(tx, {
          ticketId: ticket.id,
          actorId: user.id,
          type: 'ASSIGNED',
          fromAssigneeId: ticket.assigneeId ?? undefined,
          toAssigneeId: assignee.id,
          body: `Assigned to ${assignee.name}`,
        });
        return record;
      });
    },

    async changeStatus(
      user: AuthUser,
      input: { ticketId: string; status: TicketStatus },
    ): Promise<TicketRecord> {
      if (user.role !== 'AGENT') throw gqlError('FORBIDDEN');
      const ticket = await tickets.findCoreById(db, input.ticketId);
      if (!ticket) throw gqlError('TICKET_NOT_FOUND');
      if (!validTransition(ticket.status, input.status))
        throw gqlError('INVALID_STATUS_TRANSITION');
      return this.applyStatus(user, ticket.id, ticket.status, input.status);
    },

    async resolve(user: AuthUser, ticketId: string): Promise<TicketRecord> {
      if (user.role !== 'AGENT') throw gqlError('FORBIDDEN');
      const ticket = await tickets.findCoreById(db, ticketId);
      if (!ticket) throw gqlError('TICKET_NOT_FOUND');
      if (!validTransition(ticket.status, 'RESOLVED')) throw gqlError('INVALID_STATUS_TRANSITION');
      return this.applyStatus(user, ticket.id, ticket.status, 'RESOLVED');
    },

    async applyStatus(
      user: AuthUser,
      ticketId: string,
      from: TicketStatus,
      to: TicketStatus,
    ): Promise<TicketRecord> {
      return db.$transaction(async (tx) => {
        const now = clock();
        const current = await tickets.findCoreById(tx, ticketId);
        if (!current) throw gqlError('TICKET_NOT_FOUND');

        const data: {
          status: TicketStatus;
          resolvedAt?: Date;
          pausedAt?: Date | null;
          responseDeadline?: Date;
          resolutionDeadline?: Date;
        } = { status: to };

        if (to === 'WAITING_ON_CUSTOMER') {
          // Freeze both clocks by recording the pause instant.
          if (!current.pausedAt) data.pausedAt = now;
        } else if (from === 'WAITING_ON_CUSTOMER' && current.pausedAt) {
          // Resume: give each still-active clock back the business time
          // that was remaining when the pause started, counted from now.
          const holidays = await holidayDates(tx);
          data.pausedAt = null;
          if (!current.firstResponseAt && current.responseDeadline > current.pausedAt) {
            const firstResponseRemaining = remainingBusinessMinutes(
              current.pausedAt,
              current.responseDeadline,
              holidays,
            );
            data.responseDeadline = addBusinessMinutes(now, firstResponseRemaining, holidays);
          }
          if (!current.resolvedAt && current.resolutionDeadline > current.pausedAt) {
            const resolutionRemaining = remainingBusinessMinutes(
              current.pausedAt,
              current.resolutionDeadline,
              holidays,
            );
            data.resolutionDeadline = addBusinessMinutes(now, resolutionRemaining, holidays);
          }
        }

        if (to === 'RESOLVED') data.resolvedAt = now;

        const updated = await tickets.updateStatus(tx, ticketId, data);

        if (from === 'WAITING_ON_CUSTOMER' && !current.resolvedAt && data.resolutionDeadline) {
          await tx.resolutionAttempt.updateMany({
            where: { ticketId, resolvedAt: null },
            data: { dueAt: updated.resolutionDeadline },
          });
        }

        await tickets.createEvent(tx, {
          ticketId,
          actorId: user.id,
          type: to === 'RESOLVED' ? 'RESOLVED' : to === 'CLOSED' ? 'CLOSED' : 'STATUS_CHANGED',
          fromStatus: from,
          toStatus: to,
        });
        if (to === 'RESOLVED') await tickets.closeOpenResolutionAttempts(tx, ticketId, now);
        return updated;
      });
    },

    async reopen(user: AuthUser, ticketId: string): Promise<TicketRecord> {
      if (user.role !== 'AGENT') throw gqlError('FORBIDDEN');
      const ticket = await tickets.findCoreById(db, ticketId);
      if (!ticket) throw gqlError('TICKET_NOT_FOUND');
      if (ticket.status !== 'RESOLVED') throw gqlError('INVALID_STATUS_TRANSITION');
      return db.$transaction(async (tx) => {
        const updated = await tickets.updateStatus(tx, ticketId, {
          status: 'OPEN',
          resolvedAt: null,
          pausedAt: null,
        });
        await tickets.createResolutionAttempt(tx, ticketId, ticket.resolutionDeadline);
        await tickets.createEvent(tx, {
          ticketId,
          actorId: user.id,
          type: 'REOPENED',
          fromStatus: 'RESOLVED',
          toStatus: 'OPEN',
        });
        return updated;
      });
    },

    async addComment(user: AuthUser, input: { ticketId: string; content: string }) {
      const content = requireText(input.content, 'INVALID_COMMENT', { min: 1, max: 5000 });
      const ticket = await assertVisibleCore(db, input.ticketId, user);
      if (ticket.status === 'CLOSED') throw gqlError('COMMENT_NOT_ALLOWED');
      return db.$transaction(async (tx) => {
        const comment = await tickets.createComment(tx, {
          ticketId: ticket.id,
          authorId: user.id,
          content,
        });
        const isFirstResponse = user.role === 'AGENT' && ticket.firstResponseAt === null;
        if (isFirstResponse) await tickets.setFirstResponseAt(tx, ticket.id, comment.createdAt);
        await tickets.createEvent(tx, {
          ticketId: ticket.id,
          actorId: user.id,
          type: isFirstResponse ? 'FIRST_RESPONSE' : 'COMMENT',
          body: content,
        });
        return comment;
      });
    },
  };
}
