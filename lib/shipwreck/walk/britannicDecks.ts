import {
  BRITANNIC_BOAT,
  BRITANNIC_BOATS,
  BRITANNIC_GANTRY_ARM_DX,
  BRITANNIC_GANTRY_REACH,
  BRITANNIC_GANTRY_ROW_GAP,
  BRITANNIC_GANTRY_SETS,
  britannic,
} from "../ships/britannic";
import { deckEdgeOf, sidedOutline } from "./deckEdge";
import type { Blocker, Stair, V2, WalkArea, WalkMap } from "./types";

/**
 * HMHS Britannic's open decks. She has the Titanic's lines and arrangement
 * (the same five open decks, the same houses, funnels, masts, hatches and
 * stairs, see titanicDecks.ts) on a hull 18 in wider (94 ft), so the
 * railings follow her own deck edge, and her own davits stand on it: five
 * sets of gantry davits (two lattice arms and the bay of six boats between
 * them) and Welin davit pairs, where
 * components/shipwreck/model/britannicRecipe.ts draws them from the same
 * constants (ships/britannic.ts). Keep them in step: maps.test.ts checks
 * every house, funnel, gantry arm, boat stack, davit foot and bench the
 * recipe draws.
 *
 * Boats leave, so the lifeboats themselves are not blockers (as on the
 * Titanic), except a gantry bay's stack: the frame holds the boats and
 * stays, so the bay is a block (and the arms with it).
 */

const FT = 0.3048;
const HALF_LBP = britannic.lbp / 2;
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
const edge = deckEdgeOf(britannic, {
  fromX: -62,
  halfBreadth: britannic.beam / 2,
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

/** The Welin davit positions: one pair of davits per (side, x). */
const WELIN_POSITIONS = BRITANNIC_BOATS.filter((b) => b.kind === "welin")
  .map(({ x, side }) => ({ x, side }))
  .filter(
    (p, i, all) => all.findIndex((q) => q.x === p.x && q.side === p.side) === i
  );

/** Whether a boat (or a gantry bay) stands over a plan point, as drawn. */
function benchUnderBoats(x: number, y: number): boolean {
  const pad = 0.6;
  const half = BRITANNIC_BOAT.beam / 2 + pad;
  return BRITANNIC_BOATS.some((b) => {
    const s = b.side === "port" ? 1 : -1;
    if (Math.abs(x - b.x) >= BRITANNIC_BOAT.length / 2 + pad) return false;
    if (Math.sign(y) !== s) return false;
    const e = edge(b.x);
    // Gantry bays: two rows across; Welin: outboard and inboard.
    const rows =
      b.kind === "gantry"
        ? [0, 1].map(
            (r) =>
              e -
              0.9 -
              BRITANNIC_BOAT.beam / 2 -
              r * (BRITANNIC_BOAT.beam + BRITANNIC_GANTRY_ROW_GAP)
          )
        : [0, 1].map((k) => e - 2.1 - k * (BRITANNIC_BOAT.beam + 0.4));
    return rows.some((r) => Math.abs(y - s * r) < half);
  });
}

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
  ...britannic.funnels.flatMap((f) => [
    circle("boat-deck", f.x, 0, (24.5 * FT) / 2),
    box("boat-deck", f.x - 5.2, f.x + 5.2, -4.3, 4.3),
  ]),
  // Ventilators beside the funnels.
  ...britannic.funnels.flatMap((f, i) =>
    SIDES.flatMap((s) => [
      circle("boat-deck", f.x + 6.6, s * 3.3, 0.7),
      circle("boat-deck", f.x - 6.6, s * 3.3, 0.7),
      ...(i < 3 ? [circle("boat-deck", f.x + 2.2, s * 6.0, 0.5)] : []),
    ])
  ),
  // Benches (the recipe leaves out those a boat or a gantry bay stands over).
  ...SIDES.flatMap((s) =>
    [22, 16, 4, -2, -9, -20, -33, -66, -74]
      .filter((x) => !benchUnderBoats(x, s * 8.2))
      .map((x) =>
        box("boat-deck", x - 0.9, x + 0.9, s * 8.2 - 0.3, s * 8.2 + 0.3)
      )
  ),
  // Her gantry davits: each set's two arms (a pedestal at the deck edge,
  // leaning inboard) and the stack of boats in the bay between them.
  ...BRITANNIC_GANTRY_SETS.flatMap((set) => {
    const s = set.side === "port" ? 1 : -1;
    const stackDepth = 0.9 + 2 * BRITANNIC_BOAT.beam + BRITANNIC_GANTRY_ROW_GAP;
    /** The y range from just outboard of the pedestal, `deep` inboard. */
    const span = (x: number, deep: number): [number, number] => {
      const y0 = s * (edge(x) - 0.5) + s * 0.5;
      const y1 = y0 - s * deep;
      return [Math.min(y0, y1), Math.max(y0, y1)];
    };
    return [
      ...[-1, 1].map((k) => {
        const x = set.x + k * BRITANNIC_GANTRY_ARM_DX;
        const [y0, y1] = span(x, BRITANNIC_GANTRY_REACH + 1);
        return box("boat-deck", x - 0.6, x + 0.6, y0, y1);
      }),
      (() => {
        const [y0, y1] = span(set.x, stackDepth + 0.1);
        return box(
          "boat-deck",
          set.x - BRITANNIC_GANTRY_ARM_DX,
          set.x + BRITANNIC_GANTRY_ARM_DX,
          y0,
          y1
        );
      })(),
    ];
  }),
  // Welin davits' feet at the deck edge: a pair under each double-banked
  // position, the boat's length less its overhang apart.
  ...WELIN_POSITIONS.flatMap(({ x, side }) => {
    const s = side === "port" ? 1 : -1;
    const half = BRITANNIC_BOAT.length / 2 - 0.45;
    return [x - half, x + half].map((dx) => {
      const y = s * (edge(x) - 0.35);
      return box("boat-deck", dx - 0.25, dx + 0.25, y - 0.25, y + 0.25);
    });
  }),
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

export const BRITANNIC_WALK: WalkMap = {
  ship: "britannic",
  areas,
  blockers,
  stairs,
  // The starboard boat deck between the second and third funnels, facing
  // the bow, clear of the Welin boats' bay (y -9) so he does not start in
  // a boat.
  spawn: { area: "boat-deck", at: [10, -6.5], yaw: 0 },
};
