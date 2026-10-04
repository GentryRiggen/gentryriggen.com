"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ship-builder:ui:show-all-parts";
const ON = "1";

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so the switch still works per session.
let memorySnapshot = false;
// Set once a write fails: reads may still work but would return a stale value.
let isMemoryAuthoritative = false;

function getSnapshot(): boolean {
  if (isMemoryAuthoritative) return memorySnapshot;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === ON;
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

function writeSnapshot(next: boolean): void {
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, ON);
    else window.localStorage.removeItem(STORAGE_KEY);
    isMemoryAuthoritative = false;
  } catch {
    memorySnapshot = next;
    isMemoryAuthoritative = true;
  }
  listeners.forEach((listener) => listener());
}

interface ShowAllPartsControl {
  showAll: boolean;
  setShowAll: (next: boolean) => void;
}

/** Whether the Parts panel lists every part; remembered per device. */
export default function useShowAllParts(): ShowAllPartsControl {
  const showAll = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const setShowAll = useCallback((next: boolean) => writeSnapshot(next), []);
  return { showAll, setShowAll };
}
