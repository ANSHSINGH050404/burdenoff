export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const SLA_POLICY: Readonly<Record<Priority, { response: number; resolution: number }>> = {
  URGENT: { response: 60, resolution: 240 }, HIGH: { response: 240, resolution: 1440 },
  MEDIUM: { response: 480, resolution: 2880 }, LOW: { response: 1440, resolution: 4320 }
};
const minute = 60_000;
type Parts = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };
function parts(date: Date, timezone: string): Parts {
  const values = new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short' }).formatToParts(date);
  const get = (type: string): number => Number(values.find(value => value.type === type)?.value ?? 0);
  const weekday = values.find(value => value.type === 'weekday')?.value ?? 'Sun';
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), weekday: ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[weekday] ?? 7 };
}
export function localDate(date: Date, timezone = DEFAULT_TIMEZONE): string { const p = parts(date, timezone); return `${p.year.toString().padStart(4, '0')}-${p.month.toString().padStart(2, '0')}-${p.day.toString().padStart(2, '0')}`; }
function working(date: Date, holidays: ReadonlySet<string>, timezone: string): boolean { const p = parts(date, timezone); return p.weekday >= 1 && p.weekday <= 5 && p.hour >= 9 && p.hour < 18 && !holidays.has(localDate(date, timezone)); }
export function remainingBusinessMinutes(start: Date, end: Date, holidays: ReadonlySet<string>, timezone = DEFAULT_TIMEZONE): number {
  if (end <= start) return 0; let total = 0; for (let cursor = new Date(start); cursor < end; cursor = new Date(cursor.getTime() + minute)) if (working(cursor, holidays, timezone)) total += Math.min(minute, end.getTime() - cursor.getTime()) / minute; return total;
}
export function addBusinessMinutes(start: Date, amount: number, holidays: ReadonlySet<string>, timezone = DEFAULT_TIMEZONE): Date {
  let cursor = new Date(start); let remaining = amount;
  while (remaining > 0) { if (working(cursor, holidays, timezone)) { const consumed = Math.min(remaining, 1); cursor = new Date(cursor.getTime() + consumed * minute); remaining -= consumed; } else cursor = new Date(cursor.getTime() + minute); }
  return cursor;
}
export function calculateDeadlines(start: Date, priority: Priority, holidays: ReadonlySet<string>, timezone = DEFAULT_TIMEZONE): { response: Date; resolution: Date } { const policy = SLA_POLICY[priority]; return { response: addBusinessMinutes(start, policy.response, holidays, timezone), resolution: addBusinessMinutes(start, policy.resolution, holidays, timezone) }; }
export function slaState(start: Date, deadline: Date, now: Date, holidays: ReadonlySet<string>, completedAt: Date | null, timezone = DEFAULT_TIMEZONE): SlaState {
  if (completedAt) return completedAt <= deadline ? 'ON_TRACK' : 'BREACHED';
  if (now >= deadline) return 'BREACHED';
  const total = remainingBusinessMinutes(start, deadline, holidays, timezone); const remaining = remainingBusinessMinutes(now, deadline, holidays, timezone); return total > 0 && (total - remaining) / total > 0.75 ? 'AT_RISK' : 'ON_TRACK';
}
export function validTransition(from: string, to: string): boolean { return ({ OPEN: ['IN_PROGRESS'], IN_PROGRESS: ['OPEN', 'RESOLVED'], RESOLVED: ['CLOSED'], CLOSED: [] } as Readonly<Record<string, readonly string[]>>)[from]?.includes(to) ?? false; }
