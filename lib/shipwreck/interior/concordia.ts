import {
  CONCORDIA_HALL_POOL,
  CONCORDIA_POOL_DOME,
  CONCORDIA_POOL_GLASS,
} from "../ships/concordiaLayout";
import type { V2 } from "../walk/types";
import type { Furniture, InteriorMap, Room, ShutDoor } from "./types";

/**
 * The Costa Concordia's rooms. 1.17: only the pool hall, a deck room (her
 * open decks are `walk/concordiaDecks.ts`, which takes the hall from
 * here); 1.18 adds the rooms inside her. Positions are her game decks (the
 * model's numbering, `spec.decks`), Costa's noted alongside. Checked by
 * __tests__/concordiaMap.test.ts.
 *
 * - **The pool hall** (deck 12; Costa's Lido Ercole on deck 9): the
 *   midships pool under its glass roof, inside the model's `pool-glass`
 *   block (x −2..34, y ±13.5). Glass sides, a flat glass roof at the
 *   lidos' height with the model's glass dome over the pool (the kit
 *   draws both see-through), solid ends where the lido decks stand higher
 *   with a pair of glass doors in each (the stairs up to the lidos), a
 *   tiled floor, the pool with its walkable coping, sun loungers along
 *   both glass sides. Walked as an open deck: deck speed, jumping, never
 *   closed.
 *
 * Rulings so far (spec "Rulings Gentry may revisit"; each can be revisited):
 * - The boat recess is 7.4 m deep (was 4.8 m), so a promenade about 3 m
 *   wide runs inboard of the boats (`concordiaDecks.ts`).
 * - Her boats (and their davits) block the boat deck until each is
 *   lowered; then the gap it leaves is walkable, out to her rail.
 * - The lidos' and sports deck's side rails stand over a lower deck, so
 *   they are walls, not sea railings: a jump never goes over them.
 * - Her lean: from 8° walking uphill is slower (to 55% at 30°) and a drift
 *   up to 0.8 m/s carries you downhill, never through a door or stair,
 *   over a rail or into deep water; deck walking ends at 40°.
 * - The pool hall is a deck room (drawn by the room kit, walked with deck
 *   rules, never closes). Its layout is invented on her real space: one
 *   9 × 4.5 m pool in the middle (the real Lido Ercole had a pool and
 *   whirlpools under a sliding glass roof), 22 loungers in two rows along
 *   the glass, glass doors fore and aft where the stairs go up to the
 *   lidos, the model's 3.6 m dome over 2.8 m glass sides.
 * - The pool's water stands at its low rim (spilling as she leans): it is
 *   never refilled, and never runs back.
 */

/** The hall's plan: the model's `pool-glass` block. */
const { x0: X0, x1: X1, halfWidth: HW } = CONCORDIA_POOL_GLASS;

/** The hall's glass sides: as high as the lido decks either side (m). */
export const POOL_HALL_EAVES_M = 2.8;

/**
 * The pool hall: counter-clockwise from the starboard after corner, so its
 * edges are the starboard glass (0), the forward end (1), the port glass
 * (2) and the after end (3).
 */
const poolHall: Room = {
  id: "pool-hall",
  kind: "pool-hall",
  deck: "12",
  outline: [
    [X0, -HW],
    [X1, -HW],
    [X1, HW],
    [X0, HW],
  ],
  ceilingM: POOL_HALL_EAVES_M,
  zone: "pool-hall",
  look: {
    finish: "glass",
    floor: "tile",
    lamp: "ceiling",
    solidEdges: [1, 3],
    // Her model's glass dome, drawn by the kit (see-through) while walking.
    dome: {
      at: [CONCORDIA_POOL_DOME.x, 0],
      a: CONCORDIA_POOL_DOME.a,
      b: CONCORDIA_POOL_DOME.b,
      rise: CONCORDIA_POOL_DOME.c,
    },
  },
  water: "sea",
  deckRoom: true,
};

/**
 * The loungers: a row along each glass side, heads 0.25 m off the glass
 * (too narrow to get into), facing the pool across the hall, 2.6 m apart
 * with a gap where the walk's heel tests stand (x 30).
 */
const LOUNGER_XS = [1, 3.6, 6.2, 8.8, 11.4, 14, 16.6, 19.2, 21.8, 24.4, 27];
/** A lounger's length (its footprint's lx, along its yaw). */
const LOUNGER_L = 1.95;
const loungerY = HW - 0.25 - LOUNGER_L / 2;

const furniture: Furniture[] = [
  // The pool first: the hall's first blocker is its basin.
  {
    room: "pool-hall",
    piece: "pool-edge",
    at: CONCORDIA_HALL_POOL.c as V2,
    yaw: 0,
    blocks: true,
  },
  ...LOUNGER_XS.flatMap((x): Furniture[] => [
    // Starboard: head to the glass (−y), foot to the pool (+y).
    {
      room: "pool-hall",
      piece: "lounger",
      at: [x, -loungerY],
      yaw: Math.PI / 2,
      blocks: true,
    },
    {
      room: "pool-hall",
      piece: "lounger",
      at: [x, loungerY],
      yaw: -Math.PI / 2,
      blocks: true,
    },
  ]),
  // Exit signs over the glass doors.
  { room: "pool-hall", piece: "exit-sign", at: [X0, 0], yaw: 0 },
  { room: "pool-hall", piece: "exit-sign", at: [X1, 0], yaw: Math.PI },
];

/** The glass doors at each end (the stairs up to the lidos). */
const shutDoors: ShutDoor[] = [
  { room: "pool-hall", at: [X0, 0], facing: 0, style: "glass" },
  { room: "pool-hall", at: [X1, 0], facing: Math.PI, style: "glass" },
];

export const CONCORDIA_INTERIOR: InteriorMap = {
  ship: "concordia",
  rooms: [poolHall],
  seams: [],
  links: [],
  shutDoors,
  furniture,
};
