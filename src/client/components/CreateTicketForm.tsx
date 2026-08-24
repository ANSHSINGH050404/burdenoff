import { useState, type FormEvent } from 'react';
import { request } from '../api/client';
import { createTicketMutation } from '../api/queries';
import { PRIORITIES } from '../api/types';
import type { Priority } from '../api/types';

type Props = {
  token: string;
  onDone: () => void;
  onError: (message: string) => void;
};

const fieldClass =
  'w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700';

export function CreateTicketForm({ token, onDone, onError }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await request(token, createTicketMutation, { title, description, priority });
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
      <button
        onClick={() => setOpen(!open)}
        className="rounded bg-emerald-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
      >
        + New ticket
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded border border-stone-200 bg-white p-4 shadow-sm"
        >
          <h3 className="font-bold">Open a ticket</h3>
          <input
            required
            placeholder="Short title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
          <textarea
            required
            placeholder="What needs attention?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={`${fieldClass} min-h-24`}
          />
          <select
            aria-label="Priority"
            value={priority}
            onChange={(event) => setPriority(event.target.value as Priority)}
            className={fieldClass}
          >
            {PRIORITIES.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
          <button
            type="submit"
            className="self-start rounded bg-emerald-900 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800"
          >
            Create ticket
          </button>
        </form>
      )}
    </>
  );
}
