import { resetClock, setNow, skip } from "./clock";
import type { FlamelingsStore } from "./store";
import type { Pet } from "./types";
import { useFlamelings } from "./store";
import { now } from "./clock";

/**
 * Whether the page exposes its test hooks. On in development and in the e2e
 * build (`NEXT_PUBLIC_E2E=1`), off in the build that ships.
 */
export const TEST_HOOKS_ENABLED =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_E2E === "1";

declare global {
  interface Window {
    __flamelings?: {
      /** Sets the game clock (ms since the epoch); real time flows on. */
      setNow(ms: number): void;
      /** Jumps the game clock forward. */
      skip(ms: number): void;
      now(): number;
      state(): FlamelingsStore;
      /** Overwrites fields of the pet at `index` (for setting up a scene). */
      patchPet(index: number, patch: Partial<Pet>): void;
    };
  }
}

/** Puts the hooks on `window` when enabled. Returns a cleanup function. */
export function installTestHooks(): () => void {
  if (!TEST_HOOKS_ENABLED || typeof window === "undefined") return () => {};
  window.__flamelings = {
    setNow(ms) {
      setNow(ms);
      useFlamelings.getState().tick();
    },
    skip(ms) {
      skip(ms);
      useFlamelings.getState().tick();
    },
    now,
    state: () => useFlamelings.getState(),
    patchPet(index, patch) {
      const { save } = useFlamelings.getState();
      useFlamelings.setState({
        save: {
          ...save,
          pets: save.pets.map((p, i) => (i === index ? { ...p, ...patch } : p)),
        },
      });
    },
  };
  return () => {
    delete window.__flamelings;
    resetClock();
  };
}
