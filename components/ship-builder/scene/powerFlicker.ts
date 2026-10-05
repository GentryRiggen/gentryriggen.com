import type { PowerState, SimEvent } from "@/lib/ship-builder/sim/types";

/** Seconds per flicker slot; one dip fits in each, so dips stay under 3/s. */
const SLOT_SECONDS = 0.45;
/** Half-width in seconds of a dip (the lights are mostly dark for ~0.2 s). */
const DIP_HALF_WIDTH = 0.1;
/** Share of slots that hold a dip. */
const DIP_CHANCE = 0.8;
/** How dark a dip gets, and how far the lights sag between dips. */
const DIP_FLOOR = 0.05;
const SAG_FLOOR = 0.6;
const SAG_SECONDS = 4;
/** Seconds for the lights to die after the power fails. */
export const FADE_OUT_SECONDS = 0.3;
/** Reduced motion: one smooth dimming, never a flash. */
const CALM_FLOOR = 0.4;
const CALM_RAMP_SECONDS = 3;

/** A cheap deterministic hash of an integer to [0, 1). */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** The sim time of the first event of a kind, or null. */
export function eventTime(
  events: readonly SimEvent[],
  kind: SimEvent["kind"]
): number | null {
  return events.find((e) => e.kind === kind)?.at ?? null;
}

/**
 * How bright the ship's lights are, 0 to 1, from the sim's power state.
 * Flickering is a fixed function of time (no randomness, so scrubbing back
 * and forth shows the same flicker) with at most one dip per slot, which
 * keeps it below the 3 flashes a second photosensitive viewers are safe with.
 * Reduced motion swaps the flicker for a slow, smooth dimming.
 */
export function powerLevel(
  power: PowerState,
  time: number,
  flickerStartedAt: number | null,
  reducedMotion: boolean,
  /** Sim time the power went out, for a short fade instead of a cut. */
  outAt: number | null = null
): number {
  if (power === "on") return 1;
  const floor = reducedMotion ? CALM_FLOOR : SAG_FLOOR;
  if (power === "out") {
    if (outAt === null) return 0;
    return Math.max(0, 1 - (time - outAt) / FADE_OUT_SECONDS) * floor;
  }

  const elapsed = time - (flickerStartedAt ?? time);
  if (elapsed <= 0) return 1;
  if (reducedMotion) {
    return 1 - (1 - CALM_FLOOR) * Math.min(1, elapsed / CALM_RAMP_SECONDS);
  }

  const sag = 1 - (1 - SAG_FLOOR) * Math.min(1, elapsed / SAG_SECONDS);
  const slot = Math.floor(elapsed / SLOT_SECONDS);
  if (hash(slot) > DIP_CHANCE) return sag;
  const fromCentre = Math.abs(elapsed - (slot + 0.5) * SLOT_SECONDS);
  if (fromCentre >= DIP_HALF_WIDTH) return sag;
  // Steep-sided so a dip crosses the 0.5 mark once going down and once up.
  const depth = 1 - fromCentre / DIP_HALF_WIDTH;
  return sag - (sag - DIP_FLOOR) * Math.min(1, depth * 3);
}
