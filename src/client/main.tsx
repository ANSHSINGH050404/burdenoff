import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Role = 'REPORTER' | 'AGENT';
type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
type User = { id: string; name: string; email: string; role: Role };
type Comment = { id: string; content: string; createdAt: string; author: User };
type Attempt = {
  id: string;
  dueAt: string;
  startedAt: string;
  resolvedAt?: string;
  state: SlaState;
  remainingBusinessMinutes: number;
};
type Ticket = {
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
  resolutionAttempts: Attempt[];
  sla: {
    firstResponseDueAt: string;
    resolutionDueAt: string;
    firstResponseState: SlaState;
    resolutionState: SlaState;
    firstResponseRemainingMinutes: number;
    resolutionRemainingMinutes: number;
  };
};
type Dashboard = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  breached: number;
};
type ConnectionPage = { hasNextPage: boolean; endCursor?: string };
type Holiday = { id: string; date: string; name: string };
type GraphQLResult<T> = {
  data?: T;
  errors?: { message: string; extensions?: { code?: string } }[];
};
type Variables = Record<string, unknown>;

async function request<T>(token: string, query: string, variables: Variables = {}): Promise<T> {
  const response = await fetch('/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const result = (await response.json().catch(() => null)) as GraphQLResult<T> | null;
  if (!result)
    throw new Error(
      `HTTP_${response.status}: no GraphQL response. Is the API running? Start it with "bun run dev".`,
    );
  if (result.errors?.length)
    throw new Error(
      result.errors
        .map((item) => `${item.extensions?.code ?? 'ERROR'}: ${item.message}`)
        .join('\n'),
    );
  if (!response.ok || !result.data) throw new Error(`EMPTY_RESPONSE (HTTP ${response.status})`);
  return result.data;
}
const userFields = 'id name email role';
const ticketFields = `id title description priority status createdAt firstResponseAt resolvedAt reporter { ${userFields} } assignee { ${userFields} } comments { id content createdAt author { ${userFields} } } resolutionAttempts { id dueAt startedAt resolvedAt state remainingBusinessMinutes } sla { firstResponseDueAt resolutionDueAt firstResponseState resolutionState firstResponseRemainingMinutes resolutionRemainingMinutes }`;
const listQuery = `query Tickets($take: Int, $cursor: String, $status: TicketStatus, $priority: Priority, $assigneeId: ID, $slaState: SLAState) { tickets(take: $take, cursor: $cursor, status: $status, priority: $priority, assigneeId: $assigneeId, slaState: $slaState) { nodes { ${ticketFields} } pageInfo { hasNextPage endCursor } } }`;
const detailQuery = `query Ticket($id: ID!) { ticket(id: $id) { ${ticketFields} } }`;
const dashboardQuery = `query Dashboard { dashboard { total open inProgress resolved closed breached } }`;
const usersQuery = `query Users { users { ${userFields} } }`;
const holidaysQuery = `query Holidays { holidays { id date name } }`;

const NEXT_STATUSES: Record<Status, Status[]> = {
  OPEN: ['IN_PROGRESS'],
  IN_PROGRESS: ['OPEN', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

function formatDateTime(value?: string): string {
  return value ? new Date(value).toLocaleString() : '—';
}

function Auth({
  onLogin,
  onError,
  errorMessage,
}: {
  onLogin: (token: string, user: User) => void;
  onError: (message: string) => void;
  errorMessage?: string;
}) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const data = await request<{
        login?: { token: string; user: User };
        register?: { token: string; user: User };
      }>(
        '',
        registering
          ? `mutation Register($name: String!, $email: String!, $password: String!) { register(name: $name, email: $email, password: $password) { token user { ${userFields} } } }`
          : `mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { token user { ${userFields} } } }`,
        registering ? { name, email, password } : { email, password },
      );
      const result = data.login ?? data.register;
      if (result) onLogin(result.token, result.user);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'AUTH_FAILED');
    }
  }
  return (
    <main className="auth-shell">
      <div className="brand">
        <span>BURDENOFF</span>
        <h1>Support, without drift.</h1>
        <p>One queue. Clear ownership. Every promise measured.</p>
      </div>
      <form className="panel auth" onSubmit={submit}>
        <span className="eyebrow">{registering ? 'NEW REPORTER' : 'WORKSPACE ACCESS'}</span>
        <h2>{registering ? 'Create an account' : 'Welcome back'}</h2>
        {errorMessage && (
          <p className="auth-error" role="alert">
            {errorMessage}
          </p>
        )}
        {registering && (
          <label>
            Name
            <input required value={name} onChange={(event) => setName(event.target.value)} />
          </label>
        )}
        <label>
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          Password
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <button type="submit">{registering ? 'Create reporter account' : 'Sign in'}</button>
        <button type="button" className="quiet" onClick={() => setRegistering(!registering)}>
          {registering ? 'Already have access? Sign in' : 'Need an account? Register'}
        </button>
      </form>
    </main>
  );
}

function App() {
  const [token, setToken] = useState('');
  const [me, setMe] = useState<User>();
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket>();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [users, setUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<{
    status?: Status;
    priority?: Priority;
    assigneeId?: string;
    slaState?: SlaState;
  }>({});
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState<ConnectionPage>();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  async function refresh() {
    try {
      setError('');
      const [list, stats, people, days] = await Promise.all([
        request<{ tickets: { nodes: Ticket[]; pageInfo: ConnectionPage } }>(token, listQuery, {
          take: 50,
          ...filters,
        }),
        request<{ dashboard: Dashboard }>(token, dashboardQuery),
        request<{ users: User[] }>(token, usersQuery),
        request<{ holidays: Holiday[] }>(token, holidaysQuery),
      ]);
      setTickets(list.tickets.nodes);
      setPage(list.tickets.pageInfo);
      setDashboard(stats.dashboard);
      setUsers(people.users);
      setHolidays(days.holidays);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'LOAD_FAILED');
    }
  }
  async function loadMore() {
    if (!page?.endCursor) return;
    try {
      const list = await request<{ tickets: { nodes: Ticket[]; pageInfo: ConnectionPage } }>(
        token,
        listQuery,
        { take: 50, cursor: page.endCursor, ...filters },
      );
      setTickets((previous) => [
        ...previous,
        ...list.tickets.nodes.filter((node) => !previous.some((item) => item.id === node.id)),
      ]);
      setPage(list.tickets.pageInfo);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'LOAD_FAILED');
    }
  }
  useEffect(() => {
    if (token) void refresh();
  }, [token, filters]);
  async function openTicket(id: string) {
    try {
      setSelected((await request<{ ticket: Ticket }>(token, detailQuery, { id })).ticket);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'DETAIL_FAILED');
    }
  }
  if (!token || !me)
    return (
      <Auth
        onLogin={(newToken, user) => {
          setToken(newToken);
          setMe(user);
        }}
        onError={setError}
        errorMessage={error}
      />
    );
  const ordered = sort === 'oldest' ? [...tickets].reverse() : tickets;
  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <span className="eyebrow">BURDENOFF / {me.role}</span>
          <h1>Operations desk</h1>
        </div>
        <div className="top-actions">
          <span>{me.name}</span>
          <button
            className="quiet"
            onClick={() => {
              setToken('');
              setMe(undefined);
              setSelected(undefined);
            }}
          >
            Sign out
          </button>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          <strong>Action could not complete</strong>
          <pre>{error}</pre>
          <button onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      <section className="stats">
        {[
          ['TOTAL', dashboard?.total],
          ['OPEN', dashboard?.open],
          ['IN PROGRESS', dashboard?.inProgress],
          ['RESOLVED', dashboard?.resolved],
          ['CLOSED', dashboard?.closed],
          ['BREACHED', dashboard?.breached],
        ].map(([label, value]) => (
          <div className="stat panel" key={String(label)}>
            <span>{label}</span>
            <b>{value ?? '—'}</b>
          </div>
        ))}
      </section>
      <div className="workspace">
        <section className="queue">
          <div className="section-heading">
            <div>
              <span className="eyebrow">LIVE QUEUE</span>
              <h2>{tickets.length} tickets</h2>
            </div>
            <CreateTicket token={token} onDone={refresh} onError={setError} />
          </div>
          <div className="filters">
            <select
              aria-label="Status filter"
              value={filters.status ?? ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  status: (event.target.value || undefined) as Status | undefined,
                })
              }
            >
              <option value="">All status</option>
              {(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as Status[]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Priority filter"
              value={filters.priority ?? ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  priority: (event.target.value || undefined) as Priority | undefined,
                })
              }
            >
              <option value="">All priority</option>
              {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Assignee filter"
              value={filters.assigneeId ?? ''}
              onChange={(event) =>
                setFilters({ ...filters, assigneeId: event.target.value || undefined })
              }
            >
              <option value="">All assignees</option>
              {users
                .filter((user) => user.role === 'AGENT')
                .map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="SLA filter"
              value={filters.slaState ?? ''}
              onChange={(event) =>
                setFilters({
                  ...filters,
                  slaState: (event.target.value || undefined) as SlaState | undefined,
                })
              }
            >
              <option value="">All SLA</option>
              {(['ON_TRACK', 'AT_RISK', 'BREACHED'] as SlaState[]).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Sort tickets"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div className="ticket-list">
            {ordered.map((ticket) => (
              <button
                className={`ticket-row ${selected?.id === ticket.id ? 'selected' : ''}`}
                key={ticket.id}
                onClick={() => void openTicket(ticket.id)}
              >
                <span className="ticket-main">
                  <b>{ticket.title}</b>
                  <small>
                    {ticket.priority} · {ticket.assignee?.name ?? 'Unassigned'}
                  </small>
                </span>
                <span className="ticket-sla">
                  <span className={`dot ${ticket.sla.resolutionState.toLowerCase()}`} />
                  {ticket.sla.resolutionState}
                  <small>{ticket.sla.resolutionRemainingMinutes} min left</small>
                </span>
                <span className={`status ${ticket.status.toLowerCase()}`}>{ticket.status}</span>
              </button>
            ))}
          </div>
          {page?.hasNextPage && (
            <button className="load-more" onClick={() => void loadMore()}>
              Load more
            </button>
          )}
        </section>
        {selected ? (
          <TicketDetail
            ticket={selected}
            me={me}
            users={users}
            token={token}
            onDone={() => {
              void openTicket(selected.id);
              void refresh();
            }}
            onError={setError}
          />
        ) : (
          <aside className="empty panel">
            <span className="eyebrow">SELECT A TICKET</span>
            <p>Choose a ticket to inspect its SLA clock, conversation, and ownership.</p>
            {holidays.length > 0 && (
              <div className="holiday-list">
                <span className="eyebrow">HOLIDAY CALENDAR</span>
                {holidays.map((holiday) => (
                  <small key={holiday.id}>
                    {holiday.date} · {holiday.name}
                  </small>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </main>
  );
}

function CreateTicket({
  token,
  onDone,
  onError,
}: {
  token: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await request(
        token,
        `mutation Create($title: String!, $description: String!, $priority: Priority!) { createTicket(title: $title, description: $description, priority: $priority) { id } }`,
        { title, description, priority },
      );
      setTitle('');
      setDescription('');
      setOpen(false);
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'CREATE_FAILED');
    }
  }
  return (
    <>
      <button onClick={() => setOpen(!open)}>+ New ticket</button>
      {open && (
        <form className="create-form panel" onSubmit={submit}>
          <h3>Open a ticket</h3>
          <input
            required
            placeholder="Short title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            required
            placeholder="What needs attention?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <select
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
          >
            {(['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <button type="submit">Create ticket</button>
        </form>
      )}
    </>
  );
}

function TicketDetail({
  ticket,
  me,
  users,
  token,
  onDone,
  onError,
}: {
  ticket: Ticket;
  me: User;
  users: User[];
  token: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [content, setContent] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const agent = me.role === 'AGENT';
  async function action(query: string, variables: Variables) {
    try {
      await request(token, query, variables);
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ACTION_FAILED');
    }
  }
  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    setSendingComment(true);
    try {
      await request(
        token,
        `mutation Comment($ticketId: ID!, $content: String!) { addComment(ticketId: $ticketId, content: $content) { id } }`,
        { ticketId: ticket.id, content },
      );
      setContent('');
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ACTION_FAILED');
    } finally {
      setSendingComment(false);
    }
  }
  const nextStatuses = NEXT_STATUSES[ticket.status];
  return (
    <aside className="detail panel">
      <div className="detail-heading">
        <div>
          <span className="eyebrow">TICKET DETAIL</span>
          <h2>{ticket.title}</h2>
          <p>{ticket.description}</p>
        </div>
        <span className={`status ${ticket.status.toLowerCase()}`}>{ticket.status}</span>
      </div>
      <div className="meta-grid">
        <div>
          <small>PRIORITY</small>
          <b>{ticket.priority}</b>
        </div>
        <div>
          <small>ASSIGNEE</small>
          <b>{ticket.assignee?.name ?? 'Unassigned'}</b>
        </div>
        <div>
          <small>REPORTER</small>
          <b>{ticket.reporter.name}</b>
        </div>
        <div>
          <small>CREATED</small>
          <b>{formatDateTime(ticket.createdAt)}</b>
        </div>
        <div>
          <small>FIRST RESPONSE</small>
          <b>{ticket.sla.firstResponseState}</b>
          {ticket.firstResponseAt ? (
            <span>Responded {formatDateTime(ticket.firstResponseAt)}</span>
          ) : (
            <>
              <span>{ticket.sla.firstResponseRemainingMinutes} business min left</span>
              <span>Due {formatDateTime(ticket.sla.firstResponseDueAt)}</span>
            </>
          )}
        </div>
        <div>
          <small>RESOLUTION</small>
          <b>{ticket.sla.resolutionState}</b>
          {ticket.resolvedAt ? (
            <span>Resolved {formatDateTime(ticket.resolvedAt)}</span>
          ) : (
            <>
              <span>{ticket.sla.resolutionRemainingMinutes} business min left</span>
              <span>Due {formatDateTime(ticket.sla.resolutionDueAt)}</span>
            </>
          )}
        </div>
      </div>
      {agent && (
        <div className="controls">
          <select
            value={ticket.assignee?.id ?? ''}
            onChange={(event) => {
              if (event.target.value)
                void action(
                  `mutation Assign($ticketId: ID!, $assigneeId: ID!) { assignTicket(ticketId: $ticketId, assigneeId: $assigneeId) { id } }`,
                  { ticketId: ticket.id, assigneeId: event.target.value },
                );
            }}
          >
            <option value="">Assign agent</option>
            {users
              .filter((user) => user.role === 'AGENT')
              .map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
          </select>
          {nextStatuses.length > 0 && (
            <select
              aria-label="Change status"
              value=""
              onChange={(event) => {
                if (event.target.value)
                  void action(
                    `mutation Status($ticketId: ID!, $status: TicketStatus!) { changeTicketStatus(ticketId: $ticketId, status: $status) { id } }`,
                    { ticketId: ticket.id, status: event.target.value },
                  );
              }}
            >
              <option value="">Move to…</option>
              {nextStatuses.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          )}
          {ticket.status === 'IN_PROGRESS' && (
            <button
              onClick={() =>
                void action(
                  `mutation Resolve($ticketId: ID!) { resolveTicket(ticketId: $ticketId) { id } }`,
                  { ticketId: ticket.id },
                )
              }
            >
              Resolve
            </button>
          )}
          {ticket.status === 'RESOLVED' && (
            <button
              onClick={() =>
                void action(
                  `mutation Reopen($ticketId: ID!) { reopenTicket(ticketId: $ticketId) { id } }`,
                  { ticketId: ticket.id },
                )
              }
            >
              Reopen
            </button>
          )}
        </div>
      )}
      <div className="thread">
        <h3>Conversation</h3>
        {ticket.comments.map((comment) => (
          <div className="comment" key={comment.id}>
            <div className="comment-head">
              <b>{comment.author.name}</b>
              <small>{new Date(comment.createdAt).toLocaleString()}</small>
            </div>
            <p>{comment.content}</p>
          </div>
        ))}
        {ticket.comments.length === 0 && <p className="muted">No comments yet.</p>}
        <form
          className="comment-form"
          onSubmit={(event) => {
            void submitComment(event);
          }}
        >
          <textarea
            required
            placeholder="Add an update..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
          />
          <button type="submit" disabled={sendingComment}>
            {sendingComment ? 'Sending…' : 'Add comment'}
          </button>
        </form>
      </div>
    </aside>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
