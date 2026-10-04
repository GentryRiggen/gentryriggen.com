"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  DEFAULT_TIME_OF_DAY,
  isTimeOfDay,
  type TimeOfDay,
} from "../scene/timeOfDay";

const STORAGE_KEY = "ship-builder:ui:time";

const listeners = new Set<() => void>();
// Used when localStorage is unavailable, so choosing still works per session.
let memorySnapshot: TimeOfDay = DEFAULT_TIME_OF_DAY;
// Set once a write fails: reads may still work but would return a stale value.
let isMemoryAuthoritative = false;

function getSnapshot(): TimeOfDay {
  if (isMemoryAuthoritative) return memorySnapshot;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isTimeOfDay(raw) ? raw : DEFAULT_TIME_OF_DAY;
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

function writeSnapshot(next: TimeOfDay): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
    isMemoryAuthoritative = false;
  } catch {
    memorySnapshot = next;
    isMemoryAuthoritative = true;
  }
  listeners.forEach((listener) => listener());
}

interface TimeOfDayControl {
  timeOfDay: TimeOfDay;
  setTimeOfDay: (next: TimeOfDay) => void;
}

/** The chosen time of day, remembered per device and not saved with the ship. */
export default function useTimeOfDay(): TimeOfDayControl {
  const timeOfDay = useSyncExternalStore(
    subscribe,
    getSnapshot,
    () => DEFAULT_TIME_OF_DAY
  );
  const setTimeOfDay = useCallback(
    (next: TimeOfDay) => writeSnapshot(next),
    []
  );
  return { timeOfDay, setTimeOfDay };
}
