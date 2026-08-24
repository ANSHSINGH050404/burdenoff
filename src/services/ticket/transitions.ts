import type { TicketStatus } from '@prisma/client';

export const TRANSITIONS: Readonly<Record<string, readonly TicketStatus[]>> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export function validTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to as TicketStatus) ?? false;
}
