/**
 * Where the Costa Concordia's model puts the things you walk among: the
 * numbers `components/shipwreck/model/concordiaRecipe.ts` draws her from
 * and `lib/shipwreck/walk/concordiaDecks.ts` walks her by (lib cannot
 * import components, so they live here and the recipe imports them).
 * Changing one moves the model and the walk together;
 * `walk/__tests__/maps.test.ts` checks the walk against what the recipe
 * draws.
 *
 * Ship frame: metres, x forward, y to port. Decks are her game decks
 * (`spec.decks`, the model's numbering), not Costa's.
 */

/** The boat recess on decks 4–5, aft to forward. */
export const CONCORDIA_RECESS: [number, number] = [-101, 104];
/**
 * The recess's back wall, in from her side. 7.4 m (1.17; 4.8 m before):
 * her boats fill the outer 4.25 m, so this leaves a promenade about 3 m
 * wide inboard of them on deck 4 (on the real ship deck 4 was the wide
 * promenade where people mustered).
 */
export const CONCORDIA_RECESS_INSET = 7.4;
/** 150-person lifeboats, about 10.8 by 3.9 m (model README). */
export const CONCORDIA_BOAT = { length: 10.8, beam: 3.9, depth: 2.0 };
/** Liferaft racks at each end of the boat rows: five canisters from each x. */
export const CONCORDIA_LIFERAFT_RACKS = {
  fromX: [91.5, -99] as const,
  count: 5,
};

/** The spa, two decks over the bridge (decks 12–13), aft to forward. */
export const CONCORDIA_SPA: [number, number] = [58, 116];
/** Deck 11's after end: the terrace on its roof (deck 12) runs aft to it. */
export const CONCORDIA_DECK11_AFT = -115;

/** A block on her top: its ends and half-width. */
export interface ConcordiaSpan {
  x0: number;
  x1: number;
  halfWidth: number;
}
/** The aft pool deck (deck 12's block; you walk its roof, deck 13). */
export const CONCORDIA_LIDO_AFT: ConcordiaSpan = {
  x0: -97,
  x1: -2,
  halfWidth: 15.5,
};
/** The midships pool under its glass roof (deck 12, between the lidos). */
export const CONCORDIA_POOL_GLASS: ConcordiaSpan = {
  x0: -2,
  x1: 34,
  halfWidth: 13.5,
};
/** The forward pool deck (deck 12's block; its roof, deck 13). */
export const CONCORDIA_LIDO_FWD: ConcordiaSpan = {
  x0: 34,
  x1: 58,
  halfWidth: 15.5,
};
/** The sports deck on the spa's roof (deck 14): 0.35 m thick, 4 m in. */
export const CONCORDIA_SPORTS_DECK = {
  x0: CONCORDIA_SPA[0] + 0.5,
  x1: CONCORDIA_SPA[1] - 8,
  inset: 4,
  h: 0.35,
};

/**
 * The aft pool's glass houses on deck 13, fore and aft of the funnel: x
 * from the funnel's middle, their half-width and height.
 */
export const CONCORDIA_AFT_GLASS = {
  spans: [
    [-34, -9],
    [9, 34],
  ] as const,
  halfWidth: 13,
  h: 2.4,
};
/** The funnel's casing on deck 13: half its length (from the funnel's x), half-width, height. */
export const CONCORDIA_CASING = { halfLength: 10, halfWidth: 6, h: 1.4 };
/** The funnel: an upright oval, its half-length and half-width. */
export const CONCORDIA_FUNNEL_OVAL = { semiA: 7.5, semiB: 4.6 };

/** The water slide's tower (deck 13): its middle, width and height. */
export const CONCORDIA_SLIDE = {
  c: [42, -8] as [number, number],
  size: 2.2,
  h: 8.4,
};
/** The two open pools on deck 13 (the aft one, the forward one by the slide). */
export const CONCORDIA_POOLS: readonly {
  c: readonly [number, number];
  size: readonly [number, number];
}[] = [
  { c: [-86, 0], size: [10, 7] },
  { c: [50, 5], size: [8, 6] },
];
/**
 * The pool in the glass-roofed pool hall (deck 12): its basin, the room
 * kit's `pool-edge` (9 × 4.5 m, its walkable coping round it: the
 * interior's `POOL_BASIN_LX`, `_LY`). The model draws the hall solid; the
 * room kit draws the hall and the pool (lib/shipwreck/interior/concordia.ts,
 * spec "The pool hall"), whose basin the walk blocks.
 */
export const CONCORDIA_HALL_POOL = {
  c: [16, 0] as const,
  size: [9, 4.5] as const,
};

/**
 * The glass dome over the pool hall (a retractable "magrodome" [WPC]):
 * its middle's x, half-length, half-width and height, standing on the
 * hall's roof (deck 13). The model draws it; while walking on her the room
 * kit draws it in glass instead.
 */
export const CONCORDIA_POOL_DOME = { x: 16, a: 17.5, b: 13, c: 3.6 };

/** The radar mast on the sports deck. */
export const CONCORDIA_MAST_X = 80;
/** White radar domes: plan point, the deck under them, height of the middle over it, radius. */
export const CONCORDIA_RADOMES: readonly {
  x: number;
  y: number;
  deck: string;
  dz: number;
  r: number;
}[] = [
  { x: -75, y: 6, deck: "13", dz: 2.4, r: 2.2 },
  { x: -22, y: 0, deck: "13", dz: 2.4, r: 2.2 },
  { x: 50, y: -6, deck: "13", dz: 2.4, r: 2.0 },
  { x: 64, y: 6, deck: "14", dz: 2.2, r: 2.0 },
  { x: 72, y: -5, deck: "14", dz: CONCORDIA_SPORTS_DECK.h + 2.4, r: 2.2 },
];

/** The open decks' rails: the lidos' sides and after end, the terrace's after end, the sports deck. */
export const CONCORDIA_RAILS = {
  lidoHalfWidth: 15.4,
  lidoAftX: -96.8,
  terraceAftX: -114.8,
  /** The sports deck's rails: in from her edge, and their ends. */
  sportsInset: 4.1,
  sportsX: [CONCORDIA_SPA[0] + 0.7, CONCORDIA_SPA[1] - 16] as const,
};
