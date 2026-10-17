import {
  newLevelProgress,
  type LevelProgress,
  type Progress,
} from "../economy/progress";
import { LEVELS, LEVEL_ORDER, nextLevelId } from "../levels";
import type { LevelId } from "../levels/types";
import { MAX_TIER, TRACK_IDS, type Tiers } from "../plane/catalog";

export const SAVE_VERSION = 2;
/**
 * Saves older than this come from before a rebalance (1.2 changed prices and
 * pay), so loadProgress starts them fresh instead of migrating them.
 */
export const RESET_BELOW = 2;

export interface SaveV2 {
  version: 2;
  progress: Progress;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Sanity ceiling so a hand-edited save can't overflow displays or math. */
export const MAX_COINS = 1e9;

const isCount = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0;

function parseTiers(raw: unknown): Tiers | null {
  if (!isRecord(raw)) return null;
  const tiers = {} as Tiers;
  for (const id of TRACK_IDS) {
    const t = raw[id];
    if (!Number.isInteger(t) || (t as number) < 0 || (t as number) > MAX_TIER)
      return null;
    tiers[id] = t as number;
  }
  return tiers;
}

function parseLevel(raw: unknown, id: LevelId): LevelProgress | null {
  if (!isRecord(raw)) return null;
  const tiers = parseTiers(raw.tiers);
  if (!tiers || !isCount(raw.coins) || !isCount(raw.best)) return null;
  if (typeof raw.finished !== "boolean") return null;
  return {
    tiers,
    coins: Math.min(MAX_COINS, Math.floor(raw.coins)),
    best: Math.min(raw.best, LEVELS[id].finishDistance),
    finished: raw.finished,
  };
}

function parseProgress(raw: unknown): Progress | null {
  if (!isRecord(raw) || !isRecord(raw.levels)) return null;
  const rawUnlocked = raw.unlocked ?? ["meadow"];
  if (!Array.isArray(rawUnlocked)) return null;
  const levels = {} as Record<LevelId, LevelProgress>;
  for (const id of LEVEL_ORDER) {
    if (raw.levels[id] === undefined) {
      levels[id] = newLevelProgress();
      continue;
    }
    const level = parseLevel(raw.levels[id], id);
    if (!level) return null;
    levels[id] = level;
  }
  // Unknown ids (say, from a newer build) are dropped; junk types are not.
  if (!rawUnlocked.every((u) => typeof u === "string")) return null;
  const open = new Set<string>(rawUnlocked);
  // A finished level always opens the next one.
  for (const id of LEVEL_ORDER) {
    const after = nextLevelId(id);
    if (levels[id].finished && after) open.add(after);
  }
  const unlocked = LEVEL_ORDER.filter((id) => id === "meadow" || open.has(id));
  return { levels, unlocked };
}

/** Future versions add `migrations[n]` turning version n into n + 1. */
const migrations: Record<
  number,
  (raw: Record<string, unknown>) => Record<string, unknown>
> = {};

/** A checked Progress, or null if `raw` isn't a save this build can read. */
export function parseSave(raw: unknown): Progress | null {
  if (!isRecord(raw) || !Number.isInteger(raw.version)) return null;
  let save = raw;
  for (let v = save.version as number; v < SAVE_VERSION; v += 1) {
    const migrate = migrations[v];
    if (!migrate) return null;
    save = migrate(save);
  }
  if (save.version !== SAVE_VERSION) return null;
  return parseProgress(save.progress);
}
