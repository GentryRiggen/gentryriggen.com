import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError } from "@/lib/jim/api";
import { SpeechRefused } from "@/lib/jim/player";
import { callJim } from "@/lib/jim/view";

type GetToken = (force?: boolean) => Promise<string | null>;

/**
 * Speech for one part (up to ~600 characters) comes back in a few seconds.
 * The limit covers the whole call, the audio body included.
 */
export const SPEAK_TIMEOUT_MS = 30_000;

/** The server takes 1–1500 characters of plain text. */
export const SPEAK_MAX_CHARS = 1500;

/** Said when a 429 comes without a message of its own. */
export const SPEAK_LIMIT_MESSAGE =
  "Read-aloud has hit today's limit. It resets tomorrow.";

async function serverMessage(res: Response): Promise<string | null> {
  const body: unknown = await res.json().catch(() => null);
  const error =
    typeof body === "object" && body !== null
      ? (body as { error?: unknown }).error
      : undefined;
  return typeof error === "string" && error.trim() ? error.trim() : null;
}

/** Rejects with waking when `signal` aborts; otherwise settles as `work`. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new JimError("waking"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new JimError("waking"));
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(resolve, reject).finally(() => {
      signal.removeEventListener("abort", onAbort);
    });
  });
}

/**
 * Jim's own voice for `text`: `POST /api/speak`, MP3 back. With no `voice`
 * the server reads in the active persona's voice. Throws SpeechRefused on a
 * 429 (the daily cap, with the server's message), else JimError: rejected
 * (400), waking (503, offline, the time limit or `signal`, also while the
 * body is still arriving), denied, or server (anything else, an empty body
 * included).
 */
export async function fetchSpeech(
  text: string,
  voice?: string,
  getToken: GetToken = getIdToken,
  api: string = JIM_API,
  signal?: AbortSignal,
  fetchFn?: typeof fetch
): Promise<Blob> {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > SPEAK_MAX_CHARS) {
    throw new JimError("rejected");
  }
  // One limit and one abort for the request and its body together.
  const own = new AbortController();
  const forward = () => own.abort();
  signal?.addEventListener("abort", forward, { once: true });
  if (signal?.aborted) own.abort();
  const timer = setTimeout(() => own.abort(), SPEAK_TIMEOUT_MS);
  try {
    const res = await callJim(
      "/api/speak",
      {
        method: "POST",
        body: voice ? { text: trimmed, voice } : { text: trimmed },
      },
      getToken,
      fetchFn,
      api,
      SPEAK_TIMEOUT_MS,
      own.signal
    );
    if (res.status === 429) {
      throw new SpeechRefused(
        (await untilAborted(serverMessage(res), own.signal)) ??
          SPEAK_LIMIT_MESSAGE
      );
    }
    if (res.status === 400) throw new JimError("rejected");
    if (res.status === 503) throw new JimError("waking");
    if (!res.ok) throw new JimError("server");
    let blob: Blob;
    try {
      blob = await untilAborted(res.blob(), own.signal);
    } catch (err) {
      if (err instanceof JimError) throw err;
      throw new JimError("server");
    }
    if (blob.size === 0) throw new JimError("server");
    return blob;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forward);
  }
}
