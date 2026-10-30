import { create } from "zustand";
import { coinBonus, payout, type Payout } from "../economy/payout";
import {
  addCoins,
  buyUpgrade,
  canPrestige,
  moveOnMap,
  prestige,
  newProgress,
  recordDailyFlight,
  recordFlight,
  restartLevel,
  type BuyResult,
  type Progress,
} from "../economy/progress";
import {
  coinMultiplierFor,
  dailyFor,
  utcDateKey,
  type DailyChallenge,
} from "../daily/daily";
import type { Ghost } from "../ghost/ghost";
import { LEVELS, nextLevelId } from "../levels";
import { COIN_ZONE_MULTIPLIER, type GaugeZone } from "../minigame/gauge";
import type { LevelId } from "../levels/types";
import type { TrackId } from "../plane/catalog";
import { applyBonuses, coinFactor, type BonusKind } from "../prestige";
import { planeStats } from "../plane/stats";
import type { FlightResult, LaunchAim } from "../sim/flight";
import { isValidNickname } from "@/lib/leaderboard/nickname";
import { TEST_HOOKS_ENABLED } from "../testHooks";
import { resetFlightInput } from "./flightInput";
import { clearFlightToasts } from "./flightToasts";
import { resetLaunchAim } from "./launchAim";

export type Screen = "levels" | "hangar" | "launch" | "flight" | "map";

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
  /** The daily challenge being flown, or null on a normal world visit. */
  daily: DailyChallenge | null;
}

export interface PlaneBuilderState extends PlaneBuilderData {
  hydrate: (progress: Progress) => void;
  openLevel: (id: LevelId) => void;
  /** Opens today's (UTC) daily challenge world, even if it is still locked. */
  openDaily: (now?: number) => void;
  goToLevels: () => void;
  /** Prestiges (only once allowed) and opens the Sky Map for the owed move. */
  doPrestige: () => void;
  openMap: () => void;
  /** Spends the owed Sky Map move; returns the bonus collected, if any. */
  move: (dx: number, dy: number) => BonusKind | null;
  buy: (track: TrackId) => BuyResult;
  startLaunch: () => void;
  beginFlight: (aim: LaunchAim) => void;
  /** Stops the after-flight coin gauge; only the first call per flight pays. */
  claimCoinBonus: (zone: GaugeZone) => void;
  /** Closes the reward card, once the coin bonus has been claimed. */
  dismissFlightReward: () => void;
  /**
   * `flightId` ignores a stale or duplicate call from an earlier flight.
   * `ghost` is the recording of this flight (only kept if it is a best).
   */
  completeFlight: (
    result: FlightResult,
    flightId?: number,
    ghost?: Ghost | null
  ) => void;
  resetTransient: () => void;
  restart: (id: LevelId) => void;
  /** Only accepts a generated nickname (see lib/leaderboard/nickname). */
  setNickname: (name: string) => void;
}

const initial: PlaneBuilderData = {
  screen: "levels",
  levelId: "meadow",
  progress: newProgress(),
  aim: null,
  flightId: 0,
  lastFlight: null,
  celebrate: null,
  daily: null,
};

export const usePlaneBuilderStore = create<PlaneBuilderState>()((set, get) => ({
  ...initial,
  // A move still owed (say the tab closed on the map) sends the player back.
  hydrate: (progress) =>
    set(
      progress.prestige.movePending ? { progress, screen: "map" } : { progress }
    ),
  resetTransient: () => {
    resetFlightInput();
    resetLaunchAim();
    clearFlightToasts();
    set({
      screen: "levels",
      aim: null,
      lastFlight: null,
      celebrate: null,
      daily: null,
    });
  },
  openLevel: (id) => {
    const { progress } = get();
    if (progress.prestige.movePending) {
      set({ screen: "map" });
      return;
    }
    if (!progress.unlocked.includes(id)) return;
    set({
      screen: "hangar",
      levelId: id,
      lastFlight: null,
      celebrate: null,
      daily: null,
    });
  },
  openDaily: (now = Date.now()) => {
    if (get().progress.prestige.movePending) {
      set({ screen: "map" });
      return;
    }
    const daily = dailyFor(utcDateKey(now));
    set({
      screen: "hangar",
      levelId: daily.world,
      lastFlight: null,
      celebrate: null,
      daily,
    });
  },
  goToLevels: () => set({ screen: "levels", celebrate: null, daily: null }),
  doPrestige: () => {
    const { progress } = get();
    if (!canPrestige(progress)) return;
    set({
      progress: prestige(progress),
      screen: "map",
      lastFlight: null,
      celebrate: null,
    });
  },
  openMap: () => set({ screen: "map", celebrate: null }),
  move: (dx, dy) => {
    const r = moveOnMap(get().progress, dx, dy);
    if (!r.ok) return null;
    set({ progress: r.progress });
    return r.collected;
  },
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
  completeFlight: (result, flightId, ghost = null) => {
    const { progress, levelId, screen, daily } = get();
    if (screen !== "flight") return;
    if (flightId !== undefined && flightId !== get().flightId) return;
    const level = LEVELS[levelId];
    const { bonuses } = progress.prestige;
    const stats = applyBonuses(
      planeStats(level.plane, progress.levels[levelId].tiers),
      bonuses
    );
    const previousBest = progress.levels[levelId].best;
    // The challenge pays no milestone bonuses (they belong to a world's own
    // best), and a twist can double the coins.
    const pay = payout(
      level,
      result,
      stats.multiplier,
      daily ? level.finishDistance : previousBest,
      coinFactor(bonuses) * (daily ? coinMultiplierFor(daily.twist) : 1)
    );
    const recorded = daily
      ? {
          progress: recordDailyFlight(
            progress,
            levelId,
            result,
            pay.total,
            daily.date,
            ghost
          ),
          isNewBest: false,
          unlocked: null,
        }
      : recordFlight(progress, levelId, result, pay.total, ghost);
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
      get().daily === null &&
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
  setNickname: (name) => {
    if (!isValidNickname(name)) return;
    set((s) => ({ progress: { ...s.progress, nickname: name } }));
  },
}));

declare global {
  interface Window {
    __planeBuilderStore?: typeof usePlaneBuilderStore;
  }
}

if (TEST_HOOKS_ENABLED && typeof window !== "undefined") {
  window.__planeBuilderStore = usePlaneBuilderStore;
}
