import type { Priority, SlaState, Status } from '../api/types';

export const STATUS_BADGE: Record<Status, string> = {
  OPEN: 'bg-sky-100 text-sky-800',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  WAITING_ON_CUSTOMER: 'bg-violet-100 text-violet-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-stone-200 text-stone-600',
};

export const PRIORITY_BADGE: Record<Priority, string> = {
  URGENT: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-stone-100 text-stone-600',
};

export const SLA_DOT: Record<SlaState, string> = {
  ON_TRACK: 'bg-emerald-500',
  AT_RISK: 'bg-amber-500',
  BREACHED: 'bg-red-500',
};
