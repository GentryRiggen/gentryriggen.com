import { FLOOR_DEPTH } from "@/lib/ship-builder/sim/descent";
import { PLUNGE_DEPTH } from "@/lib/ship-builder/sim/flooding";
import type { HalfPose } from "@/lib/ship-builder/sim/types";
import { clamp } from "./animationMath";
import { lifePhase, slotNoise } from "./particles";
import type { Droplet } from "./trialEffects";
import type { TrialPlayback } from "./trialPlayback";

export const BUBBLES_PER_BODY = 18;
export const SILT_PER_PUFF = 24;
/** A whole ship lands once; a broken one lands as two halves. */
export const MAX_BODIES = 2;
export const DESCENT_BUBBLE_CAPACITY = BUBBLES_PER_BODY * MAX_BODIES;
export const DESCENT_SILT_CAPACITY = SILT_PER_PUFF * MAX_BODIES;

export const SILT_SECONDS = 3;
const SILT_SPREAD = 4.5;
const BUBBLE_LIFE = 2.2;
const BUBBLE_RISE = 3;
/** Bubbles fade out once a body is within this of the sand. */
const LANDED_MARGIN = 0.5;

/** The middle of one drifting body, in world space. */
export interface BodyPoint {
  x: number;
  y: number;
  /** Half the body's length, for spreading its bubbles along it. */
  halfSpan: number;
}

export function createBodyPoint(): BodyPoint {
  return { x: 0, y: 0, halfSpan: 0 };
}

/**
 * Fills `out` with each body's centre and returns how many there are: the
 * whole ship, or the bow and stern halves once she has broken. Uses the
 * half-pose placement from the sim contract, applied to the half's mid cell.
 */
export function descentBodies(
  playback: TrialPlayback,
  lengthCells: number,
  out: BodyPoint[]
): number {
  const { halves, breakup } = playback;
  if (!halves || !breakup) {
    out[0].x = 0;
    out[0].y = -playback.sink;
    out[0].halfSpan = lengthCells / 2;
    return 1;
  }
  // Cells run from the bow (0) to the stern (length); world x is length / 2 - x.
  const bowMid = lengthCells / 2 - breakup.atX / 2;
  const sternMid = -breakup.atX / 2;
  placeHalf(halves.bow, bowMid, lengthCells, out[0]);
  out[0].halfSpan = breakup.atX / 2;
  placeHalf(halves.stern, sternMid, lengthCells, out[1]);
  out[1].halfSpan = (lengthCells - breakup.atX) / 2;
  return 2;
}

function placeHalf(
  half: HalfPose,
  localX: number,
  lengthCells: number,
  out: BodyPoint
) {
  const pivot = lengthCells / 2 - half.pivotX;
  const offset = localX - pivot;
  out.x = half.driftX + pivot + offset * Math.cos(half.pitch);
  out.y = -half.sink + offset * Math.sin(half.pitch);
}

/** How far down the deepest body has got. */
function deepestSink(playback: TrialPlayback): number {
  const { halves } = playback;
  if (!halves) return playback.sink;
  return Math.max(halves.bow.sink, halves.stern.sink);
}

/**
 * True once the sea floor is worth drawing: the ship is going down the long
 * way, or has sunk well past the surface. Building and floating stay free.
 */
export function isFloorNeeded(playback: TrialPlayback): boolean {
  return (
    playback.phase === "descending" ||
    deepestSink(playback) > PLUNGE_DEPTH * 0.5
  );
}

/** One bubble in a body's trail, rising above it and fading as it goes. */
export function descentBubble(
  slot: number,
  time: number,
  body: BodyPoint,
  out: Droplet
): Droplet {
  const age = lifePhase(time, BUBBLE_LIFE, slot / BUBBLES_PER_BODY);
  out.x = body.x + slotNoise(slot, 31) * body.halfSpan * 0.8;
  out.z = slotNoise(slot, 32) * 1.2 + Math.sin(age * 6 + slot) * 0.15;
  out.y = Math.min(-0.3, body.y + age * BUBBLE_RISE);
  out.scale = 0.14 + 0.1 * (slotNoise(slot, 33) + 1) * 0.5;
  out.alpha = 0.6 * Math.min(1, age / 0.1) * Math.min(1, (1 - age) / 0.3);
  return out;
}

/** Seconds the bubble trails take to fade once the descent is over. */
export const TRAIL_FADE_SECONDS = 1;

/** How much of the trails still shows `seconds` after the descent ended. */
export function trailFade(seconds: number): number {
  return clamp(1 - seconds / TRAIL_FADE_SECONDS, 0, 1);
}

/** 1 while a body is falling, easing to 0 as it settles on the sand. */
export function trailIntensity(body: BodyPoint): number {
  const height = body.y + FLOOR_DEPTH;
  return clamp((height - LANDED_MARGIN) / 2, 0, 1);
}

/**
 * One grain of a silt puff `seconds` after the body touched down: it spreads
 * out along the sand, lifts a little, then settles as it fades. Before the
 * touch (negative seconds) and after SILT_SECONDS it is invisible.
 */
export function siltGrain(
  slot: number,
  seconds: number,
  landingX: number,
  out: Droplet
): Droplet {
  const t = clamp(seconds / SILT_SECONDS, 0, 1);
  const angle = (slot / SILT_PER_PUFF) * Math.PI * 2 + slotNoise(slot, 41);
  const reach = SILT_SPREAD * (0.5 + (slotNoise(slot, 42) + 1) * 0.35);
  // Ease out: a quick burst, then it hangs.
  const spread = reach * (1 - (1 - t) * (1 - t));
  const lift = Math.sin(t * Math.PI) * (0.8 + slotNoise(slot, 43) * 0.3);
  out.x = landingX + Math.cos(angle) * spread;
  out.z = Math.sin(angle) * spread;
  out.y = -FLOOR_DEPTH + 0.3 + lift;
  out.scale = 0.9 + t * 1.6;
  const isLive = seconds >= 0 && seconds <= SILT_SECONDS;
  out.alpha = isLive ? 0.45 * Math.min(1, t / 0.08) * (1 - t) : 0;
  return out;
}

/** A body's landing: whether and when it touched down, and where. */
export interface Landing {
  hasLanded: boolean;
  at: number;
  x: number;
}

/**
 * Each body's `touched-bottom` so far, in that body's slot (the whole ship or
 * the bow is body 0, the stern body 1), with the world x where it landed, so
 * a puff keeps its slot whichever half lands first. Positions are the bodies'
 * current x, which stops changing once they rest. Fills `out[0..bodyCount)`.
 */
export function landings(
  playback: TrialPlayback,
  bodies: readonly BodyPoint[],
  bodyCount: number,
  out: Landing[]
): void {
  for (let i = 0; i < bodyCount; i++) out[i].hasLanded = false;
  for (const event of playback.events) {
    if (event.kind !== "touched-bottom" || event.at > playback.time) continue;
    const index = event.body === "stern" ? 1 : 0;
    if (index >= bodyCount || out[index].hasLanded) continue;
    out[index].hasLanded = true;
    out[index].at = event.at;
    out[index].x = bodies[index].x;
  }
}

/**
 * How much of the deep-water look to mix in for a camera at height `y`:
 * 0 at or above the surface, 1 at the sea floor.
 */
export function underwaterBlend(y: number): number {
  return clamp(-y / FLOOR_DEPTH, 0, 1);
}
