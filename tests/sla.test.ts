import { describe, expect, test } from 'bun:test';
import { addBusinessHours, slaState, validTransition } from '../src/domain/sla';
describe('business hours SLA', () => {
  test('skips weekends and holidays', () => { const result = addBusinessHours(new Date('2026-08-21T09:00:00Z'), 16, new Set(['2026-08-24']), 'UTC'); expect(result.toISOString()).toBe('2026-08-25T17:00:00.000Z'); });
  test('completion is evaluated against deadline', () => { const deadline = new Date('2026-01-02'); expect(slaState(deadline, new Date('2026-01-01'), new Date('2026-01-01'))).toBe('ON_TRACK'); expect(slaState(deadline, new Date('2026-01-03'), new Date('2026-01-03'))).toBe('BREACHED'); });
  test('enforces state machine', () => { expect(validTransition('OPEN', 'IN_PROGRESS')).toBe(true); expect(validTransition('OPEN', 'RESOLVED')).toBe(false); expect(validTransition('CLOSED', 'OPEN')).toBe(false); });
});
