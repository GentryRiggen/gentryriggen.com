import { BRITANNIC_GANTRY_SETS, britannic } from "./ships/britannic";
import {
  CARPATHIA_BOAT_DECK,
  CARPATHIA_BRIDGE_DECK,
  carpathia,
} from "./ships/carpathia";
import { CONCORDIA_BOATS, concordia } from "./ships/concordia";
import { FITZGERALD_HATCHES, fitzgerald } from "./ships/fitzgerald";
import { lusitania } from "./ships/lusitania";
import {
  BALLROOM,
  BOAT_DECK_Z,
  POSEIDON_BOATS,
  deckZ as poseidonDeckZ,
  poseidon,
  poseidonComp,
} from "./ships/poseidon";
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

/** The Carpathia's places. */
export const CARPATHIA_PLACE_IDS = [
  "bridge",
  "boiler-room",
  "engine-room",
  "hold-5",
  "dining-saloon",
  "wireless-room",
] as const;

/** The Britannic's places. */
export const BRITANNIC_PLACE_IDS = [
  "bridge",
  "hold-2",
  "boiler-room-6",
  "portholes",
  "gantry-davit",
  "turbine-room",
] as const;

/** The Costa Concordia's places. */
export const CONCORDIA_PLACE_IDS = [
  "bridge",
  "the-rock",
  "motor-room",
  "generator-room",
  "lifeboat",
  "funnel",
  "pool",
] as const;

/** The Poseidon's places (a made-up ship). */
export const POSEIDON_PLACE_IDS = [
  "bridge",
  "ballroom",
  "lobby",
  "engine-room",
  "funnel",
  "propeller",
  "lifeboat",
] as const;

/** Any ship's place (looked up with the ship: several have a bridge). */
export type PlaceId =
  | TitanicPlaceId
  | (typeof LUSITANIA_PLACE_IDS)[number]
  | (typeof FITZGERALD_PLACE_IDS)[number]
  | (typeof CARPATHIA_PLACE_IDS)[number]
  | (typeof BRITANNIC_PLACE_IDS)[number]
  | (typeof CONCORDIA_PLACE_IDS)[number]
  | (typeof POSEIDON_PLACE_IDS)[number];

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
  /**
   * The superstructure box it is in (`superstructure[i].id`, the
   * Poseidon's), whose water (`SimFrame.boxWater`) "Water here" reads.
   * Missing: none (open decks, or a compartment).
   */
  boxId?: string;
  /** Inside the hull: flying there turns X-ray on. */
  interior: boolean;
  /** Camera offset from `at` (ship frame, m) when flying there. */
  view: readonly [dx: number, dy: number, dz: number];
}

const DECK = Object.fromEntries(titanic.decks.map((d) => [d.name, d.z]));
/**
 * A deck's height at x: its midships height plus the sheer there. The sheer
 * is measured from the ship's reference deck (`sheerRefDeck`; default the C
 * deck, the top of the hull, as the models do, else `Upper`).
 */
export function deckZAt(
  deck: string,
  x: number,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck"> = titanic
): number {
  const z = (name: string) => spec.decks.find((d) => d.name === name)?.z ?? 0;
  // The Carpathia has no C deck: her upper deck is the top of the hull.
  const ref =
    spec.sheerRefDeck ??
    (spec.decks.some((d) => d.name === "C") ? "C" : "Upper");
  const top = z(ref);
  return z(deck) + (spec.sheerZ(x) - top);
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

/**
 * The Carpathia's places, from her data and the model's houses: the
 * wheelhouse on the navigating bridge (the bridge house's roof, one tier
 * over the boat deck at its front); the boiler room between bulkheads D and
 * E, toward its forward end where the first torpedo struck (at D, her port
 * side); the engine room between E and F (the second torpedo); No. 5 hold
 * under the after well, at No. 5 hatch (the U-boat's third); the dining
 * saloon in the bridge deck house forward of the bridge, on the upper deck
 * (its place is ours: her plans are not online); and the wireless room at
 * the after end of the boat deck's long deckhouse, where the model's
 * aerial lead comes down. A deck's height at x is its height amidships
 * plus her sheer there (measured from the upper deck, the top of her hull).
 * Boats 1 and 2 sit on the forward deckhouse's roof (x 30), clear of all.
 */
function carpDeckZ(deck: string, x: number): number {
  const z = (name: string) =>
    carpathia.decks.find((d) => d.name === name)?.z ?? 0;
  return z(deck) + carpathia.sheerZ(x) - z("Upper");
}
const carpComp = (id: string) => {
  const c = carpathia.compartments.find((k) => k.id === id);
  if (!c) throw new Error(`Carpathia has no ${id}`);
  return c;
};
/** The wheelhouse (the model's: 1.0–3.6 m abaft the boat deck's front). */
const C_BRIDGE_X = CARPATHIA_BOAT_DECK.toX - 2.3;
const C_BRIDGE_FLOOR = carpDeckZ("Boat", C_BRIDGE_X) + 2.6;
/** The first torpedo struck at the boiler room's forward bulkhead. */
const C_BOILER_X = carpComp("boiler").toX - 4;
const C_ENGINE_X = (carpComp("engine").fromX + carpComp("engine").toX) / 2;
/** No. 5 hatch, where the U-boat's third torpedo struck. */
const C_HOLD5_X = carpathia.torpedo?.hitX?.hold5 ?? -57;
/** Forward in the bridge deck house, clear of the bridge and boilers. */
const C_SALOON_X = Math.round((CARPATHIA_BRIDGE_DECK.toX + 2) / 2);
/** The long deckhouse's after end on the boat deck (the aerial's lead). */
const C_WIRELESS_X = -25.5;
const C_TANK_TOP =
  carpathia.decks.find((d) => d.name === "Tank top")?.z ?? 1.52;

export const CARPATHIA_PLACES: Record<
  (typeof CARPATHIA_PLACE_IDS)[number],
  Place
> = {
  bridge: {
    id: "bridge",
    label: "Bridge",
    fact: "She was steered from the wheelhouse here. When the first torpedo's trail was seen, the wheel was put hard over to turn her away, but it was too late.",
    at: [C_BRIDGE_X, 0, C_BRIDGE_FLOOR + 1.6],
    floorZ: C_BRIDGE_FLOOR,
    compartmentId: null,
    interior: true,
    view: [-14, 10, 6],
  },
  "boiler-room": {
    id: "boiler-room",
    label: "Boiler Room",
    fact: "Seven big boilers burned coal here to make the steam for her engines. The first torpedo hit her port side here, at 9:15 AM, beside a coal bunker.",
    at: [C_BOILER_X, 0, 5],
    floorZ: C_TANK_TOP,
    compartmentId: "boiler",
    interior: true,
    view: [-14, 9, 15],
  },
  "engine-room": {
    id: "engine-room",
    label: "Engine Room",
    fact: "Two engines, each with four cylinders, turned her two propellers. The second torpedo hit here seconds after the first, and her engines stopped.",
    at: [C_ENGINE_X, 0, 6],
    floorZ: C_TANK_TOP,
    compartmentId: "engine",
    interior: true,
    view: [-16, 20, 10],
  },
  "hold-5": {
    id: "hold-5",
    label: "Hold 5",
    fact: "A cargo hold, almost empty on this trip. At 10:50 AM the U-boat came back, and its last torpedo hit her here.",
    at: [C_HOLD5_X, 0, 6],
    floorZ: C_TANK_TOP,
    compartmentId: "hold5",
    interior: true,
    view: [-16, 20, 10],
  },
  "dining-saloon": {
    id: "dining-saloon",
    label: "Dining Saloon",
    fact: "Meals were served here at long tables, in a room under the bridge deck in the middle of the ship.",
    at: [C_SALOON_X, 0, carpDeckZ("Upper", C_SALOON_X) + 1.4],
    floorZ: carpDeckZ("Upper", C_SALOON_X),
    compartmentId: null,
    interior: true,
    view: [-16, 18, 8],
  },
  "wireless-room": {
    id: "wireless-room",
    label: "Wireless Room",
    fact: "In 1912 her wireless operator heard the Titanic's call for help here.",
    at: [C_WIRELESS_X, 0, carpDeckZ("Boat", C_WIRELESS_X) + 1.4],
    floorZ: carpDeckZ("Boat", C_WIRELESS_X),
    compartmentId: null,
    interior: true,
    view: [-10, 10, 5],
  },
};

/**
 * The Britannic's places, from her data (the Titanic's frames and decks,
 * her own beam, compartments and davits): the wheelhouse where her
 * sister's stood, 190 ft from the bow; hold 2, beside the hold 2/3
 * bulkhead where the mine went off against her starboard side [WP];
 * boiler room 6 (the firemen's tunnel flooded it); her open portholes on
 * E deck forward, over hold 1 by her starboard side, where the row sits
 * (R8); the gantry davit set by the officers' quarters, starboard forward
 * (R5); and the turbine room between bulkheads L and M, its turbine
 * turning her middle propeller.
 */
const B_BRIDGE_X = 68.6;
const B_TANK_TOP = britannic.decks.find((d) => d.name === "Tank top")?.z ?? 1.6;
const bComp = (id: string) =>
  britannic.compartments.find((c) => c.id === id) as {
    fromX: number;
    toX: number;
  };
const bMid = (id: string) => (bComp(id).fromX + bComp(id).toX) / 2;
/** In hold 2, just forward of the hold 2/3 bulkhead the mine tore. */
const B_HOLD2_X = Math.round((bComp("hold2").fromX + 3) * 10) / 10;
const B_BR6_X = Math.round(bMid("br6") * 10) / 10;
const B_TURBINE_X = Math.round(bMid("turbine") * 10) / 10;
/** Over hold 1, on her open E-deck row, 2 m inside her starboard side. */
const B_PORTHOLE_X = Math.round(bMid("hold1") * 10) / 10;
const B_PORTHOLE_FLOOR = deckZAt("E", B_PORTHOLE_X, britannic);
const B_PORTHOLE_Z = B_PORTHOLE_FLOOR + 1;
const B_PORTHOLE_Y = -6;
const B_GANTRY = BRITANNIC_GANTRY_SETS[0];
const B_GANTRY_DECK = deckZAt("Boat", B_GANTRY.x, britannic);

export const BRITANNIC_PLACES: Record<
  (typeof BRITANNIC_PLACE_IDS)[number],
  Place
> = {
  bridge: {
    id: "bridge",
    label: "Bridge",
    fact: "She was steered from the wheelhouse here. When the mine broke her steering, her captain steered her with her engines instead, turning her toward the island of Kea.",
    at: [B_BRIDGE_X, 0, deckZAt("Boat", B_BRIDGE_X, britannic) + 1.6],
    floorZ: deckZAt("Boat", B_BRIDGE_X, britannic),
    compartmentId: null,
    interior: true,
    view: [-14, -10, 6],
  },
  "hold-2": {
    id: "hold-2",
    label: "Hold 2",
    fact: "The mine went off against her starboard side here, by the wall between holds 2 and 3. The sea poured into both holds, and on through a tunnel into the boiler rooms behind them.",
    at: [B_HOLD2_X, -5, 6],
    floorZ: B_TANK_TOP,
    compartmentId: "hold2",
    interior: true,
    view: [-16, -18, 12],
  },
  "boiler-room-6": {
    id: "boiler-room-6",
    label: "Boiler Room 6",
    fact: "Her front boiler room. The mine broke the tunnel that joined it to the holds, and the sea came in. A watertight door behind it did not close all the way, so the next boiler room filled too.",
    at: [B_BR6_X, 0, 5],
    floorZ: B_TANK_TOP,
    compartmentId: "br6",
    interior: true,
    view: [-15, -9, 17],
  },
  portholes: {
    id: "portholes",
    label: "Open Portholes",
    fact: "Rows of round windows on E deck near her front were open to let fresh air into the rooms inside. When her front sank low enough, the sea came in through them.",
    at: [B_PORTHOLE_X, B_PORTHOLE_Y, B_PORTHOLE_Z],
    floorZ: B_PORTHOLE_FLOOR,
    compartmentId: "hold1",
    interior: true,
    view: [-12, -26, 4],
  },
  "gantry-davit": {
    id: "gantry-davit",
    label: "Gantry Davit",
    fact: "Giant crane-like arms that could lift six lifeboats each, from either side of the ship. She was built after the Titanic with boats for everyone aboard.",
    at: [B_GANTRY.x, -11, B_GANTRY_DECK + 5],
    floorZ: B_GANTRY_DECK,
    compartmentId: null,
    interior: false,
    view: [-14, -22, 8],
  },
  "turbine-room": {
    id: "turbine-room",
    label: "Turbine Room",
    fact: "Steam from her two big engines came here next and spun a giant turbine, the largest of its time. Together they drove her through the sea at about 24 miles an hour.",
    at: [B_TURBINE_X, 0, 6],
    floorZ: B_TANK_TOP,
    compartmentId: "turbine",
    interior: true,
    view: [-16, -20, 10],
  },
};

/**
 * The Costa Concordia's places, from her data and her model: her bridge on
 * deck 8 behind its band of windows, the rock stuck in her port side at
 * frame 52 [MIT], the electric motor room (WTC 5) and the back generator
 * room (WTC 6) the sea reached first, a starboard lifeboat on deck 4, her
 * yellow funnel with the blue "C", and the pool under its glass roof on
 * deck 12.
 */
const cComp = (id: string) =>
  concordia.compartments.find((c) => c.id === id) as {
    id: string;
    fromX: number;
    toX: number;
  };
const cMid = (id: string) =>
  Math.round(((cComp(id).fromX + cComp(id).toX) / 2) * 10) / 10;
/** The deepest deck inside her: where the engine spaces' floor is. */
const CC_TANK_TOP = 1.6;
const CC_BRIDGE_X = 118;
const C_ROCK_X = concordia.heel?.rock?.x ?? -86;
const C_ROCK_COMP =
  concordia.compartments.find((c) => c.fromX <= C_ROCK_X && C_ROCK_X < c.toX)
    ?.id ?? "wtc4";
const C_BOAT = CONCORDIA_BOATS[6];
const C_FUNNEL = concordia.funnels[0];

export const CONCORDIA_PLACES: Record<
  (typeof CONCORDIA_PLACE_IDS)[number],
  Place
> = {
  bridge: {
    id: "bridge",
    label: "Bridge",
    fact: "A long room of big windows high at her front, where she was steered from. When the lights went out, her engines and her rudder stopped working.",
    at: [CC_BRIDGE_X, 0, deckZAt("8", CC_BRIDGE_X, concordia) + 1.6],
    floorZ: deckZAt("8", CC_BRIDGE_X, concordia),
    compartmentId: null,
    interior: true,
    view: [-16, -14, 8],
  },
  "the-rock": {
    id: "the-rock",
    label: "The Rock",
    fact: "A pointed rock from the reef called Le Scole. It tore a long gash in her left side, about 53 metres long, and a piece of it stayed stuck in her hull.",
    at: [C_ROCK_X, 13, 4],
    floorZ: CC_TANK_TOP,
    compartmentId: C_ROCK_COMP,
    interior: true,
    view: [-6, 30, 8],
  },
  "motor-room": {
    id: "motor-room",
    label: "Electric Motor Room",
    fact: "Giant electric motors here turned her propellers. The rock opened her side next to this room, and the sea filled it in a few minutes.",
    at: [cMid("wtc5"), 0, 5],
    floorZ: CC_TANK_TOP,
    compartmentId: "wtc5",
    interior: true,
    view: [-14, 20, 10],
  },
  "generator-room": {
    id: "generator-room",
    label: "Generator Room",
    fact: "Big engines here made the electricity for the whole ship. When the sea reached them, her main lights went out, and small emergency lights came on.",
    at: [cMid("wtc6"), 0, 5],
    floorZ: CC_TANK_TOP,
    compartmentId: "wtc6",
    interior: true,
    view: [-14, 20, 10],
  },
  lifeboat: {
    id: "lifeboat",
    label: "Lifeboat",
    fact: "She carried 26 big lifeboats, each with room for 150. They hung high on her sides, and were lowered down to the water one by one.",
    at: [C_BOAT.x, -14.4, deckZAt("4", C_BOAT.x, concordia) + 1.4],
    floorZ: deckZAt("4", C_BOAT.x, concordia),
    compartmentId: null,
    interior: false,
    view: [-12, -26, 7],
  },
  funnel: {
    id: "funnel",
    label: "Funnel",
    fact: "Her one big yellow funnel, with a blue letter C for Costa, the company that owned her. It stood far back, over her engines.",
    at: [C_FUNNEL.x, 0, C_FUNNEL.baseZ + 2],
    floorZ: C_FUNNEL.baseZ,
    compartmentId: null,
    interior: false,
    view: [-14, -26, 6],
  },
  pool: {
    id: "pool",
    label: "Pool",
    fact: "A swimming pool high on her top decks, under a glass roof that could slide open. The deck outside it looked all the way along the ship.",
    at: [16, 0, deckZAt("12", 16, concordia) + 1.4],
    floorZ: deckZAt("12", 16, concordia),
    compartmentId: null,
    interior: true,
    view: [-16, -16, 8],
  },
};

/**
 * The Poseidon's places, from her data and her model: the bridge forward on
 * deck 9, the ballroom under its glass dome, the lobby (the atrium on deck
 * 5), the middle generator room (WTC 6), her tall funnel, a propeller on
 * its open shaft and a starboard lifeboat in the recess on deck 4. All ours
 * (a made-up ship).
 */
const P_BOAT = POSEIDON_BOATS[6];
const P_FUNNEL = poseidon.funnels[0];
const P_ENGINE = poseidonComp("wtc6");
const P_BALLROOM_X =
  Math.round(((BALLROOM.fromX + BALLROOM.toX) / 2) * 10) / 10;
const P_BRIDGE_X = 104;
const P_LOBBY_X = 20;

export const POSEIDON_PLACES: Record<
  (typeof POSEIDON_PLACE_IDS)[number],
  Place
> = {
  bridge: {
    id: "bridge",
    label: "Bridge",
    fact: "A wide room of windows at her front. The windows were smashed, and the sea got in.",
    at: [P_BRIDGE_X, 0, poseidonDeckZ(9) + 1.6],
    floorZ: poseidonDeckZ(9),
    compartmentId: null,
    boxId: "fwd-upper",
    interior: true,
    view: [-16, -14, 8],
  },
  ballroom: {
    id: "ballroom",
    label: "Ballroom",
    fact: "A round room high on the ship, under a glass dome. When the ship rolled over, the dome was under the water.",
    at: [P_BALLROOM_X, 0, BALLROOM.baseZ + 1.6],
    floorZ: BALLROOM.baseZ,
    compartmentId: null,
    boxId: "ballroom",
    interior: true,
    view: [-20, -20, 10],
  },
  lobby: {
    id: "lobby",
    label: "Lobby",
    fact: "A tall room with glass doors on her side. A giant wave smashed them and filled the room with water.",
    at: [P_LOBBY_X, 0, poseidonDeckZ(5) + 1.6],
    floorZ: poseidonDeckZ(5),
    compartmentId: null,
    boxId: "mid-lower",
    interior: true,
    view: [-14, 20, 8],
  },
  "engine-room": {
    id: "engine-room",
    label: "Engine Room",
    fact: "Big engines here made the electricity for the whole ship. When she rolled over, the lights went out and little emergency lights came on.",
    at: [Math.round(((P_ENGINE.fromX + P_ENGINE.toX) / 2) * 10) / 10, 0, 6],
    floorZ: 1.6,
    compartmentId: "wtc6",
    interior: true,
    view: [-14, 20, 10],
  },
  funnel: {
    id: "funnel",
    label: "Funnel",
    fact: "Her tall white funnel, with a gold wave on it. Upside down, it was under the water.",
    at: [P_FUNNEL.x, 0, P_FUNNEL.baseZ + 2],
    floorZ: P_FUNNEL.baseZ,
    compartmentId: null,
    interior: false,
    view: [-14, -26, 6],
  },
  propeller: {
    id: "propeller",
    label: "Propeller",
    fact: "One of her two big propellers, which push her through the sea. Keel up, they stuck up in the air.",
    at: [-134, 7.5, 3.1],
    floorZ: 0,
    compartmentId: null,
    interior: false,
    view: [-12, 14, 6],
  },
  lifeboat: {
    id: "lifeboat",
    label: "Lifeboat",
    fact: "She carried 24 big lifeboats, 12 on each side. They stayed in their places on deck 4.",
    at: [P_BOAT.x, -11, BOAT_DECK_Z + 1.4],
    floorZ: BOAT_DECK_Z,
    compartmentId: null,
    interior: false,
    view: [-12, -26, 7],
  },
};

/** Each ship's places, in the order the HUD lists them. */
export const PLACES_BY_SHIP: Record<ShipId, readonly Place[]> = {
  titanic: PLACE_IDS.map((id) => PLACES[id]),
  lusitania: LUSITANIA_PLACE_IDS.map((id) => LUSITANIA_PLACES[id]),
  fitzgerald: FITZGERALD_PLACE_IDS.map((id) => FITZGERALD_PLACES[id]),
  carpathia: CARPATHIA_PLACE_IDS.map((id) => CARPATHIA_PLACES[id]),
  britannic: BRITANNIC_PLACE_IDS.map((id) => BRITANNIC_PLACES[id]),
  concordia: CONCORDIA_PLACE_IDS.map((id) => CONCORDIA_PLACES[id]),
  poseidon: POSEIDON_PLACE_IDS.map((id) => POSEIDON_PLACES[id]),
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
