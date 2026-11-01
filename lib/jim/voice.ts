import { getIdToken } from "@/lib/firebase/client";
import { JIM_API, JimError } from "@/lib/jim/api";
import { callJim } from "@/lib/jim/view";

type GetToken = (force?: boolean) => Promise<string | null>;

/** Speech for one part (up to ~600 characters) comes back in a few seconds. */
export const SPEAK_TIMEOUT_MS = 30_000;

/** The server takes 1–1500 characters of plain text. */
export const SPEAK_MAX_CHARS = 1500;

/**
 * Jim's own voice for `text`: `POST /api/speak`, MP3 back. With no `voice`
 * the server reads in the active persona's voice. Throws JimError: rejected
 * (400), waking (503, offline, the time limit, `signal`), denied, or server
 * (anything else, an empty body included).
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
    signal
  );
  if (res.status === 400) throw new JimError("rejected");
  if (res.status === 503) throw new JimError("waking");
  if (!res.ok) throw new JimError("server");
  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    throw new JimError(signal?.aborted ? "waking" : "server");
  }
  if (blob.size === 0) throw new JimError("server");
  return blob;
}
