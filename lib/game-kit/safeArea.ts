/**
 * Keeps a full-screen overlay clear of the iPhone's status bar and notch
 * (top), the home bar (bottom) and the notch in landscape (sides). A game
 * runs edge to edge (viewport-fit cover), so anything pinned to an edge sits
 * under the clock, the battery or the home bar unless it pads by
 * `env(safe-area-inset-*)`.
 *
 * Every `fixed inset-0` overlay or edge-pinned bar uses one of these (or its
 * own `env(safe-area-inset-*)`); lib/game-kit/__tests__/safeAreaGuard.test.ts
 * scans every game listed in GAME_DIRS.
 */
export const SAFE_INSETS =
  "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]";

/** At least 0.75rem at the top, more under a notch. */
export const SAFE_TOP = "pt-[max(0.75rem,env(safe-area-inset-top))]";
export const SAFE_BOTTOM = "pb-[max(0.75rem,env(safe-area-inset-bottom))]";
/** At least 1rem on the sides, more beside a landscape notch. */
export const SAFE_SIDES =
  "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]";
