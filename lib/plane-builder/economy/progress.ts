import { LEVELS, LEVEL_ORDER, nextLevelId } from "../levels";
import type { LevelId } from "../levels/types";
import {
  STARTER_TIERS,
  tierPrice,
  type Tiers,
  type TrackId,
} from "../plane/catalog";
import type { FlightResult } from "../sim/flight";

export interface LevelProgress {
  tiers: Tiers;
  coins: number;
  /** Best distance toward the finish, m. */
  best: number;
  finished: boolean;
}

export interface Progress {
  levels: Record<LevelId, LevelProgress>;
  /** In LEVEL_ORDER order; always starts with "meadow". */
  unlocked: LevelId[];
}

export function newLevelProgress(): LevelProgress {
  return { tiers: { ...STARTER_TIERS }, coins: 0, best: 0, finished: false };
}

export function newProgress(): Progress {
  const levels = Object.fromEntries(
    LEVEL_ORDER.map((id) => [id, newLevelProgress()])
  ) as Record<LevelId, LevelProgress>;
  return { levels, unlocked: ["meadow"] };
}

export type BuyResult =
  | { ok: true; progress: Progress; price: number }
  | { ok: false; reason: "locked" | "maxed" | "too-poor" };

function withLevel(p: Progress, id: LevelId, level: LevelProgress): Progress {
  return { ...p, levels: { ...p.levels, [id]: level } };
}

export function buyUpgrade(
  p: Progress,
  id: LevelId,
  track: TrackId
): BuyResult {
  if (!p.unlocked.includes(id)) return { ok: false, reason: "locked" };
  const level = p.levels[id];
  const price = tierPrice(LEVELS[id].plane[track], level.tiers[track]);
  if (price === null) return { ok: false, reason: "maxed" };
  if (level.coins < price) return { ok: false, reason: "too-poor" };
  return {
    ok: true,
    price,
    progress: withLevel(p, id, {
      ...level,
      coins: level.coins - price,
      tiers: { ...level.tiers, [track]: level.tiers[track] + 1 },
    }),
  };
}

export interface RecordedFlight {
  progress: Progress;
  isNewBest: boolean;
  /** The level this flight unlocked, if any. */
  unlocked: LevelId | null;
}

/** Matches the save parser's ceiling. */
const MAX_COINS = 1e9;

export function recordFlight(
  p: Progress,
  id: LevelId,
  result: FlightResult,
  earned: number
): RecordedFlight {
  const level = p.levels[id];
  const pay = Number.isFinite(earned) && earned > 0 ? earned : 0;
  const isNewBest = result.distance > level.best;
  let next = withLevel(p, id, {
    ...level,
    coins: Math.min(MAX_COINS, level.coins + pay),
    best: Math.max(level.best, result.distance),
    finished: level.finished || result.finished,
  });
  let unlocked: LevelId | null = null;
  const after = nextLevelId(id);
  if (result.finished && after && !next.unlocked.includes(after)) {
    unlocked = after;
    next = {
      ...next,
      unlocked: LEVEL_ORDER.filter(
        (l) => next.unlocked.includes(l) || l === after
      ),
    };
  }
  return { progress: next, isNewBest, unlocked };
}

/** Adds `amount` coins to one level's wallet (ignored unless positive). */
export function addCoins(p: Progress, id: LevelId, amount: number): Progress {
  if (!Number.isFinite(amount) || amount <= 0) return p;
  const level = p.levels[id];
  return withLevel(p, id, {
    ...level,
    coins: Math.min(MAX_COINS, level.coins + Math.round(amount)),
  });
}

export function restartLevel(p: Progress, id: LevelId): Progress {
  return withLevel(p, id, newLevelProgress());
}
