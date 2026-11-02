import { allowedSay } from "@/lib/jim/say";
import { JIM_BASE, parseJimPath, type JimRoute } from "@/lib/jim/routes";

/** What a notification tap (or a link into the app) asks the page to do. */
export interface JimOpen {
  route: JimRoute;
  /** Allowed text for the message box, or null. */
  say: string | null;
  /** `?listen=brief`: play the morning brief. */
  listen: "brief" | null;
}

/** An old `?reflect=1` link (the chat reflection) now opens the evening retro. */
const EVENING_RETRO: JimRoute = { kind: "retro", retro: "evening" };

/**
 * Reads a URL a notification carried. Same-origin /jim addresses only;
 * anything else (another origin, another path, junk) is null. Unknown
 * query values are ignored.
 */
export function parseOpen(
  url: string,
  origin: string = window.location.origin
): JimOpen | null {
  if (typeof url !== "string") return null;
  let parsed: URL;
  try {
    parsed = new URL(url, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== origin) return null;
  if (
    parsed.pathname !== JIM_BASE &&
    !parsed.pathname.startsWith(`${JIM_BASE}/`) &&
    parsed.pathname !== `${JIM_BASE}.html`
  ) {
    return null;
  }
  const params = parsed.searchParams;
  return {
    route:
      params.get("reflect") === "1"
        ? EVENING_RETRO
        : parseJimPath(parsed.pathname),
    say: allowedSay(params.get("say")),
    listen: params.get("listen") === "brief" ? "brief" : null,
  };
}

/** Drops the named query params from the address bar (no reload). */
export function clearParamsFromLocation(names: string[]): void {
  const url = new URL(window.location.href);
  let changed = false;
  for (const name of names) {
    if (url.searchParams.has(name)) {
      url.searchParams.delete(name);
      changed = true;
    }
  }
  if (!changed) return;
  // Without Next's own fields (it copies them back), so Next's router takes
  // the new address too and doesn't write the params back later.
  const kept = { ...(window.history.state as Record<string, unknown> | null) };
  delete kept.__NA;
  delete kept.__PRIVATE_NEXTJS_INTERNALS_TREE;
  window.history.replaceState(
    kept,
    "",
    `${url.pathname}${url.search}${url.hash}`
  );
}

/** What the chat should start once it is showing: the brief. */
export interface OpenIntent {
  listen: "brief" | null;
}

let pending: OpenIntent | null = null;
const listeners = new Set<(intent: OpenIntent) => void>();

/**
 * Hands an intent to whoever handles it. With no listener yet (the page just
 * loaded) it waits and is delivered to the first one to subscribe.
 */
export function emitOpenIntent(intent: OpenIntent): void {
  if (!intent.listen) return;
  if (listeners.size === 0) {
    pending = intent;
    return;
  }
  for (const listener of listeners) listener(intent);
}

/** Subscribes; a waiting intent is delivered at once. Returns unsubscribe. */
export function onOpenIntent(
  listener: (intent: OpenIntent) => void
): () => void {
  listeners.add(listener);
  if (pending) {
    const waiting = pending;
    pending = null;
    listener(waiting);
  }
  return () => {
    listeners.delete(listener);
  };
}

/** Where the service worker leaves the note of a tap (public/jim-sw.js). */
const OPEN_CACHE = "jim-open-v1";
const OPEN_KEY = "/jim/__open";
/** A note older than this is from a tap long past: dropped. */
const OPEN_NOTE_MAX_AGE_MS = 120_000;

/** Taps this page has already acted on, by the id the worker gave them. */
const handledTaps = new Set<string>();

/**
 * True the first time a tap's id is seen (and remembers it), false after.
 * A message with no id (a worker from before ids) always goes through.
 */
export function claimOpen(id: unknown): boolean {
  if (typeof id !== "string") return true;
  if (handledTaps.has(id)) return false;
  handledTaps.add(id);
  return true;
}

/**
 * The address a notification tap left for this page, when the tap is
 * recent (< 120 s) and not handled yet (by its JIM_OPEN message). The note
 * is deleted either way. Null when there is none, or no cache storage.
 */
export async function consumePendingOpen(
  now: number = Date.now()
): Promise<string | null> {
  try {
    if (typeof caches === "undefined") return null;
    const cache = await caches.open(OPEN_CACHE);
    const saved = await cache.match(OPEN_KEY);
    if (!saved) return null;
    await cache.delete(OPEN_KEY);
    const note: unknown = JSON.parse(await saved.text());
    if (typeof note !== "object" || note === null) return null;
    const { id, url, at } = note as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      typeof url !== "string" ||
      typeof at !== "number" ||
      at > now ||
      now - at >= OPEN_NOTE_MAX_AGE_MS
    ) {
      return null;
    }
    return claimOpen(id) ? url : null;
  } catch {
    return null;
  }
}
