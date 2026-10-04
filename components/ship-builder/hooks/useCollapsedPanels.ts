"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ship-builder:ui:collapsed";

export type PanelSide = "left" | "right";

interface CollapsedPanels {
  left: boolean;
  right: boolean;
  toggle: (side: PanelSide) => void;
}

/** Snapshot is a primitive string ("l", "r", "lr" or "") so React can compare. */
const EXPANDED = "";

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so toggling still works per session.
let memorySnapshot = EXPANDED;

function normalize(raw: string | null): string {
  if (raw === null) return EXPANDED;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return EXPANDED;
    const { left, right } = parsed as Record<string, unknown>;
    return `${left === true ? "l" : ""}${right === true ? "r" : ""}`;
  } catch {
    return EXPANDED;
  }
}

function getSnapshot(): string {
  try {
    return normalize(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return memorySnapshot;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function writeSnapshot(next: string): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ left: next.includes("l"), right: next.includes("r") })
    );
  } catch {
    // Storage unavailable: the in-memory value still applies this session.
    memorySnapshot = next;
  }
  listeners.forEach((listener) => listener());
}

/** Per-side collapsed state of the side panels, persisted across visits. */
export default function useCollapsedPanels(): CollapsedPanels {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => EXPANDED);

  const toggle = useCallback((side: PanelSide) => {
    const flag = side === "left" ? "l" : "r";
    const current = getSnapshot();
    const next = current.includes(flag)
      ? current.replace(flag, "")
      : // Keep a stable "lr" order whichever side was collapsed first.
        ["l", "r"].filter((f) => f === flag || current.includes(f)).join("");
    writeSnapshot(next);
  }, []);

  return {
    left: snapshot.includes("l"),
    right: snapshot.includes("r"),
    toggle,
  };
}
