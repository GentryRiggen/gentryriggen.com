/**
 * Income rate: gross gains of one resource per second over a short moving
 * window. Only increases count, so buying something (a drop) never shows up
 * as negative income. The net rate takes continuous costs (lamp oil) off it.
 */
import type { RunState, UniverseDef } from "./types";

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

/** Per second cost of running things, in `resourceId` (0 when none). */
export function upkeepRate(
  def: UniverseDef,
  run: RunState,
  resourceId: string
): number {
  const cost = def.upkeep?.(run)[resourceId] ?? 0;
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
}

/** Gross income minus continuous costs; purchases never count. */
export const netRate = (gross: number, upkeep: number): number =>
  gross - upkeep;

export interface RateReading {
  at: number;
  rate: number;
}

export type RateTrend = "up" | "down" | "flat";

/** How far back the trend looks, and how big a change counts. */
export const TREND_LOOKBACK_MS = 4000;
const TREND_TOLERANCE = 0.03;

/** Keeps readings for a little over the lookback. */
export function recordReading(
  history: readonly RateReading[],
  reading: RateReading
): RateReading[] {
  return [
    ...history.filter((r) => reading.at - r.at <= TREND_LOOKBACK_MS * 2),
    reading,
  ];
}

/**
 * Is the rate rising compared with about `TREND_LOOKBACK_MS` ago? Compares
 * with the newest reading at least that old; "flat" while the history is young.
 */
export function rateTrend(
  history: readonly RateReading[],
  now: number,
  current: number
): RateTrend {
  const older = [...history]
    .reverse()
    .find((r) => now - r.at >= TREND_LOOKBACK_MS);
  if (!older) return "flat";
  const slack = Math.max(0.05, Math.abs(older.rate) * TREND_TOLERANCE);
  if (current > older.rate + slack) return "up";
  if (current < older.rate - slack) return "down";
  return "flat";
}
