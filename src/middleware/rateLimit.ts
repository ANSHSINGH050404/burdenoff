export type RateLimitOptions = { windowMs: number; max: number };

export type RateLimiter = {
  check: (key: string) => boolean;
  reset: () => void;
};

/**
 * Fixed-window, in-memory rate limiter keyed by caller-supplied key
 * (client IP). Suitable for single-process deployments.
 */
export function createRateLimiter(
  options: RateLimitOptions,
  now: () => number = () => Date.now(),
): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key: string): boolean {
      const time = now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= time) {
        hits.set(key, { count: 1, resetAt: time + options.windowMs });
        return true;
      }
      if (entry.count < options.max) {
        entry.count += 1;
        return true;
      }
      return false;
    },
    reset(): void {
      hits.clear();
    },
  };
}
