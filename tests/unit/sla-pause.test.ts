import { describe, expect, test } from 'bun:test';
import { addBusinessMinutes, remainingBusinessMinutes } from '../../src/services/sla/engine';

describe('SLA pause while waiting on customer', () => {
  test('counts only business time between pause and resume', () => {
    const pausedAt = new Date('2026-08-21T17:30:00Z'); // Friday 17:30 UTC
    const resumedAt = new Date('2026-08-24T10:00:00Z'); // Monday 10:00 UTC
    const paused = remainingBusinessMinutes(pausedAt, resumedAt, new Set(), 'UTC');
    // 30 minutes Friday (17:30-18:00) + 60 minutes Monday (09:00-10:00)
    expect(paused).toBe(90);
  });

  test('restarts the clock from the resume point with the remaining budget', () => {
    const deadline = new Date('2026-08-21T14:00:00Z'); // Friday 14:00 UTC
    const pausedAt = new Date('2026-08-21T11:00:00Z'); // Friday 11:00 UTC
    const resumedAt = new Date('2026-08-24T09:30:00Z'); // Monday 09:30 UTC
    const remainingBudget = remainingBusinessMinutes(pausedAt, deadline, new Set(), 'UTC');
    expect(remainingBudget).toBe(180);
    expect(addBusinessMinutes(resumedAt, remainingBudget, new Set(), 'UTC')).toEqual(
      new Date('2026-08-24T12:30:00.000Z'),
    );
  });

  test('a pause fully outside business hours adds zero budget', () => {
    const pausedAt = new Date('2026-08-22T12:00:00Z'); // Saturday
    const resumedAt = new Date('2026-08-23T15:00:00Z'); // Sunday
    expect(remainingBusinessMinutes(pausedAt, resumedAt, new Set(), 'UTC')).toBe(0);
    const deadline = new Date('2026-08-24T10:00:00Z');
    expect(addBusinessMinutes(deadline, 0, new Set(), 'UTC')).toEqual(
      new Date('2026-08-24T10:00:00.000Z'),
    );
  });
});
