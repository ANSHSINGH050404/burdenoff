import { useEffect, useState } from 'react';
import { request } from './api/client';
import {
  dashboardQuery,
  holidaysQuery,
  listQuery,
  ticketDetailQuery,
  usersQuery,
} from './api/queries';
import type {
  AgentStat,
  ConnectionPage,
  Dashboard,
  Holiday,
  Ticket,
  TicketFilters,
  User,
} from './api/types';
import { agentStatsQuery } from './api/queries';
import { AgentStats } from './components/AgentStats';
import { AuthForm } from './components/AuthForm';
import { CreateTicketForm } from './components/CreateTicketForm';
import { DashboardStats } from './components/DashboardStats';
import { FiltersBar } from './components/FiltersBar';
import { TicketDetail } from './components/TicketDetail';
import { TicketList } from './components/TicketList';

export function App() {
  const [token, setToken] = useState('');
  const [me, setMe] = useState<User>();
  const [error, setError] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selected, setSelected] = useState<Ticket>();
  const [dashboard, setDashboard] = useState<Dashboard>();
  const [agentStats, setAgentStats] = useState<AgentStat[]>();
  const [users, setUsers] = useState<User[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [filters, setFilters] = useState<TicketFilters>({});
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState<ConnectionPage>();
  const [, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<number>();

  useEffect(() => {
    const id = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!token) return;
    // Poll periodically so SLA state and countdowns stay live; the API
    // remains the only source of truth for breach/risk calculations.
    const id = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(id);
  }, [token]);

  async function refresh() {
    try {
      setError('');
      const baseRequests = [
        request<{ tickets: { nodes: Ticket[]; pageInfo: ConnectionPage } }>(token, listQuery, {
          take: 50,
          ...filters,
        }),
        request<{ dashboard: Dashboard }>(token, dashboardQuery),
        request<{ users: User[] }>(token, usersQuery),
        request<{ holidays: Holiday[] }>(token, holidaysQuery),
        me?.role === 'AGENT'
          ? request<{ agentStats: AgentStat[] }>(token, agentStatsQuery)
          : Promise.resolve(null),
      ] as const;
      const [list, stats, people, days, perf] = await Promise.all(baseRequests);
      setTickets(list.tickets.nodes);
      setPage(list.tickets.pageInfo);
      setDashboard(stats.dashboard);
      setUsers(people.users);
      setHolidays(days.holidays);
      if (perf) setAgentStats(perf.agentStats);
      setLastUpdated(Date.now());
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
      setSelected((await request<{ ticket: Ticket }>(token, ticketDetailQuery, { id })).ticket);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'DETAIL_FAILED');
    }
  }

  if (!token || !me)
    return (
      <AuthForm
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
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6">
      <header className="flex items-center justify-between gap-4 pb-5">
        <div>
          <span className="text-[11px] font-bold tracking-[0.16em] text-orange-600 uppercase">
            Burdenoff / {me.role}
          </span>
          <h1 className="text-2xl font-black">Operations desk</h1>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {lastUpdated !== undefined && (
            <small className="text-stone-400">
              Updated {Math.max(0, Math.floor((Date.now() - lastUpdated) / 1000))}s ago
            </small>
          )}
          <span className="font-semibold text-stone-600">{me.name}</span>
          <button
            onClick={() => {
              setToken('');
              setMe(undefined);
              setSelected(undefined);
            }}
            className="rounded border border-stone-300 px-3 py-1.5 text-stone-600 hover:bg-stone-50"
          >
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          <div>
            <strong className="block font-bold">Action could not complete</strong>
            <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
          </div>
          <button
            onClick={() => setError('')}
            className="shrink-0 rounded border border-red-300 px-2 py-1 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      <DashboardStats dashboard={dashboard} />

      <AgentStats stats={agentStats} />

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_430px]">
        <section className="min-w-0 rounded border border-stone-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-stone-100 p-4">
            <div>
              <span className="text-[11px] font-bold tracking-[0.16em] text-orange-600 uppercase">
                Live queue
              </span>
              <h2 className="font-bold">{tickets.length} tickets</h2>
            </div>
            <CreateTicketForm token={token} onDone={refresh} onError={setError} />
          </div>
          <div className="border-b border-stone-100 p-3">
            <FiltersBar
              filters={filters}
              onFiltersChange={setFilters}
              sort={sort}
              onSortChange={setSort}
              users={users}
            />
          </div>
          <TicketList
            tickets={ordered}
            selectedId={selected?.id}
            onSelect={(id) => void openTicket(id)}
            page={page}
            onLoadMore={() => void loadMore()}
          />
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
          <aside className="rounded border border-stone-200 bg-white p-6 shadow-sm">
            <span className="text-[11px] font-bold tracking-[0.16em] text-orange-600 uppercase">
              Select a ticket
            </span>
            <p className="mt-2 text-sm text-stone-500">
              Choose a ticket to inspect its SLA clock, conversation, and ownership.
            </p>
            {holidays.length > 0 && (
              <div className="mt-6 grid gap-1.5">
                <span className="text-[11px] font-bold tracking-[0.16em] text-orange-600 uppercase">
                  Holiday calendar
                </span>
                {holidays.map((holiday) => (
                  <small key={holiday.id} className="text-xs text-stone-500">
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
