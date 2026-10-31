"use client";

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
}

/** How fast trials play (1x up to 20x), remembered per device. */
export default function useTrialSpeed(): TrialSpeedControl {
  return {
    speed: trialSpeedSetting.useValue(),
    setSpeed: trialSpeedSetting.set,
  };
}

/** The speed right now, for frame callbacks. */
export function getTrialSpeed(): TrialSpeed {
  return trialSpeedSetting.get();
}
