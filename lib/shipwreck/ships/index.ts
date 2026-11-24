import { britannic } from "./britannic";
import { carpathia } from "./carpathia";
import { concordia } from "./concordia";
import { fitzgerald } from "./fitzgerald";
import { lusitania } from "./lusitania";
import { poseidon } from "./poseidon";
import { titanic } from "./titanic";
import type { ShipId, ShipSpec } from "./types";

export type * from "./types";
export { titanic, TITANIC_BOATS } from "./titanic";
export {
  lusitania,
  LUSITANIA_BOATS,
  LUSITANIA_DECKS,
  LUSITANIA_LIVERIES,
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
  carpathia,
  CARPATHIA_AFTER_DECK,
  CARPATHIA_BOAT_DECK,
  CARPATHIA_BOAT_PLATFORM,
  CARPATHIA_BOATS,
  CARPATHIA_BRIDGE_DECK,
  CARPATHIA_BRIDGE_HOUSE,
  CARPATHIA_DECKS,
  CARPATHIA_FUNNEL_PAINT,
  CARPATHIA_FUNNEL_PAINTS,
  CARPATHIA_HIT_T,
  CARPATHIA_LIVERIES,
  CARPATHIA_MASTS,
  CARPATHIA_STERN_HOUSE,
  CARPATHIA_SUPERSTRUCTURE,
  CARPATHIA_WELLS,
  CARPATHIA_WING_Y,
  type CarpathiaBoat,
} from "./carpathia";
export {
  britannic,
  BRITANNIC_BOATS,
  BRITANNIC_DECKS,
  BRITANNIC_LIVERIES,
  type BritannicBoat,
} from "./britannic";
export {
  concordia,
  CONCORDIA_BOATS,
  CONCORDIA_DECKS,
  CONCORDIA_LIVERIES,
  type ConcordiaBoat,
} from "./concordia";
export {
  poseidon,
  POSEIDON_BOATS,
  POSEIDON_DECKS,
  POSEIDON_LIVERIES,
  type PoseidonBoat,
} from "./poseidon";

/** Every ship the game knows, in the order the title screen lists them. */
export const SHIP_IDS = [
  "titanic",
  "lusitania",
  "fitzgerald",
  "carpathia",
  "britannic",
  "concordia",
  "poseidon",
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
  carpathia,
  britannic,
  concordia,
  poseidon,
};

export function getShip(id: ShipId): ShipSpec {
  return SHIPS[id];
}
