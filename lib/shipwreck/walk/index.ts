import { withInterior } from "../interior/merge";
import { TITANIC_INTERIOR } from "../interior/titanic";
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
  lusitania: LUSITANIA_WALK,
  britannic: BRITANNIC_WALK,
  carpathia: CARPATHIA_WALK,
};

/** The Titanic's open decks with her rooms merged in, built on first use. */
let titanicWithRooms: WalkMap | null = null;

/**
 * A ship's walk map, or null for a ship you cannot walk on. The Titanic's
 * is her open decks (`TITANIC_WALK`) plus her interior (1.15).
 */
export function walkMapFor(ship: ShipId): WalkMap | null {
  if (ship === "titanic") {
    if (!titanicWithRooms)
      titanicWithRooms = withInterior(TITANIC_WALK, TITANIC_INTERIOR);
    return titanicWithRooms;
  }
  return MAPS[ship] ?? null;
}
