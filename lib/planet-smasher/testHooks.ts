import type { GameStore } from "./store";
import { useGameStore } from "./store";
import { fxClock } from "./fxClock";
import { saveProgress } from "./progress";
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
      /** Like forceEnding, but the ending starts at once (no flight delay). */
      forceEndingNow(kind: EndingKind): void;
      state(): GameStore;
      /** Sets points to 5200 so every tool and planet is open. */
      unlockAll(): void;
      /** Effects started so far (taps the cooldown let through, and hook fires). */
      shots?: number;
      /** Lets effects take bigger frame steps (real-time pace in slow renderers). */
      setMaxFrameStep(seconds: number): void;
    };
  }
}

/** Puts the hooks on `window` when enabled. Returns a cleanup function. */
export function installTestHooks(
  /** What a tap does (hit plus painted scar); defaults to the bare store hit. */
  onFire?: (toolId: ToolId, u: number, v: number) => void
): () => void {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return () => {};
  window.__planetSmasher = {
    fire(toolId, u, v) {
      if (onFire) onFire(toolId, u, v);
      else useGameStore.getState().hit(toolId, u, v);
    },
    forceEnding(kind) {
      force(kind, true);
    },
    forceEndingNow(kind) {
      force(kind, false);
    },
    setMaxFrameStep(seconds) {
      fxClock.maxDt = seconds;
    },
    state: () => useGameStore.getState(),
    unlockAll() {
      const { progress } = useGameStore.getState();
      const next = { ...progress, points: Math.max(progress.points, 5200) };
      saveProgress(next);
      useGameStore.setState({ progress: next });
    },
  };
  return () => {
    delete window.__planetSmasher;
  };

  function force(kind: EndingKind, viaEffects: boolean) {
    const { planet } = useGameStore.getState();
    const hit = (id: ToolId, u: number, v: number) =>
      viaEffects && onFire
        ? onFire(id, u, v)
        : useGameStore.getState().hit(id, u, v);
    if (!planet) return;
    if (kind === "swallowed") {
      hit("blackHole", 0.5, 0.5);
      return;
    }
    // Make this family the clear leader with one point of health left.
    planet.familyDamage[kind] += 1e6;
    planet.health = 0.001;
    hit("asteroid", 0.5, 0.5);
  }
}
