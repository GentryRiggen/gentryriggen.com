import { TEST_HOOKS_ENABLED, createTestHooks } from "@/lib/game-kit/testHooks";

export { TEST_HOOKS_ENABLED };

export type ShipwreckScreen = "title";

declare global {
  interface Window {
    __shipwreck?: {
      /** The screen the game is showing. Later tasks add more. */
      getScreen(): ShipwreckScreen;
    };
  }
}

/** Puts the hooks on `window` when enabled. Returns a cleanup function. */
export function installTestHooks(getScreen: () => ShipwreckScreen): () => void {
  return createTestHooks<NonNullable<Window["__shipwreck"]>>("__shipwreck", {
    getScreen,
  });
}
