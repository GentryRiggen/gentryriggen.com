import type { InteriorMap } from "../interior/types";
import { CONCORDIA_INTERIOR } from "../interior/concordia";
import { withInterior } from "../interior/merge";
import { TITANIC_INTERIOR } from "../interior/titanic";
import type { ShipId } from "../ships/types";
import { BRITANNIC_WALK } from "./britannicDecks";
import { CARPATHIA_WALK } from "./carpathiaDecks";
import { CONCORDIA_WALK } from "./concordiaDecks";
import { LUSITANIA_WALK } from "./lusitaniaDecks";
import { TITANIC_WALK } from "./titanicDecks";
import type { WalkMap } from "./types";

/** What you can walk on and inside, for one ship. */
export interface ShipWalk {
  /** The open decks. */
  deck: WalkMap;
  /** The rooms, merged into the deck map (`withInterior`) on first use. */
  interior?: InteriorMap;
}

/** Every walkable ship. A ship not here cannot be walked on. */
export const SHIP_WALKS: Partial<Record<ShipId, ShipWalk>> = {
  titanic: { deck: TITANIC_WALK, interior: TITANIC_INTERIOR },
  lusitania: { deck: LUSITANIA_WALK },
  britannic: { deck: BRITANNIC_WALK },
  carpathia: { deck: CARPATHIA_WALK },
  concordia: { deck: CONCORDIA_WALK, interior: CONCORDIA_INTERIOR },
};

const merged = new Map<ShipId, WalkMap>();

/**
 * A ship's walk map, or null for a ship you cannot walk on: its open decks,
 * with its interior merged in (built once) when it has one.
 */
export function walkMapFor(ship: ShipId): WalkMap | null {
  const walk = SHIP_WALKS[ship];
  if (!walk) return null;
  if (!walk.interior) return walk.deck;
  let map = merged.get(ship);
  if (!map) {
    map = withInterior(walk.deck, walk.interior);
    merged.set(ship, map);
  }
  return map;
}

/** A ship's interior, or null for a ship you cannot go inside. */
export function interiorFor(ship: ShipId): InteriorMap | null {
  return SHIP_WALKS[ship]?.interior ?? null;
}
