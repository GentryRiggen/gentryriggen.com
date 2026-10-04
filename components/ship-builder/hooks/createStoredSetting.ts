import { useSyncExternalStore } from "react";

interface StoredSettingOptions<T> {
  /** localStorage key. */
  key: string;
  /** Turns the stored text (null when absent) into a value; must not throw. */
  parse: (raw: string | null) => T;
  /** Text to store for a value, or null to remove the key. */
  serialize: (value: T) => string | null;
  /** Value on the server, before hydration, and when nothing is stored. */
  fallback: T;
}

export interface StoredSetting<T> {
  /** React hook returning the current value; re-renders on any change. */
  useValue: () => T;
  /** Current value, for event handlers and external-store consumers. */
  get: () => T;
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
  getServerSnapshot: () => T;
  /** Test-only: forget the in-memory value and fall back to storage. */
  resetMemory: () => void;
}

/**
 * A per-device setting kept in localStorage and shared between every component
 * and tab (via the `storage` event) through useSyncExternalStore.
 *
 * - The server snapshot is `fallback`.
 * - A write that throws makes the in-memory value authoritative, since reads
 *   may still work but would return the stale stored value.
 * - Snapshots are stable: the parsed value is cached per raw text, so
 *   object-valued settings don't make useSyncExternalStore loop.
 */
export function createStoredSetting<T>({
  key,
  parse,
  serialize,
  fallback,
}: StoredSettingOptions<T>): StoredSetting<T> {
  const listeners = new Set<() => void>();
  // Kept current on every write, so a read that later throws falls back to
  // the latest value rather than a stale one.
  let memoryValue = fallback;
  let isMemoryAuthoritative = false;
  let cache: { raw: string | null; value: T } | undefined;

  function get(): T {
    if (isMemoryAuthoritative) return memoryValue;
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return memoryValue;
    }
    if (cache === undefined || cache.raw !== raw) {
      cache = { raw, value: parse(raw) };
    }
    return cache.value;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    window.addEventListener("storage", listener);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", listener);
    };
  }

  function notify(): void {
    listeners.forEach((listener) => listener());
  }

  function set(next: T): void {
    memoryValue = next;
    try {
      const text = serialize(next);
      if (text === null) window.localStorage.removeItem(key);
      else window.localStorage.setItem(key, text);
      isMemoryAuthoritative = false;
    } catch {
      isMemoryAuthoritative = true;
    }
    notify();
  }

  function getServerSnapshot(): T {
    return fallback;
  }

  function resetMemory(): void {
    memoryValue = fallback;
    isMemoryAuthoritative = false;
    notify();
  }

  return {
    useValue: () => useSyncExternalStore(subscribe, get, getServerSnapshot),
    get,
    set,
    subscribe,
    getServerSnapshot,
    resetMemory,
  };
}
