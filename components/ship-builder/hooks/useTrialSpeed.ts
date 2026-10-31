"use client";

import { createStoredSetting } from "./createStoredSetting";

export type TrialSpeed = 1 | 2 | 3;

export const TRIAL_SPEEDS: readonly TrialSpeed[] = [1, 2, 3];

export const trialSpeedSetting = createStoredSetting<TrialSpeed>({
  key: "ship-builder:ui:trial-speed",
  parse: (raw) => {
    const value = Number(raw);
    return value === 2 || value === 3 ? value : 1;
  },
  serialize: (value) => String(value),
  fallback: 1,
});

interface TrialSpeedControl {
  speed: TrialSpeed;
  setSpeed: (next: TrialSpeed) => void;
}

/** How fast trials play (1x, 2x or 3x), remembered per device. */
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
