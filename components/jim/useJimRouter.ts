"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  formatJimPath,
  isRoutableNotePath,
  parseJimPath,
  sameRoute,
  type JimRoute,
} from "@/lib/jim/routes";

/**
 * A tiny router for the one /jim page, on window.history and popstate.
 * Next's app router is left alone: it only ever sees the same page, and its
 * own patched pushState keeps its history fields on every entry we add.
 */

/** What each Jim history entry carries, beside Next's own fields. */
export interface JimEntryMeta {
  /** Names the entry, for its scroll position. */
  key: string;
  /** How many entries this page pushed before this one: 0 is where it began. */
  depth: number;
  /** The back link's label ("Results", "Directory"), when not the default. */
  back?: string;
  /** The address Back returns to, for the back link's href. */
  from?: string;
  /** A note whose path can't sit in the address. */
  note?: string;
}

export type JimNavType = "initial" | "push" | "replace" | "pop";

export interface JimLocation {
  route: JimRoute;
  key: string;
  depth: number;
  back: string | null;
  from: string | null;
  /** How this entry was reached: a pop (Back/Forward) restores its scroll. */
  nav: JimNavType;
}

export interface NavigateOptions {
  replace?: boolean;
  /** The back link's label on the page opened. */
  back?: string;
}

export type JimNavigate = (route: JimRoute, options?: NavigateOptions) => void;

let counter = 0;
function newKey(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter}`;
}

function readMeta(): JimEntryMeta | null {
  const state: unknown = window.history.state;
  if (typeof state !== "object" || state === null) return null;
  const meta = (state as { jim?: unknown }).jim;
  if (typeof meta !== "object" || meta === null) return null;
  const { key, depth, back, from, note } = meta as Record<string, unknown>;
  if (typeof key !== "string" || typeof depth !== "number") return null;
  return {
    key,
    depth,
    back: typeof back === "string" ? back : undefined,
    from: typeof from === "string" ? from : undefined,
    note: typeof note === "string" ? note : undefined,
  };
}

export function readJimLocation(nav: JimNavType): JimLocation {
  const meta = readMeta();
  return {
    route: parseJimPath(window.location.pathname, meta?.note),
    key: meta?.key ?? "initial",
    depth: meta?.depth ?? 0,
    back: meta?.back ?? null,
    from: meta?.from ?? null,
    nav,
  };
}

function write(meta: JimEntryMeta, href: string, replace: boolean) {
  // A fresh object: Next adds its own fields to it.
  const state = { jim: meta };
  if (replace) window.history.replaceState(state, "", href);
  else window.history.pushState(state, "", href);
}

/** True for a plain left click: anything else is the browser's (new tab…). */
export function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}): boolean {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export default function useJimRouter() {
  const [location, setLocationState] = useState<JimLocation>(() => {
    const opened = readJimLocation("initial");
    // An entry this page hasn't marked yet gets its key now (written below).
    return readMeta() ? opened : { ...opened, key: newKey() };
  });
  /** The latest location, for callbacks that outlive a render. */
  const locationRef = useRef(location);
  const setLocation = useCallback((next: JimLocation) => {
    locationRef.current = next;
    setLocationState(next);
  }, []);

  useEffect(() => {
    // Mark the entry the page opened on, so Back can tell it from ours.
    if (!readMeta()) {
      write(
        { key: locationRef.current.key, depth: 0 },
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        true
      );
    }
    function onPopState() {
      setLocation(readJimLocation("pop"));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setLocation]);

  const navigate = useCallback<JimNavigate>(
    (route, options = {}) => {
      const replace = options.replace === true;
      const current = locationRef.current;
      // The page already showing: no second entry for it.
      if (!replace && sameRoute(route, current.route)) return;
      const now = readMeta();
      const depth = now?.depth ?? 0;
      const meta: JimEntryMeta = {
        key: newKey(),
        depth: replace ? depth : depth + 1,
      };
      if (options.back) {
        meta.back = options.back;
        meta.from = window.location.pathname;
      } else if (replace && now?.back) {
        // In place of this entry: its way back still holds.
        meta.back = now.back;
        meta.from = now.from;
      }
      if (route.kind === "note" && !isRoutableNotePath(route.path)) {
        meta.note = route.path;
      }
      write(meta, formatJimPath(route), replace);
      setLocation(readJimLocation(replace ? "replace" : "push"));
    },
    [setLocation]
  );

  /**
   * Back, as the browser would, when this page pushed the entry showing;
   * otherwise (opened straight from the address) up to `fallback`.
   */
  const goBack = useCallback(
    (fallback: JimRoute) => {
      if ((readMeta()?.depth ?? 0) > 0) window.history.back();
      else navigate(fallback, { replace: true });
    },
    [navigate]
  );

  return { location, navigate, goBack };
}
