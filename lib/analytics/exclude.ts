import type { KeyValueStorage } from "./storage";

const KEY = "analytics-exclude";

/** Set when the owner signs in to /admin, so their own visits go uncounted. */
export function setExcluded(storage: KeyValueStorage | null): void {
  try {
    storage?.setItem(KEY, "1");
  } catch {
    // Storage blocked: nothing to do.
  }
}

export function isExcluded(storage: KeyValueStorage | null): boolean {
  try {
    return storage?.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
