import { isExcluded } from "@/lib/analytics/exclude";
import { safeLocalStorage } from "@/lib/analytics/storage";

/**
 * Test mode is for the owner: a browser that has signed in to /admin (the
 * same mark that keeps their visits out of the analytics).
 */
export function isTester(): boolean {
  if (typeof window === "undefined") return false;
  return isExcluded(safeLocalStorage());
}

/** How fast the clock runs in a test run. */
export const TEST_SPEEDS = [1, 5, 20] as const;
export type TestSpeed = (typeof TEST_SPEEDS)[number];
