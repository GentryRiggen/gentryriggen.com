/**
 * A frozen scene clock for visual tests. An e2e test sets
 * `window.__SHIP_BUILDER_TEST__ = { freezeTime: 3 }` before the page loads and
 * every animation then shows the scene exactly as it looks at that moment:
 * the sea, bob, clouds, smoke and spinners read the fixed time, while pop-ins
 * and look changes finish at once. Without the flag nothing changes, and
 * production builds never read it.
 */

export interface ShipBuilderTestConfig {
  /** Seconds of scene time every animation should show. */
  freezeTime?: number;
}

declare global {
  interface Window {
    __SHIP_BUILDER_TEST__?: ShipBuilderTestConfig;
  }
}

/** A frame step long enough to finish any fade or ease in one frame. */
export const FROZEN_STEP = 10;

/** The fixed scene time, or null when the clock runs normally. */
export function frozenTime(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const time = window.__SHIP_BUILDER_TEST__?.freezeTime;
  return typeof time === "number" && Number.isFinite(time) ? time : null;
}

/** The time animations should show: the frozen time, else the live clock. */
export function sceneTime(liveSeconds: number): number {
  return frozenTime() ?? liveSeconds;
}
