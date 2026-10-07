import {
  firebaseConfig,
  isFirebaseConfigured,
  type FirebaseWebConfig,
} from "@/lib/firebase/config";
import type { PageviewEvent } from "./types";

const DEFAULT_BASE_URL = "https://firestore.googleapis.com";

export function commitUrl(
  config: FirebaseWebConfig,
  baseUrl: string = DEFAULT_BASE_URL
): string {
  return `${baseUrl}/v1/projects/${config.projectId}/databases/(default)/documents:commit?key=${config.apiKey}`;
}

/**
 * A Firestore REST `commit` that creates one pageviews doc. `ts` is set by the
 * server (REQUEST_TIME), which is what firestore.rules require.
 */
export function buildCommitBody(
  projectId: string,
  docId: string,
  event: PageviewEvent
) {
  const fields: Record<string, { stringValue: string }> = {};
  for (const [key, value] of Object.entries(event)) {
    fields[key] = { stringValue: value };
  }
  return {
    writes: [
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/pageviews/${docId}`,
          fields,
        },
        updateTransforms: [
          { fieldPath: "ts", setToServerValue: "REQUEST_TIME" },
        ],
        currentDocument: { exists: false },
      },
    ],
  };
}

function newDocId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface SendOptions {
  config?: FirebaseWebConfig;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  docId?: string;
}

/** Fire-and-forget: never throws, resolves to whether the write was accepted. */
export async function sendPageview(
  event: PageviewEvent,
  {
    config = firebaseConfig,
    baseUrl,
    fetchImpl = fetch,
    docId = newDocId(),
  }: SendOptions = {}
): Promise<boolean> {
  if (!isFirebaseConfigured(config)) return false;
  try {
    const response = await fetchImpl(commitUrl(config, baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCommitBody(config.projectId, docId, event)),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}
