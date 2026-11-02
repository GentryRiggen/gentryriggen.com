import type { RunState } from "../../engine/types";
import { forkCoolMult, forkHeatMult } from "./forks";
import { coolProjectMult, isParadeOn } from "./knowhow";
import { TUNING } from "./tuning";

/**
 * The cheer meter: the town and the world's managed risk. Every tap and every
 * parade warms it a little, and rest cools it. If it fills right up the crowd
 * is worn out and everything pays a little less (never nothing) until they
 * have rested. Benches and mask booths cool it faster. Nothing is lost, nobody
 * is punished: it is a gentle nudge to ease off before the cheering gets too
 * much, and the same hand that warms it can wait for it to cool.
 *
 * State is two hidden resources, `mtHeat` (0 to 1) and `mtTired` (0 or 1), so
 * a save from before reads as a cool meter.
 */

const M = TUNING.meter;

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;
const owned = (run: RunState, id: string): number => run.owned[id] ?? 0;

/** The meter runs in the town and the world. */
export const hasMeter = (run: RunState): boolean =>
  run.phase === 1 || run.phase === 2;

/** 0 (cool) to 1 (worn out). */
export const heatOf = (run: RunState): number =>
  hasMeter(run) ? Math.min(1, Math.max(0, res(run, "mtHeat"))) : 0;

export const isTired = (run: RunState): boolean =>
  hasMeter(run) && res(run, "mtTired") >= 1;

/** The multiplier of taps and helpers while worn out (1 otherwise). */
export const tiredMult = (run: RunState): number =>
  isTired(run) ? M.tiredMult : 1;

/** Benches in the town, mask booths in the world. */
export const coolLevels = (run: RunState): number =>
  run.phase === 1 ? owned(run, "bench") : owned(run, "mask-booth");

/** How quickly the crowd cools (a share of its heat lost each second). */
export const coolPerSecond = (run: RunState): number =>
  M.coolPerSecond *
  M.coolPerLevel ** coolLevels(run) *
  forkCoolMult(run) *
  coolProjectMult(run);

/** A tap warms the meter. */
export function heatByTap(run: RunState): void {
  if (!hasMeter(run)) return;
  setHeat(run, res(run, "mtHeat") + M.heatPerTap * forkHeatMult(run));
}

function setHeat(run: RunState, heat: number): void {
  const next = Math.min(1.2, Math.max(0, heat));
  run.resources.mtHeat = next;
  if (next >= M.tiredAt) run.resources.mtTired = 1;
  else if (next <= M.restedAt) run.resources.mtTired = 0;
}

/** Moves the meter for `dt` seconds: parades warm it, rest cools it. */
export function tickMeter(run: RunState, dt: number): void {
  if (!hasMeter(run)) {
    if (res(run, "mtHeat") !== 0 || res(run, "mtTired") !== 0) {
      run.resources.mtHeat = 0;
      run.resources.mtTired = 0;
    }
    return;
  }
  const warm = isParadeOn(run) ? M.paradeHeat * forkHeatMult(run) : 0;
  // Newton's cooling: the warmer the crowd, the faster it cools, so steady
  // tapping settles at a level instead of rising for ever.
  const heat = res(run, "mtHeat");
  setHeat(run, heat + (warm - coolPerSecond(run) * heat) * dt);
}

/** The meter's state in words, for the panel and the caption. */
export function meterLine(run: RunState): string {
  if (isTired(run))
    return "Everyone is worn out. Give them a rest and everything will pay less until they have cooled off.";
  const heat = heatOf(run);
  if (heat >= 0.7) return "Getting warm. Ease off a little, or take a rest.";
  if (heat >= 0.3) return "Warming up nicely.";
  return "Cool and happy.";
}

/** Quarter steps for the picture (0 to 4). */
export const meterQuarters = (run: RunState): number =>
  Math.round(heatOf(run) * 4);

/** The meter's heat with the crowd rested, for the income probes. */
export function withoutHeat(run: RunState): RunState {
  return {
    ...run,
    resources: { ...run.resources, mtHeat: 0, mtTired: 0 },
  };
}
