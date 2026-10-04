export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Frames after a tab switch can be huge; cap them so nothing leaps. */
export const MAX_FRAME_DELTA = 0.1;
