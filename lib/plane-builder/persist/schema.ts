import {
  newLevelProgress,
  newPrestige,
  type LevelProgress,
  type PrestigeState,
  type Progress,
} from "../economy/progress";
import { LEVELS, LEVEL_ORDER, nextLevelId } from "../levels";
import type { LevelId } from "../levels/types";
import { BONUS_KINDS, emptyBonuses } from "../prestige/bonuses";
import { MAX_TIER, TRACK_IDS, type Tiers } from "../plane/catalog";
import { isDateKey } from "../daily/daily";
import { isGhost } from "../ghost/ghost";

export const SAVE_VERSION = 4;
/**
 * Saves older than this come from before a rebalance (1.2 changed prices and
 * pay), so loadProgress starts them fresh instead of migrating them.
 */
export const RESET_BELOW = 2;

export interface SaveV4 {
  version: typeof SAVE_VERSION;
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

/** Most moves, hence collected squares, a save may hold. */
export const MAX_VISITED = 100_000;
export const MAX_NICKNAME_LENGTH = 40;
const VISITED_KEY = /^-?\d{1,6},-?\d{1,6}$/;

const isWhole = (v: unknown, max = MAX_VISITED): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max;

function parsePrestige(raw: unknown): PrestigeState | null {
  if (!isRecord(raw) || !isRecord(raw.bonuses)) return null;
  const { level, x, y, visited, movePending } = raw;
  if (!isWhole(level)) return null;
  if (!Number.isInteger(x) || Math.abs(x as number) > MAX_VISITED) return null;
  if (!Number.isInteger(y) || Math.abs(y as number) > MAX_VISITED) return null;
  if (typeof movePending !== "boolean") return null;
  if (!Array.isArray(visited) || visited.length > MAX_VISITED) return null;
  if (!visited.every((v) => typeof v === "string" && VISITED_KEY.test(v)))
    return null;
  const bonuses = emptyBonuses();
  for (const kind of BONUS_KINDS) {
    const n = raw.bonuses[kind];
    if (!isWhole(n)) return null;
    bonuses[kind] = n;
  }
  return {
    level,
    x: x as number,
    y: y as number,
    visited: [...new Set(visited as string[])],
    bonuses,
    movePending,
  };
}

function parseBestTimes(raw: unknown): Progress["bestTimes"] | null {
  if (!isRecord(raw)) return null;
  const times: Progress["bestTimes"] = {};
  for (const id of LEVEL_ORDER) {
    const t = raw[id];
    if (t === undefined) continue;
    if (typeof t !== "number" || !Number.isFinite(t) || t <= 0) return null;
    times[id] = t;
  }
  return times;
}

/** A bad ghost is dropped on its own; it never costs the player their save. */
function parseGhosts(raw: unknown): Progress["ghosts"] {
  const ghosts: Progress["ghosts"] = {};
  if (!isRecord(raw)) return ghosts;
  for (const id of LEVEL_ORDER) {
    const ghost = raw[id];
    if (isGhost(ghost)) ghosts[id] = { time: ghost.time, data: ghost.data };
  }
  return ghosts;
}

function parseDailyBest(raw: unknown): Progress["dailyBest"] {
  if (!isRecord(raw)) return null;
  const { date, time, ghost } = raw;
  if (!isDateKey(date) || !isGhost(ghost)) return null;
  if (typeof time !== "number" || !Number.isFinite(time) || time <= 0)
    return null;
  return { date, time, ghost: { time: ghost.time, data: ghost.data } };
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
  const prestige = parsePrestige(raw.prestige);
  const bestTimes = parseBestTimes(raw.bestTimes);
  if (!prestige || !bestTimes) return null;
  if (!isCount(raw.lifetimeDistance) || !isWhole(raw.runFlights, 1e9))
    return null;
  const { fastestRun, nickname } = raw;
  if (fastestRun !== null && !(isWhole(fastestRun, 1e9) && fastestRun >= 1))
    return null;
  if (
    nickname !== null &&
    !(typeof nickname === "string" && nickname.length <= MAX_NICKNAME_LENGTH)
  )
    return null;
  return {
    levels,
    unlocked,
    prestige,
    lifetimeDistance: raw.lifetimeDistance,
    runFlights: raw.runFlights,
    fastestRun: fastestRun as number | null,
    bestTimes,
    nickname: nickname as string | null,
    ghosts: parseGhosts(raw.ghosts),
    dailyBest: parseDailyBest(raw.dailyBest),
  };
}

/** Future versions add `migrations[n]` turning version n into n + 1. */
const migrations: Record<
  number,
  (raw: Record<string, unknown>) => Record<string, unknown>
> = {
  // v3 adds prestige and the run and lifetime stats.
  2: (raw) => {
    const { progress } = raw;
    if (!isRecord(progress)) return { ...raw, version: 3 };
    return {
      ...raw,
      version: 3,
      progress: {
        ...progress,
        prestige: newPrestige(),
        lifetimeDistance: 0,
        runFlights: 0,
        fastestRun: null,
        bestTimes: {},
        nickname: null,
      },
    };
  },
  // v4 adds ghost flights and the daily challenge's best.
  3: (raw) => {
    const { progress } = raw;
    if (!isRecord(progress)) return { ...raw, version: 4 };
    return {
      ...raw,
      version: 4,
      progress: { ...progress, ghosts: {}, dailyBest: null },
    };
  },
};

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
