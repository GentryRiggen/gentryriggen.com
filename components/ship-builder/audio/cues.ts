import type {
  PowerState,
  SimEvent,
  SimPhase,
} from "@/lib/ship-builder/sim/types";

/**
 * The part of the trial playback that decides what the player hears. Taking a
 * subset keeps `cuesFor` pure and easy to test.
 */
export interface PlaybackSnapshot {
  /** Sim seconds. */
  time: number;
  phase: SimPhase;
  strain: number;
  power: PowerState;
  events: readonly Pick<SimEvent, "kind">[];
  /** Playback rate (below 1 in slow-mo). */
  speed: number;
  scrubbing: boolean;
}

export type Cue =
  | { kind: "impact" }
  | { kind: "creak"; intensity: number }
  | { kind: "flicker" }
  | { kind: "power-out" }
  | { kind: "break" }
  | { kind: "gurgle" }
  | { kind: "touchdown" };

/** Sounds that run for as long as they are true, not one-shot cues. */
export interface AmbientParams {
  sea: boolean;
  hum: boolean;
}

/** Strain at which the hull groans as loudly as it can. */
export const STRAIN_FULL = 0.3;
/** Strain below which the hull is quiet. */
export const STRAIN_QUIET = 0.04;

const CREAK_SLOW_INTERVAL_S = 4.5;
const CREAK_FAST_INTERVAL_S = 0.9;
const FLICKER_INTERVAL_S = 0.22;
const GURGLE_INTERVAL_S = 1.7;
const UNDERWATER_MUFFLE = 0.85;
const SLOW_MO_MUFFLE = 0.55;

function countOf(events: PlaybackSnapshot["events"], kind: SimEvent["kind"]) {
  let count = 0;
  for (const event of events) if (event.kind === kind) count += 1;
  return count;
}

/** True when a fixed-period tick fell between the two times. */
function crossedTick(prev: number, next: number, interval: number) {
  return Math.floor(next / interval) > Math.floor(prev / interval);
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** 0 (just audible) to 1 (about to give way) from the bending strain. */
export function creakIntensity(strain: number): number {
  return clamp01((strain - STRAIN_QUIET) / (STRAIN_FULL - STRAIN_QUIET));
}

/**
 * The one-shot sounds to start as playback moves from `prev` to `next`.
 * Repeating sounds are paced by sim time (they come faster as strain rises)
 * so the result does not depend on the frame rate. Scrubbing and a replay
 * start (time going backwards) make no sound: the caller just resyncs.
 */
export function cuesFor(prev: PlaybackSnapshot, next: PlaybackSnapshot): Cue[] {
  if (next.scrubbing || prev.scrubbing || next.time < prev.time) return [];
  const cues: Cue[] = [];

  if (
    countOf(prev.events, "flooding") === 0 &&
    countOf(next.events, "flooding") > 0
  ) {
    cues.push({ kind: "impact" });
  }
  const hasBroken = countOf(next.events, "broke") > 0;
  if (hasBroken && countOf(prev.events, "broke") === 0) {
    cues.push({ kind: "break" });
  }
  if (countOf(next.events, "power-out") > countOf(prev.events, "power-out")) {
    cues.push({ kind: "power-out" });
  }
  const newBottoms =
    countOf(next.events, "touched-bottom") -
    countOf(prev.events, "touched-bottom");
  for (let i = 0; i < newBottoms; i += 1) cues.push({ kind: "touchdown" });

  const intensity = creakIntensity(next.strain);
  if (!hasBroken && intensity > 0) {
    const interval =
      CREAK_SLOW_INTERVAL_S -
      (CREAK_SLOW_INTERVAL_S - CREAK_FAST_INTERVAL_S) * intensity;
    if (crossedTick(prev.time, next.time, interval)) {
      cues.push({ kind: "creak", intensity });
    }
  }

  if (
    next.power === "flickering" &&
    crossedTick(prev.time, next.time, FLICKER_INTERVAL_S)
  ) {
    cues.push({ kind: "flicker" });
  }

  const isTakingWater =
    next.phase === "sinking" ||
    (next.phase === "sailing" && countOf(next.events, "flooding") > 0);
  if (isTakingWater && crossedTick(prev.time, next.time, GURGLE_INTERVAL_S)) {
    cues.push({ kind: "gurgle" });
  }
  return cues;
}

/** What should be droning right now. */
export function ambientFor(snapshot: PlaybackSnapshot): AmbientParams {
  return {
    sea: snapshot.phase !== "done",
    hum: snapshot.power === "on" && snapshot.phase !== "done",
  };
}

/**
 * How muffled everything should be (0 clear, 1 muffled): heavy under the
 * surface, and a softer fog in slow motion.
 */
export function muffleFor(cameraY: number, speed: number): number {
  const underwater = cameraY < 0 ? UNDERWATER_MUFFLE : 0;
  const slowness = clamp01((1 - speed) / 0.75);
  return Math.max(underwater, slowness * SLOW_MO_MUFFLE);
}
