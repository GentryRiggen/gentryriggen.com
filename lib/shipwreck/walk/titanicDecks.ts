import { titanic } from "../ships/titanic";
import { deckEdgeOf, sidedOutline } from "./deckEdge";
import type { Blocker, Stair, V2, WalkArea, WalkMap } from "./types";

/**
 * The Titanic's open decks, from her general arrangement as the ship data
 * and the 3D model lay it out: the deck ends from the British Wreck
 * Commissioner's report as ships/titanic.ts reads it (the bridge 190 ft
 * from the bow, the boat deck 500 ft, the forecastle 125 ft, the bridge
 * deck 550 ft, the poop 105 ft), the fittings from the profile and boat
 * deck plans as the model measures them. The houses, funnel casings, masts, hatches, cranes,
 * ventilators, benches and davits are where
 * components/shipwreck/model/titanicRecipe.ts draws them, so you bump into
 * what you see; keep them in step.
 *
 * - The boat deck, from the navigating bridge (190 ft from the bow) 500 ft
 *   aft, the full breadth of the ship.
 * - The forward well deck (C), between the bridge deck's front (175 ft from
 *   the bow) and the forecastle (125 ft).
 * - The forecastle (B), to the stem.
 * - The after well deck (C), between the bridge deck's after end and the
 *   poop (105 ft from the stern).
 * - The poop (B), to the counter.
 *
 * Ladders: forecastle to forward well and after well to poop, a pair each
 * at the decks' ends; forward well to the boat deck's front and after well
 * to the boat deck's after end (the B and A deck stairs at the bridge front
 * and the second class entrance stand in for the climb).
 */

const FT = 0.3048;
const HALF_LBP = titanic.lbp / 2;
const STERN_X = -138.7;
const STEM_X = 130.4;
const BRIDGE_X = 71.6;
/** The bridge deck's ends and the boat deck's after end. */
const BRIDGE_DECK_FROM = HALF_LBP - 175 * FT - 550 * FT;
const BRIDGE_DECK_TO = HALF_LBP - 175 * FT;
const BOAT_DECK_FROM = BRIDGE_X - 500 * FT;
const FORECASTLE_FROM = HALF_LBP - 125 * FT;
const POOP_TO = STERN_X + 105 * FT;

/** The drawn deck edge (titanicRecipe's counter: from x −62, the beam). */
const edge = deckEdgeOf(titanic, {
  fromX: -62,
  halfBreadth: titanic.beam / 2,
  exponent: 2.6,
});
/** The rails stand 10 cm inboard of the edge. */
const RAIL_INSET = 0.1;
const rail = (x: number) => Math.max(0.5, edge(x) - RAIL_INSET);

function sided(
  id: string,
  deck: string,
  x0: number,
  x1: number,
  ends: { fwd: "wall" | "rail"; aft: "wall" | "rail" }
): WalkArea {
  const s = sidedOutline(rail, x0, x1);
  const wallEdges: number[] = [];
  if (ends.fwd === "wall") wallEdges.push(s.fwdEdge);
  if (ends.aft === "wall") wallEdges.push(s.aftEdge);
  return { id, deck, outline: s.outline, wallEdges };
}

const areas: WalkArea[] = [
  // Her ends over a lower deck are walls: you cannot slide off them into
  // the sea, only off the sides.
  sided("boat-deck", "Boat", BOAT_DECK_FROM, BRIDGE_X, {
    fwd: "wall",
    aft: "wall",
  }),
  sided("forward-well", "C", BRIDGE_DECK_TO, FORECASTLE_FROM, {
    fwd: "wall",
    aft: "wall",
  }),
  sided("forecastle", "B", FORECASTLE_FROM, STEM_X - 2, {
    fwd: "rail",
    aft: "wall",
  }),
  sided("aft-well", "C", POOP_TO, BRIDGE_DECK_FROM, {
    fwd: "wall",
    aft: "wall",
  }),
  sided("poop", "B", STERN_X + 1, POOP_TO, { fwd: "wall", aft: "rail" }),
];

function box(area: string, x0: number, x1: number, y0: number, y1: number) {
  return { kind: "box", area, min: [x0, y0], max: [x1, y1] } as const;
}
function circle(area: string, x: number, y: number, r: number) {
  return { kind: "circle", area, at: [x, y] as V2, r } as const;
}
const SIDES = [1, -1] as const;

const blockers: Blocker[] = [
  // Boat deck houses (titanicRecipe's `houses`).
  box("boat-deck", 66.4, 70.9, -4.6, 4.6), // wheelhouse
  box("boat-deck", 69.6, 72.2, -14.0, -11.9), // bridge cab, starboard
  box("boat-deck", 69.6, 72.2, 11.9, 14.0), // bridge cab, port
  box("boat-deck", 41.6, 66.4, -7.0, 7.0), // officers' quarters
  box("boat-deck", 33.2, 41.6, -5.0, 5.0), // grand staircase
  box("boat-deck", 24.0, 33.2, -10.6, -4.2), // gymnasium
  box("boat-deck", 25.5, 33.2, 4.2, 8.4), // first class entrance
  box("boat-deck", -8.5, 7.5, -4.6, 4.6), // lounge roof
  box("boat-deck", 9.6, 12.0, -1.2, 1.2), // compass platform
  box("boat-deck", -31.5, -22.5, -4.6, 4.6), // aft staircase
  box("boat-deck", -45.0, -33.5, -3.2, 3.2), // engine skylight
  box("boat-deck", -63.0, -55.5, -5.2, 5.2), // smoke room roof
  box("boat-deck", -79.6, -70.5, -5.6, 5.6), // second class entrance
  // The funnels (24 ft 6 in across) and the casings round their feet.
  ...titanic.funnels.flatMap((f) => [
    circle("boat-deck", f.x, 0, (24.5 * FT) / 2),
    box("boat-deck", f.x - 5.2, f.x + 5.2, -4.3, 4.3),
  ]),
  // Ventilators beside the funnels.
  ...titanic.funnels.flatMap((f, i) =>
    SIDES.flatMap((s) => [
      circle("boat-deck", f.x + 6.6, s * 3.3, 0.7),
      circle("boat-deck", f.x - 6.6, s * 3.3, 0.7),
      ...(i < 3 ? [circle("boat-deck", f.x + 2.2, s * 6.0, 0.5)] : []),
    ])
  ),
  // Benches.
  ...SIDES.flatMap((s) =>
    [22, 16, 4, -2, -9, -20, -33, -66, -74].map((x) =>
      box("boat-deck", x - 0.9, x + 0.9, s * 8.2 - 0.3, s * 8.2 + 0.3)
    )
  ),
  // The davits' feet at the deck edge: eight pairs of boats a side, the
  // first pair the 25 ft cutters, the rest 30 ft lifeboats.
  ...SIDES.flatMap((s) =>
    [59.6, 49.7, 39.3, 28.9, -38.2, -48.6, -58.8, -69.2].flatMap((x, k) => {
      const half = ((k === 0 ? 25 : 30) * FT) / 2 - 0.45;
      return [x - half, x + half].map((dx) => {
        const y = s * (edge(dx) - 0.35);
        return box("boat-deck", dx - 0.25, dx + 0.25, y - 0.25, y + 0.25);
      });
    })
  ),
  // The forward well: the foremast, No. 2 hatch, its cranes, ventilators,
  // bollards.
  circle("forward-well", 85.4, 0, 0.5),
  box("forward-well", 80.6, 84.2, -2.6, 2.6),
  ...SIDES.flatMap((s) => [
    circle("forward-well", 78.6, s * 5.6, 0.6),
    circle("forward-well", 88.6, s * 4.4, 0.5),
    circle("forward-well", 79, s * (edge(79) - 1.0), 0.3),
    circle("forward-well", 88, s * (edge(88) - 1.0), 0.3),
  ]),
  // The forecastle: No. 1 hatch, capstans, the anchor crane, ventilators,
  // bollards.
  box("forecastle", 104.5, 108.6, -2.4, 2.4),
  circle("forecastle", 122.6, 1.6, 0.5),
  circle("forecastle", 122.6, -1.6, 0.5),
  circle("forecastle", 117.8, 0, 0.55),
  circle("forecastle", 121.4, 0, 0.4),
  ...SIDES.flatMap((s) => [
    circle("forecastle", 94.5, s * 3.6, 0.45),
    circle("forecastle", 99, s * 3.2, 0.5),
    ...[96, 104, 112, 120].map((x) =>
      circle("forecastle", x, s * (edge(x) - 1.1), 0.3)
    ),
  ]),
  // The after well: the mainmast, No. 5 hatch, cranes, ventilators,
  // bollards.
  circle("aft-well", -96.4, 0, 0.5),
  box("aft-well", -104.6, -100.8, -2.6, 2.6),
  ...SIDES.flatMap((s) => [
    circle("aft-well", -99.2, s * 5.6, 0.6),
    circle("aft-well", -104, s * 4.4, 0.5),
    circle("aft-well", -101, s * (edge(-101) - 1.0), 0.3),
    circle("aft-well", -94, s * (edge(-94) - 1.0), 0.3),
  ]),
  // The poop: No. 6 hatch, capstans, cranes, ventilators, benches,
  // bollards.
  box("poop", -116.6, -113.2, -2.2, 2.2),
  ...SIDES.flatMap((s) => [
    circle("poop", -125, s * 4.2, 0.45),
    circle("poop", -110.6, s * 4.2, 0.6),
    circle("poop", -117, s * 3.6, 0.5),
    ...[-112, -118, -124].map((x) =>
      box("poop", x - 0.9, x + 0.9, s * 8.5 - 0.3, s * 8.5 + 0.3)
    ),
    ...[-110, -120, -130].map((x) =>
      circle("poop", x, s * (edge(x) - 1.1), 0.3)
    ),
  ]),
];

function stairPair(
  id: string,
  a: { area: string; x: number },
  b: { area: string; x: number },
  y: number
): Stair[] {
  return SIDES.map((s) => ({
    id: `${id}-${s > 0 ? "port" : "starboard"}`,
    from: { area: a.area, at: [a.x, s * y] as V2 },
    to: { area: b.area, at: [b.x, s * y] as V2 },
    widthM: 1.2,
  }));
}

const stairs: Stair[] = [
  ...stairPair(
    "forecastle-ladder",
    { area: "forecastle", x: FORECASTLE_FROM + 1.6 },
    { area: "forward-well", x: FORECASTLE_FROM - 1.2 },
    7
  ),
  ...stairPair(
    "bridge-front-stairs",
    { area: "forward-well", x: BRIDGE_DECK_TO + 1.2 },
    { area: "boat-deck", x: BRIDGE_X - 2.6 },
    9
  ),
  ...stairPair(
    "poop-ladder",
    { area: "aft-well", x: POOP_TO + 1.1 },
    { area: "poop", x: POOP_TO - 1.5 },
    7
  ),
  ...stairPair(
    "second-class-stairs",
    { area: "aft-well", x: BRIDGE_DECK_FROM - 1.2 },
    { area: "boat-deck", x: BOAT_DECK_FROM + 1.6 },
    8
  ),
];

export const TITANIC_WALK: WalkMap = {
  ship: "titanic",
  areas,
  blockers,
  stairs,
  // The starboard boat deck between the second and third funnels, facing
  // forward to the Grand Staircase's starboard door (x 35.5, y −5.45, in
  // interior/titanic.ts), so the way in is ahead from the first step.
  spawn: {
    area: "boat-deck",
    at: [10, -10],
    yaw: Math.atan2(-5.45 - -10, 35.5 - 10),
  },
};
