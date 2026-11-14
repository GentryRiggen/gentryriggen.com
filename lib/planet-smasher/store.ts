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

export type Phase = "playing" | "ending" | "ended";

export interface GameStore {
  progress: Progress;
  planet: PlanetState | null;
  phase: Phase;
  ending: EndingKind | null;
  lastUnlocks: Unlockable[];
  /** Sub-point remainder of earlier hits (not saved). */
  pointsCarry: number;
  lastHit: { peopleLost: number; u: number; v: number; seq: number } | null;
  /** Loads progress and creates the planet. */
  init(grid: PopulationGrid): void;
  /** Only if unlocked. */
  selectTool(id: ToolId): void;
  /** Only if unlocked; starts a fresh planet. */
  selectPlanet(id: PlanetId, grid: PopulationGrid): void;
  /** applyHit + points + unlocks + save. */
  hit(toolId: ToolId, u: number, v: number): HitResult;
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
  lastHit: null,

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
      lastHit: null,
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
      lastHit: null,
    });
  },

  hit(toolId, u, v) {
    const { planet, phase, progress, lastHit, pointsCarry } = get();
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
            }
          : s.lastHit,
    }));
    return result;
  },

  endingShown() {
    if (get().phase === "ending") set({ phase: "ended" });
  },

  newPlanet(grid) {
    const { progress } = get();
    set({
      planet: createPlanetState(progress.planetId, grid),
      phase: "playing",
      ending: null,
      lastHit: null,
    });
  },

  clearUnlocks() {
    set({ lastUnlocks: [] });
  },
}));
