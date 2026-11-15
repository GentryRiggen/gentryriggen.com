import { useSyncExternalStore } from "react";
import type { Unlockable } from "@/lib/planet-smasher/unlocks";

/**
 * The unlock the UnlockToast is showing right now (null when none), so the
 * weapons tray can follow it. Session-only.
 */
let shown: Unlockable | null = null;
const listeners = new Set<() => void>();

export function setShownUnlock(item: Unlockable | null): void {
  if (shown === item) return;
  if (shown && item && shown.kind === item.kind && shown.id === item.id) return;
  shown = item;
  listeners.forEach((l) => l());
}

export function useShownUnlock(): Unlockable | null {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => shown,
    () => shown
  );
}
