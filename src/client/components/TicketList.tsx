import type { ConnectionPage, Ticket } from '../api/types';
import { PRIORITY_BADGE, SLA_DOT, STATUS_BADGE } from '../lib/ui';

type Props = {
  tickets: Ticket[];
  selectedId?: string;
  onSelect: (id: string) => void;
  page?: ConnectionPage;
  onLoadMore: () => void;
};

export function TicketList({ tickets, selectedId, onSelect, page, onLoadMore }: Props) {
  return (
    <div className="flex flex-col">
      {tickets.map((ticket) => (
        <button
          key={ticket.id}
          onClick={() => onSelect(ticket.id)}
          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-stone-100 px-4 py-3 text-left hover:bg-stone-50 ${
            selectedId === ticket.id ? 'bg-emerald-50/60' : ''
          }`}
        >
          <span className="min-w-0">
            <b className="block truncate">{ticket.title}</b>
            <small className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span
                className={`rounded px-1.5 py-0.5 font-bold ${PRIORITY_BADGE[ticket.priority]}`}
              >
                {ticket.priority}
              </span>
              <span>{ticket.assignee?.name ?? 'Unassigned'}</span>
            </small>
          </span>
          <span className="flex items-center gap-3 text-right">
            <span className="hidden text-xs text-stone-500 sm:flex sm:flex-col sm:items-end">
              <span className="flex items-center gap-1.5 font-semibold">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${SLA_DOT[ticket.sla.resolutionState]}`}
                />
                {ticket.sla.resolutionState}
              </span>
              <span>{ticket.sla.resolutionRemainingMinutes} min left</span>
            </span>
            <span
              className={`rounded px-2 py-1 text-[11px] font-bold ${STATUS_BADGE[ticket.status]}`}
            >
              {ticket.status}
            </span>
          </span>
        </button>
      ))}
      {page?.hasNextPage && (
        <button
          onClick={onLoadMore}
          className="m-3 rounded border border-dashed border-stone-300 px-4 py-2 text-sm font-semibold text-stone-500 hover:bg-stone-50"
        >
          Load more
        </button>
      )}
    </div>
  );
}
