import { useEffect, useSyncExternalStore } from "react";
import { randomNickname } from "@/lib/leaderboard/nickname";
import { FIRST_SEASON, fetchSeason } from "@/lib/leaderboard/season";
import {
  fetchOwnShipEntry,
  submitShipEntry,
} from "@/lib/leaderboard/shipBoard";
import { createBoardSync } from "@/lib/ship-builder/challenges/boardSync";
import { totalStars } from "@/lib/ship-builder/challenges/progress";
import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";
import {
  applyShipSeason,
  challengeProgress,
  loadedChallengeNickname,
  setChallengeNickname,
} from "@/lib/ship-builder/challenges/progressStore";
import { createStoredSetting } from "./createStoredSetting";

/**
 * Whether Ship Builder talks to the leaderboard at all. Off wherever test
 * hooks are on (unit tests, development and the e2e build), so none of them
 * make a network call; `NEXT_PUBLIC_LEADERBOARD=1` opts a dev build back in.
 */
export const SHIP_BOARD_ENABLED =
  !TEST_HOOKS_ENABLED || process.env.NEXT_PUBLIC_LEADERBOARD === "1";

/**
 * The season whose start the player has not yet been told about, kept so a
 * reload still shows the note until it is dismissed.
 */
const seasonNote = createStoredSetting<number | null>({
  key: "ship-builder:new-season-note",
  parse(raw) {
    const n = raw === null ? NaN : Number(raw);
    return Number.isInteger(n) && n > FIRST_SEASON ? n : null;
  },
  serialize: (value) => (value === null ? null : String(value)),
  fallback: null,
});

/** The season the sync last read, or null until it has. */
let currentSeason: number | null = null;
const seasonListeners = new Set<() => void>();

function subscribeSeason(listener: () => void): () => void {
  seasonListeners.add(listener);
  return () => {
    seasonListeners.delete(listener);
  };
}

/**
 * Hears each season read: a newer season starts the season stars from zero,
 * and a player who had stars is told so.
 */
export function noteShipSeason(n: number): void {
  const hadStars = totalStars(challengeProgress.get()) > 0;
  if (applyShipSeason(n) && n > FIRST_SEASON && hadStars) seasonNote.set(n);
  if (currentSeason !== n) {
    currentSeason = n;
    seasonListeners.forEach((listener) => listener());
  }
}

/** Test-only: forget the season read (and the note, unless kept). */
export function resetShipSeasonForTests({ keepNote = false } = {}): void {
  currentSeason = null;
  if (!keepNote) seasonNote.set(null);
  seasonNote.resetMemory();
}

const sync = createBoardSync({
  enabled: SHIP_BOARD_ENABLED,
  getProgress: challengeProgress.get,
  ensureNickname() {
    const existing = challengeProgress.get().nickname;
    if (existing !== null) return existing;
    const nickname = randomNickname();
    setChallengeNickname(nickname);
    return nickname;
  },
  submit: (entry, season) => submitShipEntry(entry, season),
  readSeason: () => fetchSeason("ship"),
  readOwnEntry: (season) => fetchOwnShipEntry(season),
  onSeason: noteShipSeason,
  loadedNickname: loadedChallengeNickname,
  setNickname: setChallengeNickname,
});

/** Call after the stars change. */
export const requestShipBoardSubmit = sync.request;

/** Mount once in ShipBuilder: reads the season so a new one resets first. */
export function useShipBoardSync(): void {
  useEffect(() => {
    sync.start();
    return sync.stop;
  }, []);
}

export interface ShipSeason {
  /** The season the sync last read, or null until it has. */
  current: number | null;
  /** A new season reset the player's season stars and they haven't seen it. */
  isNewSeason: boolean;
  dismissNewSeason: () => void;
}

export function useShipSeason(): ShipSeason {
  const current = useSyncExternalStore(
    subscribeSeason,
    () => currentSeason,
    () => null
  );
  const note = seasonNote.useValue();
  return {
    current,
    isNewSeason: note !== null,
    dismissNewSeason: () => seasonNote.set(null),
  };
}
