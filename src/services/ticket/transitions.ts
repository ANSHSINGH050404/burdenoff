import type { TicketStatus } from '@prisma/client';

export const TRANSITIONS: Readonly<Record<string, readonly TicketStatus[]>> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_CUSTOMER'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'WAITING_ON_CUSTOMER'],
  WAITING_ON_CUSTOMER: ['OPEN', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export function validTransition(from: string, to: string): boolean {
  return TRANSITIONS[from]?.includes(to as TicketStatus) ?? false;
}
