import {
  CHALLENGE_IDS,
  MAX_VALUE,
  isChallengeId,
  starsFor,
  type ChallengeId,
} from "./definitions";

/** The best value earned on one design, per challenge. */
export type DesignBests = Partial<Record<ChallengeId, number>>;

export interface SeasonProgress {
  /** The leaderboard season these stars count for; 0 before any was read. */
  number: number;
  /** The same as `designs`, but only from trials played this season. */
  designs: Record<string, DesignBests>;
}

export interface ChallengeProgress {
  /**
   * All-time bests, keyed by saved ship id, or `UNSAVED_KEY` for the ship not
   * yet saved. These drive the stars shown in the game.
   */
  designs: Record<string, DesignBests>;
  /** The kid-safe name used on the leaderboard (see lib/leaderboard). */
  nickname: string | null;
  /** This leaderboard season's bests; the board entry is built from them. */
  season: SeasonProgress;
}

/** The bucket for a ship that is not in My Ships yet. */
export const UNSAVED_KEY = "unsaved";
/** A sanity bound on stored designs, so a bad file cannot grow without end. */
export const MAX_DESIGNS = 500;

export const EMPTY_PROGRESS: ChallengeProgress = {
  designs: {},
  nickname: null,
  season: { number: 0, designs: {} },
};

export function designKeyOf(savedId: string | null): string {
  return savedId ?? UNSAVED_KEY;
}

/** `designs` with a better value recorded, or the same object if no better. */
function recordIn(
  designs: Record<string, DesignBests>,
  designKey: string,
  id: ChallengeId,
  value: number
): Record<string, DesignBests> {
  const existing = designs[designKey];
  if ((existing?.[id] ?? -1) >= value) return designs;
  if (!existing && Object.keys(designs).length >= MAX_DESIGNS) return designs;
  return { ...designs, [designKey]: { ...existing, [id]: value } };
}

/**
 * Keeps the better of the stored and new value, all-time and this season;
 * returns the same object if neither is beaten.
 */
export function recordBest(
  progress: ChallengeProgress,
  designKey: string,
  id: ChallengeId,
  value: number
): ChallengeProgress {
  const designs = recordIn(progress.designs, designKey, id, value);
  const seasonDesigns = recordIn(progress.season.designs, designKey, id, value);
  if (
    designs === progress.designs &&
    seasonDesigns === progress.season.designs
  ) {
    return progress;
  }
  return {
    ...progress,
    designs,
    season: { ...progress.season, designs: seasonDesigns },
  };
}

/** Begins season `number`: its stars start from zero, all-time stars stay. */
export function startShipSeason(
  progress: ChallengeProgress,
  number: number
): ChallengeProgress {
  return { ...progress, season: { number, designs: {} } };
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

function adoptIn(
  designs: Record<string, DesignBests>,
  savedId: string
): Record<string, DesignBests> {
  const unsaved = designs[UNSAVED_KEY];
  if (!unsaved) return designs;
  const { [UNSAVED_KEY]: _moved, ...rest } = designs;
  void _moved;
  const merged: DesignBests = { ...rest[savedId] };
  for (const id of CHALLENGE_IDS) {
    const value = unsaved[id];
    if (value !== undefined && value > (merged[id] ?? -1)) merged[id] = value;
  }
  return { ...rest, [savedId]: merged };
}

/** A ship that was unsaved is now in My Ships: its stars go with it. */
export function adoptUnsaved(
  progress: ChallengeProgress,
  savedId: string
): ChallengeProgress {
  const designs = adoptIn(progress.designs, savedId);
  const seasonDesigns = adoptIn(progress.season.designs, savedId);
  if (
    designs === progress.designs &&
    seasonDesigns === progress.season.designs
  ) {
    return progress;
  }
  return {
    ...progress,
    designs,
    season: { ...progress.season, designs: seasonDesigns },
  };
}

function dropIn(
  designs: Record<string, DesignBests>,
  designKey: string
): Record<string, DesignBests> {
  if (!(designKey in designs)) return designs;
  const { [designKey]: _dropped, ...rest } = designs;
  void _dropped;
  return rest;
}

/** Forgets one design's stars (the ship was deleted, or a new one started). */
export function dropDesign(
  progress: ChallengeProgress,
  designKey: string
): ChallengeProgress {
  const designs = dropIn(progress.designs, designKey);
  const seasonDesigns = dropIn(progress.season.designs, designKey);
  if (
    designs === progress.designs &&
    seasonDesigns === progress.season.designs
  ) {
    return progress;
  }
  return {
    ...progress,
    designs,
    season: { ...progress.season, designs: seasonDesigns },
  };
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

function cleanDesigns(raw: unknown): Record<string, DesignBests> {
  const clean: Record<string, DesignBests> = {};
  if (typeof raw !== "object" || raw === null) return clean;
  for (const [key, bests] of Object.entries(raw).slice(0, MAX_DESIGNS)) {
    if (key.length === 0 || key.length > 64 || key === "__proto__") continue;
    const cleaned = cleanBests(bests);
    if (Object.keys(cleaned).length > 0) clean[key] = cleaned;
  }
  return clean;
}

/** A stored season; anything unreadable (or a save from before seasons) is season 0. */
function cleanSeason(raw: unknown): SeasonProgress {
  if (typeof raw !== "object" || raw === null) return EMPTY_PROGRESS.season;
  const { number, designs } = raw as Record<string, unknown>;
  if (typeof number !== "number" || !Number.isInteger(number) || number < 0) {
    return EMPTY_PROGRESS.season;
  }
  return { number, designs: cleanDesigns(designs) };
}

/** Reads stored progress; anything unreadable is dropped, never thrown. */
export function parseProgress(
  raw: unknown,
  isValidNickname: (s: unknown) => s is string
): ChallengeProgress {
  if (typeof raw !== "object" || raw === null) return EMPTY_PROGRESS;
  const { designs, nickname, season } = raw as Record<string, unknown>;
  return {
    designs: cleanDesigns(designs),
    nickname: isValidNickname(nickname) ? nickname : null,
    season: cleanSeason(season),
  };
}
