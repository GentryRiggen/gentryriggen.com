import { newRun } from "./engine";
import type { CutsceneShowcase, RunState, UniverseDef } from "./types";

/**
 * A throwaway run for a cutscene's picture: the phase as it opens, dressed
 * with the showcase. It is never saved or ticked.
 */
export function showcaseRun(
  def: UniverseDef,
  phaseIndex: number,
  showcase?: CutsceneShowcase
): RunState {
  const run = newRun(def);
  run.phase = phaseIndex;
  def.phases[phaseIndex]?.onEnter?.(run);
  run.time = showcase?.time ?? 0;
  Object.assign(run.owned, showcase?.owned);
  Object.assign(run.resources, showcase?.resources);
  return run;
}

/** The showcase in force at a frame: the latest one set at or before it. */
export function showcaseAt(
  frames: readonly { showcase?: CutsceneShowcase }[],
  index: number
): CutsceneShowcase | undefined {
  for (let i = Math.min(index, frames.length - 1); i >= 0; i -= 1) {
    if (frames[i].showcase) return frames[i].showcase;
  }
  return undefined;
}
