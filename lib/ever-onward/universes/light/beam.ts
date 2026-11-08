import type { ActionDef, RunState } from "../../engine/types";
import { PHASE_COAST } from "./resources";
import {
  beamAt,
  beamPay,
  beamStep,
  burnAtStep,
  autoFlashRate,
  calmIncomePerSecond,
  isBeamOpen,
  marketOilPrice,
  setBeam,
  shipsPerFlash,
} from "./tick";
import { TUNING } from "./tuning";

/**
 * The coast's one knob: how bright the lamp burns. Brighter guides more
 * ships but burns even more oil, so the right step moves with what oil
 * costs at the market (not a tanker's one-off deal, which is over in a
 * minute). Nothing is ever lost; every step is a fair choice.
 */

export const BEAM_STEPS = TUNING.coast.beam.steps;

export const beamActionId = (step: number): string => `lamp-${step}`;
export const BEAM_ACTION_IDS: readonly string[] = BEAM_STEPS.map((_, i) =>
  beamActionId(i)
);

export interface BeamNumbers {
  /** Coins a second after the oil bill (calm night, taps at 3 a second). */
  net: number;
  /** Seconds the tank would last at this step (Infinity with no burn). */
  tankSeconds: number;
}

/** What the lamp would do at `step`, from today's keepers, oil and price. */
export function beamNumbers(run: RunState, step: number): BeamNumbers {
  const gross = (calmIncomePerSecond(run) * beamAt(step).pay) / beamPay(run);
  // The keepers' flashes and three of yours a second (the same pace as the income).
  const burn = burnAtStep(
    run,
    autoFlashRate(run) + TUNING.coast.tankTapsPerSecond * shipsPerFlash(run),
    step
  );
  const oil = run.resources.oil ?? 0;
  return {
    net: gross - burn * marketOilPrice(run),
    tankSeconds: burn > 0 ? oil / burn : Infinity,
  };
}

/** The step that earns the most after the oil bill right now. */
export function bestBeamStep(run: RunState): number {
  let best = beamStep(run);
  let bestNet = beamNumbers(run, best).net;
  BEAM_STEPS.forEach((_, i) => {
    const { net } = beamNumbers(run, i);
    if (net > bestNet + 1e-9) {
      best = i;
      bestNet = net;
    }
  });
  return best;
}

/** "0:40", "2:05", or "a long time" when the lamp burns next to nothing. */
export function clock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds >= 3600) return "a long time";
  const whole = Math.max(0, Math.floor(seconds));
  const secs = String(whole % 60).padStart(2, "0");
  return `${Math.floor(whole / 60)}:${secs}`;
}

/** One radio button per step; the lamp panel draws them itself. */
export const BEAM_ACTIONS: readonly ActionDef[] = BEAM_STEPS.map((step, i) => ({
  id: beamActionId(i),
  phases: [PHASE_COAST],
  isInline: true,
  visibleWhen: isBeamOpen,
  describe: (run) => ({
    label: step.label,
    detail: `Ships x${step.pay} · oil x${step.burn}`,
    isBlocked: beamStep(run) === i,
  }),
  perform: (run) => setBeam(run, i),
}));
