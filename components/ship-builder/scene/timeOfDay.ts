export const TIMES_OF_DAY = ["day", "sunset", "night"] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const DEFAULT_TIME_OF_DAY: TimeOfDay = "day";

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return TIMES_OF_DAY.includes(value as TimeOfDay);
}

/**
 * How strongly lit things glow: off by day, half at sunset, full at night.
 * Windows, lamps and light parts scale their emissive intensity by this.
 */
const GLOW: Record<TimeOfDay, number> = { day: 0, sunset: 0.6, night: 1 };

export function glowFor(time: TimeOfDay): number {
  return GLOW[time];
}
