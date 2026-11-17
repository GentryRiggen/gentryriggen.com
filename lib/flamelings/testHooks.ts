import { resetClock, setNow, skip } from "./clock";
import type { FlamelingsStore } from "./store";
import type { Pet } from "./types";
import { useFlamelings } from "./store";
import { forcedHappening, type HappeningKind } from "./happenings";
import { now } from "./clock";
import { resetPlayTuning, tunePlay, playTuning } from "./playTuning";

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
      /** Puts a fresh happening of `kind` on the pet at `index` for this window. */
      forceHappening(
        kind: HappeningKind,
        index?: number,
        variant?: string
      ): void;
      /** Marks every pet's happening for this window as done (no intro cards). */
      quietHappenings(): void;
      /**
       * Scales the mini-games' speed: `toast` above 1 toasts faster, `logs`
       * near 0 holds the swinging log still (so a tap lands dead on).
       */
      tunePlay(speeds: Partial<typeof playTuning>): void;
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
      quietHappenings() {
        const { save } = useFlamelings.getState();
        const done = {
          ...forcedHappening("visitor", now()),
          done: true,
          seen: true,
        };
        useFlamelings.setState({
          save: {
            ...save,
            pets: save.pets.map((p) => ({ ...p, happening: done })),
          },
        });
        useFlamelings.getState().tick();
      },
      forceHappening(kind, index = 0, variant) {
        const { save } = useFlamelings.getState();
        const happening = forcedHappening(kind, now(), variant);
        useFlamelings.setState({
          save: {
            ...save,
            pets: save.pets.map((p, i) =>
              i === index ? { ...p, happening } : p
            ),
          },
        });
        // Settling saves it, so a reload shows the same happening.
        useFlamelings.getState().tick();
      },
      tunePlay: tunePlay,
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
    resetPlayTuning();
  };
}
