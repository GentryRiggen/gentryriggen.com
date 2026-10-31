import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import type { FirebaseWebConfig } from "@/lib/firebase/config";
import type { ClientDeps } from "./client";
import { documentsUrl, leaderboardAppCheckHeaders, numberOf } from "./client";

/**
 * Each game's board has its own season counter, held in `seasons/{game}`
 * (written only by the admin, see firestore.rules). Season 1 is the board as
 * it was before seasons: the `leaderboard` and `shipLeaderboard` collections,
 * now frozen as an archive. Later seasons live in
 * `planeSeasons/{n}/entries/{uid}` and `shipSeasons/{n}/entries/{uid}`.
 */
export type SeasonGame = "plane" | "ship";

export const FIRST_SEASON = 1;

export interface SeasonInfo {
  number: number;
  startedAt: Date | null;
}

const DEFAULT_BASE_URL = "https://firestore.googleapis.com";

const LEGACY_COLLECTION: Record<SeasonGame, string> = {
  plane: "leaderboard",
  ship: "shipLeaderboard",
};

const SEASONS_COLLECTION: Record<SeasonGame, string> = {
  plane: "planeSeasons",
  ship: "shipSeasons",
};

/**
 * Collection path holding a season's entries: season 1 → "leaderboard" |
 * "shipLeaderboard"; else "planeSeasons/{n}/entries" | "shipSeasons/{n}/entries".
 */
export function seasonCollection(game: SeasonGame, season: number): string {
  return season === FIRST_SEASON
    ? LEGACY_COLLECTION[game]
    : `${SEASONS_COLLECTION[game]}/${season}/entries`;
}

/**
 * Where a runQuery for a season's board goes: the parent document path (""
 * for the root) and the collection id under it.
 */
export function seasonQueryTarget(
  game: SeasonGame,
  season: number
): { parent: string; collectionId: string } {
  const path = seasonCollection(game, season);
  const slash = path.lastIndexOf("/");
  return slash === -1
    ? { parent: "", collectionId: path }
    : { parent: path.slice(0, slash), collectionId: path.slice(slash + 1) };
}

export function seasonUrl(
  config: FirebaseWebConfig,
  game: SeasonGame,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}/seasons/${game}?key=${config.apiKey}`;
}

function parseSeason(json: unknown): SeasonInfo | null {
  const fields = (json as { fields?: Record<string, unknown> } | null)?.fields;
  if (typeof fields !== "object" || fields === null) return null;
  const number = numberOf(fields.number);
  if (number === null || !Number.isInteger(number) || number < FIRST_SEASON) {
    return null;
  }
  const stamp = (fields.startedAt as { timestampValue?: unknown } | undefined)
    ?.timestampValue;
  const startedAt = typeof stamp === "string" ? new Date(stamp) : null;
  return {
    number,
    startedAt:
      startedAt && Number.isFinite(startedAt.getTime()) ? startedAt : null,
  };
}

/**
 * GET seasons/{game} over REST, no auth. Missing doc → { number: 1,
 * startedAt: null } (no season has been started yet); any failure → null.
 */
export async function fetchSeason(
  game: SeasonGame,
  deps: ClientDeps = {}
): Promise<SeasonInfo | null> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return null;
  try {
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(seasonUrl(config, game, deps.baseUrl), {
      method: "GET",
      headers: { ...(await leaderboardAppCheckHeaders(deps)) },
    });
    if (response.status === 404) {
      return { number: FIRST_SEASON, startedAt: null };
    }
    if (!response.ok) return null;
    return parseSeason(await response.json());
  } catch {
    return null;
  }
}
