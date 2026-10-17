import { create } from "zustand";
import { coinBonus, payout, type Payout } from "../economy/payout";
import {
  addCoins,
  buyUpgrade,
  newProgress,
  recordFlight,
  restartLevel,
  type BuyResult,
  type Progress,
} from "../economy/progress";
import { LEVELS, nextLevelId } from "../levels";
import { COIN_ZONE_MULTIPLIER, type GaugeZone } from "../minigame/gauge";
import type { LevelId } from "../levels/types";
import type { TrackId } from "../plane/catalog";
import { planeStats } from "../plane/stats";
import type { FlightResult, LaunchAim } from "../sim/flight";
import { TEST_HOOKS_ENABLED } from "../testHooks";
import { resetFlightInput } from "./flightInput";
import { clearFlightToasts } from "./flightToasts";
import { resetLaunchAim } from "./launchAim";

export type Screen = "levels" | "hangar" | "launch" | "flight";

export interface FlightSummary {
  result: FlightResult;
  payout: Payout;
  isNewBest: boolean;
  previousBest: number;
  unlocked: LevelId | null;
  /** The after-flight coin gauge's result, once stopped (once per flight). */
  bonus: CoinBonus | null;
  /** True once the player has dismissed the after-flight reward card. */
  seen: boolean;
}

export interface Celebration {
  won: LevelId;
  /** The level to point at next, or null once every world is beaten. */
  next: LevelId | null;
}

export interface CoinBonus {
  zone: GaugeZone;
  multiplier: number;
  extra: number;
}

interface PlaneBuilderData {
  screen: Screen;
  levelId: LevelId;
  progress: Progress;
  aim: LaunchAim | null;
  /** Bumped per launch so the flight scene remounts fresh. */
  flightId: number;
  /** The flight just flown, shown at the top of the hangar until the next. */
  lastFlight: FlightSummary | null;
  /** Set after a first-time level finish; the levels screen celebrates it. */
  celebrate: Celebration | null;
}

export interface PlaneBuilderState extends PlaneBuilderData {
  hydrate: (progress: Progress) => void;
  openLevel: (id: LevelId) => void;
  goToLevels: () => void;
  buy: (track: TrackId) => BuyResult;
  startLaunch: () => void;
  beginFlight: (aim: LaunchAim) => void;
  /** Stops the after-flight coin gauge; only the first call per flight pays. */
  claimCoinBonus: (zone: GaugeZone) => void;
  /** Closes the reward card, once the coin bonus has been claimed. */
  dismissFlightReward: () => void;
  /** `flightId` ignores a stale or duplicate call from an earlier flight. */
  completeFlight: (result: FlightResult, flightId?: number) => void;
  resetTransient: () => void;
  restart: (id: LevelId) => void;
}

const initial: PlaneBuilderData = {
  screen: "levels",
  levelId: "meadow",
  progress: newProgress(),
  aim: null,
  flightId: 0,
  lastFlight: null,
  celebrate: null,
};

export const usePlaneBuilderStore = create<PlaneBuilderState>()((set, get) => ({
  ...initial,
  hydrate: (progress) => set({ progress }),
  resetTransient: () => {
    resetFlightInput();
    resetLaunchAim();
    clearFlightToasts();
    set({ screen: "levels", aim: null, lastFlight: null, celebrate: null });
  },
  openLevel: (id) => {
    if (!get().progress.unlocked.includes(id)) return;
    set({ screen: "hangar", levelId: id, lastFlight: null, celebrate: null });
  },
  goToLevels: () => set({ screen: "levels", celebrate: null }),
  buy: (track) => {
    const r = buyUpgrade(get().progress, get().levelId, track);
    if (r.ok) set({ progress: r.progress });
    return r;
  },
  startLaunch: () => {
    resetFlightInput();
    resetLaunchAim();
    clearFlightToasts();
    set({ screen: "launch", aim: null, lastFlight: null });
  },
  beginFlight: (aim) => {
    resetLaunchAim();
    clearFlightToasts();
    set((s) => ({ screen: "flight", aim, flightId: s.flightId + 1 }));
  },
  completeFlight: (result, flightId) => {
    const { progress, levelId, screen } = get();
    if (screen !== "flight") return;
    if (flightId !== undefined && flightId !== get().flightId) return;
    const level = LEVELS[levelId];
    const stats = planeStats(level.plane, progress.levels[levelId].tiers);
    const previousBest = progress.levels[levelId].best;
    const pay = payout(level, result, stats.multiplier, previousBest);
    const recorded = recordFlight(progress, levelId, result, pay.total);
    resetFlightInput();
    set({
      screen: "hangar",
      progress: recorded.progress,
      lastFlight: {
        result,
        payout: pay,
        isNewBest: recorded.isNewBest,
        previousBest,
        unlocked: recorded.unlocked,
        bonus: null,
        seen: false,
      },
    });
  },
  claimCoinBonus: (zone) => {
    const { lastFlight, progress, levelId } = get();
    if (!lastFlight || lastFlight.bonus) return;
    const extra = coinBonus(lastFlight.payout.total, zone);
    set({
      progress: addCoins(progress, levelId, extra),
      lastFlight: {
        ...lastFlight,
        bonus: { zone, multiplier: COIN_ZONE_MULTIPLIER[zone], extra },
      },
    });
  },
  dismissFlightReward: () => {
    const { lastFlight, levelId } = get();
    if (!lastFlight?.bonus || lastFlight.seen) return;
    const seen = { ...lastFlight, seen: true };
    const isFirstFinish =
      lastFlight.result.finished &&
      lastFlight.previousBest < LEVELS[levelId].finishDistance;
    if (!isFirstFinish) {
      set({ lastFlight: seen });
      return;
    }
    set({
      lastFlight: seen,
      screen: "levels",
      celebrate: {
        won: levelId,
        next: lastFlight.unlocked ?? nextLevelId(levelId),
      },
    });
  },
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
