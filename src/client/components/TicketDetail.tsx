import { useState, type FormEvent } from 'react';
import { request } from '../api/client';
import {
  assignMutation,
  commentMutation,
  reopenMutation,
  resolveMutation,
  statusMutation,
} from '../api/queries';
import type { Ticket, User, Variables } from '../api/types';
import { NEXT_STATUSES, formatDateTime } from '../lib/domain';

type Props = {
  ticket: Ticket;
  me: User;
  users: User[];
  token: string;
  onDone: () => void;
  onError: (message: string) => void;
};

const fieldClass =
  'rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700';

export function TicketDetail({ ticket, me, users, token, onDone, onError }: Props) {
  const [content, setContent] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const agent = me.role === 'AGENT';
  const nextStatuses = NEXT_STATUSES[ticket.status];

  async function action(query: string, variables: Variables) {
    try {
      await request(token, query, variables);
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ACTION_FAILED');
    }
  }

  async function submitComment(event: FormEvent) {
    event.preventDefault();
    setSendingComment(true);
    try {
      await request(token, commentMutation, { ticketId: ticket.id, content });
      setContent('');
      onDone();
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'ACTION_FAILED');
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <aside className="flex min-h-0 flex-col gap-5 overflow-y-auto rounded border border-stone-200 bg-white p-5 shadow-sm lg:max-h-[calc(100vh-13rem)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="text-[11px] font-bold tracking-[0.16em] text-orange-600 uppercase">
            Ticket detail
          </span>
          <h2 className="truncate text-xl font-bold">{ticket.title}</h2>
          <p className="mt-1 text-sm whitespace-pre-wrap text-stone-600">{ticket.description}</p>
        </div>
        <span className="shrink-0 rounded bg-stone-100 px-2 py-1 text-[11px] font-bold text-stone-600">
          {ticket.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 rounded bg-stone-50 p-3 text-sm lg:grid-cols-3">
        <div>
          <small className="block text-[10px] font-bold tracking-wider text-stone-400">
            PRIORITY
          </small>
          <b>{ticket.priority}</b>
        </div>
        <div>
          <small className="block text-[10px] font-bold tracking-wider text-stone-400">
            ASSIGNEE
          </small>
          <b>{ticket.assignee?.name ?? 'Unassigned'}</b>
        </div>
        <div>
          <small className="block text-[10px] font-bold tracking-wider text-stone-400">
            REPORTER
          </small>
          <b>{ticket.reporter.name}</b>
        </div>
        <div>
          <small className="block text-[10px] font-bold tracking-wider text-stone-400">
            FIRST RESPONSE
          </small>
          <b
            className={
              ticket.sla.firstResponseState === 'BREACHED'
                ? 'text-red-600'
                : ticket.sla.firstResponseState === 'AT_RISK'
                  ? 'text-amber-600'
                  : 'text-emerald-700'
            }
          >
            {ticket.sla.firstResponseState}
          </b>
          <span className="block text-xs text-stone-500">
            {ticket.firstResponseAt
              ? `Responded ${formatDateTime(ticket.firstResponseAt)}`
              : `${ticket.sla.firstResponseRemainingMinutes} business min left · due ${formatDateTime(ticket.sla.firstResponseDueAt)}`}
          </span>
        </div>
        <div>
          <small className="block text-[10px] font-bold tracking-wider text-stone-400">
            RESOLUTION
          </small>
          <b
            className={
              ticket.sla.resolutionState === 'BREACHED'
                ? 'text-red-600'
                : ticket.sla.resolutionState === 'AT_RISK'
                  ? 'text-amber-600'
                  : 'text-emerald-700'
            }
          >
            {ticket.sla.resolutionState}
          </b>
          <span className="block text-xs text-stone-500">
            {ticket.resolvedAt
              ? `Resolved ${formatDateTime(ticket.resolvedAt)}`
              : `${ticket.sla.resolutionRemainingMinutes} business min left · due ${formatDateTime(ticket.sla.resolutionDueAt)}`}
          </span>
        </div>
        <div>
          <small className="block text-[10px] font-bold tracking-wider text-stone-400">
            CREATED
          </small>
          <b>{formatDateTime(ticket.createdAt)}</b>
        </div>
      </div>

      {agent && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Assign agent"
            className={fieldClass}
            value={ticket.assignee?.id ?? ''}
            onChange={(event) => {
              if (event.target.value)
                void action(assignMutation, {
                  ticketId: ticket.id,
                  assigneeId: event.target.value,
                });
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
              className={fieldClass}
              value=""
              onChange={(event) => {
                if (event.target.value)
                  void action(statusMutation, { ticketId: ticket.id, status: event.target.value });
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
              onClick={() => void action(resolveMutation, { ticketId: ticket.id })}
              className="rounded bg-emerald-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
            >
              Resolve
            </button>
          )}
          {ticket.status === 'RESOLVED' && (
            <button
              onClick={() => void action(reopenMutation, { ticketId: ticket.id })}
              className="rounded border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              Reopen
            </button>
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-col gap-3">
        <h3 className="font-bold">Conversation</h3>
        {ticket.comments.map((comment) => (
          <div key={comment.id} className="rounded border border-stone-100 bg-stone-50/60 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-sm">{comment.author.name}</b>
              <small className="text-xs text-stone-400">{formatDateTime(comment.createdAt)}</small>
            </div>
            <p className="mt-1 text-sm whitespace-pre-wrap text-stone-700">{comment.content}</p>
          </div>
        ))}
        {ticket.comments.length === 0 && <p className="text-sm text-stone-400">No comments yet.</p>}
        <form onSubmit={(event) => void submitComment(event)} className="flex flex-col gap-2">
          <textarea
            required
            placeholder="Add an update..."
            value={content}
            onChange={(event) => setContent(event.target.value)}
            className={`${fieldClass} min-h-20 w-full`}
          />
          <button
            type="submit"
            disabled={sendingComment}
            className="self-start rounded bg-emerald-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {sendingComment ? 'Sending…' : 'Add comment'}
          </button>
        </form>
      </div>
    </aside>
  );
}
