/**
 * Income rate: gross gains of one resource per second over a short moving
 * window. Only increases count, so buying something (a drop) never shows up
 * as negative income.
 */

export interface GainSample {
  /** Milliseconds on whatever clock the caller uses. */
  at: number;
  gain: number;
}

/** How far back the smoothed rate looks. */
export const RATE_WINDOW_MS = 3000;
/** A young window is stretched to at least this, so one tap isn't a spike. */
const MIN_SPAN_MS = 1000;

/** Adds the change from `previous` to `next` (if it is a gain) and drops old samples. */
export function recordGain(
  samples: readonly GainSample[],
  previous: number | null,
  next: number,
  at: number,
  windowMs: number = RATE_WINDOW_MS
): GainSample[] {
  const kept = samples.filter((s) => at - s.at <= windowMs);
  if (previous === null || !Number.isFinite(next)) return kept;
  const gain = next - previous;
  return gain > 0 ? [...kept, { at, gain }] : kept;
}

/** Gain per second across the window ending at `now`. */
export function incomeRate(
  samples: readonly GainSample[],
  now: number,
  startedAt: number,
  windowMs: number = RATE_WINDOW_MS
): number {
  const total = samples
    .filter((s) => now - s.at <= windowMs)
    .reduce((sum, s) => sum + s.gain, 0);
  if (total <= 0) return 0;
  const span = Math.min(windowMs, Math.max(MIN_SPAN_MS, now - startedAt));
  return total / (span / 1000);
}
