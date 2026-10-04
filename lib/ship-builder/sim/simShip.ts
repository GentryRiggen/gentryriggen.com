import type { Stats } from "../model/stats";
import type { SimShip } from "./types";

/** The sim input for a ship, from its stats and hull width in cells. */
export function simShipFromStats(stats: Stats, beam: number): SimShip {
  return {
    stabilityRatio: stats.stabilityRatio,
    listAngle: stats.listAngle,
    beam,
  };
}
