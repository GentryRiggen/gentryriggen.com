"use client";

import { getEscape, useEscape } from "@/lib/ship-builder/state/escapeLive";
import { createStoredSetting } from "./createStoredSetting";

export type TrialSpeed = 1 | 2 | 3 | 5 | 10 | 20;

export const TRIAL_SPEEDS: readonly TrialSpeed[] = [1, 2, 3, 5, 10, 20];

/** A stored value as a speed; anything unknown is 1x. */
export function parseTrialSpeed(raw: string | null): TrialSpeed {
  const value = Number(raw);
  return TRIAL_SPEEDS.find((speed) => speed === value) ?? 1;
}

export const trialSpeedSetting = createStoredSetting<TrialSpeed>({
  key: "ship-builder:ui:trial-speed",
  parse: parseTrialSpeed,
  serialize: (value) => String(value),
  fallback: 1,
});

interface TrialSpeedControl {
  speed: TrialSpeed;
  setSpeed: (next: TrialSpeed) => void;
  /**
   * The walker is swimming: the trial plays at 1x whatever was picked, since
   * swimming and the cold run on frame time.
   */
  isHeld: boolean;
}

/**
 * How fast the trial plays (1x up to 20x). Every new run (start, Try again,
 * replay) puts it back to 1x (the store's `beginTrial` and `replay`). Held
 * at 1x while the walker swims; the picked speed comes back after.
 */
export default function useTrialSpeed(): TrialSpeedControl {
  const picked = trialSpeedSetting.useValue();
  const isHeld = useEscape().phase.kind === "swimming";
  return {
    speed: isHeld ? 1 : picked,
    setSpeed: trialSpeedSetting.set,
    isHeld,
  };
}

/** The speed right now, for frame callbacks. */
export function getTrialSpeed(): TrialSpeed {
  if (getEscape().phase.kind === "swimming") return 1;
  return trialSpeedSetting.get();
}
