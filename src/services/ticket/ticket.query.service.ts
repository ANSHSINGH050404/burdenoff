import { gqlError } from '../../errors';
import type { Priority, PrismaClient, TicketStatus } from '@prisma/client';
import type { TicketRecord } from '../../repositories/ticket.repository';
import { ticketRepository as tickets } from '../../repositories/ticket.repository';
import { userRepository as users } from '../../repositories/user.repository';
import type { AuthUser } from '../auth/guards';
import { holidayDates } from '../holiday/holiday.service';
import { remainingBusinessMinutes } from '../sla/engine';
import { computeSlaInfo, type SlaInfo } from '../sla/presenter';

type Clock = () => Date;
type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export type TicketListArgs = {
  id?: string;
  status?: TicketStatus;
  priority?: Priority;
  assigneeId?: string;
  slaState?: SlaState;
  take?: number;
  cursor?: string;
  filter?: {
    status?: TicketStatus;
    priority?: Priority;
    assigneeId?: string;
    slaState?: SlaState;
  };
};

export type TicketPage = {
  nodes: TicketRecord[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
};

const encode = (id: string): string => Buffer.from(id).toString('base64url');
const decode = (cursor: string): string => Buffer.from(cursor, 'base64url').toString();

export function createTicketQueryService(db: PrismaClient, clock: Clock) {
  function visibility(user: AuthUser) {
    return user.role === 'AGENT' ? {} : { reporterId: user.id };
  }

  function canSee(ticket: { reporterId: string }, user: AuthUser): boolean {
    return user.role === 'AGENT' || ticket.reporterId === user.id;
  }

  async function slaOf(ticket: TicketRecord, holidays: Set<string>): Promise<SlaInfo> {
    return computeSlaInfo(ticket, holidays, clock);
  }

  return {
    async list(user: AuthUser, args: TicketListArgs): Promise<TicketPage> {
      const take = Math.min(Math.max(args.take ?? 20, 1), 100);
      const filter = args.filter ?? args;
      const where = {
        ...visibility(user),
        ...(args.id ? { id: args.id } : {}),
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.priority ? { priority: filter.priority } : {}),
        ...(filter.assigneeId ? { assigneeId: filter.assigneeId } : {}),
      };
      const rows = await tickets.findMany(db, where);
      const requestedState = args.filter?.slaState ?? args.slaState;
      let filtered = rows;
      if (requestedState) {
        const holidays = await holidayDates(db);
        const withSla = await Promise.all(
          rows.map(async (row) => ({ row, sla: await slaOf(row, holidays) })),
        );
        filtered = withSla
          .filter(
            (entry) =>
              entry.sla.firstResponseState === requestedState ||
              entry.sla.resolutionState === requestedState,
          )
          .map((entry) => entry.row);
      }
      let start = 0;
      if (args.cursor) {
        try {
          const decodedId = decode(args.cursor);
          const idx = filtered.findIndex((row) => row.id === decodedId);
          start = idx >= 0 ? idx + 1 : 0;
        } catch {
          start = 0;
        }
      }
      const nodes = filtered.slice(start, start + take);
      return {
        nodes,
        pageInfo: {
          hasNextPage: start + take < filtered.length,
          endCursor: nodes.length ? encode(nodes[nodes.length - 1]!.id) : null,
        },
      };
    },

    async get(user: AuthUser, id: string): Promise<TicketRecord> {
      const ticket = await tickets.findFullById(db, id);
      if (!ticket) throw gqlError('TICKET_NOT_FOUND');
      if (!canSee(ticket, user)) throw gqlError('FORBIDDEN');
      return ticket;
    },

    async dashboard(user: AuthUser) {
      const where = visibility(user);
      const [counts, rows, holidays] = await Promise.all([
        tickets.counts(db, where),
        tickets.findMany(db, where),
        holidayDates(db),
      ]);
      const now = clock();
      let breached = 0;
      for (const row of rows) {
        const sla = computeSlaInfo(row, holidays, () => now);
        if (sla.firstResponseState === 'BREACHED' || sla.resolutionState === 'BREACHED') breached++;
      }
      return {
        total: counts.total,
        open: counts.OPEN,
        inProgress: counts.IN_PROGRESS,
        resolved: counts.RESOLVED,
        closed: counts.CLOSED,
        breached,
      };
    },

    async agentStats() {
      const [agents, rows, holidays] = await Promise.all([
        users.list(db, 'AGENT'),
        tickets.findMany(db, {}),
        holidayDates(db),
      ]);
      return agents.map((agent) => {
        const mine = rows.filter((row) => row.assigneeId === agent.id);
        const responded = mine.filter((row) => row.firstResponseAt !== null);
        const totalFirstResponse = responded.reduce(
          (sum, row) =>
            sum + remainingBusinessMinutes(row.createdAt, row.firstResponseAt!, holidays),
          0,
        );
        const active: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CUSTOMER'];
        return {
          agent,
          assignedTickets: mine.length,
          openAssigned: mine.filter((row) => active.includes(row.status)).length,
          resolvedTickets: mine.filter((row) => row.resolvedAt !== null).length,
          avgFirstResponseBusinessMinutes: responded.length
            ? Math.round((totalFirstResponse / responded.length) * 10) / 10
            : 0,
        };
      });
    },
  };
}
