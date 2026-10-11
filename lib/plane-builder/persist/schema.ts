import {
  newLevelProgress,
  type LevelProgress,
  type Progress,
} from "../economy/progress";
import { LEVEL_ORDER } from "../levels";
import type { LevelId } from "../levels/types";
import { MAX_TIER, TRACK_IDS, type Tiers } from "../plane/catalog";

export const SAVE_VERSION = 1;

export interface SaveV1 {
  version: 1;
  progress: Progress;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

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

function parseLevel(raw: unknown): LevelProgress | null {
  if (!isRecord(raw)) return null;
  const tiers = parseTiers(raw.tiers);
  if (!tiers || !isCount(raw.coins) || !isCount(raw.best)) return null;
  if (typeof raw.finished !== "boolean") return null;
  return {
    tiers,
    coins: Math.floor(raw.coins),
    best: raw.best,
    finished: raw.finished,
  };
}

function parseProgress(raw: unknown): Progress | null {
  if (!isRecord(raw) || !isRecord(raw.levels) || !Array.isArray(raw.unlocked))
    return null;
  const levels = {} as Record<LevelId, LevelProgress>;
  for (const id of LEVEL_ORDER) {
    if (raw.levels[id] === undefined) {
      levels[id] = newLevelProgress();
      continue;
    }
    const level = parseLevel(raw.levels[id]);
    if (!level) return null;
    levels[id] = level;
  }
  const known = new Set<string>(LEVEL_ORDER);
  if (!raw.unlocked.every((u) => typeof u === "string" && known.has(u)))
    return null;
  const unlocked = LEVEL_ORDER.filter(
    (id) => id === "meadow" || (raw.unlocked as string[]).includes(id)
  );
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
