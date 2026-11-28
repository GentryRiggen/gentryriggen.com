import { deckZAt } from "../places";
import { concordia } from "../ships/concordia";
import {
  CONCORDIA_HALL_POOL,
  CONCORDIA_POOL_DOME,
  CONCORDIA_POOL_GLASS,
  CONCORDIA_RECESS_INSET,
} from "../ships/concordiaLayout";
import { deckEdgeOf } from "../walk/deckEdge";
import type { Seam, V2 } from "../walk/types";
import {
  cabin,
  chamferReflex,
  corridor,
  doorway,
  flight,
  type RoomShape,
} from "./kit";
import type {
  Furniture,
  InteriorLink,
  InteriorMap,
  LiftShaft,
  Room,
  RoomEntry,
  ShutDoor,
} from "./types";

/**
 * The Costa Concordia's rooms. 1.17: the pool hall, a deck room (her open
 * decks are `walk/concordiaDecks.ts`, which takes the hall from here).
 * 1.18: the rooms inside her, with their look (the scene kit's finishes,
 * lamp styles and pieces: `components/shipwreck/interior/kit.ts`).
 * Positions are her game decks (the model's numbering, `spec.decks`),
 * Costa's noted alongside; every room stands inside her model's solid
 * blocks (`concordiaRecipe.ts`: deck 3 full width, decks 4–5 inside the
 * boat recess's wall 7.4 m in from her side, decks 7–10 inside the
 * balconies' wall 1.8 m in, the hull below deck 3). Checked by
 * __tests__/concordiaMap.test.ts and walk/__tests__/concordiaHallFeel.test.ts.
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
 * - **The Atrio Europa** (decks 3–5, x 64.2..80, y ±9; Costa: deck 3
 *   forward): the floor on deck 3 round the well (`atrium-3`, a U open
 *   forward, and `atrium-3-fwd`), the well's own floor (`atrium-well`,
 *   x 67.2..77, y ±6, its ceiling the glass roof at deck 6 + 1, so you
 *   look up three storeys), the galleries on decks 4 and 5 round the well
 *   (`atrium-4`/`-5` and their forward strips; their rails into the well
 *   are walls to the walker), the lobby bar on the floor's port side, and
 *   the stair (`atrium-stair`) down the well's starboard side from the
 *   deck 4 gallery's forward strip to the floor.
 * - **The glass lifts** (`lifts`): two cars on the atrium's after wall
 *   (x 62..64.2, y +1.5..+3.7 and −3.7..−1.5), stopping at the low lobby
 *   (deck 0 + 0.4 m: `STOPS`), 3, 4, 5 and 7. `withInterior`
 *   makes a car area per stop (`merge.ts` `liftCars`); the cars ride
 *   between them (`lift.ts`).
 * - **The boat-deck entrances** (`entry-p`, `entry-s`, deck 4, x 70..73):
 *   doors in the recess wall from each boat deck's promenade, a step into
 *   the gallery.
 * - **The low rooms** (deck 0 + 0.4 m, `LOW_RAISE_M`: not deck 1, see
 *   there; Costa: inside cabins on decks 1–2): the lift lobby (`lobby-1`,
 *   x 56..62, y −13.5..6, wide across her so the sea creeps across it),
 *   the starboard corridor aft (`corridor-1`, x 56 → 30) with shut cabin
 *   doors down both sides, an inside cabin (`cabin-inside`: two beds, a
 *   desk, a TV, no window) inboard and an ocean-view cabin (`cabin-ocean`:
 *   a bed and a sofa by its window low over the sea) outboard. These four
 *   take the sea slowly (`seep`).
 * - **Deck 7** (Costa: balcony cabins on decks 6–10): the lift lobby
 *   (`lobby-7`), the starboard corridor (`corridor-7`, x 56 → 44), the
 *   balcony stateroom (`stateroom`: beds, sofa, desk, TV, a shut bathroom
 *   door, the glass door out) and its balcony (`balcony`: a rail, the
 *   balcony above as its ceiling, two chairs; starboard, so she leans you
 *   toward the sea).
 * - **The Teatro Atene** (decks 3–5, x 80..108, y ±8; Costa: decks 3–5
 *   forward): a flight up from the atrium floor (`theatre-passage`) into
 *   the top of the raked stalls (`theatre-back` under the balcony,
 *   `theatre` in front of it: the floor falls 2 m from x 84 to the stage at
 *   x 100), seat rows with two aisles (y ±3.5), the stage (`stage`, 1 m
 *   up, its curtain and lights) with steps at both sides (`stage-steps-p`,
 *   `-s`), and the balcony on deck 5 (`theatre-balcony`, a short rake) by
 *   a passage from the deck 5 gallery (`theatre-passage-5`).
 * - **The Squok club** (deck 12, x 34.2..56, y ±13, inside the model's
 *   `deck-12-fwd` block under the forward lido; Costa: deck 10): soft
 *   play, the pirate ship, the castle tower, beanbags, low tables, toy
 *   shelves; its door is in the pool hall's forward wall, starboard, ahead
 *   of where the walk starts.
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
 * - Her rooms close at 30° of heel (`closeAtHeelDeg`, 23:11:24) and her
 *   emergency lights flicker more as she leans (`emergencyFlicker`): the
 *   data is here, the rules are Task 7's.
 * - Every layout inside her is invented on her known spaces, within her
 *   model's blocks (1.18):
 *   - The atrium is three storeys (3–5; the real one's height is not
 *     known) and starts at x 64.2, not 62: the lift cars stand at x
 *     62..64.2 on its after wall. Its well is x 67.2..77 (three-metre
 *     galleries all round) and the stair takes the well's starboard 1.5 m
 *     (x 69..77), so the well's own floor is an L.
 *   - The galleries' top storey (deck 5) reaches up to the glass roof
 *     (3.8 m), so the roof is one ceiling over the well and the gallery.
 *   - The boat-deck entrances are shallow (about 1 m) vestibules: the
 *     gallery runs almost to the recess wall.
 *   - The low and deck 7 lobbies open onto the lifts' after side (the
 *     cars have a door at each end: aft at the low lobby and on 7, forward in the
 *     atrium). The deck 7 lobby runs to y −9.2 to meet its corridor.
 *   - The stateroom is one of the model's 3.6 m balcony bays (x
 *     47.6..51.2, so its partitions and balcony door are the model's),
 *     its glass door 1.8 m wide, as deep as the block to
 *     the balconies' wall (y −15.95); its balcony is the 1.65 m out to
 *     her side, the rail 0.15 m in from her edge.
 *   - The theatre is 16 m across (y ±8), not 20, to stand inside the
 *     recess wall on decks 4–5 where the bow narrows; its stalls are two
 *     rooms (behind and in front of the balcony's edge, x 90) so the
 *     balcony's front is a rail over the stalls. The stalls are entered at
 *     the top of the rake by a 2 m flight up from the atrium floor; the
 *     stage is 1 m up, x 100..108, its sides 7.5 m out, with steps at both
 *     sides from the stalls' front aisle. Side seat rows are six seats,
 *     the middle ones ten.
 *   - The Squok club starts at x 34.2 against the pool hall's forward
 *     wall (the spec's x 36), so its door is a short step.
 * - The picker's room buttons (`entries`) have her own pictures: the
 *   atrium's glass lift, a bed by the balcony door, the low cabin with the
 *   sea at its window, the stage, a pirate ship for the kids' club.
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

// --- 1.18: the rooms inside her ------------------------------------------------

const spec = concordia;
/** A deck's floor (her decks are flat: deck 3's sheer). */
const Z = (deck: string) => deckZAt(deck, 0, spec);
/** Her deck step (2.8 m) and a room's ceiling under the slab above. */
const STEP = Z("4") - Z("3");
const SLAB_M = 0.25;
const CEIL = STEP - SLAB_M;
/** Her drawn deck edge (as `walk/concordiaDecks.ts`). */
const edge = deckEdgeOf(spec, { fromX: spec.stations[0].x, exponent: 2 });
/** The boat recess's wall on decks 4–5 (|y|). */
const recessY = (x: number) => edge(x) - CONCORDIA_RECESS_INSET;
/**
 * The balconies' depth on decks 7–10: their back wall stands this far in
 * from her side (the model's `balcony-wall` block, concordiaRecipe.ts).
 */
export const BALCONY_DEPTH_M = 1.8;
/** The glass roof over the atrium: a metre over deck 6. */
const ATRIUM_ROOF_Z = Z("6") + 1;

/**
 * The low rooms' floor stands this far over deck 0 (m), and the lobby
 * reaches 13.5 m to starboard (hull 16.3 m there). Task 7 moved them off
 * deck 1 (14.18 m): the lobby's starboard edge sat 2.8 m over the sea from
 * the touch on and never got wet. Her real night puts that edge under the
 * sea about 3.75 shown minutes before the close at 30° (and dry at the
 * touch), and the outboard cabin knee deep well before it
 * (`concordiaWater.test.ts`). Her heel shortens a drop of the floor
 * (cos of the heel), which is why 0.4 m and the wider lobby, not 0.2.
 */
const LOW_RAISE_M = 0.4;
/** The lobby's starboard wall (y). */
const LOBBY_1_STBD_Y = -13.5;

const shapes = new Map<string, RoomShape>();
const seams: Seam[] = [];

function add(...list: RoomShape[]): void {
  for (const sh of list) {
    if (shapes.has(sh.id)) throw new Error(`room ${sh.id} twice`);
    shapes.set(sh.id, sh);
  }
}

function shape(id: string): RoomShape {
  const sh = shapes.get(id);
  if (!sh) throw new Error(`no room ${id}`);
  return sh;
}

/** A doorway between two rooms (cut into both, seam recorded). */
function door(a: string, b: string, at: V2, width: number): void {
  const d = doorway(shape(a), shape(b), at, width);
  shapes.set(a, d.a);
  shapes.set(b, d.b);
  seams.push(d.seam);
}

// The glass lifts: two cars on the atrium's after wall.
const LIFT_X0 = 62;
const LIFT_X1 = 64.2;
const LIFT_Y: Record<"lift-a" | "lift-b", readonly [number, number]> = {
  "lift-a": [1.5, 3.7],
  "lift-b": [-3.7, -1.5],
};
const LIFT_DOOR_M = 1.2;
/** The lifts' doors, per lift, per stop (cut into each landing). */
const liftDoors = new Map<string, readonly [V2, V2]>();

/** A lift's door at one stop, on the landing's wall at x. */
function liftDoor(lift: "lift-a" | "lift-b", deck: string, landing: string) {
  const [y0, y1] = LIFT_Y[lift];
  const car = cabin(`${lift}-car`, [LIFT_X0, y0], [LIFT_X1, y1]);
  // Aft of the car on decks 1 and 7 (the lobbies), forward in the atrium.
  const x = landing.startsWith("lobby") ? LIFT_X0 : LIFT_X1;
  const d = doorway(shape(landing), car, [x, (y0 + y1) / 2], LIFT_DOOR_M);
  shapes.set(landing, d.a);
  liftDoors.set(`${lift}@${deck}`, d.seam.at);
}

// The Atrio Europa.
const AT_AFT = LIFT_X1; // the after wall: the lifts' fronts
const WELL_AFT = 67.2;
const WELL_FWD = 77;
const AT_FWD = 80;
const AT_HW = 9;
const WELL_HW = 6;
/** The stair down the well's starboard side: its strip and its foot. */
const STAIR_Y0 = -6;
const STAIR_Y1 = -4.5;
const STAIR_FOOT_X = 69;
const STAIR_Y = (STAIR_Y0 + STAIR_Y1) / 2;

/** A floor round the well, open forward (a U): the lifts on its after wall. */
function ring(id: string): RoomShape {
  return {
    id,
    outline: [
      [AT_AFT, -AT_HW],
      [WELL_FWD, -AT_HW],
      [WELL_FWD, -WELL_HW],
      [WELL_AFT, -WELL_HW],
      [WELL_AFT, WELL_HW],
      [WELL_FWD, WELL_HW],
      [WELL_FWD, AT_HW],
      [AT_AFT, AT_HW],
    ],
  };
}

add(
  ring("atrium-3"),
  cabin("atrium-3-fwd", [WELL_FWD, -AT_HW], [AT_FWD, AT_HW]),
  // The well's floor: an L round the stair's foot.
  {
    id: "atrium-well",
    outline: [
      [WELL_AFT, STAIR_Y0],
      [STAIR_FOOT_X, STAIR_Y0],
      [STAIR_FOOT_X, STAIR_Y1],
      [WELL_FWD, STAIR_Y1],
      [WELL_FWD, WELL_HW],
      [WELL_AFT, WELL_HW],
    ],
  },
  flight(
    "atrium-stair",
    [WELL_FWD, STAIR_Y],
    [STAIR_FOOT_X, STAIR_Y],
    STAIR_Y1 - STAIR_Y0,
    STEP
  ),
  ring("atrium-4"),
  cabin("atrium-4-fwd", [WELL_FWD, -AT_HW], [AT_FWD, AT_HW]),
  ring("atrium-5"),
  cabin("atrium-5-fwd", [WELL_FWD, -AT_HW], [AT_FWD, AT_HW])
);
// Deck 3: the floor open to the well (its aft, port and the stair's foot).
door("atrium-3", "atrium-well", [WELL_AFT, 0], 2 * WELL_HW);
door(
  "atrium-3",
  "atrium-well",
  [(WELL_AFT + WELL_FWD) / 2, WELL_HW],
  WELL_FWD - WELL_AFT
);
door(
  "atrium-3",
  "atrium-well",
  [(WELL_AFT + STAIR_FOOT_X) / 2, -WELL_HW],
  STAIR_FOOT_X - WELL_AFT
);
door(
  "atrium-well",
  "atrium-3-fwd",
  [WELL_FWD, (STAIR_Y1 + WELL_HW) / 2],
  WELL_HW - STAIR_Y1
);
door(
  "atrium-stair",
  "atrium-well",
  [STAIR_FOOT_X, STAIR_Y],
  STAIR_Y1 - STAIR_Y0
);
door("atrium-stair", "atrium-4-fwd", [WELL_FWD, STAIR_Y], STAIR_Y1 - STAIR_Y0);
// Each ring's arms open onto its forward strip.
for (const d of ["3", "4", "5"])
  for (const s of [1, -1])
    door(
      `atrium-${d}`,
      `atrium-${d}-fwd`,
      [WELL_FWD, (s * (AT_HW + WELL_HW)) / 2],
      AT_HW - WELL_HW
    );

// The boat-deck entrances: doors in the recess wall, into the gallery.
const ENTRY_X0 = 70;
const ENTRY_X1 = 73;
const ENTRY_X = (ENTRY_X0 + ENTRY_X1) / 2;
/** Their outer wall: just inside the recess wall (|y|). */
const ENTRY_OUT =
  Math.floor((Math.min(recessY(ENTRY_X0), recessY(ENTRY_X1)) - 0.05) * 20) / 20;
add(
  cabin("entry-p", [ENTRY_X0, AT_HW], [ENTRY_X1, ENTRY_OUT]),
  cabin("entry-s", [ENTRY_X0, -ENTRY_OUT], [ENTRY_X1, -AT_HW])
);
door("atrium-4", "entry-p", [ENTRY_X, AT_HW], ENTRY_X1 - ENTRY_X0);
door("atrium-4", "entry-s", [ENTRY_X, -AT_HW], ENTRY_X1 - ENTRY_X0);

// Deck 1: the lift lobby, the corridor aft and two cabins.
const C1_Y = -9.9;
add(
  cabin("lobby-1", [56, LOBBY_1_STBD_Y], [LIFT_X0, 6]),
  corridor("corridor-1", [56, C1_Y], [30, C1_Y], 1.4),
  cabin("cabin-inside", [44, -9.2], [47.6, -5]),
  cabin("cabin-ocean", [40, -16], [43.6, -10.6])
);
door("lobby-1", "corridor-1", [56, C1_Y], 1.4);
door("corridor-1", "cabin-inside", [45.8, -9.2], 1.2);
door("corridor-1", "cabin-ocean", [41.8, -10.6], 1.2);

// Deck 7: the lift lobby, the corridor, the stateroom and its balcony.
const C7_Y = -8.5;
/**
 * The stateroom: one of the model's balcony bays (3.6 m from x −100, its
 * partitions at the bays' ends and its balcony door in the middle).
 */
const ST_X0 = 47.6;
const ST_X1 = 51.2;
const ST_MID = (ST_X0 + ST_X1) / 2;
/** The balconies' back wall (|y|): the stateroom's outboard wall. */
const BAL_BACK =
  Math.floor((Math.min(edge(ST_X0), edge(ST_X1)) - BALCONY_DEPTH_M) * 100) /
  100;
/** The balcony's rail, just inside her edge (|y|). */
const BAL_RAIL = 17.6;
add(
  cabin("lobby-7", [56, -9.2], [LIFT_X0, 6]),
  corridor("corridor-7", [56, C7_Y], [44, C7_Y], 1.4),
  cabin("stateroom", [ST_X0, -BAL_BACK], [ST_X1, -9.2]),
  cabin("balcony", [ST_X0, -BAL_RAIL], [ST_X1, -BAL_BACK])
);
door("lobby-7", "corridor-7", [56, C7_Y], 1.4);
door("corridor-7", "stateroom", [ST_X1 - 0.8, -9.2], 1.1);
door("stateroom", "balcony", [ST_MID, -BAL_BACK], 1.8);

// The lifts' doors, every stop.
const STOPS = [
  ["0", "lobby-1"],
  ["3", "atrium-3"],
  ["4", "atrium-4"],
  ["5", "atrium-5"],
  ["7", "lobby-7"],
] as const;
for (const lift of ["lift-a", "lift-b"] as const)
  for (const [deck, landing] of STOPS) liftDoor(lift, deck, landing);

// The Teatro Atene: the stalls fall 2 m from x 84 to the stage at x 100.
const TH_HW = 8;
const TH_BACK = 84;
const TH_EDGE = 90; // the balcony's front
const TH_FRONT = 100;
const STAGE_FWD = 108;
const STAGE_HW = 7.5;
const RAKE_M = 2.0;
const rake = (x: number) => (RAKE_M * (x - TH_BACK)) / (TH_FRONT - TH_BACK);
const STAGE_UP = 1.0;
/** The stage's steps: 1.2 m wide at its sides, from the stalls' front. */
const STEPS_X1 = 102.5;
const STEPS_Y = STAGE_HW - 0.6;
const BALCONY_RAKE_M = 0.6;
add(
  flight("theatre-passage", [TH_BACK, 0], [AT_FWD, 0], 2.4, RAKE_M),
  {
    id: "theatre-back",
    outline: [
      [TH_BACK, -TH_HW],
      [TH_EDGE, -TH_HW],
      [TH_EDGE, TH_HW],
      [TH_BACK, TH_HW],
    ],
    ramp: { from: [TH_BACK, 0], to: [TH_EDGE, 0], dropM: rake(TH_EDGE) },
  },
  {
    id: "theatre",
    outline: [
      [TH_EDGE, -TH_HW],
      [TH_FRONT, -TH_HW],
      [TH_FRONT, TH_HW],
      [TH_EDGE, TH_HW],
    ],
    ramp: {
      from: [TH_EDGE, 0],
      to: [TH_FRONT, 0],
      dropM: RAKE_M - rake(TH_EDGE),
    },
  },
  flight(
    "stage-steps-p",
    [STEPS_X1, STEPS_Y],
    [TH_FRONT, STEPS_Y],
    1.2,
    STAGE_UP
  ),
  flight(
    "stage-steps-s",
    [STEPS_X1, -STEPS_Y],
    [TH_FRONT, -STEPS_Y],
    1.2,
    STAGE_UP
  ),
  {
    id: "stage",
    outline: [
      [STEPS_X1, -STAGE_HW],
      [STAGE_FWD, -STAGE_HW],
      [STAGE_FWD, STAGE_HW],
      [STEPS_X1, STAGE_HW],
      [STEPS_X1, STAGE_HW - 1.2],
      [TH_FRONT, STAGE_HW - 1.2],
      [TH_FRONT, -(STAGE_HW - 1.2)],
      [STEPS_X1, -(STAGE_HW - 1.2)],
    ],
  },
  corridor("theatre-passage-5", [AT_FWD, 0], [TH_BACK, 0], 2.4),
  {
    id: "theatre-balcony",
    outline: [
      [TH_BACK, -TH_HW],
      [TH_EDGE, -TH_HW],
      [TH_EDGE, TH_HW],
      [TH_BACK, TH_HW],
    ],
    ramp: { from: [TH_BACK, 0], to: [TH_EDGE, 0], dropM: BALCONY_RAKE_M },
  }
);
door("atrium-3-fwd", "theatre-passage", [AT_FWD, 0], 2.4);
door("theatre-passage", "theatre-back", [TH_BACK, 0], 2.4);
door("theatre-back", "theatre", [TH_EDGE, 0], 2 * TH_HW);
for (const s of [1, -1] as const) {
  const steps = s > 0 ? "stage-steps-p" : "stage-steps-s";
  door("theatre", steps, [TH_FRONT, s * STEPS_Y], 1.2);
  door(steps, "stage", [STEPS_X1, s * STEPS_Y], 1.2);
}
door("atrium-5-fwd", "theatre-passage-5", [AT_FWD, 0], 2.4);
door("theatre-passage-5", "theatre-balcony", [TH_BACK, 0], 2.4);

// The Squok club, under the forward lido.
const SQ_X0 = CONCORDIA_POOL_GLASS.x1 + 0.2;
const SQ_DOOR_Y = -7;
add(cabin("squok", [SQ_X0, -13], [56, 13]));

// --- Her rooms' info ----------------------------------------------------------

type RoomInfo = Omit<Room, "id" | "outline" | "axis" | "ramp">;

const MARBLE = {
  finish: "marble",
  floor: "marble",
  lamp: "chandelier",
} as const;
const GALLERY = {
  finish: "cream",
  floor: "marble",
  lamp: "downlight",
} as const;
const CARPET = {
  finish: "cream",
  floor: "cabin-carpet",
  lamp: "downlight",
} as const;
const CABIN = {
  finish: "cabin-veneer",
  floor: "cabin-carpet",
  lamp: "downlight",
} as const;
const RED = {
  finish: "theatre",
  floor: "cabin-carpet",
  lamp: "strip",
} as const;
const BOARDS = {
  finish: "theatre",
  floor: "stage-wood",
  lamp: "strip",
} as const;
/** The theatre's ceiling: the balcony's (deck 5 + 2.6 m). */
const THEATRE_TOP_Z = Z("5") + 2.6;

const atrium = (
  kind: "atrium" | "gallery" | "lobby",
  deck: string,
  ceilingM: number,
  look: Room["look"]
): RoomInfo => ({ kind, deck, ceilingM, zone: "atrium", look });
const low = (kind: Room["kind"], look: Room["look"]): RoomInfo => ({
  kind,
  deck: "0",
  raiseM: LOW_RAISE_M,
  ceilingM: CEIL,
  zone: "low-cabins",
  look,
  seep: true,
});
const seven = (kind: Room["kind"], look: Room["look"]): RoomInfo => ({
  kind,
  deck: "7",
  ceilingM: CEIL,
  zone: "stateroom",
  look,
});

const INFO: Record<string, RoomInfo> = {
  "atrium-3": atrium("atrium", "3", CEIL, MARBLE),
  "atrium-3-fwd": atrium("atrium", "3", CEIL, MARBLE),
  "atrium-well": atrium("atrium", "3", ATRIUM_ROOF_Z - Z("3"), MARBLE),
  "atrium-stair": {
    kind: "flight",
    deck: "4",
    ceilingM: ATRIUM_ROOF_Z - Z("4"),
    zone: "atrium",
    look: MARBLE,
  },
  "atrium-4": atrium("gallery", "4", CEIL, GALLERY),
  "atrium-4-fwd": atrium("gallery", "4", CEIL, GALLERY),
  "atrium-5": atrium("gallery", "5", ATRIUM_ROOF_Z - Z("5"), GALLERY),
  "atrium-5-fwd": atrium("gallery", "5", ATRIUM_ROOF_Z - Z("5"), GALLERY),
  "entry-p": atrium("lobby", "4", CEIL, GALLERY),
  "entry-s": atrium("lobby", "4", CEIL, GALLERY),
  "lobby-1": low("lobby", CARPET),
  "corridor-1": low("corridor", CARPET),
  "cabin-inside": low("cabin", CABIN),
  // Its big window low over the sea, on her starboard side.
  "cabin-ocean": low("cabin", { ...CABIN, portholes: "starboard" }),
  "lobby-7": seven("lobby", CARPET),
  "corridor-7": seven("corridor", CARPET),
  stateroom: seven("stateroom", CABIN),
  balcony: {
    kind: "balcony",
    deck: "7",
    // Under the balcony above (the model's 0.3 m balcony floor on deck 8).
    ceilingM: Z("8") - 0.3 - Z("7"),
    zone: "stateroom",
    look: { finish: "cream", floor: "teak", lamp: "downlight" },
  },
  "theatre-passage": {
    kind: "flight",
    deck: "3",
    raiseM: RAKE_M,
    ceilingM: 2.7,
    zone: "theatre",
    look: RED,
  },
  "theatre-back": {
    kind: "theatre",
    deck: "3",
    raiseM: RAKE_M,
    // Under the balcony.
    ceilingM: 2.7,
    zone: "theatre",
    look: RED,
  },
  theatre: {
    kind: "theatre",
    deck: "3",
    raiseM: RAKE_M - rake(TH_EDGE),
    ceilingM: THEATRE_TOP_Z - (Z("3") + RAKE_M - rake(TH_EDGE)),
    zone: "theatre",
    look: RED,
  },
  "stage-steps-p": {
    kind: "flight",
    deck: "3",
    raiseM: STAGE_UP,
    ceilingM: THEATRE_TOP_Z - (Z("3") + STAGE_UP),
    zone: "theatre",
    look: BOARDS,
  },
  "stage-steps-s": {
    kind: "flight",
    deck: "3",
    raiseM: STAGE_UP,
    ceilingM: THEATRE_TOP_Z - (Z("3") + STAGE_UP),
    zone: "theatre",
    look: BOARDS,
  },
  stage: {
    kind: "stage",
    deck: "3",
    raiseM: STAGE_UP,
    ceilingM: THEATRE_TOP_Z - (Z("3") + STAGE_UP),
    zone: "theatre",
    look: BOARDS,
  },
  "theatre-passage-5": {
    kind: "passage",
    deck: "5",
    ceilingM: CEIL,
    zone: "theatre",
    look: RED,
  },
  "theatre-balcony": {
    kind: "theatre",
    deck: "5",
    ceilingM: THEATRE_TOP_Z - Z("5"),
    zone: "theatre",
    look: RED,
  },
  squok: {
    kind: "club",
    deck: "12",
    ceilingM: CEIL,
    zone: "squok",
    look: { finish: "kids", floor: "soft", lamp: "downlight" },
  },
};

const liftEnds = [...liftDoors.values()].flat();
const rooms: Room[] = [...shapes.values()].map((sh) => {
  const info = INFO[sh.id];
  if (!info) throw new Error(`room ${sh.id} has no info`);
  // No corner traps: chamfer reflex corners, except a seam's ends.
  const ends = [
    ...seams
      .filter((m) => m.a === sh.id || m.b === sh.id)
      .flatMap((m) => [m.at[0], m.at[1]]),
    ...liftEnds,
  ];
  return {
    id: sh.id,
    ...info,
    outline: chamferReflex(sh.outline, ends),
    ...(sh.axis ? { axis: sh.axis } : {}),
    ...(sh.ramp ? { ramp: sh.ramp } : {}),
  };
});

const lifts: LiftShaft[] = (["lift-a", "lift-b"] as const).map((id) => ({
  id,
  car: { min: [LIFT_X0, LIFT_Y[id][0]], max: [LIFT_X1, LIFT_Y[id][1]] },
  stops: STOPS.map(([deck, landing]) => ({
    deck,
    ...(landing === "lobby-1" ? { raiseM: LOW_RAISE_M } : {}),
    landing,
    door: liftDoors.get(`${id}@${deck}`)!,
  })),
}));

// --- Deck doors ------------------------------------------------------------------

const links: InteriorLink[] = [
  // The recess wall's doors, 0.45 m out on each boat deck's promenade.
  {
    id: "entry-p",
    kind: "door",
    from: { area: "boat-deck-p", at: [ENTRY_X, recessY(ENTRY_X) + 0.45] },
    to: { area: "entry-p", at: [ENTRY_X, (AT_HW + ENTRY_OUT) / 2] },
    widthM: 1.2,
  },
  {
    id: "entry-s",
    kind: "door",
    from: { area: "boat-deck-s", at: [ENTRY_X, -(recessY(ENTRY_X) + 0.45)] },
    to: { area: "entry-s", at: [ENTRY_X, -(AT_HW + ENTRY_OUT) / 2] },
    widthM: 1.2,
  },
  // The pool hall's forward wall, starboard: the kids' club.
  {
    id: "squok",
    kind: "door",
    from: { area: "pool-hall", at: [X1 - 0.45, SQ_DOOR_Y] },
    to: { area: "squok", at: [SQ_X0 + 0.8, SQ_DOOR_Y] },
    widthM: 1.2,
  },
];

// --- Shut doors -------------------------------------------------------------------

const PORT_WALL = -Math.PI / 2; // a door on a room's port wall faces starboard
const STBD_WALL = Math.PI / 2;
/** Whether a point on a room's wall is clear (0.8 m) of its doorways. */
function clearOfSeams(room: string, at: V2): boolean {
  for (const m of seams) {
    if (m.a !== room && m.b !== room) continue;
    const [p, q] = m.at;
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const u = Math.max(
      0,
      Math.min(
        1,
        ((at[0] - p[0]) * dx + (at[1] - p[1]) * dy) / (dx * dx + dy * dy)
      )
    );
    if (Math.hypot(at[0] - p[0] - u * dx, at[1] - p[1] - u * dy) < 0.8)
      return false;
  }
  return true;
}
const herShutDoors: ShutDoor[] = [];
/** Cabin doors down both walls of a corridor every 3.6 m, and its end. */
function cabinDoors(room: string, y: number, x0: number, x1: number): void {
  for (let x = x0; x > x1 + 0.6; x -= 3.6)
    for (const [wy, facing] of [
      [y + 0.7, PORT_WALL],
      [y - 0.7, STBD_WALL],
    ] as const) {
      const at: V2 = [Math.round(x * 100) / 100, wy];
      if (clearOfSeams(room, at))
        herShutDoors.push({ room, at, facing, style: "white" });
    }
  herShutDoors.push({ room, at: [x1, y], facing: 0, style: "white" });
}
cabinDoors("corridor-1", C1_Y, 54.2, 30);
cabinDoors("corridor-7", C7_Y, 54.2, 44);
// The stateroom's bathroom, on its after wall by the door.
herShutDoors.push({
  room: "stateroom",
  at: [ST_X0, -10.4],
  facing: 0,
  style: "white",
});

// --- Furniture ---------------------------------------------------------------------

const Q = Math.PI / 2;
/** A seat row facing the stage (+x); `seats` for the six-seat side rows. */
const row = (
  room: string,
  x: number,
  y: number,
  seats?: number
): Furniture => ({
  room,
  piece: "theatre-seat-row",
  at: [x, y],
  yaw: 0,
  blocks: true,
  ...(seats !== undefined ? { seats } : {}),
});
/** Rows at each x: the middle ten seats, six each side of the aisles. */
const SIDE_ROW_Y = 5.85;
const rows = (room: string, xs: readonly number[]): Furniture[] =>
  xs.flatMap((x) => [
    row(room, x, 0),
    row(room, x, SIDE_ROW_Y, 6),
    row(room, x, -SIDE_ROW_Y, 6),
  ]);

const herFurniture: Furniture[] = [
  // The atrium: the lobby bar on the floor's port side, its stools.
  {
    room: "atrium-3",
    piece: "bar-counter",
    at: [72, 8.3],
    yaw: -Q,
    blocks: true,
  },
  ...[71, 72, 73].map((x): Furniture => ({
    room: "atrium-3",
    piece: "bar-stool",
    at: [x, 7.45],
    yaw: Q,
  })),
  // Exit signs over the deck doors (inside), the way to them from the
  // galleries, the club's door, the lobbies' and corridors' ways out (the
  // corridors' far ends: a stair beyond), and the theatre's doors.
  { room: "entry-p", piece: "exit-sign", at: [ENTRY_X, ENTRY_OUT], yaw: -Q },
  { room: "entry-s", piece: "exit-sign", at: [ENTRY_X, -ENTRY_OUT], yaw: Q },
  { room: "atrium-4", piece: "exit-sign", at: [ENTRY_X, AT_HW], yaw: -Q },
  { room: "atrium-4", piece: "exit-sign", at: [ENTRY_X, -AT_HW], yaw: Q },
  { room: "squok", piece: "exit-sign", at: [SQ_X0 + 0.05, SQ_DOOR_Y], yaw: 0 },
  { room: "lobby-1", piece: "exit-sign", at: [56, C1_Y], yaw: 0 },
  { room: "corridor-1", piece: "exit-sign", at: [56, C1_Y], yaw: Math.PI },
  { room: "corridor-1", piece: "exit-sign", at: [30, C1_Y], yaw: 0 },
  { room: "lobby-7", piece: "exit-sign", at: [56, C7_Y], yaw: 0 },
  { room: "corridor-7", piece: "exit-sign", at: [56, C7_Y], yaw: Math.PI },
  { room: "corridor-7", piece: "exit-sign", at: [44, C7_Y], yaw: 0 },
  { room: "theatre-back", piece: "exit-sign", at: [TH_BACK, 0], yaw: 0 },
  { room: "theatre-balcony", piece: "exit-sign", at: [TH_BACK, 0], yaw: 0 },
  // The inside cabin: twin beds heads to the inboard wall, a desk, a TV.
  {
    room: "cabin-inside",
    piece: "cabin-bed",
    at: [44.6, -6.1],
    yaw: -Q,
    blocks: true,
  },
  {
    room: "cabin-inside",
    piece: "cabin-bed",
    at: [47.0, -6.1],
    yaw: -Q,
    blocks: true,
  },
  {
    room: "cabin-inside",
    piece: "desk",
    at: [44.3, -8.35],
    yaw: 0,
    blocks: true,
  },
  { room: "cabin-inside", piece: "tv", at: [47.55, -8.0], yaw: Math.PI },
  // The ocean-view cabin: a double bed (two twins), a sofa by the window.
  {
    room: "cabin-ocean",
    piece: "cabin-bed",
    at: [41.05, -12.35],
    yaw: 0,
    blocks: true,
  },
  {
    room: "cabin-ocean",
    piece: "cabin-bed",
    at: [41.05, -13.25],
    yaw: 0,
    blocks: true,
  },
  {
    room: "cabin-ocean",
    piece: "cabin-sofa",
    at: [43.15, -14.5],
    yaw: Math.PI,
    blocks: true,
  },
  // The stateroom: a double bed, the sofa by the balcony door, desk, TV.
  // The beds and the sofa never overlap in y, so the way from the corridor
  // door to the balcony door is not a pinch between them (Task 6 review).
  {
    room: "stateroom",
    piece: "cabin-bed",
    at: [ST_X0 + 1.05, -12.3],
    yaw: 0,
    blocks: true,
  },
  {
    room: "stateroom",
    piece: "cabin-bed",
    at: [ST_X0 + 1.05, -13.2],
    yaw: 0,
    blocks: true,
  },
  {
    room: "stateroom",
    piece: "cabin-sofa",
    at: [ST_X1 - 0.45, -14.9],
    yaw: Math.PI,
    blocks: true,
  },
  {
    room: "stateroom",
    piece: "desk",
    at: [ST_X1 - 0.3, -11.6],
    yaw: Math.PI,
    blocks: true,
  },
  { room: "stateroom", piece: "tv", at: [ST_X1 - 0.05, -12.9], yaw: Math.PI },
  // The glass door out, slid open (its frame round the doorway).
  {
    room: "stateroom",
    piece: "balcony-door",
    at: [ST_MID, -BAL_BACK],
    yaw: Q,
  },
  // Its balcony: two chairs looking out to sea.
  {
    room: "balcony",
    piece: "balcony-chair",
    at: [ST_MID - 0.9, -16.9],
    yaw: -Q,
  },
  {
    room: "balcony",
    piece: "balcony-chair",
    at: [ST_MID + 0.9, -16.9],
    yaw: -Q,
  },
  // The theatre: seat rows behind and in front of the balcony's edge, and
  // on the balcony; the stage's curtain and lights.
  ...rows("theatre-back", [85.9, 86.9, 87.9, 88.9]),
  ...rows("theatre", [91.05, 92.15, 93.25, 94.35, 95.45, 96.55]),
  ...rows("theatre-balcony", [85.6, 86.7, 87.8, 88.9]),
  { room: "stage", piece: "stage-curtain", at: [107, 0], yaw: Math.PI },
  { room: "stage", piece: "stage-lights", at: [103.5, 0], yaw: Math.PI },
  // The Squok club.
  { room: "squok", piece: "pirate-ship", at: [46, 4], yaw: 0, blocks: true },
  { room: "squok", piece: "castle-tower", at: [52, -8], yaw: 0, blocks: true },
  { room: "squok", piece: "soft-play", at: [40, 9], yaw: 0, blocks: true },
  { room: "squok", piece: "soft-play", at: [43, 9], yaw: 0, blocks: true },
  ...[38, 39.3, 40.6].map((x): Furniture => ({
    room: "squok",
    piece: "beanbag",
    at: [x, -10],
    yaw: 0,
    blocks: true,
  })),
  { room: "squok", piece: "kids-table", at: [48, -4], yaw: 0, blocks: true },
  { room: "squok", piece: "kids-table", at: [44, -9], yaw: 0, blocks: true },
  {
    room: "squok",
    piece: "toy-shelf",
    at: [55.75, 6],
    yaw: Math.PI,
    blocks: true,
  },
  {
    room: "squok",
    piece: "toy-shelf",
    at: [55.75, -2],
    yaw: Math.PI,
    blocks: true,
  },
  // More to play on: a second tower, soft blocks, a reading corner of
  // beanbags, shelves along both sides, another table.
  { room: "squok", piece: "castle-tower", at: [39, 2], yaw: 0, blocks: true },
  { room: "squok", piece: "soft-play", at: [50, -11.5], yaw: 0, blocks: true },
  { room: "squok", piece: "soft-play", at: [53, 2], yaw: 0, blocks: true },
  ...[49.5, 51, 52.5].map((x, i): Furniture => ({
    room: "squok",
    piece: "beanbag",
    at: [x, i === 1 ? 11.6 : 10.8],
    yaw: 0,
    blocks: true,
  })),
  ...[40, 46].map((x): Furniture => ({
    room: "squok",
    piece: "toy-shelf",
    at: [x, 12.75],
    yaw: -Q,
    blocks: true,
  })),
  {
    room: "squok",
    piece: "toy-shelf",
    at: [44, -12.75],
    yaw: Q,
    blocks: true,
  },
  { room: "squok", piece: "kids-table", at: [49, 6.5], yaw: 0, blocks: true },
];

// --- Start inside (1.16) ------------------------------------------------------------

/**
 * The camera picker's rooms, in the order the buttons show, each facing
 * what is worth seeing, each with her own picture.
 */
const entries: RoomEntry[] = [
  // The well's floor, looking aft at the glass lifts (and up).
  {
    id: "atrium",
    label: "Atrium",
    icon: "atrium",
    room: "atrium-well",
    at: [75, 1],
    yaw: Math.PI,
  },
  // Inside the stateroom's door, facing the balcony's glass door.
  {
    id: "stateroom",
    label: "Stateroom",
    icon: "stateroom",
    room: "stateroom",
    at: [ST_MID + 0.2, -10.6],
    yaw: -Q,
  },
  // The deck 1 lift lobby, facing aft down the corridor.
  {
    id: "low-cabin",
    label: "Low cabin",
    icon: "low-cabin",
    room: "lobby-1",
    at: [59.5, C1_Y],
    yaw: Math.PI,
  },
  // The stalls' starboard-of-centre aisle, facing the stage.
  {
    id: "theatre",
    label: "Theatre",
    icon: "theatre",
    room: "theatre",
    at: [95.0, 3.5],
    yaw: 0,
  },
  // Inside the club's door, facing the pirate ship.
  {
    id: "squok",
    label: "Kids' club",
    icon: "kids-club",
    room: "squok",
    at: [37, -4],
    yaw: Math.atan2(8, 9),
  },
];

export const CONCORDIA_INTERIOR: InteriorMap = {
  ship: "concordia",
  // The pool hall first (her open decks' and the kit's tests find it so).
  rooms: [poolHall, ...rooms],
  seams,
  links,
  shutDoors: [...shutDoors, ...herShutDoors],
  furniture: [...furniture, ...herFurniture],
  entries,
  lifts,
  closeAtHeelDeg: 30,
  emergencyFlicker: true,
};
