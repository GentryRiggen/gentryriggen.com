import type { ShipId } from "../ships/types";
import { BRITANNIC_WALK } from "./britannicDecks";
import { CARPATHIA_WALK } from "./carpathiaDecks";
import { LUSITANIA_WALK } from "./lusitaniaDecks";
import { TITANIC_WALK } from "./titanicDecks";
import type { WalkMap } from "./types";

/** Walk the decks (see README.md): the pure rules, no three.js. */
export * from "./types";
export { TITANIC_WALK } from "./titanicDecks";
export { LUSITANIA_WALK } from "./lusitaniaDecks";
export { BRITANNIC_WALK } from "./britannicDecks";
export { CARPATHIA_WALK } from "./carpathiaDecks";
export * from "./slope";
export * from "./step";
export * from "./swim";
export { resetWalkInput, walkInput } from "./walkInput";

const MAPS: Partial<Record<ShipId, WalkMap>> = {
  titanic: TITANIC_WALK,
  lusitania: LUSITANIA_WALK,
  britannic: BRITANNIC_WALK,
  carpathia: CARPATHIA_WALK,
};

/** A ship's walk map, or null for a ship you cannot walk on. */
export function walkMapFor(ship: ShipId): WalkMap | null {
  return MAPS[ship] ?? null;
}
