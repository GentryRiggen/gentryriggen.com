import { titanic } from "./titanic";
import type { ShipId, ShipSpec } from "./types";

export type * from "./types";
export { titanic, TITANIC_BOATS } from "./titanic";

/** Every ship the game knows, by id. */
export const SHIPS: Record<ShipId, ShipSpec> = { titanic };

export function getShip(id: ShipId): ShipSpec {
  return SHIPS[id];
}
