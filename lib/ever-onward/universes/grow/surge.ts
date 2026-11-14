import type { RunState } from "../../engine/types";
import { MANUAL_RESOURCES, carryOver } from "./resources";

const res = (run: RunState, id: string): number => run.resources[id] ?? 0;

/**
 * A farm payout that flows into the harvest over a few seconds instead of
 * landing as one lump. `prefix` names its two hidden resources
 * (`<prefix>Pending`, `<prefix>SurgeRate`).
 */
export function addSurge(
  run: RunState,
  prefix: string,
  harvest: number,
  seconds: number
): void {
  const r = run.resources;
  r[`${prefix}Pending`] = res(run, `${prefix}Pending`) + harvest;
  r[`${prefix}SurgeRate`] = r[`${prefix}Pending`] / seconds;
}

/**
 * Moves the payout that is still flowing into the harvest. Once the farm has
 * ended, whatever is left is settled at the farm-gate rate into the new
 * phase's own currency (as leftover seeds are when the farm opens).
 */
export function flowSurge(run: RunState, prefix: string, dt: number): void {
  const r = run.resources;
  const pending = res(run, `${prefix}Pending`);
  if (pending <= 0) return;
  if (run.phase !== 1) {
    const id = MANUAL_RESOURCES[run.phase];
    r[id] = res(run, id) + carryOver(1, pending);
    r[`${prefix}Pending`] = 0;
    return;
  }
  const flow = Math.min(pending, res(run, `${prefix}SurgeRate`) * dt);
  r[`${prefix}Pending`] = pending - flow;
  r.harvest = res(run, "harvest") + flow;
}
