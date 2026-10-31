import { getIdToken } from "@/lib/firebase/client";

/**
 * The Cloud Run server that answers /jim. Empty until it is deployed: while
 * it is empty the page says Jim isn't connected and never calls out.
 */
export const JIM_API = "https://jim-997603129413.us-central1.run.app";

/**
 * How long to wait for a reply: a little over the server's own limit (Cloud
 * Run allows 300 s), so the page never gives up on a turn that can still
 * finish and save.
 */
export const JIM_TIMEOUT_MS = 305_000;

/** Token errors that mean the sign-in itself is gone, not a passing hiccup. */
const SIGNED_OUT_CODES = new Set([
  "auth/user-token-expired",
  "auth/user-disabled",
]);

function tokenErrorKind(err: unknown): JimErrorKind {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? (err as { code: unknown }).code
      : undefined;
  return typeof code === "string" && SIGNED_OUT_CODES.has(code)
    ? "denied"
    : "waking";
}

export interface JimReply {
  reply: string;
  /** Files the reply saved, repo-relative. */
  changed: string[];
  commit: string | null;
}

/**
 * - waking: the message never reached Jim, so it is safe to send again:
 *   offline, a token could not be fetched, a time-out before it was sent,
 *   or the server said 503 (busy or cold; the turn did not run).
 * - uncertain: the message went out but no reply came back (the connection
 *   dropped, the body was cut off, or JIM_TIMEOUT_MS passed). Jim may have
 *   acted on it, so sending again could save it twice.
 * - denied: no signed-in user (or Firebase says the sign-in expired or was
 *   disabled), a token the server still refused after one refresh, or a 403.
 *   Any other failure to get a token (offline, a PWA waking up) is waking.
 * - rejected: the server refused the message itself (400, 413).
 * - server: anything else (5xx, a reply in the wrong shape, no URL).
 */
export type JimErrorKind =
  "waking" | "uncertain" | "server" | "denied" | "rejected";

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
 * force-refreshed and the request is tried once more. Gives up after
 * `timeoutMs`. Throws JimError.
 */
export async function sendToJim(
  session: string,
  text: string,
  getToken: (force?: boolean) => Promise<string | null> = getIdToken,
  fetchFn: typeof fetch = fetch,
  api: string = JIM_API,
  timeoutMs: number = JIM_TIMEOUT_MS
): Promise<JimReply> {
  if (!isJimConnected(api)) throw new JimError("server");
  const controller = new AbortController();
  const progress = { sent: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Also ends a wait that fetch's signal can't reach (a hung token refresh).
  const timedOut = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new JimError(progress.sent ? "uncertain" : "waking"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([
      request(session, text, getToken, fetchFn, api, controller, progress),
      timedOut,
    ]);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new JimError(progress.sent ? "uncertain" : "waking");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function request(
  session: string,
  text: string,
  getToken: (force?: boolean) => Promise<string | null>,
  fetchFn: typeof fetch,
  api: string,
  controller: AbortController,
  progress: { sent: boolean }
): Promise<JimReply> {
  async function post(force: boolean): Promise<Response> {
    let token: string | null;
    try {
      token = await getToken(force);
    } catch (err) {
      throw new JimError(tokenErrorKind(err));
    }
    if (!token) throw new JimError("denied");
    if (isOffline()) throw new JimError("waking");
    // From here the server may get the message and act on it.
    progress.sent = true;
    try {
      return await fetchFn(`${api}/api/chat`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session, text }),
        signal: controller.signal,
      });
    } catch {
      throw new JimError("uncertain");
    }
  }

  let res = await post(false);
  if (res.status === 401) {
    // The server refused the token, so that try did not run.
    progress.sent = false;
    res = await post(true);
  }

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
    // A 200 whose body never arrived whole: the turn ran.
    throw new JimError("uncertain");
  }
  if (!isReply(body)) throw new JimError("server");
  return { reply: body.reply, changed: body.changed, commit: body.commit };
}
