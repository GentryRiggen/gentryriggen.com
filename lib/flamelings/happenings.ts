import { localDay } from "./progress";
import type { Pet } from "./types";

/**
 * Happenings: a small surprise that visits a pet in most check-in windows (a
 * visitor, a rain shower, buried treasure, a shooting star, a mushroom dance,
 * a season's treat, a Hatch Day party). Everything here is pure: what happens
 * is decided by a seeded pick (pet id + window), so a reload never rerolls.
 */

export const HAPPENING_KINDS = [
  "visitor",
  "rain",
  "treasure",
  "star",
  "mushrooms",
  "hatchday",
  "season",
] as const;
export type HappeningKind = (typeof HAPPENING_KINDS)[number];

export const VISITORS = [
  "owl",
  "snail",
  "frog",
  "butterfly",
  "hedgehog",
] as const;
export type VisitorId = (typeof VISITORS)[number];

export const SEASONS = ["winter", "autumn", "halloween", "spring"] as const;
export type SeasonId = (typeof SEASONS)[number];

export const HATCH_DAYS = ["monthly", "yearly"] as const;
export type HatchDayKind = (typeof HATCH_DAYS)[number];

/** The mushroom dance has 3 to 5 steps (the variant is the count). */
export const MUSHROOM_STEPS = ["3", "4", "5"] as const;
export const MUSHROOM_RING = 5;

export interface Happening {
  /** The check-in window it was picked for, e.g. `2026-11-17:am`. */
  window: string;
  kind: HappeningKind;
  /** Which visitor, season, Hatch Day or step count; "" when it has none. */
  variant: string;
  done: boolean;
  /** The icon intro has been shown (and the "started" stat sent). */
  seen: boolean;
}

/** About three visits in four have something happen. */
export const HAPPENING_CHANCE = 0.75;

const WEIGHTS = {
  visitor: 30,
  rain: 15,
  treasure: 20,
  mushrooms: 15,
  season: 20,
} as const;

const DAY_MS = 86_400_000;
const MORNING_START = 6.5;
const EVENING_START = 14;
const NIGHT_START = 21;

/** The variants each kind may carry (anything else in a save is defaulted). */
export function variantsOf(kind: HappeningKind): readonly string[] {
  switch (kind) {
    case "visitor":
      return VISITORS;
    case "mushrooms":
      return MUSHROOM_STEPS;
    case "season":
      return SEASONS;
    case "hatchday":
      return HATCH_DAYS;
    default:
      return [""];
  }
}

export function isHappeningKind(v: unknown): v is HappeningKind {
  return (
    typeof v === "string" && (HAPPENING_KINDS as readonly string[]).includes(v)
  );
}

/**
 * The window `ms` falls in: morning 6:30 to 14:00, evening 14:00 to 21:00 and
 * the night, which belongs to the date it started on (so 2 am counts as the
 * night before).
 */
export function happeningWindowAt(ms: number): string {
  const d = new Date(ms);
  const hour = d.getHours() + d.getMinutes() / 60;
  if (hour >= NIGHT_START) return `${localDay(ms)}:night`;
  if (hour < MORNING_START) {
    const before = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1, 12);
    return `${localDay(before.getTime())}:night`;
  }
  return `${localDay(ms)}:${hour < EVENING_START ? "am" : "pm"}`;
}

export const isNightWindow = (window: string): boolean =>
  window.endsWith(":night");

/** Which real-world season's treat is on, from the calendar date. */
export function seasonAt(ms: number): SeasonId | null {
  const d = new Date(ms);
  const month = d.getMonth();
  if (month === 11 || month === 0 || month === 1) return "winter";
  if (month >= 2 && month <= 4) return "spring";
  if (month === 9) return d.getDate() >= 20 ? "halloween" : "autumn";
  if (month === 10) return "autumn";
  return null;
}

/** Whole calendar days from `from` to `to`, by local date (DST-proof). */
function calendarDays(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  const start = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const end = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((end - start) / DAY_MS);
}

/** Today is the pet's yearly Hatch Day, or every 30th day it has been alive. */
export function hatchDayAt(bornAt: number, ms: number): HatchDayKind | null {
  const born = new Date(bornAt);
  const day = new Date(ms);
  if (
    day.getFullYear() > born.getFullYear() &&
    day.getMonth() === born.getMonth() &&
    day.getDate() === born.getDate()
  ) {
    return "yearly";
  }
  const days = calendarDays(bornAt, ms);
  return days > 0 && days % 30 === 0 ? "monthly" : null;
}

/** A 32-bit hash of a string (FNV-1a). */
function hashOf(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** A small seeded random generator (mulberry32): the same seed, the same run. */
export function seededRandom(seed: string): () => number {
  let a = hashOf(seed);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * What happens in the window `ms` falls in, or null for a quiet one. Nights
 * only ever bring a shooting star; a Hatch Day always brings its party.
 */
export function pickHappening(
  petId: string,
  bornAt: number,
  ms: number,
  options: { skipHatchDay?: boolean } = {}
): Happening | null {
  const window = happeningWindowAt(ms);
  const base = { window, done: false, seen: false };
  const rand = seededRandom(`${petId}|${window}`);
  if (isNightWindow(window)) {
    return rand() < HAPPENING_CHANCE
      ? { ...base, kind: "star", variant: "" }
      : null;
  }
  const hatchDay = options.skipHatchDay ? null : hatchDayAt(bornAt, ms);
  if (hatchDay) return { ...base, kind: "hatchday", variant: hatchDay };
  if (rand() >= HAPPENING_CHANCE) return null;
  const season = seasonAt(ms);
  const choices: [HappeningKind, number][] = [
    ["visitor", WEIGHTS.visitor],
    ["rain", WEIGHTS.rain],
    ["treasure", WEIGHTS.treasure],
    ["mushrooms", WEIGHTS.mushrooms],
    ["season", season ? WEIGHTS.season : 0],
  ];
  const total = choices.reduce((sum, [, w]) => sum + w, 0);
  let roll = rand() * total;
  let kind: HappeningKind = "visitor";
  for (const [k, w] of choices) {
    if (roll < w) {
      kind = k;
      break;
    }
    roll -= w;
  }
  const variantRoll = rand();
  const variant =
    kind === "visitor"
      ? VISITORS[Math.floor(variantRoll * VISITORS.length)]
      : kind === "mushrooms"
        ? MUSHROOM_STEPS[Math.floor(variantRoll * MUSHROOM_STEPS.length)]
        : kind === "season"
          ? (season ?? "autumn")
          : "";
  return { ...base, kind, variant };
}

/**
 * Makes sure the pet has this window's pick stored: a stored one for the
 * current window is kept as it is (that is what stops a reload rerolling),
 * and an undone Hatch Day party stays for the rest of its day. Embers get
 * nothing.
 */
export function ensureHappening(pet: Pet, ms: number): Pet {
  if (pet.state !== "alive") return pet;
  const window = happeningWindowAt(ms);
  const current = pet.happening;
  if (current && current.window === window) return pet;
  const partyToday =
    current?.kind === "hatchday" &&
    current.window.slice(0, 10) === localDay(ms);
  if (partyToday && !current.done && !isNightWindow(window)) return pet;
  const next = pickHappening(pet.id, pet.bornAt, ms, {
    skipHatchDay: partyToday,
  });
  if (!current && !next) return pet;
  return { ...pet, happening: next };
}

/** The happening the pet can do right now (none for an ember or when done). */
export function activeHappening(pet: Pet, ms: number): Happening | null {
  const h = pet.happening;
  if (!h || h.done || pet.state !== "alive") return null;
  const window = happeningWindowAt(ms);
  if (h.window === window) return h;
  const carried =
    h.kind === "hatchday" &&
    h.window.slice(0, 10) === localDay(ms) &&
    !isNightWindow(window);
  return carried ? h : null;
}

/** Sparks from a star wish are waiting once the pet is up. */
export function wishWaiting(pet: Pet, awake: boolean): boolean {
  return pet.state === "alive" && awake && pet.wish > 0;
}

/** True when the "!" should show: a happening to do, or a wish to collect. */
export function hasHappeningWaiting(
  pet: Pet,
  ms: number,
  awake: boolean
): boolean {
  return activeHappening(pet, ms) !== null || wishWaiting(pet, awake);
}

/**
 * The order the mushrooms glow, `steps` long over a ring of `ring`, with no
 * mushroom twice in a row (an easy thing for a six-year-old to follow).
 */
export function mushroomSequence(
  seed: string,
  steps: number,
  ring: number = MUSHROOM_RING
): number[] {
  const rand = seededRandom(`mush|${seed}`);
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    let next = Math.floor(rand() * ring);
    if (i > 0 && next === out[i - 1]) next = (next + 1) % ring;
    out.push(next);
  }
  return out;
}

/** A forced happening for tests and the e2e hook. */
export function forcedHappening(
  kind: HappeningKind,
  ms: number,
  variant?: string
): Happening {
  const allowed = variantsOf(kind);
  const chosen =
    variant && allowed.includes(variant)
      ? variant
      : kind === "season"
        ? (seasonAt(ms) ?? "autumn")
        : allowed[0];
  return {
    window: happeningWindowAt(ms),
    kind,
    variant: chosen,
    done: false,
    seen: false,
  };
}
