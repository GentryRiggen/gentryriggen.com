import { CONCORDIA_BOATS, concordia } from "../ships/concordia";
import {
  CONCORDIA_AFT_GLASS,
  CONCORDIA_BOAT,
  CONCORDIA_CASING,
  CONCORDIA_FUNNEL_OVAL,
  CONCORDIA_HALL_POOL,
  CONCORDIA_LIDO_AFT,
  CONCORDIA_LIDO_FWD,
  CONCORDIA_LIFERAFT_RACKS,
  CONCORDIA_MAST_X,
  CONCORDIA_POOL_GLASS,
  CONCORDIA_POOLS,
  CONCORDIA_RADOMES,
  CONCORDIA_RAILS,
  CONCORDIA_RECESS,
  CONCORDIA_RECESS_INSET,
  CONCORDIA_SLIDE,
  CONCORDIA_SPA,
  CONCORDIA_SPORTS_DECK,
} from "../ships/concordiaLayout";
import { deckEdgeOf, sidedOutline } from "./deckEdge";
import type { Blocker, Stair, V2, WalkArea, WalkMap } from "./types";

/**
 * The Costa Concordia's open decks as on 13 January 2012, where
 * components/shipwreck/model/concordiaRecipe.ts draws them, from the same
 * constants (`ships/concordiaLayout.ts`); maps.test.ts checks every house,
 * pool, slide, mast, radome, boat, liferaft rack and rail the recipe draws.
 * Heights are her game decks (`spec.decks`, the model's numbering), not
 * Costa's: the model's pool decks (12/13) are about three above her real
 * Lido (Costa's deck 9) and Belvedere pool deck (11).
 *
 * - `lido-aft` (deck 13; Costa's 11): the pine pool deck aft of the glass
 *   roof, with the aft pool, its two glass houses round the funnel and
 *   the funnel's casing.
 * - `pool-hall` (deck 12; Costa's Lido, 9): under the glass roof, round
 *   the midships pool (its basin a blocker, its edge walkable). Where you
 *   start, starboard of the pool, facing forward.
 * - `lido-fwd` (deck 13): forward of the glass roof, the forward pool and
 *   the yellow water slide's tower, to the spa's after wall.
 * - `aft-terrace` (deck 12; Costa's 10): the terrace under the lido's
 *   after end, deck 11's roof.
 * - `sports-deck` (deck 14 + its 0.35 m court; Costa's 12): over the spa,
 *   round the radar mast.
 * - `boat-deck-p`, `boat-deck-s` (deck 4, both Costa's and the model's):
 *   the promenade in the boat recess, between its wall and the boats.
 *
 * Stairs (the walk's teleport, the eyes eased) join the lidos to the pool
 * hall through its glass doors, the aft lido to the terrace, the forward
 * lido to the sports deck, and a stair tower from each lido to each side's
 * boat deck (real ships do that inside). The boat-deck ends are doors in
 * the recess wall, beside it, so walking the promenade never takes one.
 *
 * Rulings (spec "Rulings Gentry may revisit"):
 * - The recess is 7.4 m deep (was 4.8 m) so a promenade about 3 m wide
 *   runs inboard of the boats.
 * - Her boats (and their davits) are blockers on the boat deck all night:
 *   the map has no way to drop one when it is lowered, and the gap they
 *   leave is only out to her rail.
 * - The lidos' and sports deck's side rails stand over a lower deck (the
 *   strip beside the block below), so they are walls, not sea railings: a
 *   jump never goes over them. Only the boat deck's and terrace's sides
 *   are over the sea.
 */

const STERN_X = concordia.stations[0].x;
/** Her drawn deck edge: the stations' top half-breadths (her hull has no counter rounding). */
const edge = deckEdgeOf(concordia, { fromX: STERN_X, exponent: 2 });
/** The rails stand 10 cm inboard of the edge. */
const RAIL_INSET = 0.1;
const rail = (x: number) => Math.max(0.5, edge(x) - RAIL_INSET);
const FUNNEL_X = concordia.funnels[0].x;
const R = CONCORDIA_RAILS;
const SIDES = [1, -1] as const;

type End = "wall" | "rail";

/** An area across her between x0 and x1, its sides at ±halfWidth(x). */
function sided(
  id: string,
  deck: string,
  x0: number,
  x1: number,
  halfWidth: (x: number) => number,
  walls: { sides: End; fwd: End; aft: End },
  raiseM?: number
): WalkArea {
  const s = sidedOutline(halfWidth, x0, x1);
  const wallEdges: number[] = [];
  const n = s.outline.length;
  for (let i = 0; i < n; i += 1) {
    const kind =
      i === s.fwdEdge ? walls.fwd : i === s.aftEdge ? walls.aft : walls.sides;
    if (kind === "wall") wallEdges.push(i);
  }
  return {
    id,
    deck,
    ...(raiseM !== undefined && { raiseM }),
    outline: s.outline,
    wallEdges,
  };
}

/** One side of a sided outline: [x, +halfWidth] from x0 to x1, thinned. */
function side(hw: (x: number) => number, x0: number, x1: number): V2[] {
  const s = sidedOutline(hw, x0, x1);
  return s.outline.slice(0, s.fwdEdge + 1).map(([x, y]) => [x, -y] as V2);
}

/**
 * One side's boat deck: from the recess wall out to her rail, between the
 * recess's ends. The rail is over the sea; the wall and both ends (the
 * flush tiers) hold as walls.
 */
function boatDeck(id: string, s: 1 | -1): WalkArea {
  const [x0, x1] = CONCORDIA_RECESS;
  const outer = side(rail, x0, x1).map(([x, y]) => [x, s * y] as V2);
  const inner = side((x) => edge(x) - CONCORDIA_RECESS_INSET, x0, x1).map(
    ([x, y]) => [x, s * y] as V2
  );
  // Counter-clockwise: starboard runs forward along the rail and back along
  // the wall; port forward along the wall and back along the rail.
  const outline =
    s < 0
      ? [...outer, ...[...inner].reverse()]
      : [...inner, ...[...outer].reverse()];
  const railEdges = new Set<number>();
  const first = s < 0 ? 0 : inner.length;
  for (let i = first; i < first + outer.length - 1; i += 1) railEdges.add(i);
  const wallEdges: number[] = [];
  for (let i = 0; i < outline.length; i += 1)
    if (!railEdges.has(i)) wallEdges.push(i);
  return { id, deck: "4", outline, wallEdges };
}

const LIDO_HW = () => R.lidoHalfWidth;
const ALL_WALLS = { sides: "wall", fwd: "wall", aft: "wall" } as const;

const areas: WalkArea[] = [
  sided(
    "lido-aft",
    "13",
    R.lidoAftX,
    CONCORDIA_LIDO_AFT.x1,
    LIDO_HW,
    ALL_WALLS
  ),
  sided(
    "pool-hall",
    "12",
    CONCORDIA_POOL_GLASS.x0,
    CONCORDIA_POOL_GLASS.x1,
    () => CONCORDIA_POOL_GLASS.halfWidth,
    ALL_WALLS
  ),
  sided(
    "lido-fwd",
    "13",
    CONCORDIA_LIDO_FWD.x0,
    CONCORDIA_LIDO_FWD.x1,
    LIDO_HW,
    ALL_WALLS
  ),
  // Her sides over the sea; the after end over deck 11's terrace, the
  // forward end the lido's block.
  sided("aft-terrace", "12", R.terraceAftX, CONCORDIA_LIDO_AFT.x0, rail, {
    sides: "rail",
    fwd: "wall",
    aft: "wall",
  }),
  sided(
    "sports-deck",
    "14",
    R.sportsX[0],
    R.sportsX[1],
    (x) => edge(x) - R.sportsInset,
    ALL_WALLS,
    CONCORDIA_SPORTS_DECK.h
  ),
  boatDeck("boat-deck-p", 1),
  boatDeck("boat-deck-s", -1),
];

function box(area: string, x0: number, x1: number, y0: number, y1: number) {
  return { kind: "box", area, min: [x0, y0], max: [x1, y1] } as const;
}
function circle(area: string, x: number, y: number, r: number) {
  return { kind: "circle", area, at: [x, y] as V2, r } as const;
}
function poolBox(area: string, p: (typeof CONCORDIA_POOLS)[number]) {
  const [cx, cy] = p.c;
  const [lx, ly] = p.size;
  return box(area, cx - lx / 2, cx + lx / 2, cy - ly / 2, cy + ly / 2);
}

const glassHouses = CONCORDIA_AFT_GLASS.spans.map(([a, b]) =>
  box(
    "lido-aft",
    FUNNEL_X + a,
    FUNNEL_X + b,
    -CONCORDIA_AFT_GLASS.halfWidth,
    CONCORDIA_AFT_GLASS.halfWidth
  )
);

/** The radomes standing on a walked deck (not on a glass house's roof). */
function radomeBlockers(): Blocker[] {
  const out: Blocker[] = [];
  for (const d of CONCORDIA_RADOMES) {
    const onHouse = glassHouses.some(
      (h) =>
        d.x - d.r >= h.min[0] &&
        d.x + d.r <= h.max[0] &&
        d.y - d.r >= h.min[1] &&
        d.y + d.r <= h.max[1]
    );
    if (onHouse) continue;
    const area =
      d.deck === "14"
        ? "sports-deck"
        : d.x >= CONCORDIA_LIDO_FWD.x0
          ? "lido-fwd"
          : "lido-aft";
    out.push(circle(area, d.x, d.y, d.r));
  }
  return out;
}

/** The boats in their davits, out to her rail (one box a boat). */
function boatBlockers(): Blocker[] {
  const { length, beam } = CONCORDIA_BOAT;
  return CONCORDIA_BOATS.map((b) => {
    const s = b.side === "port" ? 1 : -1;
    const e = edge(b.x);
    // recessBoats: the boat's outboard side 0.35 m in from her edge.
    const inboard = e - 0.35 - beam;
    const out = e - RAIL_INSET;
    const [y0, y1] = s > 0 ? [inboard, out] : [-out, -inboard];
    return box(
      s > 0 ? "boat-deck-p" : "boat-deck-s",
      b.x - length / 2,
      b.x + length / 2,
      y0,
      y1
    );
  });
}

/**
 * The liferaft racks (cruiseKit's `liferaftRacks`: canisters 1.9 m apart,
 * 1.5 m long, 0.36 m round, 1.1 m in from her edge), out to her rail.
 */
function raftBlockers(): Blocker[] {
  const out: Blocker[] = [];
  const { fromX, count } = CONCORDIA_LIFERAFT_RACKS;
  for (const s of SIDES)
    for (const x0 of fromX) {
      const xs = Array.from({ length: count }, (_, i) => x0 + i * 1.9);
      const lo = Math.min(...xs.map(edge)) - 1.1 - 0.36;
      const hi = Math.max(...xs.map(edge)) - RAIL_INSET;
      const [y0, y1] = s > 0 ? [lo, hi] : [-hi, -lo];
      out.push(
        box(
          s > 0 ? "boat-deck-p" : "boat-deck-s",
          xs[0] - 0.75,
          xs[count - 1] + 0.75,
          y0,
          y1
        )
      );
    }
  return out;
}

const [SLIDE_X, SLIDE_Y] = CONCORDIA_SLIDE.c;
/** The slide's coil (cruiseKit's `waterSlide`: 3.4 m round) and its tube. */
const SLIDE_COIL_M = 3.4 + 0.55;

const blockers: Blocker[] = [
  // The aft lido: the glass houses, the funnel's casing and the funnel,
  // the aft pool's basin (half under the after glass house).
  ...glassHouses,
  box(
    "lido-aft",
    FUNNEL_X - CONCORDIA_CASING.halfLength,
    FUNNEL_X + CONCORDIA_CASING.halfLength,
    -CONCORDIA_CASING.halfWidth,
    CONCORDIA_CASING.halfWidth
  ),
  circle("lido-aft", FUNNEL_X, 0, CONCORDIA_FUNNEL_OVAL.semiB),
  poolBox("lido-aft", CONCORDIA_POOLS[0]),
  // The pool hall: the pool's basin (walk round its edge).
  poolBox("pool-hall", CONCORDIA_HALL_POOL),
  // The forward lido: the forward pool, the slide's tower with its coil
  // and its run-out aft at knee height, the spa's after wall.
  poolBox("lido-fwd", CONCORDIA_POOLS[1]),
  circle("lido-fwd", SLIDE_X, SLIDE_Y, SLIDE_COIL_M),
  box("lido-fwd", SLIDE_X - 6.5, SLIDE_X, SLIDE_Y + 2.45, SLIDE_Y + 3.95),
  box(
    "lido-fwd",
    CONCORDIA_SPA[0] - 0.2,
    CONCORDIA_SPA[0],
    -R.lidoHalfWidth,
    R.lidoHalfWidth
  ),
  // The sports deck: the radar mast's pole and its two legs.
  box("sports-deck", CONCORDIA_MAST_X - 0.6, CONCORDIA_MAST_X + 0.6, -1.9, 1.9),
  ...radomeBlockers(),
  ...boatBlockers(),
  ...raftBlockers(),
];

/** A stair door in the recess wall on one side's boat deck, at x. */
function recessDoor(x: number, s: 1 | -1): V2 {
  return [x, s * (edge(x) - CONCORDIA_RECESS_INSET + 0.7)];
}
const boatDeckOf = (s: 1 | -1) => (s > 0 ? "boat-deck-p" : "boat-deck-s");
const sideName = (s: 1 | -1) => (s > 0 ? "port" : "starboard");

const stairs: Stair[] = [
  // The pool hall's glass doors, fore and aft, a short stair down.
  {
    id: "pool-hall-aft",
    from: { area: "lido-aft", at: [CONCORDIA_POOL_GLASS.x0 - 1.4, 0] },
    to: { area: "pool-hall", at: [CONCORDIA_POOL_GLASS.x0 + 1.4, 0] },
    widthM: 2,
  },
  {
    id: "pool-hall-fwd",
    from: { area: "pool-hall", at: [CONCORDIA_POOL_GLASS.x1 - 1.4, 0] },
    to: { area: "lido-fwd", at: [CONCORDIA_POOL_GLASS.x1 + 1.4, 0] },
    widthM: 2,
  },
  // Down from the aft lido's after end to the terrace.
  {
    id: "terrace-stair",
    from: { area: "lido-aft", at: [R.lidoAftX + 1.4, 0] },
    to: { area: "aft-terrace", at: [CONCORDIA_LIDO_AFT.x0 - 1.4, 0] },
    widthM: 1.2,
  },
  // Up from the forward lido onto the sports deck over the spa.
  {
    id: "sports-stair",
    from: { area: "lido-fwd", at: [CONCORDIA_SPA[0] - 1.4, 0] },
    to: { area: "sports-deck", at: [R.sportsX[0] + 1.4, 0] },
    widthM: 1.2,
  },
  // The stair towers: from each lido down to each side's boat deck.
  ...SIDES.flatMap((s): Stair[] => [
    {
      id: `aft-tower-${sideName(s)}`,
      from: { area: "lido-aft", at: [-94, s * 10] },
      to: { area: boatDeckOf(s), at: recessDoor(-95, s) },
      widthM: 1.2,
    },
    {
      id: `fwd-tower-${sideName(s)}`,
      from: { area: "lido-fwd", at: [55, s * 12] },
      to: { area: boatDeckOf(s), at: recessDoor(49, s) },
      widthM: 1.2,
    },
  ]),
];

export const CONCORDIA_WALK: WalkMap = {
  ship: "concordia",
  areas,
  blockers,
  stairs,
  // The pool hall, starboard of the pool, facing forward (1.18 puts the
  // Squok club's door in the forward glass wall).
  spawn: { area: "pool-hall", at: [12, -7], yaw: 0 },
};
