import { allowedSay } from "@/lib/jim/say";
import { JIM_BASE, parseJimPath, type JimRoute } from "@/lib/jim/routes";

/** What a notification tap (or a link into the app) asks the page to do. */
export interface JimOpen {
  route: JimRoute;
  /** Allowed text for the message box, or null. */
  say: string | null;
  /** `?listen=brief`: play the morning brief. */
  listen: "brief" | null;
  /** `?reflect=1`: start tonight's reflection. */
  reflect: boolean;
}

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
  const route = parseJimPath(parsed.pathname);
  const params = parsed.searchParams;
  return {
    route,
    say: allowedSay(params.get("say")),
    listen: params.get("listen") === "brief" ? "brief" : null,
    reflect: params.get("reflect") === "1",
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

/** What the chat should start once it is showing: the brief or a reflection. */
export interface OpenIntent {
  listen: "brief" | null;
  reflect: boolean;
}

let pending: OpenIntent | null = null;
const listeners = new Set<(intent: OpenIntent) => void>();

/**
 * Hands an intent to whoever handles it. With no listener yet (the page just
 * loaded) it waits and is delivered to the first one to subscribe.
 */
export function emitOpenIntent(intent: OpenIntent): void {
  if (!intent.listen && !intent.reflect) return;
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
