import { appCheckHeaders, type AppCheckAction } from "@/lib/firebase/appCheck";
import {
  firebaseConfig,
  isFirebaseConfigured,
  type FirebaseWebConfig,
} from "@/lib/firebase/config";
import type { GameEvent } from "./gameEvents";
import { commitUrl } from "./send";

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { mapValue: { fields: Record<string, FirestoreValue> } };

function toValue(value: string | number): FirestoreValue {
  return typeof value === "number"
    ? { integerValue: String(value) }
    : { stringValue: value };
}

/**
 * A Firestore REST `commit` that creates one gameEvents doc. `createdAt` is
 * the start of the event's UTC day, which is all firestore.rules accept.
 */
export function buildGameCommitBody(
  projectId: string,
  docId: string,
  event: GameEvent
) {
  const props: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(event.props)) {
    props[key] = toValue(value);
  }
  return {
    writes: [
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/gameEvents/${docId}`,
          fields: {
            site: { stringValue: event.site },
            name: { stringValue: event.name },
            day: { stringValue: event.day },
            props: { mapValue: { fields: props } },
            // Day-granular on purpose (see firestore.rules).
            createdAt: { timestampValue: `${event.day}T00:00:00Z` },
          },
        },
        currentDocument: { exists: false },
      },
    ],
  };
}

/** A random UUIDv4 (the only id shape the rules accept); never time-based. */
export function newDocId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  const variant = "89ab"[Math.floor(Math.random() * 4)];
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${variant}${hex(3)}-${hex(12)}`;
}

interface SendOptions {
  config?: FirebaseWebConfig;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  docId?: string;
  /** Page-hide flushes pass true: use a cached token, never wait for one. */
  cachedAppCheckOnly?: boolean;
  getAppCheckHeaders?: (
    action: AppCheckAction,
    cachedOnly: boolean
  ) => Promise<Record<string, string>>;
}

/**
 * Fire-and-forget: never throws, resolves to whether the write was accepted.
 * `keepalive` lets the request outlive the page when a player leaves mid-game.
 */
export async function sendGameEvent(
  event: GameEvent,
  {
    config = firebaseConfig,
    baseUrl,
    fetchImpl = fetch,
    docId = newDocId(),
    cachedAppCheckOnly = false,
    getAppCheckHeaders = (action, cachedOnly) =>
      appCheckHeaders(action, { cachedOnly }),
  }: SendOptions = {}
): Promise<boolean> {
  if (!isFirebaseConfigured(config)) return false;
  try {
    const response = await fetchImpl(commitUrl(config, baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(await getAppCheckHeaders("game_event", cachedAppCheckOnly)),
      },
      body: JSON.stringify(buildGameCommitBody(config.projectId, docId, event)),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
