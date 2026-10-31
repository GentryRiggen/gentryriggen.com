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

/** Why a token couldn't be fetched: signed out (denied) or a passing hiccup. */
export function tokenErrorKind(err: unknown): JimErrorKind {
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
 * - uncertain: the message went out but no usable reply came back (the
 *   connection dropped, the body was cut off or malformed, a 5xx other than
 *   503, or JIM_TIMEOUT_MS passed). Jim may have acted on it, so sending
 *   again could save it twice.
 * - denied: no signed-in user (or Firebase says the sign-in expired or was
 *   disabled), a token the server still refused after one refresh, or a 403.
 *   Any other failure to get a token (offline, a PWA waking up) is waking.
 * - rejected: the server refused the message itself (400, 413).
 * - server: anything else where the turn never ran (another 4xx, no URL).
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
 * How long an open stream may stay silent. The server pings every 15 s, so
 * this much quiet means the connection is gone (a lift, a tunnel).
 */
export const JIM_IDLE_MS = 45_000;

/** What Jim is doing while a streamed turn runs (pings are not passed on). */
export type JimStreamEvent =
  | { t: "step"; text: string }
  | { t: "delta"; text: string }
  | { t: "reply"; text: string }
  | { t: "saving" };

const NDJSON = "application/x-ndjson";

/**
 * Sends one message and resolves to Jim's reply, passing what he is doing to
 * `onEvent` as it streams in. A server that answers with plain JSON instead
 * (one without streaming) still works. On a 401 the ID token is
 * force-refreshed and the request is tried once more. Gives up after
 * `timeoutMs` in all, or after `idleMs` with no bytes on an open stream; a
 * stream that ends without its final `done` is uncertain. `signal` lets the
 * page drop the turn (New chat, leaving the page). Throws JimError.
 */
export async function streamToJim(
  text: string,
  session: string,
  getToken: (force?: boolean) => Promise<string | null> = getIdToken,
  onEvent: (event: JimStreamEvent) => void = () => {},
  fetchFn: typeof fetch = fetch,
  api: string = JIM_API,
  timeoutMs: number = JIM_TIMEOUT_MS,
  idleMs: number = JIM_IDLE_MS,
  signal?: AbortSignal
): Promise<JimReply> {
  if (!isJimConnected(api)) throw new JimError("server");
  if (signal?.aborted) throw new JimError("waking");
  const controller = new AbortController();
  const progress = { sent: false };
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let giveUp: (err: JimError) => void = () => {};
  // Also ends a wait that fetch's signal can't reach (a hung token refresh).
  const stopped = new Promise<never>((_resolve, reject) => {
    giveUp = (err) => {
      controller.abort();
      reject(err);
    };
  });
  const quit = () =>
    giveUp(new JimError(progress.sent ? "uncertain" : "waking"));
  const timer = setTimeout(quit, timeoutMs);
  signal?.addEventListener("abort", quit, { once: true });
  // Armed once the stream opens and again by every chunk.
  const stillThere = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => giveUp(new JimError("uncertain")), idleMs);
  };
  async function run(): Promise<JimReply> {
    const res = await request(
      session,
      text,
      getToken,
      fetchFn,
      api,
      controller,
      progress
    );
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes(NDJSON)) return readJson(res);
    return readStream(res, onEvent, stillThere);
  }
  try {
    return await Promise.race([run(), stopped]);
  } catch (err) {
    if (controller.signal.aborted) {
      throw new JimError(progress.sent ? "uncertain" : "waking");
    }
    throw err;
  } finally {
    clearTimeout(timer);
    clearTimeout(idleTimer);
    signal?.removeEventListener("abort", quit);
  }
}

/**
 * Wakes the server (Cloud Run starts it cold) while Gentry types: a
 * fire-and-forget `GET /api/health`, which needs no sign-in.
 */
export function wakeJim(
  api: string = JIM_API,
  fetchFn: typeof fetch | undefined = typeof fetch === "function"
    ? fetch
    : undefined
): void {
  if (!isJimConnected(api) || !fetchFn) return;
  fetchFn(`${api}/api/health`, { method: "GET", cache: "no-store" }).catch(
    () => {}
  );
}

export function isOffline(): boolean {
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
): Promise<Response> {
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
          Accept: NDJSON,
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
  // Any other 5xx (500, 502, Cloud Run's 504 at its time limit) can come
  // after the turn ran and saved.
  if (res.status >= 500) throw new JimError("uncertain");
  if (!res.ok) throw new JimError("server");
  return res;
}

async function readJson(res: Response): Promise<JimReply> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // A 200 whose body never arrived whole: the turn ran.
    throw new JimError("uncertain");
  }
  if (!isReply(body)) throw new JimError("uncertain");
  return { reply: body.reply, changed: body.changed, commit: body.commit };
}

/** Reads NDJSON lines until `done`; anything short of it is uncertain. */
async function readStream(
  res: Response,
  onEvent: (event: JimStreamEvent) => void,
  stillThere: () => void
): Promise<JimReply> {
  const reader = res.body?.getReader();
  if (!reader) throw new JimError("uncertain");
  const decoder = new TextDecoder();
  /** Jim has started on the turn, so an error now may follow a save. */
  let started = false;
  let buffer = "";

  function handle(line: string): JimReply | null {
    if (!line.trim()) return null;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      throw new JimError("uncertain");
    }
    if (typeof event !== "object" || event === null) return null;
    const e = event as Record<string, unknown>;
    // Anything but a ping (or the error itself) means Jim is on the turn,
    // even an event this page doesn't know.
    const wasStarted = started;
    if (e.t !== "ping") started = true;
    switch (e.t) {
      case "step":
      case "delta":
      case "reply":
        if (typeof e.text !== "string") return null;
        onEvent({ t: e.t, text: e.text });
        return null;
      case "saving":
        onEvent({ t: "saving" });
        return null;
      case "done":
        if (!isReply(e)) throw new JimError("uncertain");
        return { reply: e.reply, changed: e.changed, commit: e.commit };
      case "error":
        // A 503 before any step is the sync or the lock: the turn never ran.
        throw new JimError(
          e.status === 503 && !wasStarted ? "waking" : "uncertain"
        );
      default:
        // Pings, and anything a newer server adds.
        return null;
    }
  }

  stillThere();
  try {
    for (;;) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        // The connection dropped mid-turn.
        throw new JimError("uncertain");
      }
      if (chunk.done) break;
      stillThere();
      buffer += decoder.decode(chunk.value, { stream: true });
      let end: number;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        const reply = handle(line);
        if (reply) return reply;
      }
    }
    const reply = handle(buffer + decoder.decode());
    if (reply) return reply;
    throw new JimError("uncertain");
  } finally {
    reader.cancel().catch(() => {});
  }
}
