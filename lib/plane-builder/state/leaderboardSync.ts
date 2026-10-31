import { useEffect } from "react";
import { randomNickname } from "@/lib/leaderboard/nickname";
import { submitEntry } from "@/lib/leaderboard/client";
import { FIRST_SEASON } from "@/lib/leaderboard/season";
import { scoreFor, type LeaderboardEntry } from "@/lib/leaderboard/types";
import { TEST_HOOKS_ENABLED } from "../testHooks";
import { usePlaneBuilderStore } from "./store";

/**
 * Whether the game talks to the leaderboard at all. Off wherever test hooks
 * are on (unit tests, development and the e2e build), so none of them make a
 * network call; `NEXT_PUBLIC_LEADERBOARD=1` opts a dev build back in. Tests
 * of the sync itself pass `enabled: true` with an injected `submit`.
 */
export const LEADERBOARDS_ENABLED =
  !TEST_HOOKS_ENABLED || process.env.NEXT_PUBLIC_LEADERBOARD === "1";

/** At most one submission per this long; the latest state rides a trailing one. */
export const SUBMIT_INTERVAL_MS = 30_000;

export interface LeaderboardSyncDeps {
  enabled?: boolean;
  submit?: (entry: LeaderboardEntry) => Promise<boolean>;
  intervalMs?: number;
  now?: () => number;
}

export interface LeaderboardSync {
  /** Asks for a submit: sent now if the interval has passed, else later. */
  request: () => void;
  /** Starts watching the store for finished flights and prestiges. */
  start: () => () => void;
}

/** Gives the player a generated name the first time, then reads the entry. */
function currentEntry(): LeaderboardEntry {
  const store = usePlaneBuilderStore.getState();
  if (store.progress.nickname === null) store.setNickname(randomNickname());
  const { progress } = usePlaneBuilderStore.getState();
  return {
    nickname: progress.nickname ?? "",
    prestige: progress.prestige.level,
    score: scoreFor(progress.prestige.level, progress.lifetimeDistance),
    lifetimeDistance: progress.lifetimeDistance,
    bestTimes: progress.bestTimes,
    fastestRun: progress.fastestRun,
  };
}

export function createLeaderboardSync(
  deps: LeaderboardSyncDeps = {}
): LeaderboardSync {
  const enabled = deps.enabled ?? LEADERBOARDS_ENABLED;
  const submit = deps.submit ?? ((entry) => submitEntry(entry, FIRST_SEASON));
  const intervalMs = deps.intervalMs ?? SUBMIT_INTERVAL_MS;
  const now = deps.now ?? Date.now;
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const send = async (): Promise<void> => {
    lastSentAt = now();
    try {
      await submit(currentEntry());
    } catch {
      // A failed submit is retried by the next flight; never bother the game.
    }
  };

  const request = (): void => {
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
  };

  const start = (): (() => void) => {
    if (!enabled) return () => {};
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
