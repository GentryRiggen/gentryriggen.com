import { useEffect } from "react";
import { randomNickname } from "@/lib/leaderboard/nickname";
import {
  fetchOwnEntry,
  submitEntryResult,
  type CommitResult,
  type OwnEntry,
} from "@/lib/leaderboard/client";
import {
  FIRST_SEASON,
  fetchSeason,
  type SeasonInfo,
} from "@/lib/leaderboard/season";
import { scoreFor, type LeaderboardEntry } from "@/lib/leaderboard/types";
import { seasonEntry } from "../economy/progress";
import { LEVELS, LEVEL_ORDER } from "../levels";
import { TEST_HOOKS_ENABLED } from "../testHooks";
import { usePlaneBuilderStore } from "./store";

/**
 * Whether the game talks to the leaderboard at all. Off wherever test hooks
 * are on (unit tests, development and the e2e build), so none of them make a
 * network call; `NEXT_PUBLIC_LEADERBOARD=1` opts a dev build back in. Tests
 * of the sync itself pass `enabled: true` with injected reads and `submit`.
 */
export const LEADERBOARDS_ENABLED =
  !TEST_HOOKS_ENABLED || process.env.NEXT_PUBLIC_LEADERBOARD === "1";

/** At most one submission per this long; the latest state rides a trailing one. */
export const SUBMIT_INTERVAL_MS = 30_000;

/** The season is read again before a submit once the last read is this old. */
export const SEASON_READ_MS = 10 * 60_000;

/**
 * The limits firestore.rules put on a plane entry (checked by
 * lib/leaderboard/__tests__/rulesSync.test.ts). A first write may hold at
 * most one prestige and 150 km; each later one may add at most 200 m per
 * second since the last plus 9100 m, and each prestige past the first needs
 * a full run's distance. The climb stays a little inside the per-write ones.
 */
export const CREATE_MAX_PRESTIGE = 1;
export const CREATE_MAX_DISTANCE = 150_000;
export const UPDATE_METRES_PER_SECOND = 200;
export const UPDATE_FLIGHT_METRES = 9100;
const CLIMB_METRES_PER_SECOND = 190;
const CLIMB_FLIGHT_METRES = 9000;
/** Every world's finish distance: one full run. */
export const RUN_DISTANCE = LEVEL_ORDER.reduce(
  (sum, id) => sum + LEVELS[id].finishDistance,
  0
);

export interface LeaderboardSyncDeps {
  enabled?: boolean;
  submit?: (entry: LeaderboardEntry, season: number) => Promise<CommitResult>;
  readSeason?: () => Promise<SeasonInfo | null>;
  /** The player's entry in a season, "missing", or null if it can't be read. */
  readOwnEntry?: (season: number) => Promise<OwnEntry | "missing" | null>;
  intervalMs?: number;
  now?: () => number;
}

export interface LeaderboardSync {
  /** Asks for a submit: sent now if the interval has passed, else later. */
  request: () => void;
  /** Starts watching the store for finished flights and prestiges. */
  start: () => () => void;
}

/** What the board holds for the player, as far as the climb is concerned. */
export interface ClimbBase {
  prestige: number;
  distance: number;
  /** Seconds since it was written; 0 when unknown. */
  secs: number;
}

/**
 * The entry to send now on the way to `target`. With no entry on the board
 * (`base` null) a first write's limits apply; otherwise the distance rises by
 * at most what the rules allow since the base was written. Prestige never
 * runs ahead of the distance it needs. Until the real stats are reached, no
 * fastest run rides along (it needs a full run's distance behind it).
 */
export function climbEntry(
  target: LeaderboardEntry,
  base: ClimbBase | null
): LeaderboardEntry {
  const maxDistance =
    base === null
      ? CREATE_MAX_DISTANCE
      : base.distance +
        CLIMB_METRES_PER_SECOND * Math.max(0, base.secs) +
        CLIMB_FLIGHT_METRES;
  const lifetimeDistance = Math.min(target.lifetimeDistance, maxDistance);
  const prestige = Math.min(
    target.prestige,
    base === null ? CREATE_MAX_PRESTIGE : Infinity,
    Math.floor(lifetimeDistance / RUN_DISTANCE) + 1
  );
  if (
    lifetimeDistance === target.lifetimeDistance &&
    prestige === target.prestige
  ) {
    return target;
  }
  return {
    ...target,
    prestige,
    lifetimeDistance,
    score: scoreFor(prestige, lifetimeDistance),
    fastestRun: null,
  };
}

interface Accepted {
  season: number;
  prestige: number;
  distance: number;
  at: number;
}

export function createLeaderboardSync(
  deps: LeaderboardSyncDeps = {}
): LeaderboardSync {
  const enabled = deps.enabled ?? LEADERBOARDS_ENABLED;
  const submit = deps.submit ?? submitEntryResult;
  const readSeason = deps.readSeason ?? (() => fetchSeason("plane"));
  const readOwnEntry = deps.readOwnEntry ?? ((n) => fetchOwnEntry(n));
  const intervalMs = deps.intervalMs ?? SUBMIT_INTERVAL_MS;
  const now = deps.now ?? Date.now;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let season: number | null = null;
  let seasonReadAt = Number.NEGATIVE_INFINITY;
  let seasonRead: Promise<number | null> | null = null;
  /** The name this client last saw on the board (sent or adopted). */
  let lastSentName: string | null = null;
  /** The last write the server accepted, so the climb knows its time. */
  let accepted: Accepted | null = null;
  /**
   * Refused writes in a row while the board entry can't be read. A refusal
   * may be the rate limit as well as a too-big first write, so one is
   * retried in full; only a second one falls back to the climb.
   */
  let refusals = 0;

  /** The current season, read again when the last read is stale. */
  function currentSeason(): Promise<number | null> {
    if (season !== null && now() - seasonReadAt < SEASON_READ_MS) {
      return Promise.resolve(season);
    }
    seasonRead ??= readSeason()
      .catch(() => null)
      .then((info) => {
        seasonRead = null;
        // A failed re-read keeps the season last read; none read means none.
        if (info === null) return season;
        season = info.number;
        seasonReadAt = now();
        usePlaneBuilderStore.getState().applySeason(info.number);
        return season;
      });
    return seasonRead;
  }

  /** Takes a name the admin gave the entry; never a name not yet sent. */
  function adoptName(onBoard: string): void {
    if (onBoard === lastSentName) return;
    lastSentName = onBoard;
    usePlaneBuilderStore.getState().setNickname(onBoard);
  }

  function baseFor(n: number, own: OwnEntry | "missing" | null) {
    if (own === "missing") return { known: true, base: null };
    const mine = accepted?.season === n ? accepted : null;
    const at = (a: Accepted) => (now() - a.at) / 1000;
    if (own === null) {
      if (mine) {
        return {
          known: true,
          base: {
            prestige: mine.prestige,
            distance: mine.distance,
            secs: at(mine),
          },
        };
      }
      return { known: false, base: null };
    }
    const isMine =
      mine !== null &&
      mine.prestige === own.prestige &&
      mine.distance === own.lifetimeDistance;
    return {
      known: true,
      base: {
        prestige: own.prestige,
        distance: own.lifetimeDistance,
        secs: isMine ? at(mine) : 0,
      },
    };
  }

  const send = async (): Promise<void> => {
    lastSentAt = now();
    try {
      const n = await currentSeason();
      // No season known means no write (never guess); season 1 is frozen.
      if (n === null || n <= FIRST_SEASON) return;
      const own = await readOwnEntry(n);
      if (own !== null && own !== "missing") adoptName(own.nickname);
      const store = usePlaneBuilderStore.getState();
      if (store.progress.nickname === null) store.setNickname(randomNickname());
      const target = seasonEntry(usePlaneBuilderStore.getState().progress);
      const { known, base } = baseFor(n, own);
      const entry = known || refusals >= 2 ? climbEntry(target, base) : target;
      const result = await submit(entry, n);
      if (result === "ok") {
        refusals = 0;
        lastSentName = entry.nickname;
        accepted = {
          season: n,
          prestige: entry.prestige,
          distance: entry.lifetimeDistance,
          at: now(),
        };
        // Keep climbing while the distance has further to go.
        if (entry.lifetimeDistance < target.lifetimeDistance) request();
      } else if (result === "refused") {
        refusals++;
        // The season may have moved on; check before the next write.
        seasonReadAt = Number.NEGATIVE_INFINITY;
        // Nothing else asks again before the next flight; retry (bounded).
        if (refusals <= 2) request();
      }
    } catch {
      // A failed submit is retried by the next flight; never bother the game.
    }
  };

  function request(): void {
    if (!enabled || timer !== null) return;
    const wait = lastSentAt + intervalMs - now();
    if (wait <= 0) {
      void send();
      return;
    }
    // The entry is read when the timer fires, so it carries the latest state.
    timer = setTimeout(() => {
      timer = null;
      void send();
    }, wait);
  }

  const start = (): (() => void) => {
    if (!enabled) return () => {};
    lastSentName = usePlaneBuilderStore.getState().progress.nickname;
    void currentSeason();
    const unsubscribe = usePlaneBuilderStore.subscribe((state, prev) => {
      const isFlightDone =
        state.lastFlight !== null && state.lastFlight !== prev.lastFlight;
      const isPrestiged =
        state.progress.prestige.level > prev.progress.prestige.level;
      if (isFlightDone || isPrestiged) request();
    });
    return () => {
      unsubscribe();
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
  };

  return { request, start };
}

const sync = createLeaderboardSync();

/** Used by the nickname reroll, which should reach the board too. */
export const requestLeaderboardSubmit = sync.request;

/** Mount once in PlaneBuilder. */
export function useLeaderboardSync(): void {
  useEffect(() => sync.start(), []);
}
