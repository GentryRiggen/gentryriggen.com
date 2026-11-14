import type { RunState } from "../../engine/types";
import { burnPerSecond, farePaid, goingRate, habitOilCost } from "./tick";
import { TOLL_STEPS, shipShare, tollPay } from "./toll";

/**
 * What the toll really earns. Every ship pays the toll times the fare, but
 * every ship that comes also burns the same oil whatever it paid: so a high
 * toll that turns ships away also saves the oil they would have burned.
 * That makes the best toll depend on what oil costs you as well as on the
 * rival's sign.
 */

/** Coins one ship pays at toll step `step`, per coin of fare (the going rate's fare, grown). */
const payAt = (run: RunState, step: number): number =>
  (farePaid(run) / tollPay(run)) * TOLL_STEPS[step].pay;

/** Coins the oil one ship burns costs (at what the tank's oil cost, whatever the toll). */
export const oilPerShipCoins = (run: RunState): number =>
  burnPerSecond(run, 1) * habitOilCost(run);

/**
 * Coins a ship-trip earns at toll step `step` once the traffic has settled:
 * the share that come, times what each pays after its oil.
 */
export const tollNet = (run: RunState, step: number): number =>
  shipShare(TOLL_STEPS[step].pay, goingRate(run)) *
  (payAt(run, step) - oilPerShipCoins(run));

/** The step that earns the most after the oil bill, now. */
export function bestTollStep(run: RunState): number {
  let best = 0;
  TOLL_STEPS.forEach((_, i) => {
    if (tollNet(run, i) > tollNet(run, best)) best = i;
  });
  return best;
}
