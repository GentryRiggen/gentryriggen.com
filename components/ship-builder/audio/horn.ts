import { trialSynth } from "./synth";

/** A horn blast takes this long (ms); another press inside it is ignored. */
export const HORN_COOLDOWN_MS = 1400;

let lastBlastAt = Number.NEGATIVE_INFINITY;

/** Blows the ship's horn unless it is still sounding. Returns whether it did. */
export function blowHorn(now: number = performance.now()): boolean {
  if (now - lastBlastAt < HORN_COOLDOWN_MS) return false;
  lastBlastAt = now;
  trialSynth.play({ kind: "horn" });
  return true;
}

/** Test-only: forgets the last blast. */
export function resetHorn(): void {
  lastBlastAt = Number.NEGATIVE_INFINITY;
}
