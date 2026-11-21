import { titanic } from "./ships/titanic";

/**
 * The places a player can fly to. Positions are ship-frame metres (x
 * forward from midships, y to port, z up from the keel) from the general
 * arrangement plans as the ship data lays them out: the bridge's wheelhouse
 * on the boat deck 190 ft from the bow, the forward Grand Staircase under
 * its glass dome between funnels 1 and 2, boiler room 6 between bulkheads E
 * and F (the forward boiler room, where the iceberg opened the side), and
 * the reciprocating engine room between bulkheads K and L.
 */

export const PLACE_IDS = [
  "bridge",
  "grand-staircase",
  "boiler-room-6",
  "engine-room",
] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

export interface Place {
  id: PlaceId;
  label: string;
  /** A short kid-friendly fact. */
  fact: string;
  /** Where the pin sits and the camera looks (ship frame, m). */
  at: readonly [x: number, y: number, z: number];
  /** The floor the water depth is measured from (ship-frame z, m). */
  floorZ: number;
  /** The watertight compartment it is in, or null for open decks. */
  compartmentId: string | null;
  /** Inside the hull: flying there turns X-ray on. */
  interior: boolean;
  /** Camera offset from `at` (ship frame, m) when flying there. */
  view: readonly [dx: number, dy: number, dz: number];
}

const DECK = Object.fromEntries(titanic.decks.map((d) => [d.name, d.z]));
const DECK_C = DECK.C;
/** A deck's height at x: its midships height plus the sheer there. */
export function deckZAt(deck: string, x: number): number {
  return DECK[deck] + (titanic.sheerZ(x) - DECK_C);
}

const BRIDGE_X = 68.6;
const STAIR_X = 37.4;
const BR6_X = 62.5;
const ENGINE_X = -38;

export const PLACES: Record<PlaceId, Place> = {
  bridge: {
    id: "bridge",
    label: "Bridge",
    fact: "The ship was steered from the wheelhouse here. When the iceberg was seen, the officer on watch turned the wheel hard and rang the engines to stop, but she was too big and too fast to miss it.",
    at: [BRIDGE_X, 0, deckZAt("Boat", BRIDGE_X) + 1.6],
    floorZ: deckZAt("Boat", BRIDGE_X),
    compartmentId: null,
    interior: true,
    view: [-14, -10, 6],
  },
  "grand-staircase": {
    id: "grand-staircase",
    label: "Grand Staircase",
    fact: "Oak stairs went down seven decks under a glass dome that let daylight in. It was the most famous room on the ship.",
    at: [STAIR_X, 0, deckZAt("B", STAIR_X)],
    floorZ: deckZAt("E", STAIR_X),
    compartmentId: "br5",
    interior: true,
    view: [20, -30, 12],
  },
  "boiler-room-6": {
    id: "boiler-room-6",
    label: "Boiler Room 6",
    fact: "Four giant boilers, each taller than a grown-up standing on a grown-up, burned coal in 24 fires. The iceberg opened the side here and the sea came in within minutes.",
    at: [BR6_X, 0, 5],
    floorZ: DECK["Tank top"],
    compartmentId: "br6",
    interior: true,
    // From above and aft, inside the ghost hull, looking down on the boilers.
    view: [-15, -9, 17],
  },
  "engine-room": {
    id: "engine-room",
    label: "Engine Room",
    fact: "Two engines as tall as a four-storey house turned the outside propellers. Their used steam then spun a turbine that turned the middle one.",
    at: [ENGINE_X, 0, 8],
    floorZ: DECK["Tank top"],
    compartmentId: "engine",
    interior: true,
    view: [-16, -24, 10],
  },
};

/** Water depth here as a short line ("Water here: 2.1 m deep"). */
export function waterHereText(depthM: number): string {
  if (!(depthM > 0.05)) return "Dry here";
  return `Water here: ${depthM < 10 ? depthM.toFixed(1) : Math.round(depthM)} m deep`;
}
