/**
 * Keeps a full-screen overlay clear of the iPhone's status bar and notch
 * (top), the home bar (bottom) and the notch in landscape (sides). The page
 * runs edge to edge, so anything pinned to the top of the screen sits under
 * the clock and the battery unless it pads by `env(safe-area-inset-*)`.
 *
 * Every Ever Onward overlay (`fixed inset-0 z-50`) or top-pinned bar uses
 * this, or its own `env(safe-area-inset-top)` padding; a guard test in
 * `components/ever-onward/__tests__/safeArea.test.ts` checks.
 */
export const SAFE_INSETS =
  "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]";
