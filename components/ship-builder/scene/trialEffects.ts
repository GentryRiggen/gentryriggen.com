import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { clamp } from "./animationMath";
import { lifePhase, slotNoise } from "./particles";
import { trialPlayback, type TrialPlayback } from "./trialPlayback";

/** A particle to draw: position, size and opacity. */
export interface Droplet {
  x: number;
  y: number;
  z: number;
  scale: number;
  alpha: number;
}

export function createDroplet(): Droplet {
  return { x: 0, y: 0, z: 0, scale: 0, alpha: 0 };
}

export interface HullBounds {
  halfLength: number;
  halfBeam: number;
}

export const TRIAL_BUBBLE_COUNT = 40;
export const SPLASH_DROPLET_COUNT = 28;
export const SPLASH_RING_COUNT = 24;
export const TRIAL_SPLASH_CAPACITY = SPLASH_DROPLET_COUNT + SPLASH_RING_COUNT;

const BUBBLE_LIFE = 2.4;
const BUBBLE_RAMP_SECONDS = 0.6;
const BUBBLE_FADE_SECONDS = 2.5;
const SPLASH_SECONDS = 1.6;
const SPLASH_STAGGER = 0.5;
const GRAVITY = 4.5;
const RING_SECONDS = 1.8;
const RING_SPEED = 2.5;

/** True once the running or finished trial has begun to go over. */
export function isCapsizing(): boolean {
  return (
    trialPlayback.capsizedAt !== null &&
    useShipBuilderStore.getState().trial.status !== "idle"
  );
}

/** 0 before the ship goes over, 1 while bubbles rise, fading after the end. */
export function bubbleIntensity(playback: TrialPlayback): number {
  if (playback.capsizedAt === null) return 0;
  const ramp = clamp(
    (playback.time - playback.capsizedAt) / BUBBLE_RAMP_SECONDS,
    0,
    1
  );
  if (playback.doneAt === null) return ramp;
  const fade = clamp(
    (playback.time - playback.doneAt) / BUBBLE_FADE_SECONDS,
    0,
    1
  );
  return ramp * (1 - fade);
}

/** One bubble rising through the water over the ship's footprint. */
export function trialBubble(
  slot: number,
  time: number,
  bounds: HullBounds,
  out: Droplet
): Droplet {
  const age = lifePhase(time, BUBBLE_LIFE, slot / TRIAL_BUBBLE_COUNT);
  out.x = slotNoise(slot, 11) * bounds.halfLength * 0.9;
  out.z =
    slotNoise(slot, 12) * bounds.halfBeam * 0.9 +
    Math.sin(age * 6 + slot) * 0.1;
  out.y = -1.2 + age * 1.4;
  out.scale = 0.12 + 0.1 * (slotNoise(slot, 13) + 1) * 0.5;
  out.alpha = 0.6 * Math.min(1, age / 0.1) * Math.min(1, (1 - age) / 0.3);
  return out;
}

/**
 * A droplet thrown up from the side that goes under, following a short arc.
 * `side` is -1 or 1 (the sign of the roll).
 */
export function splashDroplet(
  slot: number,
  seconds: number,
  side: number,
  bounds: HullBounds,
  out: Droplet
): Droplet {
  const t = seconds - (slot / SPLASH_DROPLET_COUNT) * SPLASH_STAGGER;
  const vy = 2.2 + (slotNoise(slot, 21) + 1) * 0.6;
  const height = vy * t - GRAVITY * t * t;
  const isFlying = t > 0 && height > 0;
  out.x =
    slotNoise(slot, 22) * bounds.halfLength * 0.8 + slotNoise(slot, 23) * t;
  out.z =
    side *
    (bounds.halfBeam +
      (0.6 + (slotNoise(slot, 24) + 1) * 0.3) * Math.max(0, t));
  out.y = isFlying ? height : 0;
  out.scale = 0.14;
  out.alpha = isFlying ? 0.8 * (1 - clamp(seconds / SPLASH_SECONDS, 0, 1)) : 0;
  return out;
}

/** One dot of the ring that spreads across the water as the ship goes under. */
export function splashRing(
  slot: number,
  seconds: number,
  bounds: HullBounds,
  out: Droplet
): Droplet {
  const angle = (slot / SPLASH_RING_COUNT) * Math.PI * 2;
  const spread = seconds * RING_SPEED;
  out.x = Math.cos(angle) * (bounds.halfLength * 0.7 + spread);
  out.z = Math.sin(angle) * (bounds.halfBeam + 0.3 + spread);
  out.y = 0.04;
  out.scale = 0.2;
  out.alpha =
    seconds < 0 || seconds > RING_SECONDS
      ? 0
      : 0.5 * (1 - seconds / RING_SECONDS);
  return out;
}
