export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
const hour = 60 * 60 * 1000;

export function localDate(date: Date, timezone = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
function isWorking(date: Date, holidays: Set<string>, timezone: string): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date);
  const local = localDate(date, timezone);
  return weekday !== 'Sat' && weekday !== 'Sun' && !holidays.has(local);
}
function localHour(date: Date, timezone: string): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hour12: false }).format(date));
}
export function addBusinessHours(start: Date, hours: number, holidays: Set<string>, timezone = DEFAULT_TIMEZONE): Date {
  let cursor = new Date(start);
  let remaining = hours * hour;
  while (remaining > 0) {
    if (!isWorking(cursor, holidays, timezone) || localHour(cursor, timezone) < 9 || localHour(cursor, timezone) >= 17) {
      cursor = new Date(cursor.getTime() + hour);
      continue;
    }
    cursor = new Date(cursor.getTime() + Math.min(remaining, hour));
    remaining -= hour;
  }
  return cursor;
}
export function slaState(deadline: Date, now = new Date(), completedAt?: Date | null): SlaState {
  if (completedAt) return completedAt <= deadline ? 'ON_TRACK' : 'BREACHED';
  if (now > deadline) return 'BREACHED';
  return deadline.getTime() - now.getTime() <= 2 * hour ? 'AT_RISK' : 'ON_TRACK';
}
export function validTransition(from: string, to: string): boolean {
  return ({ OPEN: ['IN_PROGRESS'], IN_PROGRESS: ['OPEN', 'RESOLVED'], RESOLVED: ['CLOSED'], CLOSED: [] } as Record<string, string[]>)[from]?.includes(to) ?? false;
}
