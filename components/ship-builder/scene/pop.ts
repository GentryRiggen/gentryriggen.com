import { clamp } from "./animationMath";

export const POP_DURATION = 0.25;
const START_SCALE = 0.6;
const OVERSHOOT = 1.70158;

/** Scale from 0.6 up to 1 with a small overshoot, settling on exactly 1. */
export function popScale(elapsedSeconds: number): number {
  const q = clamp(elapsedSeconds / POP_DURATION, 0, 1) - 1;
  // easeOutBack: 0 at the start, a little over 1 near the end, 1 at the end.
  const eased = 1 + (OVERSHOOT + 1) * q * q * q + OVERSHOOT * q * q;
  return START_SCALE + (1 - START_SCALE) * eased;
}

/**
 * The id of the one part that appeared between two part lists, or null when
 * none or several did (a loaded ship, an undo or redo of a batch), so only a
 * part the player placed pops.
 */
export function singleAddedId(
  previous: readonly { id: string }[],
  next: readonly { id: string }[]
): string | null {
  const known = new Set(previous.map((part) => part.id));
  let added: string | null = null;
  for (const part of next) {
    if (known.has(part.id)) continue;
    if (added !== null) return null;
    added = part.id;
  }
  return added;
}
