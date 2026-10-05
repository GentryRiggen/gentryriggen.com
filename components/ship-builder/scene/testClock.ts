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
  /**
   * Sea trial: jump the simulation to this many seconds and hold there (the
   * trial stays "running" so a screenshot can catch a mid-capsize pose). A
   * trial that finishes sooner still ends normally.
   */
  trialSeconds?: number;
  /** Sea trial: play this many times faster, so a whole trial takes moments. */
  trialSpeed?: number;
  /**
   * Ambient occlusion: true forces it on, false off, and either also stops
   * the performance monitor from switching it off. Unset leaves it to the
   * device.
   */
  ao?: boolean;
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

function finiteTestNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Seconds the test wants the sea trial held at, or null. */
export function testTrialSeconds(): number | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const seconds = finiteTestNumber(window.__SHIP_BUILDER_TEST__?.trialSeconds);
  return seconds !== null && seconds >= 0 ? seconds : null;
}

/** The sea trial playback speed multiplier; 1 when no test sets it. */
export function testTrialSpeed(): number {
  if (process.env.NODE_ENV === "production") return 1;
  if (typeof window === "undefined") return 1;
  const speed = finiteTestNumber(window.__SHIP_BUILDER_TEST__?.trialSpeed);
  return speed !== null && speed > 0 ? speed : 1;
}

/**
 * Whether the test wants ambient occlusion forced on (true) or off (false);
 * null leaves it to the device's performance, as in production.
 */
export function testAoOverride(): boolean | null {
  if (process.env.NODE_ENV === "production") return null;
  if (typeof window === "undefined") return null;
  const ao = window.__SHIP_BUILDER_TEST__?.ao;
  return typeof ao === "boolean" ? ao : null;
}
