import { getIdToken } from "@/lib/firebase/client";

/**
 * The Cloud Run server that answers /jim. Empty until it is deployed: while
 * it is empty the page says Jim isn't connected and never calls out.
 */
export const JIM_API = "";

export interface JimReply {
  reply: string;
  /** Files the reply saved, repo-relative. */
  changed: string[];
  commit: string | null;
}

/**
 * - waking: the network failed or the server said 503 (cold start, busy).
 * - denied: no signed-in user, a token the server still refused after one
 *   refresh, or a 403.
 * - rejected: the server refused the message itself (400, 413).
 * - server: anything else (5xx, a reply in the wrong shape, no URL).
 */
export type JimErrorKind = "waking" | "server" | "denied" | "rejected";

export class JimError extends Error {
  readonly kind: JimErrorKind;

  constructor(kind: JimErrorKind) {
    super(`Jim request failed: ${kind}`);
    this.name = "JimError";
    this.kind = kind;
  }
}

export function isJimConnected(api: string = JIM_API): boolean {
  return api.length > 0;
}

function isReply(value: unknown): value is JimReply {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.reply === "string" &&
    Array.isArray(v.changed) &&
    v.changed.every((f) => typeof f === "string") &&
    (v.commit === null || typeof v.commit === "string")
  );
}

/**
 * Sends one message and resolves to Jim's reply. On a 401 the ID token is
 * force-refreshed and the request is tried once more. Throws JimError.
 */
export async function sendToJim(
  session: string,
  text: string,
  getToken: (force?: boolean) => Promise<string | null> = getIdToken,
  fetchFn: typeof fetch = fetch,
  api: string = JIM_API
): Promise<JimReply> {
  if (!isJimConnected(api)) throw new JimError("server");

  async function post(force: boolean): Promise<Response> {
    let token: string | null;
    try {
      token = await getToken(force);
    } catch {
      throw new JimError("denied");
    }
    if (!token) throw new JimError("denied");
    try {
      return await fetchFn(`${api}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session, text }),
      });
    } catch {
      throw new JimError("waking");
    }
  }

  let res = await post(false);
  if (res.status === 401) res = await post(true);

  if (res.status === 401 || res.status === 403) throw new JimError("denied");
  if (res.status === 503) throw new JimError("waking");
  if (res.status === 400 || res.status === 413) {
    throw new JimError("rejected");
  }
  if (!res.ok) throw new JimError("server");

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new JimError("server");
  }
  if (!isReply(body)) throw new JimError("server");
  return { reply: body.reply, changed: body.changed, commit: body.commit };
}
