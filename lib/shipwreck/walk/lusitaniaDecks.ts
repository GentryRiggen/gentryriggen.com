import { LUSITANIA_BOATS, lusitania } from "../ships/lusitania";
import { deckEdgeOf, sidedOutline } from "./deckEdge";
import type { Blocker, Stair, V2, WalkArea, WalkMap } from "./types";

/**
 * The Lusitania's open decks, from her general arrangement ("RMS
 * Lusitania deck plans", Wikimedia Commons) as ships/lusitania.ts and the
 * 3D model measure it (the superstructure's ends, the boats, the funnels;
 * the fittings where components/shipwreck/model/lusitaniaRecipe.ts draws
 * them, so you bump into what you see; keep them in step).
 *
 * - The boat deck, from the bridge front (144 ft from the forward
 *   perpendicular) to its after end. A long house stands on it, 3.6 m in
 *   from each side (the funnels, skylights and the navigating bridge are
 *   on its roof), so you walk the two promenades beside it and round its
 *   ends, under the boats' davits.
 * - The foredeck ("forecastle"), plated up to the Promenade (B) deck from
 *   the house front to the stem: one long deck, no well.
 * - The gap at the mainmast (Shelter deck, C) between the boat deck and the
 *   second class house, and the second class house's own boat deck
 *   ("aft-deck").
 * - The stern: the Shelter deck, open from the second class house aft (no
 *   raised poop).
 *
 * Ladders join each to the next: the boat deck's front down to the
 * foredeck, its after end down into the mast gap, the gap up to the after
 * deck, and the after deck down to the stern.
 */

const FT = 0.3048;
const [aftBox, , longBox] = lusitania.superstructure;
/** The bridge front, the boat deck's after end. */
const F = longBox.toX;
const A = longBox.fromX;
/** The second class house, its forward end short of the mainmast's gap. */
const X0 = aftBox.fromX;
const X1 = Math.min(aftBox.toX, A) - 1.2;
const MAIN_X = (A + X1) / 2;
const STEM_X = 116.64;
const STERN_X = -123.24;
const FP = lusitania.lbp / 2;
const FOREMAST_X = FP - 100 * FT;
/** The house on the boat deck: 3.6 m in from the sides, 3 m short of its ends. */
const HOUSE_INSET = 3.6;
/** The boat deck's rounded front (radius) and the house's. */
const DECK_ROUND = 4;
const HOUSE_ROUND = 6;

/** The drawn deck edge (lusitaniaRecipe's counter: from x −85). */
const edge = deckEdgeOf(lusitania, { fromX: -85, exponent: 2.4 });
const RAIL_INSET = 0.1;
const rail = (x: number) => Math.max(0.5, edge(x) - RAIL_INSET);
/** How far a rounded front of radius r cuts in at x (front at `front`). */
function roundCut(x: number, front: number, r: number): number {
  const d = x - (front - r);
  if (d <= 0) return 0;
  return r - Math.sqrt(Math.max(0, r * r - d * d));
}

function sided(
  id: string,
  deck: string,
  x0: number,
  x1: number,
  ends: { fwd: "wall" | "rail"; aft: "wall" | "rail" },
  halfWidth: (x: number) => number = rail
): WalkArea {
  const s = sidedOutline(halfWidth, x0, x1);
  const wallEdges: number[] = [];
  if (ends.fwd === "wall") wallEdges.push(s.fwdEdge);
  if (ends.aft === "wall") wallEdges.push(s.aftEdge);
  return { id, deck, outline: s.outline, wallEdges };
}

const areas: WalkArea[] = [
  // Her ends over a lower deck are walls: you cannot slide off them into
  // the sea, only off the sides.
  sided("boat-deck", "Boat", A, F, { fwd: "wall", aft: "wall" }, (x) =>
    Math.max(0.5, rail(x) - roundCut(x, F, DECK_ROUND))
  ),
  sided("forecastle", "B", F, STEM_X - 2, { fwd: "rail", aft: "wall" }),
  sided("mast-gap", "C", X1, A, { fwd: "wall", aft: "wall" }),
  sided("aft-deck", "Boat", X0, X1, { fwd: "wall", aft: "wall" }),
  sided("stern", "C", STERN_X + 1, X0, { fwd: "wall", aft: "rail" }),
];

function box(area: string, x0: number, x1: number, y0: number, y1: number) {
  return { kind: "box", area, min: [x0, y0], max: [x1, y1] } as const;
}
function circle(area: string, x: number, y: number, r: number) {
  return { kind: "circle", area, at: [x, y] as V2, r } as const;
}
const SIDES = [1, -1] as const;

/**
 * The boat deck's house in 6 m lengths (2 m at its rounded front), each as
 * wide as the house is at the widest point of its length, so the
 * promenade is never wider than the drawn one.
 */
function houseBoxes(): Blocker[] {
  const x0 = A + 3;
  const front = F - 3;
  const out: Blocker[] = [];
  const hw = (x: number) =>
    Math.max(0.5, edge(x) - HOUSE_INSET - roundCut(x, front, HOUSE_ROUND));
  let x = x0;
  while (x < front - 1e-6) {
    const len = x < front - HOUSE_ROUND ? 6 : 2;
    const x1 = Math.min(front, x + len);
    let w = 0;
    for (let k = 0; k <= 8; k += 1) w = Math.max(w, hw(x + ((x1 - x) * k) / 8));
    out.push(box("boat-deck", x, x1, -w, w));
    x = x1;
  }
  return out;
}

const blockers: Blocker[] = [
  ...houseBoxes(),
  // The funnels (25 ft across) on the house's roof: blocked by the house
  // too, and their own circles for the scene and the tests.
  ...lusitania.funnels.map((f) => circle("boat-deck", f.x, 0, (25 * FT) / 2)),
  // The davits' feet at the deck edge, a pair for each wooden boat.
  ...LUSITANIA_BOATS.filter((b) => b.kind === "wooden").flatMap((b) => {
    const s = b.side === "port" ? 1 : -1;
    const half = (30 * FT) / 2 - 0.45;
    return [b.x - half, b.x + half].map((x) => {
      const y = s * (edge(x) - 0.4);
      return box("boat-deck", x - 0.25, x + 0.25, y - 0.25, y + 0.25);
    });
  }),
  // The foredeck: the foremast, hatch, windlasses, capstans, the anchor
  // crane, ventilators, bollards (feet from the stem).
  circle("forecastle", FOREMAST_X, 0, 0.55),
  box("forecastle", STEM_X - 69 * FT, STEM_X - 59 * FT, -1.8, 1.8),
  circle("forecastle", STEM_X - 16 * FT, 0, 0.5),
  ...SIDES.flatMap((s) => [
    circle("forecastle", STEM_X - 108 * FT, s * 4.4, 0.45),
    circle("forecastle", STEM_X - 80 * FT, s * 3.4, 0.45),
    circle("forecastle", STEM_X - 94 * FT, s * 1.6, 0.6),
    circle("forecastle", F + 3, s * 6.0, 0.6),
    circle("forecastle", STEM_X - 60 * FT, s * 3.4, 0.5),
    ...[100, 64, 34].map((ft) => {
      const x = STEM_X - ft * FT;
      return circle("forecastle", x, s * (edge(x) - 1.0), 0.3);
    }),
  ]),
  // The mainmast in its gap.
  circle("mast-gap", MAIN_X, 0, 0.52),
  // The after deck: the second class lounge's skylight, ventilators,
  // benches.
  box("aft-deck", -96, -80, -5.2, 5.2),
  ...SIDES.flatMap((s) => [
    circle("aft-deck", X1 - 3, s * 7.8, 0.6),
    circle("aft-deck", X0 + 6, s * 4.4, 0.55),
    circle("aft-deck", X0 + 5, s * 7.4, 0.4),
    ...[X0 + 3.3, X0 + 5.7].map((x) =>
      box("aft-deck", x - 0.9, x + 0.9, s * 6.6 - 0.3, s * 6.6 + 0.3)
    ),
  ]),
  // The stern: hatch, capstans, ventilators, bollards.
  box("stern", X0 - 8.7, X0 - 6.1, -1.6, 1.6),
  ...SIDES.flatMap((s) => [
    circle("stern", X0 - 12.2, s * 2.6, 0.45),
    circle("stern", X0 - 6, s * 4.2, 0.5),
    ...[X0 - 4, X0 - 10, X0 - 15].map((x) =>
      circle("stern", x, s * (edge(x) - 1.0), 0.3)
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

/** The mast gap's middle (its ladders' feet). */
const GAP_X = (X1 + A) / 2;

const stairs: Stair[] = [
  ...stairPair(
    "foredeck-stairs",
    { area: "boat-deck", x: F - 1.5 },
    { area: "forecastle", x: F + 1.2 },
    4
  ),
  ...stairPair(
    "mast-gap-stairs",
    { area: "boat-deck", x: A + 1.2 },
    { area: "mast-gap", x: GAP_X },
    8
  ),
  ...stairPair(
    "aft-deck-ladder",
    { area: "mast-gap", x: GAP_X },
    { area: "aft-deck", x: X1 - 1.4 },
    10.5
  ),
  ...stairPair(
    "stern-ladder",
    { area: "aft-deck", x: X0 + 1.3 },
    { area: "stern", x: X0 - 1.1 },
    3.5
  ),
];

export const LUSITANIA_WALK: WalkMap = {
  ship: "lusitania",
  areas,
  blockers,
  stairs,
  // The starboard promenade beside the boat deck's house, aft of the third
  // funnel, facing the bow.
  spawn: { area: "boat-deck", at: [8, -11.4], yaw: 0 },
};
