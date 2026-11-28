import { deckZAt } from "../places";
import { titanic } from "../ships/titanic";
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
  Room,
  RoomEntry,
  ShutDoor,
} from "./types";

/**
 * The Titanic's rooms (1.15), from her general arrangement, roughly right
 * and invented where the plans are thin (the spec's table and rulings:
 * docs/superpowers/specs/2026-11-27-shipwreck-titanic-interiors-design.md).
 * Checked by __tests__/titanicMap.test.ts.
 *
 * - **The forward Grand Staircase** inside the boat deck's staircase house
 *   (x 33.2–41.6, y ±5: the open-deck blocker in walk/titanicDecks.ts),
 *   the well x 35–41.4, y ±3 the same on every deck. Each deck down: one
 *   broad flight (3 m) down forward to a half landing, then twin flights
 *   (1.5 m) port and starboard back aft to the next foyer. Boat → A → B is
 *   walked; the B → C flight and its landing (`gs-c`) are drawn behind a
 *   rope. The foyers are U-shaped round the well, open on their aft side
 *   (x 35) to the flights. Doors in the house's port and starboard sides
 *   at x 35.5.
 * - **B deck**: a 1.4 m corridor aft from the B foyer on the starboard side
 *   (x 31 → 14) with three suites outboard, modelled on the parlour
 *   suites, not a copy.
 * - **The first-class lift** just forward of the well, starboard (x
 *   41.4–43.4): its car on B deck (`lift-b`) opens off the B foyer; on E
 *   deck (`lift-e`) a short cross passage (`e-lobby`) runs to port into
 *   Scotland Road.
 * - **Scotland Road**: E deck, port, y 3.0–5.6, from x 70 aft to bulkhead J.
 * - **Third class**: a door in the forward well's after wall (x 76.2,
 *   port) onto a C deck landing, a steep flight down aft to a D deck
 *   landing, another down forward to an E deck landing, off which are the
 *   four-berth cabin (x 72–76, y 5.6–8.6) and a short passage aft into
 *   Scotland Road's forward end. The flights stand side by side, so the
 *   lower one has nothing over it.
 *
 * Every floor is a deck's height plus the sheer (`deckZAt`); a flight falls
 * exactly the deck step it spans (half of it for a staircase half), so
 * seams are level.
 */

const spec = titanic;
const step = (upper: string, lower: string) =>
  deckZAt(upper, 0, spec) - deckZAt(lower, 0, spec);

/** Bulkhead J: Scotland Road's after end (boiler room 2's after bulkhead). */
const BULKHEAD_J = spec.compartments.find((c) => c.id === "br2")!.fromX;

// --- The rooms' shapes and doorways -----------------------------------------

const shapes = new Map<string, RoomShape>();
const seams: Seam[] = [];

function add(...list: RoomShape[]): void {
  for (const s of list) {
    if (shapes.has(s.id)) throw new Error(`room ${s.id} twice`);
    shapes.set(s.id, s);
  }
}

function shape(id: string): RoomShape {
  const s = shapes.get(id);
  if (!s) throw new Error(`no room ${id}`);
  return s;
}

/** A doorway between two rooms (cut into both, seam recorded). */
function door(a: string, b: string, at: V2, width: number): void {
  const d = doorway(shape(a), shape(b), at, width);
  shapes.set(a, d.a);
  shapes.set(b, d.b);
  seams.push(d.seam);
}

// The Grand Staircase.
const GS_AFT = 35.0; // the well's after edge: the broad flights' heads
const GS_TURN = 39.0; // the half landings' after edge
const GS_FWD = 41.4; // the well's and the foyers' forward wall
const WELL_Y = 3.0;
const BROAD_Y = 1.5;
const TWIN_Y = (BROAD_Y + WELL_Y) / 2;

/** A foyer round the well: x from x0 to the forward wall, y ±halfY. */
function foyer(id: string, x0: number, halfY: number): RoomShape {
  return {
    id,
    outline: [
      [x0, -halfY],
      [GS_FWD, -halfY],
      [GS_FWD, -WELL_Y],
      [GS_AFT, -WELL_Y],
      [GS_AFT, WELL_Y],
      [GS_FWD, WELL_Y],
      [GS_FWD, halfY],
      [x0, halfY],
    ],
  };
}

/** One deck down the well: the broad flight, its half landing, the twins. */
function staircase(prefix: string, drop: number): void {
  const half = drop / 2;
  add(
    flight(prefix, [GS_AFT, 0], [GS_TURN, 0], 2 * BROAD_Y, half),
    cabin(`${prefix}-landing`, [GS_TURN, -WELL_Y], [GS_FWD, WELL_Y]),
    flight(
      `${prefix}-port`,
      [GS_TURN, TWIN_Y],
      [GS_AFT, TWIN_Y],
      WELL_Y - BROAD_Y,
      half
    ),
    flight(
      `${prefix}-starboard`,
      [GS_TURN, -TWIN_Y],
      [GS_AFT, -TWIN_Y],
      WELL_Y - BROAD_Y,
      half
    )
  );
}

add(
  foyer("gs-boat", 33.4, 4.8),
  foyer("gs-a", 31.0, 7.0),
  foyer("gs-b", 31.0, 8.0)
);
staircase("gs-flight-boat-a", step("Boat", "A"));
staircase("gs-flight-a-b", step("A", "B"));
// Drawn behind the rope: the broad flight down from B and its landing.
add(
  flight(
    "gs-flight-b-c",
    [GS_AFT, 0],
    [GS_TURN, 0],
    2 * BROAD_Y,
    step("B", "C") / 2
  ),
  // Its after edge is cut where the flight's foot meets it: only the
  // middle (the foot) is open; either side, under the A → B twin flights,
  // is a wall (one whole open edge left holes under them).
  {
    id: "gs-c",
    outline: [
      [GS_TURN, -WELL_Y],
      [GS_FWD, -WELL_Y],
      [GS_FWD, WELL_Y],
      [GS_TURN, WELL_Y],
      [GS_TURN, BROAD_Y],
      [GS_TURN, -BROAD_Y],
    ],
  }
);
for (const [upper, prefix, lower] of [
  ["gs-boat", "gs-flight-boat-a", "gs-a"],
  ["gs-a", "gs-flight-a-b", "gs-b"],
] as const) {
  door(upper, prefix, [GS_AFT, 0], 2 * BROAD_Y);
  for (const [side, y] of [
    ["port", TWIN_Y],
    ["starboard", -TWIN_Y],
  ] as const) {
    door(
      `${prefix}-landing`,
      `${prefix}-${side}`,
      [GS_TURN, y],
      WELL_Y - BROAD_Y
    );
    door(lower, `${prefix}-${side}`, [GS_AFT, y], WELL_Y - BROAD_Y);
  }
  door(prefix, `${prefix}-landing`, [GS_TURN, 0], 2 * BROAD_Y);
}

// B deck: the corridor and the suites; the lift car.
const B_CORRIDOR_Y = -5.3;
const SUITES: readonly [id: string, x0: number, x1: number][] = [
  ["suite-1", 26.0, 30.8],
  ["suite-2", 21.0, 25.8],
  ["suite-3", 16.0, 20.8],
];
add(corridor("b-corridor", [31.0, B_CORRIDOR_Y], [14.0, B_CORRIDOR_Y], 1.4));
door("gs-b", "b-corridor", [31.0, B_CORRIDOR_Y], 1.4);
for (const [id, x0, x1] of SUITES) {
  add(cabin(id, [x0, -11.0], [x1, -6.0]));
  door("b-corridor", id, [(x0 + x1) / 2, -6.0], 1.2);
}
const LIFT_MIN: V2 = [GS_FWD, -5.6];
const LIFT_MAX: V2 = [GS_FWD + 2, -3.6];
const LIFT_AT: V2 = [GS_FWD + 1, -4.6];
add(cabin("lift-b", LIFT_MIN, LIFT_MAX));
door("gs-b", "lift-b", [GS_FWD, LIFT_AT[1]], 1.2);

// E deck: the lift, its cross passage and Scotland Road.
const SR_Y0 = 3.0;
const SR_Y1 = 5.6;
const SR_FWD = 70.0;
add(
  cabin("lift-e", LIFT_MIN, LIFT_MAX),
  corridor("e-lobby", [LIFT_AT[0], LIFT_MAX[1]], [LIFT_AT[0], SR_Y0], 1.4),
  corridor(
    "scotland-road",
    [SR_FWD, (SR_Y0 + SR_Y1) / 2],
    [BULKHEAD_J, (SR_Y0 + SR_Y1) / 2],
    SR_Y1 - SR_Y0
  )
);
door("lift-e", "e-lobby", [LIFT_AT[0], LIFT_MAX[1]], 1.4);
door("e-lobby", "scotland-road", [LIFT_AT[0], SR_Y0], 1.4);

// Third class: C landing, flight, D landing, flight, E landing, passage,
// cabin. The upper flight (y 4.2–5.6) goes down aft, the lower (y 2.8–4.2)
// back forward.
const T_FWD = 76.0; // just inside the forward well's after wall (76.2)
const T_TOP = 74.4; // the flights' forward ends
const T_TURN = 69.9; // their after ends (the D landing's forward wall)
const T_UPPER_Y = 4.9;
const T_LOWER_Y = 3.5;
add(
  cabin("third-stairs-c", [T_TOP, 2.8], [T_FWD, 5.6]),
  flight(
    "third-flight-cd",
    [T_TOP, T_UPPER_Y],
    [T_TURN, T_UPPER_Y],
    1.4,
    step("C", "D")
  ),
  cabin("third-stairs-d", [T_TURN - 1.5, 2.8], [T_TURN, 5.6]),
  flight(
    "third-flight-de",
    [T_TURN, T_LOWER_Y],
    [T_TOP, T_LOWER_Y],
    1.4,
    step("D", "E")
  ),
  cabin("third-stairs-e", [T_TOP, 2.8], [T_FWD, 5.6]),
  corridor("third-passage", [T_TOP, T_UPPER_Y], [SR_FWD, T_UPPER_Y], 1.4),
  cabin("third-cabin", [72.0, 5.6], [76.0, 8.6])
);
door("third-stairs-c", "third-flight-cd", [T_TOP, T_UPPER_Y], 1.4);
door("third-flight-cd", "third-stairs-d", [T_TURN, T_UPPER_Y], 1.4);
door("third-stairs-d", "third-flight-de", [T_TURN, T_LOWER_Y], 1.4);
door("third-flight-de", "third-stairs-e", [T_TOP, T_LOWER_Y], 1.4);
door("third-stairs-e", "third-passage", [T_TOP, T_UPPER_Y], 1.4);
door("third-passage", "scotland-road", [SR_FWD, T_UPPER_Y], 1.4);
door("third-stairs-e", "third-cabin", [75.2, 5.6], 1.2);

// --- The rooms ---------------------------------------------------------------

type RoomInfo = Omit<Room, "id" | "outline" | "axis" | "ramp">;

const OAK = { finish: "oak", floor: "lino", lamp: "sconce" } as const;
const OAK_CARPET = { finish: "oak", floor: "carpet", lamp: "sconce" } as const;
const STEEL = { finish: "steel", floor: "lino", lamp: "caged-bulb" } as const;
const ENAMEL = { finish: "enamel", floor: "lino", lamp: "caged-bulb" } as const;
const TREADS = {
  finish: "enamel",
  floor: "steel",
  lamp: "caged-bulb",
} as const;

const half = (upper: string, lower: string) => step(upper, lower) / 2;
/**
 * The Boat deck entrance's ceiling (m over its floor), under the dome: the
 * half landing and the twin flights below it reach up to the same height.
 */
const TOP_CEILING_M = 4.2;

const INFO: Record<string, RoomInfo> = {
  "gs-boat": {
    kind: "foyer",
    deck: "Boat",
    ceilingM: TOP_CEILING_M,
    zone: "gs",
    look: { finish: "oak", floor: "lino", lamp: "dome" },
  },
  "gs-flight-boat-a": {
    kind: "flight",
    deck: "Boat",
    ceilingM: TOP_CEILING_M,
    zone: "gs",
    look: { finish: "oak", floor: "lino", lamp: "dome" },
  },
  "gs-flight-boat-a-landing": {
    kind: "landing",
    deck: "A",
    raiseM: half("Boat", "A"),
    ceilingM: TOP_CEILING_M + half("Boat", "A"),
    zone: "gs",
    look: { finish: "oak", floor: "lino", lamp: "dome" },
  },
  "gs-flight-boat-a-port": {
    kind: "flight",
    deck: "A",
    raiseM: half("Boat", "A"),
    ceilingM: TOP_CEILING_M + half("Boat", "A"),
    zone: "gs",
    look: { finish: "oak", floor: "lino", lamp: "dome" },
  },
  "gs-flight-boat-a-starboard": {
    kind: "flight",
    deck: "A",
    raiseM: half("Boat", "A"),
    ceilingM: TOP_CEILING_M + half("Boat", "A"),
    zone: "gs",
    look: { finish: "oak", floor: "lino", lamp: "dome" },
  },
  "gs-a": { kind: "foyer", deck: "A", ceilingM: 2.8, zone: "gs", look: OAK },
  "gs-flight-a-b": {
    kind: "flight",
    deck: "A",
    ceilingM: 2.8,
    zone: "gs",
    look: OAK,
  },
  "gs-flight-a-b-landing": {
    kind: "landing",
    deck: "B",
    raiseM: half("A", "B"),
    ceilingM: 2.6,
    zone: "gs",
    look: OAK,
  },
  "gs-flight-a-b-port": {
    kind: "flight",
    deck: "B",
    raiseM: half("A", "B"),
    ceilingM: 2.6,
    zone: "gs",
    look: OAK,
  },
  "gs-flight-a-b-starboard": {
    kind: "flight",
    deck: "B",
    raiseM: half("A", "B"),
    ceilingM: 2.6,
    zone: "gs",
    look: OAK,
  },
  "gs-b": { kind: "foyer", deck: "B", ceilingM: 2.5, zone: "gs", look: OAK },
  "gs-flight-b-c": {
    kind: "flight",
    deck: "B",
    ceilingM: 2.5,
    zone: "gs",
    look: OAK,
    noWalk: true,
  },
  "gs-c": {
    kind: "landing",
    deck: "C",
    raiseM: half("B", "C"),
    ceilingM: 2.5,
    zone: "gs",
    look: OAK,
    noWalk: true,
  },
  "lift-b": {
    kind: "lift",
    deck: "B",
    ceilingM: 2.3,
    zone: "gs",
    look: { finish: "oak", floor: "carpet", lamp: "ceiling" },
  },
  "b-corridor": {
    kind: "corridor",
    deck: "B",
    ceilingM: 2.4,
    zone: "b-deck",
    look: { finish: "white-panel", floor: "carpet", lamp: "sconce" },
  },
  "suite-1": {
    kind: "cabin",
    deck: "B",
    ceilingM: 2.4,
    zone: "b-deck",
    look: { ...OAK_CARPET, portholes: "starboard" },
  },
  "suite-2": {
    kind: "cabin",
    deck: "B",
    ceilingM: 2.4,
    zone: "b-deck",
    look: {
      finish: "white-panel",
      floor: "carpet",
      lamp: "sconce",
      portholes: "starboard",
    },
  },
  "suite-3": {
    kind: "cabin",
    deck: "B",
    ceilingM: 2.4,
    zone: "b-deck",
    look: { ...OAK_CARPET, portholes: "starboard" },
  },
  "lift-e": {
    kind: "lift",
    deck: "E",
    ceilingM: 2.3,
    zone: "e-deck",
    look: { finish: "oak", floor: "carpet", lamp: "ceiling" },
  },
  "e-lobby": {
    kind: "passage",
    deck: "E",
    ceilingM: 2.3,
    zone: "e-deck",
    look: STEEL,
  },
  "scotland-road": {
    kind: "corridor",
    deck: "E",
    ceilingM: 2.4,
    zone: "e-deck",
    look: STEEL,
  },
  "third-passage": {
    kind: "passage",
    deck: "E",
    ceilingM: 2.3,
    zone: "e-deck",
    look: ENAMEL,
  },
  "third-cabin": {
    kind: "cabin",
    deck: "E",
    ceilingM: 2.3,
    zone: "e-deck",
    look: { ...ENAMEL, portholes: "port" },
  },
  "third-stairs-c": {
    kind: "landing",
    deck: "C",
    ceilingM: 2.4,
    zone: "third-stairs",
    look: TREADS,
  },
  "third-flight-cd": {
    kind: "flight",
    deck: "C",
    ceilingM: 2.4,
    zone: "third-stairs",
    look: TREADS,
  },
  "third-stairs-d": {
    kind: "landing",
    deck: "D",
    ceilingM: 2.4,
    zone: "third-stairs",
    look: TREADS,
  },
  "third-flight-de": {
    kind: "flight",
    deck: "D",
    ceilingM: 2.3,
    zone: "third-stairs",
    look: TREADS,
  },
  "third-stairs-e": {
    kind: "landing",
    deck: "E",
    ceilingM: 2.4,
    zone: "third-stairs",
    look: TREADS,
  },
};

const rooms: Room[] = [...shapes.values()].map((s) => {
  const info = INFO[s.id];
  if (!info) throw new Error(`room ${s.id} has no info`);
  // No corner traps: chamfer reflex corners, except a seam's ends.
  const ends = seams
    .filter((m) => m.a === s.id || m.b === s.id)
    .flatMap((m) => [m.at[0], m.at[1]]);
  return {
    id: s.id,
    ...info,
    outline: info.noWalk ? s.outline : chamferReflex(s.outline, ends),
    ...(s.axis ? { axis: s.axis } : {}),
    ...(s.ramp ? { ramp: s.ramp } : {}),
  };
});

// --- Deck doors and the lift -------------------------------------------------

const GS_DOOR_X = 35.5;
const links: InteriorLink[] = [
  // The staircase house's sides (y ±5): outside 0.45 m off the face.
  {
    id: "gs-door-port",
    kind: "door",
    from: { area: "boat-deck", at: [GS_DOOR_X, 5.45] },
    to: { area: "gs-boat", at: [GS_DOOR_X, 4.2] },
    widthM: 1.2,
  },
  {
    id: "gs-door-starboard",
    kind: "door",
    from: { area: "boat-deck", at: [GS_DOOR_X, -5.45] },
    to: { area: "gs-boat", at: [GS_DOOR_X, -4.2] },
    widthM: 1.2,
  },
  // The forward well's after wall (x 76.2), port.
  {
    id: "third-class-door",
    kind: "door",
    from: { area: "forward-well", at: [76.65, T_UPPER_Y] },
    to: { area: "third-stairs-c", at: [75.6, T_UPPER_Y] },
    widthM: 1.2,
  },
  {
    id: "first-class-lift",
    kind: "lift",
    from: { area: "lift-b", at: LIFT_AT },
    to: { area: "lift-e", at: LIFT_AT },
    widthM: 1.0,
  },
];

// --- Shut doors ---------------------------------------------------------------

const PORT_FACING = -Math.PI / 2; // a door on a port wall faces starboard
const STBD_FACING = Math.PI / 2;
const shutDoors: ShutDoor[] = [];
// Scotland Road: steel doors both sides every 4 m, clear of the lobby.
for (let x = 66; x >= -14; x -= 4) {
  if (Math.abs(x - LIFT_AT[0]) < 1.6) continue;
  shutDoors.push(
    {
      room: "scotland-road",
      at: [x, SR_Y1],
      facing: PORT_FACING,
      style: "steel",
    },
    {
      room: "scotland-road",
      at: [x, SR_Y0],
      facing: STBD_FACING,
      style: "steel",
    }
  );
}
// The B deck corridor: inboard every 4 m, and its after end.
for (const x of [29, 25, 21, 17])
  shutDoors.push({
    room: "b-corridor",
    at: [x, B_CORRIDOR_Y + 0.7],
    facing: PORT_FACING,
    style: "white",
  });
shutDoors.push({
  room: "b-corridor",
  at: [14.0, B_CORRIDOR_Y],
  facing: 0,
  style: "white",
});
// Each suite's door through to the next room (aft wall), and another
// third-class cabin off the passage.
for (const [room, x0] of [
  ["suite-1", 26.0],
  ["suite-2", 21.0],
  ["suite-3", 16.0],
] as const)
  shutDoors.push({
    room,
    at: [x0, -7.0],
    facing: 0,
    style: room === "suite-2" ? "white" : "oak",
  });
shutDoors.push({
  room: "third-passage",
  at: [71.0, 5.6],
  facing: PORT_FACING,
  style: "white",
});
// The foyers' after and side walls.
for (const [room, halfY, aft] of [
  ["gs-a", 7.0, [4.5, -4.5]],
  ["gs-b", 8.0, [3.5, -1.5]],
] as const) {
  for (const y of aft)
    shutDoors.push({ room, at: [31.0, y], facing: 0, style: "oak" });
  for (const x of [33.5, 38.5])
    shutDoors.push(
      { room, at: [x, halfY], facing: PORT_FACING, style: "oak" },
      { room, at: [x, -halfY], facing: STBD_FACING, style: "oak" }
    );
}

// --- Furniture ------------------------------------------------------------------

const Q = Math.PI / 2;
const furniture: Furniture[] = [
  // The Grand Staircase: the dome over the well's middle, the clock on
  // the A → B half landing, the cherub lamp and newels at the flights'
  // feet, sconces round the foyers' walls.
  {
    room: "gs-flight-boat-a",
    piece: "dome",
    at: [(GS_AFT + GS_FWD) / 2, 0],
    yaw: 0,
  },
  {
    room: "gs-flight-a-b-landing",
    piece: "clock-panel",
    at: [41.3, 0],
    yaw: Math.PI,
  },
  { room: "gs-b", piece: "cherub-lamp", at: [34.8, 3.2], yaw: 0 },
  { room: "gs-b", piece: "newel", at: [34.8, -3.2], yaw: 0 },
  { room: "gs-b", piece: "rope", at: [34.95, 0], yaw: 0 },
  ...(["gs-a", "gs-b"] as const).flatMap((room) =>
    [2, -2].map((y): Furniture => ({
      room,
      piece: "sconce",
      at: [31.1, y],
      yaw: 0,
    }))
  ),
  { room: "gs-a", piece: "cherub-lamp", at: [34.8, 3.2], yaw: 0 },
  { room: "gs-a", piece: "newel", at: [34.8, -3.2], yaw: 0 },
  { room: "gs-boat", piece: "newel", at: [34.8, 1.7], yaw: 0 },
  { room: "gs-boat", piece: "newel", at: [34.8, -1.7], yaw: 0 },
  // Side walls (between the shut doors) and the forward walls (clear of
  // the B foyer's lift doorway).
  ...(
    [
      ["gs-boat", 4.8, [36.5, 39.5]],
      ["gs-a", 7.0, [36.0]],
      ["gs-b", 8.0, [36.0]],
    ] as const
  ).flatMap(([room, halfY, xs]) =>
    xs.flatMap((x): Furniture[] => [
      { room, piece: "sconce", at: [x, halfY - 0.05], yaw: -Q },
      { room, piece: "sconce", at: [x, -halfY + 0.05], yaw: Q },
    ])
  ),
  ...(["gs-a", "gs-b"] as const).flatMap((room) =>
    [6.2, -6.2].map((y): Furniture => ({
      room,
      piece: "sconce",
      at: [GS_FWD - 0.05, y],
      yaw: Math.PI,
    }))
  ),
  ...[2.4, -2.4].map((y): Furniture => ({
    room: "gs-boat",
    piece: "sconce",
    at: [33.45, y],
    yaw: 0,
  })),
  // The B deck corridor's lamps, between the shut doors.
  ...[27, 23, 19, 15].map((x): Furniture => ({
    room: "b-corridor",
    piece: "sconce",
    at: [x, B_CORRIDOR_Y + 0.65],
    yaw: -Q,
  })),
  // Suite 1: a brass bed and a wardrobe.
  { room: "suite-1", piece: "bed", at: [30.05, -10.0], yaw: Q, blocks: true },
  {
    room: "suite-1",
    piece: "wardrobe",
    at: [26.3, -9.0],
    yaw: 0,
    blocks: true,
  },
  { room: "suite-1", piece: "chair", at: [27.2, -10.3], yaw: Q },
  // Suite 2: twin beds and a washstand.
  {
    room: "suite-2",
    piece: "single-bed",
    at: [21.475, -10.0],
    yaw: Q,
    blocks: true,
  },
  {
    room: "suite-2",
    piece: "single-bed",
    at: [25.325, -10.0],
    yaw: Q,
    blocks: true,
  },
  {
    room: "suite-2",
    piece: "washstand",
    at: [23.4, -10.75],
    yaw: Q,
    blocks: true,
  },
  // Suite 3: a sitting room.
  { room: "suite-3", piece: "sofa", at: [18.4, -10.6], yaw: Q, blocks: true },
  { room: "suite-3", piece: "table", at: [18.4, -8.9], yaw: 0, blocks: true },
  { room: "suite-3", piece: "chair", at: [17.3, -8.9], yaw: 0 },
  { room: "suite-3", piece: "chair", at: [19.5, -8.9], yaw: Math.PI },
  ...SUITES.flatMap(([room, x0, x1]): Furniture[] => [
    { room, piece: "porthole", at: [x0 + 1.2, -10.95], yaw: Q },
    { room, piece: "porthole", at: [x1 - 1.2, -10.95], yaw: Q },
    // Beside the door (not in it), and over the middle of the outboard wall.
    { room, piece: "sconce", at: [x0 + 0.9, -6.05], yaw: -Q },
    { room, piece: "sconce", at: [(x0 + x1) / 2, -10.95], yaw: Q },
  ]),
  // The third-class cabin: two pairs of bunks, a washbasin, a porthole.
  {
    room: "third-cabin",
    piece: "bunk",
    at: [72.4, 7.65],
    yaw: Q,
    blocks: true,
  },
  {
    room: "third-cabin",
    piece: "bunk",
    at: [73.75, 8.2],
    yaw: 0,
    blocks: true,
  },
  {
    room: "third-cabin",
    piece: "washbasin",
    at: [73.65, 5.825],
    yaw: Q,
    blocks: true,
  },
  { room: "third-cabin", piece: "porthole", at: [75.3, 8.55], yaw: -Q },
  { room: "third-cabin", piece: "caged-bulb", at: [74.0, 7.1], yaw: 0 },
  // Working lamps and pipes.
  ...(["third-stairs-c", "third-stairs-d", "third-stairs-e"] as const).map(
    (room): Furniture => {
      const s = shape(room).outline;
      const xs = s.map((p) => p[0]);
      return {
        room,
        piece: "caged-bulb",
        at: [(Math.min(...xs) + Math.max(...xs)) / 2, 4.2],
        yaw: 0,
      };
    }
  ),
  { room: "e-lobby", piece: "caged-bulb", at: [LIFT_AT[0], 0], yaw: 0 },
  // Scotland Road: a caged bulb every 8 m; along the port wall, high up,
  // runs of pipes end to end from its forward end; fire buckets on the
  // starboard wall and hose reels on the port wall, between the doors.
  ...Array.from({ length: 11 }, (_, i): Furniture => ({
    room: "scotland-road",
    piece: "caged-bulb",
    at: [66 - i * 8, 4.3],
    yaw: 0,
  })),
  ...Array.from({ length: 11 }, (_, i) => SR_FWD - 4 - i * 8)
    .filter((x) => x - 4 >= BULKHEAD_J)
    .map((x): Furniture => ({
      room: "scotland-road",
      piece: "pipes",
      at: [x, SR_Y1 - 0.05],
      yaw: -Q,
    })),
  ...[60, 36, 12, -8].map((x): Furniture => ({
    room: "scotland-road",
    piece: "fire-buckets",
    at: [x, SR_Y0 + 0.05],
    yaw: Q,
  })),
  ...[48, 24, 0].map((x): Furniture => ({
    room: "scotland-road",
    piece: "hose-reel",
    at: [x, SR_Y1 - 0.05],
    yaw: -Q,
  })),
];

// --- Start inside (1.16) ------------------------------------------------------

/**
 * The camera picker's rooms, in the order the buttons show: each spot is
 * on a level floor, clear of the furniture, facing what is worth seeing.
 */
const entries: RoomEntry[] = [
  // The Boat deck entrance under the dome, at the head of the broad
  // flight, looking down it.
  {
    id: "grand-staircase",
    label: "Grand Staircase",
    icon: "staircase",
    room: "gs-boat",
    at: [GS_AFT - 1, 0],
    yaw: 0,
  },
  // Suite 1, just inside its door, the brass bed and the portholes ahead.
  {
    id: "suite",
    label: "Suite",
    icon: "bed",
    room: "suite-1",
    at: [27.6, -6.9],
    yaw: -0.9,
  },
  // The four-berth cabin, just inside its door, facing the bunks.
  {
    id: "third-class-cabin",
    label: "Third class cabin",
    icon: "bunk",
    room: "third-cabin",
    at: [75.0, 6.3],
    yaw: 2.6,
  },
  // Scotland Road's forward end (dry at the start of the night), looking
  // aft down its length.
  {
    id: "scotland-road",
    label: "Scotland Road",
    icon: "corridor",
    room: "scotland-road",
    at: [SR_FWD - 4, (SR_Y0 + SR_Y1) / 2],
    yaw: Math.PI,
  },
];

export const TITANIC_INTERIOR: InteriorMap = {
  ship: "titanic",
  rooms,
  seams,
  links,
  shutDoors,
  furniture,
  entries,
};
