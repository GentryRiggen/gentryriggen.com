"use client";

import {
  pixelClass,
  retroSecondaryButtonClass,
} from "../game/retro/retroStyles";
import { applyNarrationRate } from "./player";
import {
  NARRATION_SPEEDS,
  setNarrationSettings,
  useNarrationSettings,
} from "./settings";

interface SpeedStepperProps {
  testId?: string;
  /** Larger speed label, for the Menu. */
  isLarge?: boolean;
}

/**
 * − / + a quarter at a time (0.75x to 2x) for the voice and the intro films.
 * The speed is one setting for the whole game, so the film and the Menu show
 * the same control; a change reaches the line speaking straight away.
 */
export default function SpeedStepper({
  testId,
  isLarge = false,
}: SpeedStepperProps) {
  const { rate } = useNarrationSettings();
  const step = (by: 1 | -1) => {
    const at = NARRATION_SPEEDS.indexOf(rate);
    const next =
      NARRATION_SPEEDS[
        Math.min(NARRATION_SPEEDS.length - 1, Math.max(0, at + by))
      ];
    if (next === undefined || next === rate) return;
    setNarrationSettings({ rate: next });
    applyNarrationRate();
  };
  return (
    <div
      role="group"
      aria-label="Speed"
      data-testid={testId}
      className="flex items-center gap-1"
    >
      <button
        type="button"
        aria-label="Slower"
        disabled={rate <= NARRATION_SPEEDS[0]}
        onClick={() => step(-1)}
        className={`${retroSecondaryButtonClass} !px-2 disabled:opacity-40`}
      >
        <span aria-hidden="true" className={pixelClass}>
          −
        </span>
      </button>
      <span
        aria-live="polite"
        className={`${pixelClass} min-w-10 text-center text-amber-200 ${
          isLarge ? "text-xs" : "text-[10px] sm:text-xs"
        }`}
      >
        {rate}×
      </span>
      <button
        type="button"
        aria-label="Faster"
        disabled={rate >= NARRATION_SPEEDS[NARRATION_SPEEDS.length - 1]}
        onClick={() => step(1)}
        className={`${retroSecondaryButtonClass} !px-2 disabled:opacity-40`}
      >
        <span aria-hidden="true" className={pixelClass}>
          +
        </span>
      </button>
    </div>
  );
}
