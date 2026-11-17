import { ALL_UNLOCKS, UNLOCK_ORDER, type UnlockKey } from "./catalog";
import type { Pet, StageId } from "./types";

export type { StageId };

export interface Stage {
  id: StageId;
  name: string;
  /** First level of the stage, and the blob scale. */
  from: number;
  scale: number;
}

export const STAGES: readonly Stage[] = [
  { id: "spark", name: "Spark", from: 1, scale: 0.6 },
  { id: "flicker", name: "Flicker", from: 3, scale: 0.7 },
  { id: "flame", name: "Flame", from: 6, scale: 0.8 },
  { id: "blaze", name: "Blaze", from: 10, scale: 0.9 },
  { id: "bonfire", name: "Bonfire", from: 15, scale: 1 },
];

export const MAX_LEVEL = 99;

export function stageFor(level: number): Stage {
  let found = STAGES[0];
  for (const stage of STAGES) if (level >= stage.from) found = stage;
  return found;
}

export function xpToNext(level: number): number {
  return Math.round(40 * Math.pow(level, 1.4));
}

/** The first item in the fixed order that this pet does not have yet. */
export function nextLevelUnlock(
  unlocked: readonly UnlockKey[]
): UnlockKey | null {
  return UNLOCK_ORDER.find((key) => !unlocked.includes(key)) ?? null;
}

export function lockedItems(unlocked: readonly UnlockKey[]): UnlockKey[] {
  return ALL_UNLOCKS.filter((key) => !unlocked.includes(key));
}

export interface LevelGain {
  level: number;
  xp: number;
  /** One entry per level gained, with the item it handed out (or null). */
  gains: { level: number; unlocked: UnlockKey | null }[];
}

/** Adds XP, rolling over as many levels as it pays for. */
export function addXp(
  level: number,
  xp: number,
  amount: number,
  unlocked: readonly UnlockKey[]
): LevelGain {
  let lv = level;
  let have = xp + Math.max(0, amount);
  const owned = [...unlocked];
  const gains: LevelGain["gains"] = [];
  while (lv < MAX_LEVEL && have >= xpToNext(lv)) {
    have -= xpToNext(lv);
    lv += 1;
    const item = nextLevelUnlock(owned);
    if (item) owned.push(item);
    gains.push({ level: lv, unlocked: item });
  }
  if (lv >= MAX_LEVEL) have = 0;
  return { level: lv, xp: have, gains };
}

/** Local calendar day as `yyyy-mm-dd`. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const MORNING_START = 6.5;
export const EVENING_START = 14;
export const GIFT_END = 21;

export type GiftWindowPart = "am" | "pm";

/** The check-in window `ms` falls in, or null overnight. */
export function giftWindowAt(ms: number): string | null {
  const d = new Date(ms);
  const hour = d.getHours() + d.getMinutes() / 60;
  if (hour < MORNING_START || hour >= GIFT_END) return null;
  const part: GiftWindowPart = hour < EVENING_START ? "am" : "pm";
  return `${localDay(ms)}:${part}`;
}

export function hasGiftWaiting(pet: Pet, nowMs: number): boolean {
  if (pet.state === "ember") return false;
  const window = giftWindowAt(nowMs);
  return window !== null && pet.giftWindow !== window;
}

/** The visit window used by analytics. */
export function visitWindow(ms: number): "morning" | "evening" | "night" {
  const window = giftWindowAt(ms);
  if (window === null) return "night";
  return window.endsWith("am") ? "morning" : "evening";
}
