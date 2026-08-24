import type { Status } from '../api/types';

export const NEXT_STATUSES: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

export function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : '—';
}
