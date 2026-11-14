/** Lets a cue through at most once per `minGapMs`, per key. */
export interface RateLimiter {
  /** True (and records the time) when the cue may play at `now` (ms). */
  allow: (key: string, now: number) => boolean;
  reset: () => void;
}

export function createRateLimiter(minGapMs: number): RateLimiter {
  const last = new Map<string, number>();
  return {
    allow(key, now) {
      const before = last.get(key);
      if (before !== undefined && now >= before && now - before < minGapMs) {
        return false;
      }
      last.set(key, now);
      return true;
    },
    reset: () => last.clear(),
  };
}
