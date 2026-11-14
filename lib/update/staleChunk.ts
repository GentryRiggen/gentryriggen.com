/**
 * A tab left open across a deploy can ask for a JS chunk the new release no
 * longer has. These helpers spot that failure and decide whether a single
 * reload is allowed, so it can never loop.
 */

const CHUNK_MESSAGE =
  /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export const RELOAD_STAMP_KEY = "app:chunk-reload";
/** At most one automatic reload in this long. */
export const RELOAD_WINDOW_MS = 60_000;

/** True for the errors a missing chunk produces (rejections or thrown). */
export function isChunkLoadFailure(reason: unknown): boolean {
  if (typeof reason === "string") return CHUNK_MESSAGE.test(reason);
  if (typeof reason !== "object" || reason === null) return false;
  const { name, message } = reason as { name?: unknown; message?: unknown };
  return (
    (typeof name === "string" && CHUNK_MESSAGE.test(name)) ||
    (typeof message === "string" && CHUNK_MESSAGE.test(message))
  );
}

/** True when a failed `<script src>` is one of the app's own chunks. */
export function isAppScriptLoadFailure(target: EventTarget | null): boolean {
  return (
    typeof HTMLScriptElement !== "undefined" &&
    target instanceof HTMLScriptElement &&
    target.src.includes("/_next/")
  );
}

/**
 * Claims the one reload allowed per minute. Returns false when one already
 * happened recently (or storage is unavailable, to be safe against loops).
 */
export function claimReload(storage: Storage, now: number): boolean {
  try {
    const last = Number(storage.getItem(RELOAD_STAMP_KEY));
    if (last && now - last >= 0 && now - last < RELOAD_WINDOW_MS) return false;
    storage.setItem(RELOAD_STAMP_KEY, String(now));
    return true;
  } catch {
    return false;
  }
}
