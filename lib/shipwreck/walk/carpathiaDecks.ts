import {
  CARPATHIA_BOAT_DECK,
  CARPATHIA_BOAT_PLATFORM,
  CARPATHIA_BRIDGE_DECK,
  CARPATHIA_BRIDGE_HOUSE,
  CARPATHIA_MASTS,
  CARPATHIA_STERN_HOUSE,
  CARPATHIA_WELLS,
  carpathia,
} from "../ships/carpathia";
import { deckEdgeOf, sidedOutline } from "./deckEdge";
import type { Blocker, Stair, V2, WalkArea, WalkMap } from "./types";

/**
 * RMS Carpathia's open decks as 17 July 1918, where
 * components/shipwreck/model/carpathiaRecipe.ts draws them (keep them in
 * step; maps.test.ts checks the houses, funnel, masts and platform):
 *
 * - The forecastle (a tier up, ~42 ft from the stem back), over the stem.
 * - The forward well (the upper deck, behind bulwarks) with the foremast
 *   and its two hatches.
 * - The bridge deck forward of the boat deck (the main mast, a hatch, the
 *   forward deckhouse with boats 1 and 2 on its roof, which is not walked).
 * - The bridge deck promenade: a covered walkway along each side under the
 *   boat deck, closed at both ends, reached by a ladder from the boat deck.
 * - The boat deck over it: the bridge house, the funnel's casing, the smoke
 *   room, the after house, the mizzen, the boats' davits.
 * - The open after deck (R21, no raised poop) at the upper deck's height,
 *   from the house to the stern: the white stern deckhouse (a walkway each
 *   side), the boat platform on stanchions, the jigger mast and hatch.
 *
 * Ladders join each to the next. The boat deck's front and the forecastle
 * and well ends over a lower deck are walls, not places to fall.
 */

const FT = 0.3048;
const STEM_X = carpathia.stations[carpathia.stations.length - 1].x;
const STERN_X = carpathia.stations[0].x;
const FC = CARPATHIA_WELLS.forward.toX;
const HF = CARPATHIA_BRIDGE_DECK.toX;
const HA = CARPATHIA_BRIDGE_DECK.fromX;
const F = CARPATHIA_BOAT_DECK.toX;
const A = CARPATHIA_BOAT_DECK.fromX;
const BH0 = CARPATHIA_BRIDGE_HOUSE.fromX;
const SH = CARPATHIA_STERN_HOUSE;
const PF = CARPATHIA_BOAT_PLATFORM;
const [FORE_X, MAIN_X, MIZZEN_X, JIGGER_X] = CARPATHIA_MASTS;
const FUNNEL_X = carpathia.funnels[0].x;
const fromStem = (ft: number) => STEM_X - ft * FT;
const FH0 = fromStem(192);
const FH1 = fromStem(148);
const FWD_HOUSE_INSET = 2.2;
const PROM_INSET = 2.4;
const BOAT_DECK_ROUND = 3;
const FWD_HOUSE_ROUND = 2;

/** The drawn deck edge (carpathiaRecipe's counter, from x -58). */
const edge = deckEdgeOf(carpathia, { fromX: -58, exponent: 2.5 });
const RAIL_INSET = 0.1;
const rail = (x: number) => Math.max(0.5, edge(x) - RAIL_INSET);
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
  halfWidth: (x: number) => number = rail,
  wallsFromX = Infinity
): WalkArea {
  const s = sidedOutline(halfWidth, x0, x1);
  const wallEdges: number[] = [];
  if (ends.fwd === "wall") wallEdges.push(s.fwdEdge);
  if (ends.aft === "wall") wallEdges.push(s.aftEdge);
  const n = s.outline.length;
  for (let i = 0; i < n; i += 1) {
    if (i === s.fwdEdge || i === s.aftEdge) continue;
    const a = s.outline[i];
    const b = s.outline[(i + 1) % n];
    if (Math.max(a[0], b[0]) > wallsFromX) wallEdges.push(i);
  }
  return { id, deck, outline: s.outline, wallEdges };
}

/** One side's strip of the promenade: from `inner` out to the rail. */
function strip(id: string, x0: number, x1: number, s: 1 | -1): WalkArea {
  const inner = (x: number) => edge(x) - PROM_INSET + 0.05;
  const pts: V2[] = [];
  const n = Math.max(1, Math.ceil((x1 - x0) / 0.5));
  const xs = Array.from({ length: n + 1 }, (_, i) => x0 + ((x1 - x0) * i) / n);
  // Counter-clockwise: starboard strip runs fwd along its outer edge, back
  // along its inner; the port strip the reverse.
  const outer = xs.map((x) => [x, s * rail(x)] as V2);
  const inn = xs.map((x) => [x, s * inner(x)] as V2);
  if (s < 0) pts.push(...outer, ...[...inn].reverse());
  else pts.push(...inn, ...[...outer].reverse());
  // Walls: the strip's inner side and both ends; the outer side is a rail
  // over the sea.
  const wallEdges: number[] = [];
  const m = pts.length;
  for (let i = 0; i < m; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % m];
    const isOuter =
      Math.abs(a[1]) > inner(a[0]) + 1 && Math.abs(b[1]) > inner(b[0]) + 1;
    if (!isOuter) wallEdges.push(i);
  }
  return { id, deck: "Bridge", outline: pts, wallEdges };
}

const BOAT_DECK_HW = (x: number) =>
  Math.max(0.5, rail(x) - roundCut(x, F, BOAT_DECK_ROUND));

const areas: WalkArea[] = [
  // Her forecastle's after end is a rail over the well: a wall.
  sided("forecastle", "Forecastle", FC, STEM_X - 2, {
    fwd: "rail",
    aft: "wall",
  }),
  sided("forward-well", "Upper", HF, FC, { fwd: "wall", aft: "wall" }),
  sided("bridge-deck", "Bridge", F, HF, { fwd: "wall", aft: "wall" }),
  sided(
    "boat-deck",
    "Boat",
    A,
    F,
    { fwd: "wall", aft: "wall" },
    BOAT_DECK_HW,
    F - BOAT_DECK_ROUND
  ),
  strip("promenade-port", A + 4.4, F - 5.4, 1),
  strip("promenade-starboard", A + 4.4, F - 5.4, -1),
  sided("after-deck", "Upper", STERN_X + 1, HA, { fwd: "wall", aft: "rail" }),
];

function box(area: string, x0: number, x1: number, y0: number, y1: number) {
  return { kind: "box", area, min: [x0, y0], max: [x1, y1] } as const;
}
function circle(area: string, x: number, y: number, r: number) {
  return { kind: "circle", area, at: [x, y] as V2, r } as const;
}
const SIDES = [1, -1] as const;

/** A house in slices, each as wide as the house is at its widest point. */
function slices(
  area: string,
  x0: number,
  x1: number,
  hw: (x: number) => number,
  step = 4
): Blocker[] {
  const out: Blocker[] = [];
  let x = x0;
  while (x < x1 - 1e-6) {
    const e = Math.min(x1, x + step);
    let w = 0;
    for (let k = 0; k <= 8; k += 1) w = Math.max(w, hw(x + ((e - x) * k) / 8));
    out.push(box(area, x, e, -w, w));
    x = e;
  }
  return out;
}

const BH1 = F - 0.4;
/** A mast's winch houses, one each side. */
const winches = (area: string, x: number) =>
  [-1, 1].map((d) =>
    box(area, x + d * 1.6 - 0.6, x + d * 1.6 + 0.6, -0.8, 0.8)
  );

const blockers: Blocker[] = [
  // The forecastle: capstans, bollards, vents (the recipe's).
  ...SIDES.flatMap((s) => [
    circle("forecastle", STEM_X - 8.5, s * 1.5, 0.5),
    circle("forecastle", FC + 3, s * 2.6, 0.4),
    ...[STEM_X - 6, STEM_X - 11, FC + 1.5].map((x) =>
      circle("forecastle", x, s * (edge(x) - 0.9), 0.3)
    ),
  ]),
  // The forward well: the foremast, its hatches, the winch houses, vents.
  circle("forward-well", FORE_X, 0, 0.5),
  box("forward-well", FORE_X + 3.4, FORE_X + 8.4, -2.4, 2.4),
  box("forward-well", FORE_X - 9.4, FORE_X - 3.4, -2.4, 2.4),
  ...winches("forward-well", FORE_X),
  ...SIDES.flatMap((s) => [
    circle("forward-well", FC - 1.5, s * 3.4, 0.45),
    circle("forward-well", HF + 1.6, s * 4.6, 0.5),
    ...[HF + 3.5, FC - 3.5].map((x) =>
      circle("forward-well", x, s * (edge(x) - 1.0), 0.3)
    ),
  ]),
  // The bridge deck: the forward deckhouse (rounded front, boats 1 and 2 on
  // its roof), the main mast and its winches, the hatch.
  ...slices(
    "bridge-deck",
    FH0,
    FH1,
    (x) =>
      Math.max(
        0.5,
        edge(x) - FWD_HOUSE_INSET - roundCut(x, FH1, FWD_HOUSE_ROUND)
      ),
    2
  ),
  circle("bridge-deck", MAIN_X, 0, 0.5),
  ...winches("bridge-deck", MAIN_X),
  box("bridge-deck", F + 0.5, MAIN_X - 2.4, -2.0, 2.0),
  // The boat deck: the bridge house, the funnel's casing and the funnel,
  // the long smoke room house, the after house, the mizzen, the cowls.
  ...slices("boat-deck", BH0, BH1, () => 5.4),
  box("boat-deck", FUNNEL_X - 3.6, FUNNEL_X + 3.6, -3.6, 3.6),
  circle("boat-deck", FUNNEL_X, 0, (19.5 * FT) / 2),
  box("boat-deck", -27.4, FUNNEL_X - 4.9, -4.2, 4.2),
  box("boat-deck", A + 1.6, A + 10.5, -4.0, 4.0),
  circle("boat-deck", MIZZEN_X, 0, 0.5),
  ...winches("boat-deck", MIZZEN_X),
  ...SIDES.flatMap((s) => [
    circle("boat-deck", FUNNEL_X + 2.6, s * 5.1, 0.5),
    circle("boat-deck", FUNNEL_X - 2.4, s * 5.1, 0.5),
    circle("boat-deck", FUNNEL_X + 6.4, s * 3.0, 0.45),
    circle("boat-deck", -30.2, s * 3.2, 0.4),
    circle("boat-deck", A + 0.9, s * 3.0, 0.4),
  ]),
  // The after deck: the white stern house, the platform's stanchions, the
  // jigger and its winches, a hatch, vents, bollards.
  box("after-deck", SH.fromX, SH.toX, -SH.halfBreadth, SH.halfBreadth),
  circle("after-deck", JIGGER_X, 0, 0.45),
  ...winches("after-deck", JIGGER_X),
  box("after-deck", PF.toX + 0.45, PF.toX + 4.65, -2.3, 2.3),
  ...SIDES.flatMap((s) => {
    const len = PF.toX - PF.fromX;
    const x = (PF.fromX + PF.toX) / 2;
    const e = edge(x);
    return [-1, 1].flatMap((dx) =>
      [0.3, 2.9].map((dy) =>
        circle("after-deck", x + dx * (len / 2 - 0.3), s * (e - dy), 0.25)
      )
    );
  }),
  ...SIDES.flatMap((s) => [
    circle("after-deck", HA - 1.6, s * 4.4, 0.5),
    circle("after-deck", SH.toX + 1.6, s * 3.4, 0.45),
    ...[HA - 2.5, SH.toX + 2.8, STERN_X + 1.8, STERN_X + 4.6].map((x) =>
      circle("after-deck", x, s * (edge(x) - 0.95), 0.3)
    ),
  ]),
  circle("after-deck", STERN_X + 3.2, 1.5, 0.5),
  circle("after-deck", STERN_X + 3.2, -1.5, 0.5),
];

function stairPair(
  id: string,
  a: { area: string; x: number },
  b: { area: string; x: number },
  y: (x: number) => number,
  widthM = 1.2
): Stair[] {
  return SIDES.map((s) => ({
    id: `${id}-${s > 0 ? "port" : "starboard"}`,
    from: { area: a.area, at: [a.x, s * y(a.x)] as V2 },
    to: { area: b.area, at: [b.x, s * y(b.x)] as V2 },
    widthM,
  }));
}
const inboard = (d: number) => (x: number) => edge(x) - d;

const stairs: Stair[] = [
  ...stairPair(
    "forecastle-ladder",
    { area: "forecastle", x: FC + 1.4 },
    { area: "forward-well", x: FC - 1.4 },
    () => 1.3,
    2.0
  ),
  ...stairPair(
    "well-ladder",
    { area: "forward-well", x: HF + 1.4 },
    { area: "bridge-deck", x: HF - 1.4 },
    inboard(1.1)
  ),
  ...stairPair(
    "boat-deck-ladder",
    { area: "bridge-deck", x: F + 1.4 },
    { area: "boat-deck", x: F - 1.4 },
    inboard(2.4)
  ),
  ...stairPair(
    "after-deck-ladder",
    { area: "boat-deck", x: A + 1.4 },
    { area: "after-deck", x: A - 1.4 },
    () => 7
  ),
  // Down to the covered promenade at the boat deck's side, inboard of the
  // davits (the boats hang outboard of them).
  ...stairPair(
    "promenade-ladder",
    { area: "boat-deck", x: -9.7 },
    { area: "promenade-x", x: -9.7 },
    inboard(1.4)
  ).map((s) => ({
    ...s,
    to: {
      ...s.to,
      area: s.id.endsWith("port") ? "promenade-port" : "promenade-starboard",
    },
  })),
];

export const CARPATHIA_WALK: WalkMap = {
  ship: "carpathia",
  areas,
  blockers,
  stairs,
  // Her boat deck's starboard side aft of the funnel, facing the bow.
  spawn: { area: "boat-deck", at: [-18, -6.8], yaw: 0 },
};
