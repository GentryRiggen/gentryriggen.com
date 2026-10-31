import { firebaseConfig, isFirebaseConfigured } from "@/lib/firebase/config";
import type { FirebaseWebConfig } from "@/lib/firebase/config";
import type { ClientDeps } from "./client";
import { documentsUrl, leaderboardAppCheckHeaders } from "./client";

/**
 * Switches the admin sets for a game's board, held in `boardSettings/{game}`
 * (publicly readable, written only by the admin; see firestore.rules). Only
 * the plane board has one.
 */
export type BoardSettingsGame = "plane";

const DEFAULT_BASE_URL = "https://firestore.googleapis.com";

export function boardSettingsUrl(
  config: FirebaseWebConfig,
  game: BoardSettingsGame,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${documentsUrl(config, baseUrl)}/boardSettings/${game}?key=${config.apiKey}`;
}

/**
 * Whether the admin has hidden `game`'s board from players. Fails closed: a
 * missing or malformed doc, or any failure to read it, means hidden.
 */
export async function fetchBoardHidden(
  game: BoardSettingsGame,
  deps: ClientDeps = {}
): Promise<boolean> {
  const config = deps.config ?? firebaseConfig;
  if (!isFirebaseConfigured(config)) return true;
  try {
    const fetchImpl = deps.fetchImpl ?? ((...args) => fetch(...args));
    const response = await fetchImpl(
      boardSettingsUrl(config, game, deps.baseUrl),
      {
        method: "GET",
        headers: { ...(await leaderboardAppCheckHeaders(deps)) },
      }
    );
    if (!response.ok) return true;
    const json: unknown = await response.json();
    const hidden = (
      json as { fields?: { hidden?: { booleanValue?: unknown } } } | null
    )?.fields?.hidden?.booleanValue;
    return typeof hidden === "boolean" ? hidden : true;
  } catch {
    return true;
  }
}
