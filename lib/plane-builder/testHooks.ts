/**
 * Whether the page exposes its test hooks (the store on `window`). On in
 * development and in the e2e build (`NEXT_PUBLIC_E2E=1`), off in the build
 * that ships.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

declare global {
  interface Window {
    /** Set by a visual test before the page loads; see `heldFlightSeconds`. */
    __PLANE_BUILDER_TEST__?: {
      holdFlightSeconds?: number;
      /** Pins the render quality level and turns adaptation off. */
      lockQuality?: number;
    };
  }
}

/**
 * Sim seconds at which a flight stops advancing (and coins stop spinning), so
 * a visual test can photograph one exact mid-flight frame. Undefined unless a
 * test asks for it, and always undefined in the build that ships.
 */
export function heldFlightSeconds(): number | undefined {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return undefined;
  return window.__PLANE_BUILDER_TEST__?.holdFlightSeconds;
}

/**
 * A render quality level a test pinned (0 is full quality), which also stops
 * the adaptive step-downs so screenshots do not depend on machine speed.
 */
export function lockedQuality(): number | undefined {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return undefined;
  return window.__PLANE_BUILDER_TEST__?.lockQuality;
}
