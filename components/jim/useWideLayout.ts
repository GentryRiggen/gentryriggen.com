"use client";

import { useSyncExternalStore } from "react";

/**
 * The desktop layout's breakpoint: Tailwind's `lg`, so CSS (`lg:`) and the
 * layout switch agree. Below it Jim is the phone app, unchanged.
 */
export const WIDE_QUERY = "(min-width: 1024px)";

function media(): MediaQueryList | null {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(WIDE_QUERY)
    : null;
}

function subscribe(onChange: () => void): () => void {
  const list = media();
  if (!list || typeof list.addEventListener !== "function") return () => {};
  list.addEventListener("change", onChange);
  return () => list.removeEventListener("change", onChange);
}

/** True at desktop width: sidebar, page, and the chat docked beside it. */
export default function useWideLayout(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => media()?.matches === true,
    () => false
  );
}
