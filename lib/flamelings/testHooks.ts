import { resetClock, setNow, skip } from "./clock";
import type { FlamelingsStore } from "./store";
import type { Pet } from "./types";
import { useFlamelings } from "./store";
import { now } from "./clock";

import { TEST_HOOKS_ENABLED, createTestHooks } from "@/lib/game-kit/testHooks";

export { TEST_HOOKS_ENABLED };

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
  const remove = createTestHooks<NonNullable<Window["__flamelings"]>>(
    "__flamelings",
    {
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
            pets: save.pets.map((p, i) =>
              i === index ? { ...p, ...patch } : p
            ),
          },
        });
      },
    }
  );
  return () => {
    remove();
    resetClock();
  };
}
