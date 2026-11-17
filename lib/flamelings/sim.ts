import type { Pet } from "./types";

/** Awake hours, local time: 6:30 until 21:00. Nothing drains outside them. */
export const WAKE_HOUR = 6.5;
export const SLEEP_HOUR = 21;

export const FUEL_HOURS = 16;
export const JOY_HOURS = 20;
export const JOY_ASH_FACTOR = 1.5;
export const GLOW_DRAIN_HOURS = 28;
export const GLOW_RECOVERY_PER_HOUR = 10;
export const ASH_HOURS = 4;
export const MAX_ASH = 4;
/** An ember that nobody relights goes out for good after this long. */
export const OUT_AFTER_MS = 5 * 24 * 3_600_000;
export const RELIGHT_FEEDS = 3;

const HOUR_MS = 3_600_000;
/** Integration step. Fine enough that thresholds land within minutes. */
const STEP_HOURS = 1 / 12;

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

function localTime(ms: number, hour: number): number {
  const d = new Date(ms);
  const h = Math.floor(hour);
  return new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    h,
    Math.round((hour - h) * 60)
  ).getTime();
}

/** True while the pet is up and about (not asleep for the night). */
export function isAwake(ms: number): boolean {
  const d = new Date(ms);
  const hour = d.getHours() + d.getMinutes() / 60;
  return hour >= WAKE_HOUR && hour < SLEEP_HOUR;
}

/** The awake spans [start, end) that overlap [fromMs, toMs), in order. */
export function awakeSpans(fromMs: number, toMs: number): [number, number][] {
  const spans: [number, number][] = [];
  if (!(toMs > fromMs)) return spans;
  // Walk calendar days using local midnight so DST shifts cannot skip a day.
  let day = new Date(fromMs);
  day = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  let guard = 0;
  while (day.getTime() < toMs && guard++ < 4000) {
    const start = Math.max(fromMs, localTime(day.getTime(), WAKE_HOUR));
    const end = Math.min(toMs, localTime(day.getTime(), SLEEP_HOUR));
    if (end > start) spans.push([start, end]);
    // Calendar arithmetic (not +24 h) so 23 and 25 hour days cannot skip one.
    day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return spans;
}

/** Awake hours between two moments. */
export function awakeHoursBetween(fromMs: number, toMs: number): number {
  return (
    awakeSpans(fromMs, toMs).reduce((s, [a, b]) => s + (b - a), 0) / HOUR_MS
  );
}

/**
 * Plays a pet's needs forward from `fromMs` to `toMs`, counting only awake
 * time. Returns a new pet; ember pets stand still (and go out for good five
 * days after the ember began, which the caller notices via `isOut`).
 */
export function advance(pet: Pet, fromMs: number, toMs: number): Pet {
  const next: Pet = { ...pet, tickedAt: Math.max(pet.tickedAt, toMs) };
  if (pet.state === "ember" || !(toMs > fromMs)) return next;

  let { fuel, joy, glow, ash, ashHours } = pet;
  for (const [start, end] of awakeSpans(fromMs, toMs)) {
    let t = start;
    while (t < end) {
      const hours = Math.min(STEP_HOURS, (end - t) / HOUR_MS);
      fuel = clamp(fuel - (100 / FUEL_HOURS) * hours);
      const joyRate = (100 / JOY_HOURS) * (ash >= 2 ? JOY_ASH_FACTOR : 1);
      joy = clamp(joy - joyRate * hours);
      if (fuel <= 0) {
        glow = clamp(glow - (100 / GLOW_DRAIN_HOURS) * hours);
      } else if (fuel > 30 && joy > 30) {
        glow = clamp(glow + GLOW_RECOVERY_PER_HOUR * hours);
      }
      if (ash < MAX_ASH) {
        ashHours += hours;
        while (ashHours >= ASH_HOURS && ash < MAX_ASH) {
          ashHours -= ASH_HOURS;
          ash += 1;
        }
        if (ash >= MAX_ASH) ashHours = 0;
      }
      t += hours * HOUR_MS;
      if (glow <= 0) {
        return {
          ...next,
          fuel: 0,
          joy,
          glow: 0,
          ash,
          ashHours,
          state: "ember",
          emberAt: Math.min(t, end),
          relightFeeds: 0,
        };
      }
    }
  }
  return { ...next, fuel, joy, glow, ash, ashHours };
}

/** True once an ember has been dark for too long, as of `nowMs`. */
export function isOut(pet: Pet, nowMs: number): boolean {
  return (
    pet.state === "ember" &&
    pet.emberAt !== null &&
    nowMs - pet.emberAt >= OUT_AFTER_MS
  );
}

/** The mood the blob shows, from needs and the time of day. */
export type Mood =
  "happy" | "excited" | "hungry" | "sad" | "asleep" | "ember" | "eating";

export function moodOf(pet: Pet, nowMs: number): Mood {
  if (pet.state === "ember") return "ember";
  if (!isAwake(nowMs)) return "asleep";
  if (pet.fuel < 30) return "hungry";
  if (pet.joy < 30 || pet.glow < 50) return "sad";
  return "happy";
}
