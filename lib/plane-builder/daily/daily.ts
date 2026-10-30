import type { LevelId } from "../levels/types";
import type { FlightMods } from "../sim/flight";

/** The little rule change that makes one day's flight different. */
export type DailyTwist = "tailwind" | "headwind" | "doubleCoins" | "noBoost";

export const DAILY_TWISTS: readonly DailyTwist[] = [
  "tailwind",
  "headwind",
  "doubleCoins",
  "noBoost",
];

/** Extra push of a tailwind (and the pull of a headwind), m/s². */
export const WIND_ACCEL = 5;

export interface DailyChallenge {
  /** The UTC day, `yyyy-mm-dd`. */
  date: string;
  world: LevelId;
  twist: DailyTwist;
}

export interface TwistInfo {
  name: string;
  emoji: string;
  /** One line a young player can read. */
  blurb: string;
}

export const TWIST_INFO: Record<DailyTwist, TwistInfo> = {
  tailwind: {
    name: "Tailwind",
    emoji: "💨",
    blurb: "A friendly wind pushes you along.",
  },
  headwind: {
    name: "Headwind",
    emoji: "🌬️",
    blurb: "A wind blows against you. Fly smart!",
  },
  doubleCoins: {
    name: "Double coins",
    emoji: "🪙",
    blurb: "Every coin you earn counts twice.",
  },
  noBoost: {
    name: "No boost",
    emoji: "🚫",
    blurb: "The boost button is switched off today.",
  },
};

const DAY_MS = 86_400_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => String(n).padStart(2, "0");

/** The UTC day of `now` (ms since the epoch) as `yyyy-mm-dd`. */
export function utcDateKey(now: number): string {
  const d = new Date(now);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && DATE_KEY.test(value);
}

/** Milliseconds from `now` to the next UTC midnight (always 1..86 400 000). */
export function msUntilNextUtcDay(now: number): number {
  return DAY_MS - (((now % DAY_MS) + DAY_MS) % DAY_MS);
}

/** "3:05:09" style clock for a countdown. */
export function formatCountdown(ms: number): string {
  // Never 24:00:00: the clock reads 23:59:59 for the whole first second.
  const total = Math.min(86_399, Math.max(0, Math.ceil(ms / 1000)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

/**
 * The daily plan: every world with every twist once, in a fixed shuffled
 * order of 40. The day number picks the entry, so the plan repeats every
 * 40 days. firestore.rules holds the same list (a test keeps them equal) and
 * checks a daily entry's world against it, so a pilot cannot claim an easier
 * world than the day's.
 */
export const DAILY_PLAN: readonly string[] = [
  "volcano:noBoost",
  "glacier:tailwind",
  "islands:tailwind",
  "glacier:headwind",
  "beach:noBoost",
  "storm:noBoost",
  "volcano:doubleCoins",
  "city:noBoost",
  "islands:headwind",
  "jungle:tailwind",
  "mountains:headwind",
  "jungle:noBoost",
  "islands:noBoost",
  "storm:doubleCoins",
  "beach:headwind",
  "mountains:tailwind",
  "jungle:doubleCoins",
  "storm:headwind",
  "canyon:doubleCoins",
  "meadow:tailwind",
  "volcano:tailwind",
  "islands:doubleCoins",
  "canyon:noBoost",
  "city:doubleCoins",
  "glacier:noBoost",
  "beach:doubleCoins",
  "meadow:doubleCoins",
  "canyon:tailwind",
  "beach:tailwind",
  "canyon:headwind",
  "mountains:doubleCoins",
  "city:headwind",
  "glacier:doubleCoins",
  "jungle:headwind",
  "city:tailwind",
  "mountains:noBoost",
  "meadow:noBoost",
  "volcano:headwind",
  "storm:tailwind",
  "meadow:headwind",
];

/** Whole days since 1970-01-01 (UTC) of a `yyyy-mm-dd` date. */
export function dayNumberOf(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / DAY_MS);
}

/** The same world and twist for everyone on the same UTC day. */
export function dailyFor(date: string): DailyChallenge {
  const entry = DAILY_PLAN[dayNumberOf(date) % DAILY_PLAN.length];
  const [world, twist] = entry.split(":");
  return { date, world: world as LevelId, twist: twist as DailyTwist };
}

/** How the twist changes the flight itself. */
export function modsFor(twist: DailyTwist | null): FlightMods {
  if (twist === "tailwind") return { accel: WIND_ACCEL };
  if (twist === "headwind") return { accel: -WIND_ACCEL };
  if (twist === "noBoost") return { noBoost: true };
  return {};
}

/** Coin earnings are multiplied by this on the day's challenge. */
export function coinMultiplierFor(twist: DailyTwist): number {
  return twist === "doubleCoins" ? 2 : 1;
}
