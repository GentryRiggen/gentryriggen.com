import {
  CHALLENGE_IDS,
  MAX_VALUE,
  isChallengeId,
  starsFor,
  type ChallengeId,
} from "./definitions";

/** The best value earned on one design, per challenge. */
export type DesignBests = Partial<Record<ChallengeId, number>>;

export interface ChallengeProgress {
  /** Keyed by saved ship id, or `UNSAVED_KEY` for the ship not yet saved. */
  designs: Record<string, DesignBests>;
  /** The kid-safe name used on the leaderboard (see lib/leaderboard). */
  nickname: string | null;
}

/** The bucket for a ship that is not in My Ships yet. */
export const UNSAVED_KEY = "unsaved";
/** A sanity bound on stored designs, so a bad file cannot grow without end. */
export const MAX_DESIGNS = 500;

export const EMPTY_PROGRESS: ChallengeProgress = {
  designs: {},
  nickname: null,
};

export function designKeyOf(savedId: string | null): string {
  return savedId ?? UNSAVED_KEY;
}

/** Keeps the better of the stored and new value; returns the same object if no better. */
export function recordBest(
  progress: ChallengeProgress,
  designKey: string,
  id: ChallengeId,
  value: number
): ChallengeProgress {
  const existing = progress.designs[designKey];
  if ((existing?.[id] ?? -1) >= value) return progress;
  if (!existing && Object.keys(progress.designs).length >= MAX_DESIGNS) {
    return progress;
  }
  return {
    ...progress,
    designs: {
      ...progress.designs,
      [designKey]: { ...existing, [id]: value },
    },
  };
}

export function bestValue(
  progress: ChallengeProgress,
  designKey: string,
  id: ChallengeId
): number | null {
  return progress.designs[designKey]?.[id] ?? null;
}

export function starsOfDesign(
  progress: ChallengeProgress,
  designKey: string,
  id: ChallengeId
): number {
  const value = bestValue(progress, designKey, id);
  return value === null ? 0 : starsFor(id, value);
}

/** Stars across every design: the best of each challenge on each ship. */
export function totalStars(progress: ChallengeProgress): number {
  let total = 0;
  for (const bests of Object.values(progress.designs)) {
    for (const id of CHALLENGE_IDS) {
      const value = bests[id];
      if (value !== undefined) total += starsFor(id, value);
    }
  }
  return total;
}

/** The best value per challenge across all designs (for the leaderboard). */
export function overallBests(progress: ChallengeProgress): DesignBests {
  const bests: DesignBests = {};
  for (const design of Object.values(progress.designs)) {
    for (const id of CHALLENGE_IDS) {
      const value = design[id];
      if (value !== undefined && value > (bests[id] ?? -1)) bests[id] = value;
    }
  }
  return bests;
}

/** A ship that was unsaved is now in My Ships: its stars go with it. */
export function adoptUnsaved(
  progress: ChallengeProgress,
  savedId: string
): ChallengeProgress {
  const unsaved = progress.designs[UNSAVED_KEY];
  if (!unsaved) return progress;
  const { [UNSAVED_KEY]: _moved, ...rest } = progress.designs;
  void _moved;
  const merged: DesignBests = { ...rest[savedId] };
  for (const id of CHALLENGE_IDS) {
    const value = unsaved[id];
    if (value !== undefined && value > (merged[id] ?? -1)) merged[id] = value;
  }
  return { ...progress, designs: { ...rest, [savedId]: merged } };
}

/** Forgets one design's stars (the ship was deleted, or a new one started). */
export function dropDesign(
  progress: ChallengeProgress,
  designKey: string
): ChallengeProgress {
  if (!(designKey in progress.designs)) return progress;
  const { [designKey]: _dropped, ...rest } = progress.designs;
  void _dropped;
  return { ...progress, designs: rest };
}

function cleanBests(raw: unknown): DesignBests {
  const bests: DesignBests = {};
  if (typeof raw !== "object" || raw === null) return bests;
  for (const [key, value] of Object.entries(raw)) {
    if (!isChallengeId(key)) continue;
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    bests[key] = Math.max(0, Math.min(MAX_VALUE[key], Math.round(value)));
  }
  return bests;
}

/** Reads stored progress; anything unreadable is dropped, never thrown. */
export function parseProgress(
  raw: unknown,
  isValidNickname: (s: unknown) => s is string
): ChallengeProgress {
  if (typeof raw !== "object" || raw === null) return EMPTY_PROGRESS;
  const { designs, nickname } = raw as Record<string, unknown>;
  const clean: Record<string, DesignBests> = {};
  if (typeof designs === "object" && designs !== null) {
    for (const [key, bests] of Object.entries(designs).slice(0, MAX_DESIGNS)) {
      if (key.length === 0 || key.length > 64 || key === "__proto__") continue;
      const cleaned = cleanBests(bests);
      if (Object.keys(cleaned).length > 0) clean[key] = cleaned;
    }
  }
  return {
    designs: clean,
    nickname: isValidNickname(nickname) ? nickname : null,
  };
}
