import type { GameStore } from "./store";
import { useGameStore } from "./store";
import type { EndingKind, ToolId } from "./tools";

/**
 * Whether the page exposes its test hooks (the store on `window`). On in
 * development and in the e2e build (`NEXT_PUBLIC_E2E=1`), off in the build
 * that ships.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

declare global {
  interface Window {
    __planetSmasher?: {
      fire(toolId: ToolId, u: number, v: number): void;
      forceEnding(kind: EndingKind): void;
      state(): GameStore;
    };
  }
}

/** Puts the hooks on `window` when enabled. Returns a cleanup function. */
export function installTestHooks(): () => void {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return () => {};
  window.__planetSmasher = {
    fire(toolId, u, v) {
      useGameStore.getState().hit(toolId, u, v);
    },
    forceEnding(kind) {
      const { planet, hit } = useGameStore.getState();
      if (!planet) return;
      if (kind === "swallowed") {
        hit("blackHole", 0.5, 0.5);
        return;
      }
      // Make this family the clear leader with one point of health left.
      planet.familyDamage[kind] += 1e6;
      planet.health = 0.001;
      hit("asteroid", 0.5, 0.5);
    },
    state: () => useGameStore.getState(),
  };
  return () => {
    delete window.__planetSmasher;
  };
}
