import { LEVELS, LEVEL_ORDER, nextLevelId } from "../levels";
import type { LevelId } from "../levels/types";
import {
  STARTER_TIERS,
  tierPrice,
  type Tiers,
  type TrackId,
} from "../plane/catalog";
import type { FlightResult } from "../sim/flight";
import { squareAt } from "../prestige/board";
import {
  TREASURE_COINS,
  emptyBonuses,
  type BonusKind,
  type Bonuses,
} from "../prestige/bonuses";

export interface LevelProgress {
  tiers: Tiers;
  coins: number;
  /** Best distance toward the finish, m. */
  best: number;
  finished: boolean;
}

export interface PrestigeState {
  /** How many times the player has prestiged. */
  level: number;
  /** Position on the Sky Map; (0, 0) is the start. */
  x: number;
  y: number;
  /** Collected squares as "x,y"; each is spent once. */
  visited: string[];
  bonuses: Bonuses;
  /** A prestige's Sky Map move that hasn't been spent yet. */
  movePending: boolean;
}

export interface Progress {
  levels: Record<LevelId, LevelProgress>;
  /** In LEVEL_ORDER order; always starts with "meadow". */
  unlocked: LevelId[];
  prestige: PrestigeState;
  /** Sum of every flight's distance, m. */
  lifetimeDistance: number;
  /** Flights since the last prestige (or since starting). */
  runFlights: number;
  /** Fewest flights in which a run finished all 10 worlds, or null. */
  fastestRun: number | null;
  /** Fastest sim seconds to cross each world's finish. */
  bestTimes: Partial<Record<LevelId, number>>;
  /** Leaderboard name; set by the leaderboard, null until then. */
  nickname: string | null;
}

export function newPrestige(): PrestigeState {
  return {
    level: 0,
    x: 0,
    y: 0,
    visited: [],
    bonuses: emptyBonuses(),
    movePending: false,
  };
}

export function newLevelProgress(): LevelProgress {
  return { tiers: { ...STARTER_TIERS }, coins: 0, best: 0, finished: false };
}

export function newProgress(): Progress {
  const levels = Object.fromEntries(
    LEVEL_ORDER.map((id) => [id, newLevelProgress()])
  ) as Record<LevelId, LevelProgress>;
  return {
    levels,
    unlocked: ["meadow"],
    prestige: newPrestige(),
    lifetimeDistance: 0,
    runFlights: 0,
    fastestRun: null,
    bestTimes: {},
    nickname: null,
  };
}

const isRunFinished = (p: Progress) =>
  LEVEL_ORDER.every((id) => p.levels[id].finished);

/** Prestige is offered once the last world is finished and no move is owed. */
export function canPrestige(p: Progress): boolean {
  return p.levels.islands.finished && !p.prestige.movePending;
}

/**
 * Starts a new run: every world resets (with Treasure Chest coins in each
 * wallet) and one Sky Map move is owed. Position, bonuses and stats stay.
 */
export function prestige(p: Progress): Progress {
  const start = Math.min(
    MAX_COINS,
    TREASURE_COINS * p.prestige.bonuses.treasure
  );
  const levels = Object.fromEntries(
    LEVEL_ORDER.map((id) => [id, { ...newLevelProgress(), coins: start }])
  ) as Record<LevelId, LevelProgress>;
  return {
    ...p,
    levels,
    unlocked: ["meadow"],
    runFlights: 0,
    prestige: { ...p.prestige, level: p.prestige.level + 1, movePending: true },
  };
}

export type MoveResult =
  { ok: true; progress: Progress; collected: BonusKind | null } | { ok: false };

/** Spends the owed move on an adjacent square, collecting it if unvisited. */
export function moveOnMap(p: Progress, dx: number, dy: number): MoveResult {
  if (!p.prestige.movePending) return { ok: false };
  if (!Number.isInteger(dx) || !Number.isInteger(dy)) return { ok: false };
  if (Math.abs(dx) + Math.abs(dy) !== 1) return { ok: false };
  const x = p.prestige.x + dx;
  const y = p.prestige.y + dy;
  const key = `${x},${y}`;
  const isNew = !p.prestige.visited.includes(key);
  const collected = isNew ? squareAt(x, y) : null;
  const bonuses = collected
    ? { ...p.prestige.bonuses, [collected]: p.prestige.bonuses[collected] + 1 }
    : p.prestige.bonuses;
  return {
    ok: true,
    collected,
    progress: {
      ...p,
      prestige: {
        ...p.prestige,
        x,
        y,
        visited: isNew ? [...p.prestige.visited, key] : p.prestige.visited,
        bonuses,
        movePending: false,
      },
    },
  };
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
  const runFlights = p.runFlights + 1;
  const finishTime = result.finishTime;
  const bestTimes =
    finishTime !== null && Number.isFinite(finishTime) && finishTime > 0
      ? {
          ...p.bestTimes,
          [id]: Math.min(p.bestTimes[id] ?? Infinity, finishTime),
        }
      : p.bestTimes;
  const completedRun = !isRunFinished(p) && isRunFinished(next);
  next = {
    ...next,
    runFlights,
    bestTimes,
    lifetimeDistance: p.lifetimeDistance + Math.max(0, result.distance),
    fastestRun: completedRun
      ? Math.min(p.fastestRun ?? Infinity, runFlights)
      : p.fastestRun,
  };
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
