/**
 * When ambient occlusion should be given up on. Pure
 * decisions, kept apart from the render loop so they can be tested.
 */

/** Slow frames this soon after mount (shader compiles, first paint) are noise. */
export const AO_WARM_UP_MS = 5000;
/** Consecutive monitor declines (each spans ~2.5 s of frames) that count. */
export const AO_DECLINES_REQUIRED = 2;
/** A decline older than this no longer counts towards the streak. */
export const AO_DECLINE_STREAK_MS = 6000;

/**
 * Decides whether a performance decline should switch AO off. Declines are
 * ignored during a warm-up (after mount and after the tab comes back from
 * being hidden) and while the tab is hidden, and only a streak of them counts.
 */
export interface DeclineGate {
  /** Starts (or restarts) the warm-up at `now`. */
  restartWarmUp: (now: number) => void;
  /** Records a decline; true when AO should now be switched off. */
  noteDecline: (now: number, isHidden: boolean) => boolean;
  /** A healthy reading ends the streak. */
  noteIncline: () => void;
}

export function createDeclineGate(): DeclineGate {
  // Until the first restart the warm-up never ends, so nothing can latch.
  let warmUpEndsAt = Number.POSITIVE_INFINITY;
  let streak = 0;
  let lastDeclineAt = Number.NEGATIVE_INFINITY;

  return {
    restartWarmUp(now) {
      warmUpEndsAt = now + AO_WARM_UP_MS;
      streak = 0;
    },
    noteDecline(now, isHidden) {
      if (isHidden || now < warmUpEndsAt) {
        streak = 0;
        return false;
      }
      if (now - lastDeclineAt > AO_DECLINE_STREAK_MS) streak = 0;
      streak += 1;
      lastDeclineAt = now;
      return streak >= AO_DECLINES_REQUIRED;
    },
    noteIncline() {
      streak = 0;
    },
  };
}
