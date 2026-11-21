import { titanic } from "./titanic";
import type { ShipId, ShipSpec } from "./types";

export type * from "./types";
export { titanic, TITANIC_BOATS } from "./titanic";

/**
 * Every ship the game knows, by id.
 * TODO(Shipwreck 1.1 Task 2): add the Lusitania and drop this cast.
 */
export const SHIPS = { titanic } as Record<ShipId, ShipSpec>;

export function getShip(id: ShipId): ShipSpec {
  return SHIPS[id];
}
