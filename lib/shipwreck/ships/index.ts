import { britannic } from "./britannic";
import { fitzgerald } from "./fitzgerald";
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
export {
  fitzgerald,
  FITZGERALD_BOATS,
  FITZGERALD_CARGO_T,
  FITZGERALD_DECKS,
  FITZGERALD_HATCHES,
  FITZGERALD_TANK_Y,
  type FitzgeraldBoat,
  type FitzgeraldHatch,
} from "./fitzgerald";
export {
  britannic,
  BRITANNIC_BOATS,
  BRITANNIC_DECKS,
  type BritannicBoat,
} from "./britannic";

/** Every ship the game knows, in the order the title screen lists them. */
export const SHIP_IDS = [
  "titanic",
  "lusitania",
  "fitzgerald",
  "britannic",
] as const satisfies readonly ShipId[];
/** Every ShipId is in SHIP_IDS: this fails to compile if one is missing. */
const ALL_SHIP_IDS: [Exclude<ShipId, (typeof SHIP_IDS)[number]>] extends [never]
  ? true
  : never = true;
void ALL_SHIP_IDS;

/** Every ship the game knows, by id. */
export const SHIPS: Record<ShipId, ShipSpec> = {
  titanic,
  lusitania,
  fitzgerald,
  britannic,
};

export function getShip(id: ShipId): ShipSpec {
  return SHIPS[id];
}
