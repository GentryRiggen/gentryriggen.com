import { lusitania } from "./lusitania";
import { titanic } from "./titanic";
import type { ShipId, ShipSpec } from "./types";

export type * from "./types";
export { titanic, TITANIC_BOATS } from "./titanic";
export {
  lusitania,
  LUSITANIA_BOATS,
  LUSITANIA_DECKS,
  type LusitaniaBoat,
} from "./lusitania";

/** Every ship the game knows, in the order the title screen lists them. */
export const SHIP_IDS = ["titanic", "lusitania"] as const;

/** Every ship the game knows, by id. */
export const SHIPS: Record<ShipId, ShipSpec> = { titanic, lusitania };

export function getShip(id: ShipId): ShipSpec {
  return SHIPS[id];
}
