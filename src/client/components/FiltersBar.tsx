import type { TicketFilters, User } from '../api/types';
import { PRIORITIES, SLA_STATES, STATUSES } from '../api/types';

type Props = {
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
  sort: string;
  onSortChange: (sort: string) => void;
  users: User[];
};

const selectClass =
  'min-w-0 flex-1 rounded border border-stone-300 bg-white px-2 py-2 text-sm capitalize';

export function FiltersBar({ filters, onFiltersChange, sort, onSortChange, users }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      <select
        aria-label="Status filter"
        className={selectClass}
        value={filters.status ?? ''}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            status: (event.target.value || undefined) as TicketFilters['status'],
          })
        }
      >
        <option value="">All status</option>
        {STATUSES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <select
        aria-label="Priority filter"
        className={selectClass}
        value={filters.priority ?? ''}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            priority: (event.target.value || undefined) as TicketFilters['priority'],
          })
        }
      >
        <option value="">All priority</option>
        {PRIORITIES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <select
        aria-label="Assignee filter"
        className={selectClass}
        value={filters.assigneeId ?? ''}
        onChange={(event) =>
          onFiltersChange({ ...filters, assigneeId: event.target.value || undefined })
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
        className={selectClass}
        value={filters.slaState ?? ''}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            slaState: (event.target.value || undefined) as TicketFilters['slaState'],
          })
        }
      >
        <option value="">All SLA</option>
        {SLA_STATES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>
      <select
        aria-label="Sort tickets"
        className={selectClass}
        value={sort}
        onChange={(event) => onSortChange(event.target.value)}
      >
        <option value="newest">Newest first</option>
        <option value="oldest">Oldest first</option>
      </select>
    </div>
  );
}
