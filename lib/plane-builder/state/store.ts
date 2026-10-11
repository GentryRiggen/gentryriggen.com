import { create } from "zustand";
import { payout, type Payout } from "../economy/payout";
import {
  buyUpgrade,
  newProgress,
  recordFlight,
  restartLevel,
  type BuyResult,
  type Progress,
} from "../economy/progress";
import { LEVELS } from "../levels";
import type { LevelId } from "../levels/types";
import type { TrackId } from "../plane/catalog";
import { planeStats } from "../plane/stats";
import type { FlightResult, LaunchAim } from "../sim/flight";
import { TEST_HOOKS_ENABLED } from "../testHooks";
import { resetFlightInput } from "./flightInput";
import { resetLaunchAim } from "./launchAim";

export type Screen = "levels" | "hangar" | "launch" | "flight" | "results";

export interface FlightSummary {
  result: FlightResult;
  payout: Payout;
  isNewBest: boolean;
  previousBest: number;
  unlocked: LevelId | null;
}

interface PlaneBuilderData {
  screen: Screen;
  levelId: LevelId;
  progress: Progress;
  aim: LaunchAim | null;
  /** Bumped per launch so the flight scene remounts fresh. */
  flightId: number;
  lastFlight: FlightSummary | null;
}

export interface PlaneBuilderState extends PlaneBuilderData {
  hydrate: (progress: Progress) => void;
  openLevel: (id: LevelId) => void;
  goToLevels: () => void;
  buy: (track: TrackId) => BuyResult;
  startLaunch: () => void;
  beginFlight: (aim: LaunchAim) => void;
  /** `flightId` ignores a stale or duplicate call from an earlier flight. */
  completeFlight: (result: FlightResult, flightId?: number) => void;
  resetTransient: () => void;
  flyAgain: () => void;
  restart: (id: LevelId) => void;
}

const initial: PlaneBuilderData = {
  screen: "levels",
  levelId: "meadow",
  progress: newProgress(),
  aim: null,
  flightId: 0,
  lastFlight: null,
};

export const usePlaneBuilderStore = create<PlaneBuilderState>()((set, get) => ({
  ...initial,
  hydrate: (progress) => set({ progress }),
  resetTransient: () => {
    resetFlightInput();
    resetLaunchAim();
    set({ screen: "levels", aim: null, lastFlight: null });
  },
  openLevel: (id) => {
    if (!get().progress.unlocked.includes(id)) return;
    set({ screen: "hangar", levelId: id, lastFlight: null });
  },
  goToLevels: () => set({ screen: "levels" }),
  buy: (track) => {
    const r = buyUpgrade(get().progress, get().levelId, track);
    if (r.ok) set({ progress: r.progress });
    return r;
  },
  startLaunch: () => {
    resetFlightInput();
    resetLaunchAim();
    set({ screen: "launch", aim: null });
  },
  beginFlight: (aim) => {
    resetLaunchAim();
    set((s) => ({ screen: "flight", aim, flightId: s.flightId + 1 }));
  },
  completeFlight: (result, flightId) => {
    const { progress, levelId, screen } = get();
    if (screen !== "flight") return;
    if (flightId !== undefined && flightId !== get().flightId) return;
    const level = LEVELS[levelId];
    const stats = planeStats(level.plane, progress.levels[levelId].tiers);
    const pay = payout(level, result, stats.multiplier);
    const previousBest = progress.levels[levelId].best;
    const recorded = recordFlight(progress, levelId, result, pay.total);
    resetFlightInput();
    set({
      screen: "results",
      progress: recorded.progress,
      lastFlight: {
        result,
        payout: pay,
        isNewBest: recorded.isNewBest,
        previousBest,
        unlocked: recorded.unlocked,
      },
    });
  },
  flyAgain: () => get().startLaunch(),
  restart: (id) => set((s) => ({ progress: restartLevel(s.progress, id) })),
}));

declare global {
  interface Window {
    __planeBuilderStore?: typeof usePlaneBuilderStore;
  }
}

if (TEST_HOOKS_ENABLED && typeof window !== "undefined") {
  window.__planeBuilderStore = usePlaneBuilderStore;
}
