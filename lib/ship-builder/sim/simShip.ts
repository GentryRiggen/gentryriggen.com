import type { Stats } from "../model/stats";
import type { SimShip } from "./types";

/**
 * PLACEHOLDER: listAngle is 0 until stats track side-to-side balance. The
 * signature is the contract.
 */
export function simShipFromStats(stats: Stats, beam: number): SimShip {
  return { stabilityRatio: stats.stabilityRatio, listAngle: 0, beam };
}
