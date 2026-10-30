import { LEVEL_ORDER } from "../levels";
import type { LevelId } from "../levels/types";
import { createRng } from "../levels/rng";
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
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${pad(m)}:${pad(s)}`;
}

/** FNV-1a, so neighbouring dates give unrelated seeds. */
function seedFor(date: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < date.length; i += 1) {
    h = Math.imul(h ^ date.charCodeAt(i), 0x01000193);
  }
  return h >>> 0;
}

/** The same world and twist for everyone on the same UTC day. */
export function dailyFor(date: string): DailyChallenge {
  const random = createRng(seedFor(date));
  random();
  const world = LEVEL_ORDER[Math.floor(random() * LEVEL_ORDER.length)];
  const twist = DAILY_TWISTS[Math.floor(random() * DAILY_TWISTS.length)];
  return { date, world, twist };
}

/** How the twist changes the flight itself. */
export function modsFor(twist: DailyTwist): FlightMods {
  if (twist === "tailwind") return { accel: WIND_ACCEL };
  if (twist === "headwind") return { accel: -WIND_ACCEL };
  if (twist === "noBoost") return { noBoost: true };
  return {};
}

/** Coin earnings are multiplied by this on the day's challenge. */
export function coinMultiplierFor(twist: DailyTwist): number {
  return twist === "doubleCoins" ? 2 : 1;
}
