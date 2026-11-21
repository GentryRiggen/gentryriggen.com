"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  emptySave,
  loadSaveResult,
  writeSave,
  type ShipwreckSave,
} from "./save";

/**
 * The save as a tiny external store. It is read once after mount (never
 * during render, so the static page matches on hydration: the server
 * snapshot is the empty save) and written by `persist`, which the root
 * passes to useVisibilityPause({ onPersist }).
 */
const SERVER_SNAPSHOT = emptySave();
let current: ShipwreckSave = SERVER_SNAPSHOT;
let writable = false;
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function load() {
  if (loaded) return;
  const result = loadSaveResult(Date.now());
  current = result.save;
  writable = result.writable;
  loaded = true;
  emit();
}

/** Test seam: forget what was loaded so the next mount reads storage again. */
export function resetSaveStore(): void {
  current = SERVER_SNAPSHOT;
  writable = false;
  loaded = false;
  emit();
}

export function useShipwreckSave() {
  const save = useSyncExternalStore(
    subscribe,
    () => current,
    () => SERVER_SNAPSHOT
  );

  useEffect(load, []);

  const persist = useCallback(() => {
    if (loaded && writable) writeSave(current);
  }, []);

  const update = useCallback((next: (s: ShipwreckSave) => ShipwreckSave) => {
    current = next(current);
    emit();
  }, []);

  return { save, update, persist };
}
