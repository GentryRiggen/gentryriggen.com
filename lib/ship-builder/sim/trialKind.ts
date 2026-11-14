import type { BreakMode, CompartmentSpec, TrialInput } from "./types";

/**
 * Which sea trial an input describes: the Level 1 waves trial, the storm
 * (wild sea, water over the deck until she sinks), the iceberg or Boom!
 * (bombs dropped on her, one hole each).
 */
export type TrialKind = "waves" | "storm" | "iceberg" | "boom";

export function trialKindOf(input: TrialInput): TrialKind {
  if (input.iceberg) return "iceberg";
  if (input.storm) return "storm";
  if (input.boom) return "boom";
  return "waves";
}

/** The hull the flooding steps work on, from either kind of flooding trial. */
export interface FloodSpec {
  compartments: CompartmentSpec[];
  /** Hull length in cells. */
  length: number;
  breakMode: BreakMode;
}

/**
 * The compartments, length and break mode of a trial that floods (iceberg,
 * storm or Boom!), or null for a waves trial. `breakMode` defaults to `real`.
 */
export function floodOf(input: TrialInput): FloodSpec | null {
  const source = input.iceberg ?? input.storm ?? input.boom;
  if (!source) return null;
  return {
    compartments: source.compartments,
    length: source.length,
    breakMode: source.breakMode ?? "real",
  };
}

/**
 * Trials that are worked out ahead as a timeline (scrubbing, replay, the
 * story clock): the iceberg and the storm.
 */
export function isTimelineTrial(input: TrialInput): boolean {
  return trialKindOf(input) !== "waves";
}
