import type { RunState } from "../../engine/types";
import { SIZE_NAMES, lastBurn, lastSaved } from "./sunEdge";

/** The running log's lines for the sky's moments, in plain words. */

const pct = (share: number): string => `${Math.round(share * 100)}%`;

export function flareLine(run: RunState): string | null {
  if ((run.resources.skFlares ?? 0) <= 0) return null;
  const size = SIZE_NAMES[Math.round(run.resources.skHitSize ?? 0)] ?? "small";
  const burned = lastBurn(run);
  const saved = lastSaved(run);
  if (burned < 0.005)
    return `A ${size} flare swept past. The fleet was out of its reach.`;
  const shielded =
    saved >= 0.05 ? ` The shields kept ${pct(saved)} of the fleet safe.` : "";
  return `A ${size} flare burned ${pct(burned)} of the fleet.${shielded}`;
}

export const wildLine = (): string =>
  "Some of the copies went wild! They are keeping their light for themselves.";

export const homeLine = (): string =>
  "The wild probes came home. They have missed you.";
