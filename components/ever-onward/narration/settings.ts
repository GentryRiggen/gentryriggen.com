import { useSyncExternalStore } from "react";

export interface NarrationSettings {
  /** Master switch: off hides every narration control and never plays. */
  isEnabled: boolean;
  /** Play new messages without asking (no toast). */
  isAutoPlay: boolean;
}

export const NARRATION_STORAGE_KEY = "everOnward.narration";

const DEFAULTS: NarrationSettings = { isEnabled: true, isAutoPlay: false };

function read(): NarrationSettings {
  try {
    const raw = window.localStorage.getItem(NARRATION_STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULTS;
    const { isEnabled, isAutoPlay } = parsed as Record<string, unknown>;
    return {
      isEnabled:
        typeof isEnabled === "boolean" ? isEnabled : DEFAULTS.isEnabled,
      isAutoPlay:
        typeof isAutoPlay === "boolean" ? isAutoPlay : DEFAULTS.isAutoPlay,
    };
  } catch {
    return DEFAULTS;
  }
}

let current: NarrationSettings | null = null;
const listeners = new Set<() => void>();

export function getNarrationSettings(): NarrationSettings {
  if (typeof window === "undefined") return DEFAULTS;
  current ??= read();
  return current;
}

/** Drops the in-memory copy so the next read comes from storage (tests). */
export function reloadNarrationSettings(): void {
  current = null;
  listeners.forEach((listener) => listener());
}

export function setNarrationSettings(patch: Partial<NarrationSettings>): void {
  current = { ...getNarrationSettings(), ...patch };
  try {
    window.localStorage.setItem(NARRATION_STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Private mode or full storage: the choice lasts until the page closes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNarrationSettings(): NarrationSettings {
  return useSyncExternalStore(subscribe, getNarrationSettings, () => DEFAULTS);
}
