"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_SEA_STATE,
  isSeaState,
  type SeaState,
} from "../scene/seaState";

const STORAGE_KEY = "ship-builder:ui:sea";

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so choosing still works per session.
let memorySnapshot: SeaState = DEFAULT_SEA_STATE;
// Set once a write fails: reads may still work but would return a stale value.
let isMemoryAuthoritative = false;

function getSnapshot(): SeaState {
  if (isMemoryAuthoritative) return memorySnapshot;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isSeaState(raw) ? raw : DEFAULT_SEA_STATE;
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

function writeSnapshot(next: SeaState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    isMemoryAuthoritative = false;
  } catch {
    memorySnapshot = next;
    isMemoryAuthoritative = true;
  }
  listeners.forEach((listener) => listener());
}

interface SeaStateControl {
  seaState: SeaState;
  setSeaState: (next: SeaState) => void;
}

/** The chosen sea state, remembered per device and not saved with the ship. */
export default function useSeaState(): SeaStateControl {
  const seaState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_SEA_STATE
  );
  const setSeaState = useCallback((next: SeaState) => writeSnapshot(next), []);
  return { seaState, setSeaState };
}
