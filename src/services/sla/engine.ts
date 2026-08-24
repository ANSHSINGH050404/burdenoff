export type Priority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
export type SlaState = 'ON_TRACK' | 'AT_RISK' | 'BREACHED';
export const DEFAULT_TIMEZONE = 'Asia/Kolkata';
export const SLA_POLICY: Readonly<Record<Priority, { response: number; resolution: number }>> = {
  URGENT: { response: 60, resolution: 240 },
  HIGH: { response: 240, resolution: 1440 },
  MEDIUM: { response: 480, resolution: 2880 },
  LOW: { response: 1440, resolution: 4320 },
};
type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};
type Interval = { start: Date; end: Date };
const DAY = 86_400_000;
function dateParts(date: Date, timezone: string): DateParts {
  const values = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const number = (type: string): number =>
    Number(values.find((value) => value.type === type)?.value ?? 0);
  const weekday = values.find((value) => value.type === 'weekday')?.value ?? 'Sun';
  return {
    year: number('year'),
    month: number('month'),
    day: number('day'),
    hour: number('hour'),
    minute: number('minute'),
    weekday:
      ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 } as Record<string, number>)[
        weekday
      ] ?? 7,
  };
}
export function localDate(date: Date, timezone = DEFAULT_TIMEZONE): string {
  const p = dateParts(date, timezone);
  return `${p.year.toString().padStart(4, '0')}-${p.month.toString().padStart(2, '0')}-${p.day.toString().padStart(2, '0')}`;
}
function localToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timezone: string,
): Date {
  let guess = new Date(Date.UTC(year, month - 1, day, hour));
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = dateParts(guess, timezone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour);
    const wanted = Date.UTC(year, month - 1, day, hour);
    guess = new Date(guess.getTime() + wanted - actualAsUtc);
  }
  return guess;
}
function nextLocalDay(p: DateParts): DateParts {
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
    hour: 0,
    minute: 0,
    weekday: next.getUTCDay() || 7,
  };
}
function intervals(
  start: Date,
  end: Date,
  holidays: ReadonlySet<string>,
  timezone: string,
): Interval[] {
  const result: Interval[] = [];
  let day = dateParts(start, timezone);
  const last = localDate(end, timezone);
  while (
    `${day.year.toString().padStart(4, '0')}-${day.month.toString().padStart(2, '0')}-${day.day.toString().padStart(2, '0')}` <=
    last
  ) {
    const key = `${day.year.toString().padStart(4, '0')}-${day.month.toString().padStart(2, '0')}-${day.day.toString().padStart(2, '0')}`;
    if (day.weekday >= 1 && day.weekday <= 5 && !holidays.has(key)) {
      const intervalStart = new Date(
        Math.max(start.getTime(), localToUtc(day.year, day.month, day.day, 9, timezone).getTime()),
      );
      const intervalEnd = new Date(
        Math.min(end.getTime(), localToUtc(day.year, day.month, day.day, 18, timezone).getTime()),
      );
      if (intervalEnd > intervalStart) result.push({ start: intervalStart, end: intervalEnd });
    }
    day = nextLocalDay(day);
  }
  return result;
}
export function remainingBusinessMinutes(
  start: Date,
  end: Date,
  holidays: ReadonlySet<string>,
  timezone = DEFAULT_TIMEZONE,
): number {
  return intervals(start, end, holidays, timezone).reduce(
    (total, interval) => total + (interval.end.getTime() - interval.start.getTime()) / 60_000,
    0,
  );
}
export function addBusinessMinutes(
  start: Date,
  amount: number,
  holidays: ReadonlySet<string>,
  timezone = DEFAULT_TIMEZONE,
): Date {
  if (amount <= 0) return new Date(start);
  let cursor = new Date(start);
  let remaining = amount;
  while (remaining > 0) {
    const searchEnd = new Date(cursor.getTime() + Math.max(remaining * 60_000, DAY));
    const next = intervals(cursor, searchEnd, holidays, timezone)[0];
    if (!next) {
      cursor = searchEnd;
      continue;
    }
    const available =
      (next.end.getTime() - Math.max(cursor.getTime(), next.start.getTime())) / 60_000;
    if (remaining <= available)
      return new Date(Math.max(cursor.getTime(), next.start.getTime()) + remaining * 60_000);
    remaining -= available;
    cursor = new Date(next.end.getTime() + 60_000);
  }
  return cursor;
}
export function calculateDeadlines(
  start: Date,
  priority: Priority,
  holidays: ReadonlySet<string>,
  timezone = DEFAULT_TIMEZONE,
): { response: Date; resolution: Date } {
  const policy = SLA_POLICY[priority];
  return {
    response: addBusinessMinutes(start, policy.response, holidays, timezone),
    resolution: addBusinessMinutes(start, policy.resolution, holidays, timezone),
  };
}
export function slaState(
  start: Date,
  deadline: Date,
  now: Date,
  holidays: ReadonlySet<string>,
  completedAt: Date | null,
  timezone = DEFAULT_TIMEZONE,
): SlaState {
  if (completedAt) return completedAt <= deadline ? 'ON_TRACK' : 'BREACHED';
  if (now >= deadline) return 'BREACHED';
  const total = remainingBusinessMinutes(start, deadline, holidays, timezone);
  const remaining = remainingBusinessMinutes(now, deadline, holidays, timezone);
  return total > 0 && (total - remaining) / total > 0.75 ? 'AT_RISK' : 'ON_TRACK';
}
