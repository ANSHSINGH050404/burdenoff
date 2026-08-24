export type Role = 'REPORTER' | 'AGENT';
export type Status = 'OPEN' | 'IN_PROGRESS' | 'WAITING_ON_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';

export type User = { id: string; name: string; email: string; role: Role };

export type Comment = { id: string; content: string; createdAt: string; author: User };

export type ResolutionAttempt = {
  id: string;
  dueAt: string;
  startedAt: string;
  resolvedAt?: string;
  state: SlaState;
  remainingBusinessMinutes: number;
};

export type SlaInfo = {
  firstResponseDueAt: string;
  resolutionDueAt: string;
  firstResponseState: SlaState;
  resolutionState: SlaState;
  firstResponseRemainingMinutes: number;
  resolutionRemainingMinutes: number;
};

export type Ticket = {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  status: Status;
  createdAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  reporter: User;
  assignee?: User;
  comments: Comment[];
  resolutionAttempts: ResolutionAttempt[];
  sla: SlaInfo;
};

export type Dashboard = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  breached: number;
};

export type ConnectionPage = { hasNextPage: boolean; endCursor?: string };

export type Holiday = { id: string; date: string; name: string };

export type AuthPayload = { token: string; user: User };

export type GraphQLResult<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};

export type Variables = Record<string, unknown>;

export type TicketFilters = {
  status?: Status;
  priority?: Priority;
  assigneeId?: string;
  slaState?: SlaState;
};

export const STATUSES: Status[] = [
  'OPEN',
  'IN_PROGRESS',
  'WAITING_ON_CUSTOMER',
  'RESOLVED',
  'CLOSED',
];
export const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
export const SLA_STATES: SlaState[] = ['ON_TRACK', 'AT_RISK', 'BREACHED'];
