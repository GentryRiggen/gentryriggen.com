import { useSyncExternalStore } from "react";
import type { Unlockable } from "@/lib/planet-smasher/unlocks";

/**
 * Items unlocked this session that haven't been tapped yet (their tile
 * pulses). Session-only on purpose.
 */
let fresh: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

const key = (u: Unlockable) => `${u.kind}:${u.id}`;
const emit = () => listeners.forEach((l) => l());

export function markFresh(items: Unlockable[]): void {
  if (!items.length) return;
  fresh = new Set([...fresh, ...items.map(key)]);
  emit();
}

export function clearFresh(item: Unlockable): void {
  if (!fresh.has(key(item))) return;
  const next = new Set(fresh);
  next.delete(key(item));
  fresh = next;
  emit();
}

export function resetFresh(): void {
  fresh = new Set();
  emit();
}

export function useFreshItems(): ReadonlySet<string> {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => fresh,
    () => fresh
  );
}

export const freshKey = key;
