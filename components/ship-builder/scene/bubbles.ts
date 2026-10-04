import { MAX_REV_PER_SEC } from "./spin";

export const BUBBLE_LIFE = 2;
export const BUBBLES_PER_PROPELLER = 12;
export const BUBBLE_MAX = 200;

const STREAM_SPEED = 1.5;
const RISE = 1.6;
const PEAK_ALPHA = 0.55;
const FADE_IN = 0.1;
const FADE_OUT = 0.4;

export interface BubbleState {
  /** Distance aft (world -X) of the propeller. */
  aft: number;
  rise: number;
  scale: number;
  alpha: number;
}

export function createBubbleState(): BubbleState {
  return { aft: 0, rise: 0, scale: 0, alpha: 0 };
}

/**
 * A bubble at `age` (0 to 1 of its life): streams aft faster behind a faster
 * propeller, drifts up with increasing buoyancy, and fades in and out.
 */
export function bubbleState(
  age: number,
  revPerSec: number,
  out: BubbleState
): BubbleState {
  const pace = 0.4 + 0.6 * Math.min(1, revPerSec / MAX_REV_PER_SEC);
  out.aft = STREAM_SPEED * pace * BUBBLE_LIFE * age;
  out.rise = RISE * age * age;
  out.scale = 0.08 + 0.06 * (1 - age);
  out.alpha =
    PEAK_ALPHA * Math.min(1, age / FADE_IN) * Math.min(1, (1 - age) / FADE_OUT);
  return out;
}

/** Total live bubbles wanted for these propellers, capped. */
export function bubbleCapacity(propellers: number): number {
  return Math.min(BUBBLE_MAX, propellers * BUBBLES_PER_PROPELLER);
}
