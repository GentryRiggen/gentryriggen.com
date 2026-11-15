import { create } from "zustand";
import type { HitResult, PlanetState } from "./damage";
import { applyHit, createPlanetState } from "./damage";
import type { PlanetId } from "./planets";
import type { PopulationGrid } from "./population";
import {
  FIRST_ENDING_BONUS,
  loadProgress,
  saveProgress,
  type Progress,
} from "./progress";
import type { EndingKind, ToolId } from "./tools";
import {
  newlyEarned,
  TROPHY_REWARD,
  type PlanetRun,
  type TrophyId,
} from "./trophies";
import { isUnlocked, unlocksBetween, type Unlockable } from "./unlocks";

export const COMBO_WINDOW_MS = 1200;
export const COMBO_MIN = 3;
export const COMBO_CAP = 10;
/** The most combo bonus one planet can pay, however many shots it takes. */
export const COMBO_PLANET_CAP = 300;
const COMBO_FIRE_IDS_KEPT = 32;

const NO_COMBO = { count: 0, lastAt: 0 };

const freshRun = (): PlanetRun => ({
  toolsUsed: [],
  startedAt: typeof performance === "undefined" ? 0 : performance.now(),
});

export interface DebrisIntent {
  count: number;
  seed: number;
  /** Frozen endings leave icy rocks. */
  icy: boolean;
}

const DEBRIS_ENDINGS: readonly EndingKind[] = ["shatter", "frozen", "collided"];
const DEBRIS_COUNT = 60;

export type Phase = "playing" | "ending" | "ended";

export interface GameStore {
  progress: Progress;
  planet: PlanetState | null;
  phase: Phase;
  ending: EndingKind | null;
  lastUnlocks: Unlockable[];
  /** Trophies earned and not yet shown (the UI clears them). */
  lastTrophies: TrophyId[];
  /**
   * The ring of rocks left after a shatter, frozen or collided ending. It
   * shows on the next planet; any other ending clears it.
   */
  debris: DebrisIntent | null;
  /** Tools used and start time of the current planet. */
  planetRun: PlanetRun;
  /** Recent fires (effect ids) already counted in the shot stats. */
  shotFireIds: number[];
  /** Sub-point remainder of earlier hits (not saved). */
  pointsCarry: number;
  /** Points earned on the current planet (shown when it ends). */
  planetPoints: number;
  /** Quick hits in a row; count 0 = none. */
  combo: { count: number; lastAt: number };
  /** Recent fires (effect ids) that moved the combo; a fire counts once ever. */
  comboFireIds: number[];
  /** Combo bonus paid on the current planet (at most COMBO_PLANET_CAP). */
  comboBonus: number;
  lastHit: {
    peopleLost: number;
    u: number;
    v: number;
    seq: number;
    /** The combo count after this hit. */
    combo: number;
  } | null;
  /** Loads progress and creates the planet. */
  init(grid: PopulationGrid): void;
  /** Only if unlocked. */
  selectTool(id: ToolId): void;
  /** Only if unlocked; starts a fresh planet. */
  selectPlanet(id: PlanetId, grid: PopulationGrid): void;
  /** applyHit + points + unlocks + save. `now` is ms (defaults to performance.now()). */
  hit(
    toolId: ToolId,
    u: number,
    v: number,
    now?: number,
    fireId?: number
  ): HitResult;
  /** "ending" becomes "ended". */
  endingShown(): void;
  /** Fresh state for the current planet, phase "playing". */
  newPlanet(grid: PopulationGrid): void;
  clearUnlocks(): void;
  clearTrophies(): void;
}

const ZERO: HitResult = {
  peopleLost: 0,
  healthLost: 0,
  points: 0,
  rawPoints: 0,
  ending: null,
};

export const useGameStore = create<GameStore>((set, get) => ({
  progress: loadProgress(null),
  planet: null,
  phase: "playing",
  ending: null,
  lastUnlocks: [],
  lastTrophies: [],
  debris: null,
  planetRun: freshRun(),
  shotFireIds: [],
  pointsCarry: 0,
  planetPoints: 0,
  lastHit: null,
  combo: { ...NO_COMBO },
  comboFireIds: [],
  comboBonus: 0,

  init(grid) {
    const loaded = loadProgress();
    // A saved selection can never be ahead of the points.
    const progress: Progress = {
      ...loaded,
      toolId: isUnlocked({ kind: "tool", id: loaded.toolId }, loaded.points)
        ? loaded.toolId
        : "asteroid",
      planetId: isUnlocked(
        { kind: "planet", id: loaded.planetId },
        loaded.points
      )
        ? loaded.planetId
        : "earth",
    };
    set({
      progress,
      planet: createPlanetState(progress.planetId, grid),
      phase: "playing",
      ending: null,
      lastUnlocks: [],
      lastTrophies: [],
      debris: null,
      planetRun: freshRun(),
      shotFireIds: [],
      pointsCarry: 0,
      planetPoints: 0,
      lastHit: null,
      combo: { ...NO_COMBO },
      comboFireIds: [],
      comboBonus: 0,
    });
  },

  selectTool(id) {
    const { progress } = get();
    if (!isUnlocked({ kind: "tool", id }, progress.points)) return;
    const next = { ...progress, toolId: id };
    saveProgress(next);
    set({ progress: next });
  },

  selectPlanet(id, grid) {
    const { progress } = get();
    if (!isUnlocked({ kind: "planet", id }, progress.points)) return;
    const next = { ...progress, planetId: id };
    saveProgress(next);
    set({
      progress: next,
      planet: createPlanetState(id, grid),
      phase: "playing",
      ending: null,
      debris: null,
      planetPoints: 0,
      planetRun: freshRun(),
      lastHit: null,
      combo: { ...NO_COMBO },
      comboFireIds: [],
      comboBonus: 0,
    });
  },

  hit(toolId, u, v, now = performance.now(), fireId) {
    const {
      planet,
      phase,
      progress,
      lastHit,
      pointsCarry,
      combo,
      comboFireIds,
      comboBonus,
      planetRun,
      shotFireIds,
    } = get();
    if (!planet || phase !== "playing") return { ...ZERO };
    const result = applyHit(planet, toolId, u, v);
    // Whole points go to the score; the fraction waits for the next hit.
    const total = pointsCarry + result.rawPoints;
    let gained = Math.floor(total + 1e-9);
    const carry = Math.max(0, total - gained);
    const endingsSeen = [...progress.endingsSeen];
    if (result.ending && !endingsSeen.includes(result.ending)) {
      endingsSeen.push(result.ending);
      gained += FIRST_ENDING_BONUS;
    }
    // Quick shots in a row pay a growing bonus. A shot (one fire id) moves the
    // combo once, however many damage ticks or warheads it lands.
    let nextCombo = combo;
    let nextFireIds = comboFireIds;
    let nextBonus = comboBonus;
    const sameFire = fireId !== undefined && comboFireIds.includes(fireId);
    if (sameFire) {
      // Report the live count, or none once the window has lapsed.
      if (now - combo.lastAt > COMBO_WINDOW_MS)
        nextCombo = { ...combo, count: 0 };
    } else if (result.peopleLost > 0) {
      if (fireId !== undefined)
        nextFireIds = [...comboFireIds, fireId].slice(-COMBO_FIRE_IDS_KEPT);
      const count =
        now - combo.lastAt <= COMBO_WINDOW_MS && combo.count > 0
          ? combo.count + 1
          : 1;
      nextCombo = { count, lastAt: now };
      if (count >= COMBO_MIN) {
        const bonus = Math.min(
          Math.min(count, COMBO_CAP),
          COMBO_PLANET_CAP - comboBonus
        );
        gained += bonus;
        nextBonus += bonus;
      }
    }
    // Lifetime stats. A shot (one fire id) counts once, like the combo.
    const stats = {
      ...progress.stats,
      shots: { ...progress.stats.shots },
      endedBy: { ...progress.stats.endedBy },
      endedByPlanet: { ...progress.stats.endedByPlanet },
    };
    let nextShotIds = shotFireIds;
    if (fireId === undefined || !shotFireIds.includes(fireId)) {
      stats.shots[toolId] = (stats.shots[toolId] ?? 0) + 1;
      if (fireId !== undefined)
        nextShotIds = [...shotFireIds, fireId].slice(-COMBO_FIRE_IDS_KEPT);
    }
    stats.peopleLost += result.peopleLost;
    if (!sameFire) stats.bestCombo = Math.max(stats.bestCombo, nextCombo.count);
    const run: PlanetRun = planetRun.toolsUsed.includes(toolId)
      ? planetRun
      : { ...planetRun, toolsUsed: [...planetRun.toolsUsed, toolId] };
    const endedNow = result.ending
      ? { ending: result.ending, planetId: progress.planetId, at: now }
      : null;
    if (endedNow) {
      stats.planetsEnded += 1;
      stats.endedByPlanet[endedNow.planetId] =
        (stats.endedByPlanet[endedNow.planetId] ?? 0) + 1;
      stats.endedBy[endedNow.ending] =
        (stats.endedBy[endedNow.ending] ?? 0) + 1;
      const took = Math.max(0, now - run.startedAt);
      stats.fastestEndMs =
        stats.fastestEndMs === null ? took : Math.min(stats.fastestEndMs, took);
    }
    // Trophies pay once each; their points can complete a star trophy.
    let nextProgress: Progress = { ...progress, endingsSeen, stats };
    nextProgress.points = progress.points + gained;
    const earned: TrophyId[] = [];
    for (;;) {
      const fresh = newlyEarned(nextProgress, run, endedNow);
      if (!fresh.length) break;
      earned.push(...fresh);
      gained += fresh.length * TROPHY_REWARD;
      nextProgress = {
        ...nextProgress,
        points: nextProgress.points + fresh.length * TROPHY_REWARD,
        trophies: [...nextProgress.trophies, ...fresh],
      };
    }
    const points = nextProgress.points;
    saveProgress(nextProgress);
    const unlocked = unlocksBetween(progress.points, points);
    set((s) => ({
      progress: nextProgress,
      planetRun: run,
      shotFireIds: nextShotIds,
      lastTrophies: earned.length
        ? [...s.lastTrophies, ...earned]
        : s.lastTrophies,
      // The state is mutated in place; a new reference wakes subscribers.
      planet: { ...planet },
      pointsCarry: carry,
      combo: sameFire ? combo : nextCombo,
      comboFireIds: nextFireIds,
      comboBonus: nextBonus,
      planetPoints: s.planetPoints + gained,
      phase: result.ending ? "ending" : s.phase,
      ending: result.ending ?? s.ending,
      lastUnlocks: unlocked.length
        ? [...s.lastUnlocks, ...unlocked]
        : s.lastUnlocks,
      lastHit:
        result.peopleLost > 0
          ? {
              peopleLost: result.peopleLost,
              u,
              v,
              seq: (lastHit?.seq ?? 0) + 1,
              combo: nextCombo.count,
            }
          : s.lastHit,
    }));
    return result;
  },

  endingShown() {
    const { phase, ending } = get();
    if (phase !== "ending") return;
    set({
      phase: "ended",
      debris:
        ending && DEBRIS_ENDINGS.includes(ending)
          ? {
              count: DEBRIS_COUNT,
              seed: Math.floor(Math.random() * 1e9),
              icy: ending === "frozen",
            }
          : null,
    });
  },

  newPlanet(grid) {
    // Only after an ending: a stray or double call mid-game changes nothing.
    if (get().phase !== "ended") return;
    const { progress } = get();
    set({
      planet: createPlanetState(progress.planetId, grid),
      phase: "playing",
      ending: null,
      planetPoints: 0,
      planetRun: freshRun(),
      lastHit: null,
      combo: { ...NO_COMBO },
      comboFireIds: [],
      comboBonus: 0,
    });
  },

  clearUnlocks() {
    set({ lastUnlocks: [] });
  },

  clearTrophies() {
    set({ lastTrophies: [] });
  },
}));
