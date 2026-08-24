import { describe, expect, test } from 'bun:test';
import { createRateLimiter } from '../../src/middleware/rateLimit';

describe('rate limiter', () => {
  test('allows up to the configured maximum per window', () => {
    const time = 1_000;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 3 }, () => time);
    expect(limiter.check('ip-1')).toBe(true);
    expect(limiter.check('ip-1')).toBe(true);
    expect(limiter.check('ip-1')).toBe(true);
    expect(limiter.check('ip-1')).toBe(false);
    expect(limiter.check('ip-2')).toBe(true);
  });

  test('opens a fresh window after expiry', () => {
    let time = 1_000;
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1 }, () => time);
    expect(limiter.check('ip-1')).toBe(true);
    expect(limiter.check('ip-1')).toBe(false);
    time += 60_001;
    expect(limiter.check('ip-1')).toBe(true);
  });
});
