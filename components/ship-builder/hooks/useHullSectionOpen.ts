"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ship-builder:ui:hull-open";
const CLOSED = "0";

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so the section still toggles.
let memorySnapshot = true;
// Set once a write fails: reads may still work but would return a stale value.
let isMemoryAuthoritative = false;

function getSnapshot(): boolean {
  if (isMemoryAuthoritative) return memorySnapshot;
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== CLOSED;
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
  memorySnapshot = next;
  try {
    if (next) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, CLOSED);
    isMemoryAuthoritative = false;
  } catch {
    isMemoryAuthoritative = true;
  }
  listeners.forEach((listener) => listener());
}

/** Whether the Parts panel's Hull section is open; open until closed once. */
export default function useHullSectionOpen(): [
  boolean,
  (next: boolean) => void,
] {
  const isOpen = useSyncExternalStore(subscribe, getSnapshot, () => true);
  const setOpen = useCallback((next: boolean) => writeSnapshot(next), []);
  return [isOpen, setOpen];
}
