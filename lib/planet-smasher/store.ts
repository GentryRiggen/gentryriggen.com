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
import { isUnlocked, unlocksBetween, type Unlockable } from "./unlocks";

export const COMBO_WINDOW_MS = 1200;
export const COMBO_MIN = 3;
export const COMBO_CAP = 10;
const COMBO_FIRE_IDS_KEPT = 32;

const NO_COMBO = { count: 0, lastAt: 0 };

export type Phase = "playing" | "ending" | "ended";

export interface GameStore {
  progress: Progress;
  planet: PlanetState | null;
  phase: Phase;
  ending: EndingKind | null;
  lastUnlocks: Unlockable[];
  /** Sub-point remainder of earlier hits (not saved). */
  pointsCarry: number;
  /** Points earned on the current planet (shown when it ends). */
  planetPoints: number;
  /** Quick hits in a row; count 0 = none. */
  combo: { count: number; lastAt: number };
  /** Recent fires (effect ids) that moved the combo; a fire counts once ever. */
  comboFireIds: number[];
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
  pointsCarry: 0,
  planetPoints: 0,
  lastHit: null,
  combo: { ...NO_COMBO },
  comboFireIds: [],

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
      pointsCarry: 0,
      planetPoints: 0,
      lastHit: null,
      combo: { ...NO_COMBO },
      comboFireIds: [],
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
      planetPoints: 0,
      lastHit: null,
      combo: { ...NO_COMBO },
      comboFireIds: [],
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
    const sameFire = fireId !== undefined && comboFireIds.includes(fireId);
    if (sameFire) {
      // Report the live count, or none once the window has lapsed.
      if (now - combo.lastAt > COMBO_WINDOW_MS)
        nextCombo = { ...combo, count: 0 };
    } else if (result.peopleLost > 0 || result.healthLost > 0) {
      if (fireId !== undefined)
        nextFireIds = [...comboFireIds, fireId].slice(-COMBO_FIRE_IDS_KEPT);
      const count =
        now - combo.lastAt <= COMBO_WINDOW_MS && combo.count > 0
          ? combo.count + 1
          : 1;
      nextCombo = { count, lastAt: now };
      if (count >= COMBO_MIN) gained += Math.min(count, COMBO_CAP);
    }
    const points = progress.points + gained;
    const nextProgress: Progress = { ...progress, points, endingsSeen };
    if (gained > 0 || endingsSeen.length !== progress.endingsSeen.length) {
      saveProgress(nextProgress);
    }
    const unlocked = unlocksBetween(progress.points, points);
    set((s) => ({
      progress: nextProgress,
      // The state is mutated in place; a new reference wakes subscribers.
      planet: { ...planet },
      pointsCarry: carry,
      combo: sameFire ? combo : nextCombo,
      comboFireIds: nextFireIds,
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
    if (get().phase === "ending") set({ phase: "ended" });
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
      lastHit: null,
      combo: { ...NO_COMBO },
      comboFireIds: [],
    });
  },

  clearUnlocks() {
    set({ lastUnlocks: [] });
  },
}));
