import type { Prisma, TicketStatus } from '@prisma/client';
import type { Database } from './user.repository';

export type TicketRecord = Prisma.TicketGetPayload<{
  include: {
    reporter: true;
    assignee: true;
    comments: { include: { author: true }; orderBy: { createdAt: 'asc' } };
    resolutionAttempts: { orderBy: { startedAt: 'asc' } };
    events: { include: { actor: true }; orderBy: { createdAt: 'desc' } };
  };
}>;

export type CommentRecord = Prisma.CommentGetPayload<{ include: { author: true } }>;

export type TicketCore = {
  id: string;
  reporterId: string;
  assigneeId: string | null;
  status: TicketStatus;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  pausedAt: Date | null;
  responseDeadline: Date;
  resolutionDeadline: Date;
};

export type StatusCounts = {
  total: number;
  OPEN: number;
  IN_PROGRESS: number;
  RESOLVED: number;
  CLOSED: number;
};

export const ticketRepository = {
  async findCoreById(db: Database, id: string): Promise<TicketCore | null> {
    return db.ticket.findUnique({
      where: { id },
      select: {
        id: true,
        reporterId: true,
        assigneeId: true,
        status: true,
        firstResponseAt: true,
        resolvedAt: true,
        pausedAt: true,
        responseDeadline: true,
        resolutionDeadline: true,
      },
    });
  },
  findFullById(db: Database, id: string): Promise<TicketRecord | null> {
    return db.ticket.findUnique({ where: { id }, include: ticketInclude });
  },
  findMany(db: Database, where: Prisma.TicketWhereInput): Promise<TicketRecord[]> {
    return db.ticket.findMany({ where, include: ticketInclude, orderBy: ORDER });
  },
  async counts(db: Database, where: Prisma.TicketWhereInput): Promise<StatusCounts> {
    return {
      total: await db.ticket.count({ where }),
      OPEN: await db.ticket.count({ where: { ...where, status: 'OPEN' } }),
      IN_PROGRESS: await db.ticket.count({ where: { ...where, status: 'IN_PROGRESS' } }),
      RESOLVED: await db.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
      CLOSED: await db.ticket.count({ where: { ...where, status: 'CLOSED' } }),
    };
  },
  create(
    db: Database,
    data: {
      title: string;
      description: string;
      priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
      reporterId: string;
      responseDeadline: Date;
      resolutionDeadline: Date;
    },
  ): Promise<TicketRecord> {
    return db.ticket.create({
      data: { ...data, resolutionAttempts: { create: { dueAt: data.resolutionDeadline } } },
      include: ticketInclude,
    });
  },
  updateAssignee(db: Database, ticketId: string, assigneeId: string): Promise<TicketRecord> {
    return db.ticket.update({
      where: { id: ticketId },
      data: { assigneeId },
      include: ticketInclude,
    });
  },
  updateStatus(
    db: Database,
    ticketId: string,
    data: {
      status: TicketStatus;
      resolvedAt?: Date | null;
      pausedAt?: Date | null;
      responseDeadline?: Date;
      resolutionDeadline?: Date;
    },
  ): Promise<TicketRecord> {
    return db.ticket.update({ where: { id: ticketId }, data, include: ticketInclude });
  },
  setFirstResponseAt(db: Database, ticketId: string, at: Date): Promise<unknown> {
    return db.ticket.update({ where: { id: ticketId }, data: { firstResponseAt: at } });
  },
  createResolutionAttempt(db: Database, ticketId: string, dueAt: Date): Promise<unknown> {
    return db.resolutionAttempt.create({ data: { ticketId, dueAt } });
  },
  closeOpenResolutionAttempts(db: Database, ticketId: string, at: Date): Promise<unknown> {
    return db.resolutionAttempt.updateMany({
      where: { ticketId, resolvedAt: null },
      data: { resolvedAt: at },
    });
  },
  createEvent(
    db: Database,
    data: {
      ticketId: string;
      actorId: string;
      type:
        | 'CREATED'
        | 'STATUS_CHANGED'
        | 'ASSIGNED'
        | 'FIRST_RESPONSE'
        | 'COMMENT'
        | 'RESOLVED'
        | 'REOPENED'
        | 'CLOSED';
      fromStatus?: TicketStatus;
      toStatus?: TicketStatus;
      fromAssigneeId?: string;
      toAssigneeId?: string;
      body?: string;
    },
  ): Promise<unknown> {
    return db.ticketEvent.create({ data });
  },
  createComment(
    db: Database,
    data: { ticketId: string; authorId: string; content: string },
  ): Promise<CommentRecord> {
    return db.comment.create({ data, include: { author: true } });
  },
};

const ORDER = [
  { createdAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.TicketOrderByWithRelationInput[];

const ticketInclude = {
  reporter: true,
  assignee: true,
  comments: { include: { author: true }, orderBy: { createdAt: 'asc' as const } },
  resolutionAttempts: { orderBy: { startedAt: 'asc' as const } },
  events: { include: { actor: true }, orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.TicketInclude;
