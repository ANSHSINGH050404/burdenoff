import { useState, type FormEvent } from 'react';
import { request } from '../api/client';
import { loginMutation, registerMutation } from '../api/queries';
import type { AuthPayload, User } from '../api/types';

type Props = {
  onLogin: (token: string, user: User) => void;
  onError: (message: string) => void;
  errorMessage?: string;
};

const inputClass =
  'mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700';

export function AuthForm({ onLogin, onError, errorMessage }: Props) {
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const data = await request<Record<string, AuthPayload | undefined>>(
        '',
        registering ? registerMutation : loginMutation,
        registering ? { name, email, password } : { email, password },
      );
      const result = data.login ?? data.register;
      if (result) onLogin(result.token, result.user);
    } catch (caught) {
      onError(caught instanceof Error ? caught.message : 'AUTH_FAILED');
    }
  }

  return (
    <main className="grid min-h-screen items-center gap-[8vw] px-[7vw] py-16 lg:grid-cols-[1.2fr_0.8fr]">
      <div>
        <span className="text-sm font-black tracking-[0.2em] text-orange-600">BURDENOFF</span>
        <h1 className="my-4 text-5xl font-black leading-[0.95] tracking-tight lg:text-6xl">
          Support, without drift.
        </h1>
        <p className="max-w-md text-lg text-stone-500">
          One queue. Clear ownership. Every promise measured in business hours.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 rounded border border-stone-200 bg-white p-8 shadow-sm"
      >
        <span className="text-[11px] font-bold tracking-[0.16em] text-orange-600 uppercase">
          {registering ? 'New reporter' : 'Workspace access'}
        </span>
        <h2 className="text-xl font-bold">{registering ? 'Create an account' : 'Welcome back'}</h2>
        {errorMessage && (
          <p
            role="alert"
            className="rounded border border-red-300 bg-red-50 p-3 text-sm break-words text-red-700"
          >
            {errorMessage}
          </p>
        )}
        {registering && (
          <label className="text-sm font-semibold text-stone-600">
            Name
            <input
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="text-sm font-semibold text-stone-600">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="text-sm font-semibold text-stone-600">
          Password
          <input
            required
            minLength={8}
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="rounded bg-emerald-900 px-4 py-2.5 font-bold text-white hover:bg-emerald-800"
        >
          {registering ? 'Create reporter account' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={() => setRegistering(!registering)}
          className="rounded border border-stone-300 px-4 py-2 text-sm text-stone-600 hover:bg-stone-50"
        >
          {registering ? 'Already have access? Sign in' : 'Need an account? Register'}
        </button>
      </form>
    </main>
  );
}
