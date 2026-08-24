import type { Status } from '../api/types';

export const NEXT_STATUSES: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS', 'WAITING_ON_CUSTOMER'],
  IN_PROGRESS: ['OPEN', 'RESOLVED', 'WAITING_ON_CUSTOMER'],
  WAITING_ON_CUSTOMER: ['OPEN', 'IN_PROGRESS'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : '—';
}
