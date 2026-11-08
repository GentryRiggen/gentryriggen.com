import { visitorHereFlag } from "../../engine/engine";
import type { RunState } from "../../engine/types";
import { tickDeliveries } from "./deliveries";
import { addToFooting, gainOf, savedShare, tickFooting } from "./footing";
import { grossIncome, grossTap } from "./income";
import { tickKnowhow } from "./knowhow";
import { stepDown } from "./descent";
import { res } from "./lines";
import { paceMult, tickPlayroom, wakeTower } from "./playroom";
import { MANUAL_RESOURCES, RETURN_VISITOR_ID } from "./resources";
import { swayFactor, tickSway } from "./sway";
import { tickTown, townPay, townTap } from "./town";

export { stacked } from "./income";

/**
 * What the site pays per second after the tower's lean and the footing, and
 * before the kept share is taken out.
 */
function netIncome(run: RunState): number {
  if (run.phase > 2) return grossIncome(run);
  return (
    grossIncome(run) *
    swayFactor(run) *
    paceMult(run) *
    townPay(run) *
    (1 + gainOf(run))
  );
}

/** What one tap pays after the footing, before the kept share is taken out. */
function netTap(run: RunState): number {
  return run.phase > 2
    ? grossTap(run)
    : grossTap(run) * paceMult(run) * townTap(run) * (1 + gainOf(run));
}

/** The phase's main resource per second from helpers alone (the kept share out). */
export const incomePerSecond = (run: RunState): number =>
  netIncome(run) * (1 - savedShare(run));

/** What one tap earns right now (the kept share out). */
export const manualPerTap = (run: RunState): number =>
  netTap(run) * (1 - savedShare(run));

/** What a second of building is worth: the helpers plus one tap. */
export const tendingValue = (run: RunState): number =>
  incomePerSecond(run) + manualPerTap(run);

function earn(run: RunState, amount: number): void {
  if (run.phase === 3) {
    stepDown(run, amount);
    return;
  }
  const key = MANUAL_RESOURCES[run.phase];
  run.resources[key] = res(run, key) + amount;
}

export function tickHigher(run: RunState, dt: number): void {
  if (run.phase <= 2) {
    tickTown(run, dt);
    tickSway(run, dt);
    tickPlayroom(run, dt);
    const kept = netIncome(run) * savedShare(run);
    earn(run, incomePerSecond(run) * dt);
    tickFooting(run, kept, dt);
  } else earn(run, incomePerSecond(run) * dt);
  tickKnowhow(run, dt);
  tickDeliveries(run, dt);
}

export function manualHigher(run: RunState): void {
  earn(run, manualPerTap(run));
  wakeTower(run);
  if (run.phase <= 2) addToFooting(run, netTap(run) * savedShare(run));
}

export const isHigherComplete = (run: RunState): boolean =>
  run.flags[visitorHereFlag(RETURN_VISITOR_ID)] === true;
