import { FITZGERALD_HATCHES, fitzgerald } from "./ships/fitzgerald";
import { lusitania } from "./ships/lusitania";
import { titanic } from "./ships/titanic";
import type { ShipId, ShipSpec } from "./ships/types";

/**
 * The places a player can fly to. Positions are ship-frame metres (x
 * forward from midships, y to port, z up from the keel) from the general
 * arrangement plans as the ship data lays them out: the bridge's wheelhouse
 * on the boat deck 190 ft from the bow, the forward Grand Staircase under
 * its glass dome between funnels 1 and 2, boiler room 6 between bulkheads E
 * and F (the forward boiler room, where the iceberg opened the side), and
 * the reciprocating engine room between bulkheads K and L.
 */

/** The Titanic's places (the 1.0 list). */
export const PLACE_IDS = [
  "bridge",
  "grand-staircase",
  "boiler-room-6",
  "engine-room",
] as const;
export type TitanicPlaceId = (typeof PLACE_IDS)[number];

/** The Lusitania's places. */
export const LUSITANIA_PLACE_IDS = [
  "bridge",
  "dining-saloon",
  "boiler-room-1",
  "starboard-bunker",
  "turbine-room",
] as const;

/** The Edmund Fitzgerald's places. */
export const FITZGERALD_PLACE_IDS = [
  "pilothouse",
  "bell",
  "cargo-hold-1",
  "ballast-tank",
  "engine-room",
  "hatch-crane",
] as const;

/** Any ship's place (looked up with the ship: several have a bridge). */
export type PlaceId =
  | TitanicPlaceId
  | (typeof LUSITANIA_PLACE_IDS)[number]
  | (typeof FITZGERALD_PLACE_IDS)[number];

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
/**
 * A deck's height at x: its midships height plus the sheer there (the
 * sheer measured from the C deck, the top of the hull, as the models do).
 */
export function deckZAt(
  deck: string,
  x: number,
  spec: Pick<ShipSpec, "decks" | "sheerZ"> = titanic
): number {
  const z = (name: string) => spec.decks.find((d) => d.name === name)?.z ?? 0;
  return z(deck) + (spec.sheerZ(x) - z("C"));
}

const BRIDGE_X = 68.6;
const STAIR_X = 37.4;
const BR6_X = 62.5;
const ENGINE_X = -38;

export const PLACES: Record<TitanicPlaceId, Place> = {
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

/**
 * The Lusitania's places, from her general arrangement as her data lays it
 * out: the wheelhouse on the navigating bridge, on the roof of the boat
 * deck's house about 4 m abaft its front; the first class dining saloon on
 * the Upper (D) deck, two decks high under its dome, amidships forward;
 * No. 1 boiler room between bulkheads D and E (the forward one, where the
 * torpedo hit); the starboard side bunker of No. 2 boiler room (the second
 * explosion opened it); and the turbine room between bulkheads H and J.
 */
const L_BRIDGE_X = 68.4;
/** The navigating bridge: the boat deck house's roof (2.6 m up). */
const L_BRIDGE_FLOOR = deckZAt("Boat", L_BRIDGE_X, lusitania) + 2.6;
const L_SALOON_X = 22;
const L_BR1_X = 46;
const L_BUNKER_X = 24;
const L_TURBINE_X = -47;
const L_TANK_TOP =
  lusitania.decks.find((d) => d.name === "Tank top")?.z ?? 1.52;

export const LUSITANIA_PLACES: Record<
  (typeof LUSITANIA_PLACE_IDS)[number],
  Place
> = {
  bridge: {
    id: "bridge",
    label: "Bridge",
    fact: "The ship was steered from the wheelhouse here, high above the sea. The torpedo hit her side down below, just behind it.",
    at: [L_BRIDGE_X, 0, L_BRIDGE_FLOOR + 1.6],
    floorZ: L_BRIDGE_FLOOR,
    compartmentId: null,
    interior: true,
    view: [-14, -10, 6],
  },
  "dining-saloon": {
    id: "dining-saloon",
    label: "Dining Saloon",
    fact: "First class passengers ate here, in a white and gold room two decks high under a painted dome.",
    at: [L_SALOON_X, 0, deckZAt("D", L_SALOON_X, lusitania) + 2],
    floorZ: deckZAt("D", L_SALOON_X, lusitania),
    compartmentId: null,
    interior: true,
    view: [-16, -22, 10],
  },
  "boiler-room-1": {
    id: "boiler-room-1",
    label: "Boiler Room 1",
    fact: "The front boiler room. She had 25 boilers in four boiler rooms, with 192 fires to stoke. The torpedo hit the side here.",
    at: [L_BR1_X, 0, 5],
    floorZ: L_TANK_TOP,
    compartmentId: "br1",
    interior: true,
    view: [-14, -9, 15],
  },
  "starboard-bunker": {
    id: "starboard-bunker",
    label: "Coal Bunker",
    fact: "Long coal stores ran down both sides of the boiler rooms. When the sea filled the ones on this side, their weight made her lean over fast.",
    at: [L_BUNKER_X, -11.4, 6],
    floorZ: 2,
    compartmentId: "br2-stbd",
    interior: true,
    view: [-14, -14, 9],
  },
  "turbine-room": {
    id: "turbine-room",
    label: "Turbine Room",
    fact: "Giant steam turbines spun her four propellers. They made her one of the fastest ships in the world.",
    at: [L_TURBINE_X, 0, 6],
    floorZ: L_TANK_TOP,
    compartmentId: "turbine",
    interior: true,
    view: [-16, -20, 10],
  },
};

/**
 * The Edmund Fitzgerald's places, from her data (and the model's houses):
 * the pilothouse on the texas deck forward, her bell on its roof, No. 1
 * cargo hold with its taconite, the No. 1 starboard ballast tanks where
 * her vents broke, the engine room aft and the hatch crane on its rails at
 * No. 21 hatch. A deck's height at x is its height amidships plus her
 * sheer there (measured from the spar deck, the top of her hull).
 */
function fitzDeckZ(deck: string, x: number): number {
  const z = (name: string) =>
    fitzgerald.decks.find((d) => d.name === name)?.z ?? 0;
  return z(deck) + fitzgerald.sheerZ(x) - z("Spar");
}
const hatchAt = (n: number) => FITZGERALD_HATCHES[n - 1].x;
/** The pilothouse (the model's, set back on the texas deck). */
const F_PILOT_X = 99;
const F_PILOT_FLOOR = fitzDeckZ("Pilothouse", F_PILOT_X);
/** Its roof: one tier (2.6 m) over the texas deck's step (the model). */
const F_PILOT_ROOF = fitzDeckZ("Texas", F_PILOT_X) + 0.7 + 2.6;
/** The tank top over her double bottom: flat, not following the sheer. */
const F_TANK_TOP =
  fitzgerald.decks.find((d) => d.name === "Tank top")?.z ?? 1.52;
/** Over the No. 1 starboard tanks, between her two broken vents. */
const F_TANK_X = Math.round(((hatchAt(3) + hatchAt(5)) / 2 - 3.6) * 10) / 10;
/** Midway between the tanks' inner wall (7.43 m out) and her side. */
const F_TANK_Y = -9.4;
const F_ENGINE_X = -86;
const F_CRANE_X = hatchAt(21);

export const FITZGERALD_PLACES: Record<
  (typeof FITZGERALD_PLACE_IDS)[number],
  Place
> = {
  pilothouse: {
    id: "pilothouse",
    label: "Pilothouse",
    fact: "She was steered from here, high up at her front. From its windows you could see all 21 of her hatches in a row along her long deck.",
    at: [F_PILOT_X, 0, F_PILOT_FLOOR + 1.6],
    floorZ: F_PILOT_FLOOR,
    compartmentId: null,
    interior: true,
    view: [-14, -10, 6],
  },
  bell: {
    id: "bell",
    label: "Ship's Bell",
    fact: "Her bronze bell stood on the pilothouse roof. Divers brought it up from the wreck in 1995, and it is kept at the Great Lakes Shipwreck Museum at Whitefish Point.",
    at: [F_PILOT_X + 1, 0, F_PILOT_ROOF + 0.6],
    floorZ: F_PILOT_ROOF,
    compartmentId: null,
    interior: false,
    view: [-8, -7, 4],
  },
  "cargo-hold-1": {
    id: "cargo-hold-1",
    label: "Cargo Hold 1",
    fact: "Her holds carried taconite: small, hard pellets of iron ore, over 26,000 tons of them, on their way to be made into steel. In the X-ray they are the dark layer.",
    // Forward in the hold, clear of the ballast tank's pin beside it.
    at: [76, 0, 6],
    floorZ: F_TANK_TOP,
    compartmentId: "hold1",
    interior: true,
    view: [-18, -24, 12],
  },
  "ballast-tank": {
    id: "ballast-tank",
    label: "Ballast Tank",
    fact: "Tanks ran along both sides of her holds. Filled with water, they kept her steady when she had no cargo. Here, water got in and made her lean. Experts still argue how: through her broken vents, or after a scrape on a shoal.",
    at: [F_TANK_X, F_TANK_Y, 6],
    floorZ: 0.3,
    compartmentId: "tank1-s",
    interior: true,
    view: [-14, -14, 9],
  },
  "engine-room": {
    id: "engine-room",
    label: "Engine Room",
    fact: "A steam turbine as strong as 7,500 horses turned her one big propeller and drove her along at about 13 miles an hour.",
    at: [F_ENGINE_X, 0, 6],
    floorZ: F_TANK_TOP,
    compartmentId: "engine",
    interior: true,
    view: [-16, -20, 10],
  },
  "hatch-crane": {
    id: "hatch-crane",
    label: "Hatch Crane",
    fact: "This crane rolled on rails along her deck. It lifted the heavy steel hatch covers off for loading, and put them back on before she sailed.",
    at: [F_CRANE_X, 0, fitzDeckZ("Spar", F_CRANE_X) + 5.6],
    floorZ: fitzDeckZ("Spar", F_CRANE_X),
    compartmentId: null,
    interior: false,
    view: [16, -22, 8],
  },
};

/** Each ship's places, in the order the HUD lists them. */
export const PLACES_BY_SHIP: Record<ShipId, readonly Place[]> = {
  titanic: PLACE_IDS.map((id) => PLACES[id]),
  lusitania: LUSITANIA_PLACE_IDS.map((id) => LUSITANIA_PLACES[id]),
  fitzgerald: FITZGERALD_PLACE_IDS.map((id) => FITZGERALD_PLACES[id]),
};

/** A ship's place by id, or null if she has none by that id. */
export function placeFor(ship: ShipId, id: string | null): Place | null {
  if (id === null) return null;
  return PLACES_BY_SHIP[ship].find((p) => p.id === id) ?? null;
}

/** Water depth here as a short line ("Water here: 2.1 m deep"). */
export function waterHereText(depthM: number): string {
  if (!(depthM > 0.05)) return "Dry here";
  return `Water here: ${depthM < 10 ? depthM.toFixed(1) : Math.round(depthM)} m deep`;
}
