import { businessTimezone } from '../../config';
import type { TicketRecord } from '../../repositories/ticket.repository';
import { remainingBusinessMinutes, slaState, type SlaState } from './engine';

export type SlaInfo = {
  firstResponseDueAt: Date;
  resolutionDueAt: Date;
  firstResponseState: SlaState;
  resolutionState: SlaState;
  firstResponseRemainingMinutes: number;
  resolutionRemainingMinutes: number;
};

export function computeSlaInfo(
  ticket: TicketRecord,
  holidays: ReadonlySet<string>,
  clock: () => Date,
): SlaInfo {
  const timezone = businessTimezone();
  const now = clock();
  const completed = (at: Date | null): boolean => at !== null;
  return {
    firstResponseDueAt: ticket.responseDeadline,
    resolutionDueAt: ticket.resolutionDeadline,
    firstResponseState: slaState(
      ticket.createdAt,
      ticket.responseDeadline,
      now,
      holidays,
      ticket.firstResponseAt,
      timezone,
    ),
    resolutionState: slaState(
      ticket.createdAt,
      ticket.resolutionDeadline,
      now,
      holidays,
      ticket.resolvedAt,
      timezone,
    ),
    firstResponseRemainingMinutes: completed(ticket.firstResponseAt)
      ? 0
      : remainingBusinessMinutes(now, ticket.responseDeadline, holidays, timezone),
    resolutionRemainingMinutes: completed(ticket.resolvedAt)
      ? 0
      : remainingBusinessMinutes(now, ticket.resolutionDeadline, holidays, timezone),
  };
}

export function attemptState(
  attempt: { startedAt: Date; dueAt: Date; resolvedAt: Date | null },
  holidays: ReadonlySet<string>,
  clock: () => Date,
): SlaState {
  return slaState(
    attempt.startedAt,
    attempt.dueAt,
    clock(),
    holidays,
    attempt.resolvedAt,
    businessTimezone(),
  );
}

export function attemptRemainingMinutes(
  attempt: { dueAt: Date; resolvedAt: Date | null },
  holidays: ReadonlySet<string>,
  clock: () => Date,
): number {
  if (attempt.resolvedAt) return 0;
  return remainingBusinessMinutes(clock(), attempt.dueAt, holidays, businessTimezone());
}
