import type { Tiers } from "../plane/catalog";

/**
 * The timing gauge both mini-games share: a marker sweeps back and forth
 * along a bar, and where it stops picks a zone. Green is the middle, yellow
 * either side of it, red the two ends.
 */
export type GaugeZone = "green" | "yellow" | "red";

/** Seconds for the marker to go end to end and back. */
export const GAUGE_PERIOD = 1.28;
/** Half-widths of the zones around the middle, as shares of the bar. */
export const GREEN_HALF = 0.06;
export const YELLOW_HALF = 0.25;

/** Launch speed multiplier for where the launch gauge stopped. */
export const LAUNCH_ZONE_BOOST: Record<GaugeZone, number> = {
  green: 1.25,
  yellow: 1,
  red: 0.8,
};

/** Coin multiplier for where the after-flight gauge stopped. Never below 1. */
export const COIN_ZONE_MULTIPLIER: Record<GaugeZone, number> = {
  green: 2,
  yellow: 1.5,
  red: 1,
};

/** Launcher tier from which the slingshot has the timing gauge. */
export const LAUNCH_GAUGE_TIER = 3;

export function hasLaunchGauge(tiers: Tiers): boolean {
  return tiers.launcher >= LAUNCH_GAUGE_TIER;
}

/** Marker position, 0 (left end) to 1 (right end), `seconds` into a sweep. */
export function gaugePosition(seconds: number, period = GAUGE_PERIOD): number {
  if (!Number.isFinite(seconds) || period <= 0) return 0;
  const phase = (((seconds / period) % 1) + 1) % 1;
  return phase < 0.5 ? phase * 2 : 2 - phase * 2;
}

export function gaugeZone(position: number): GaugeZone {
  const off = Math.abs(position - 0.5);
  if (off <= GREEN_HALF) return "green";
  if (off <= YELLOW_HALF) return "yellow";
  return "red";
}
