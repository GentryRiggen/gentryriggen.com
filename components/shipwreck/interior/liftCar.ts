import { Group, Mesh, type BufferAttribute, type Material } from "three";
import {
  liftAt,
  liftMiddle,
  liftStopZ,
  landingStop,
  LIFT_CAR_CEILING_M,
  LIFT_SPEED_MS,
  otherCarLoopS,
  otherCarZ,
  type InteriorMap,
  type LiftShaft,
} from "@/lib/shipwreck/interior";
import { deckZAt } from "@/lib/shipwreck/places";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { V2 } from "@/lib/shipwreck/walk";
import type { WalkRide } from "../scene/runtime";
import { MODERN_COLOR as C, ModernLayers } from "./modernPieces";
import { MODERN_TILE as MT } from "./modernTextures";
import { Builder, lin, scale, type P3, type RGB } from "./pieces";

/**
 * Her glass lifts in the scene (the Concordia, 1.18; spec "The glass
 * lift"): one glass car per shaft, moved by matrix, and the shafts they
 * ride in. Built with the rest of her rooms (Interior's `build`), nothing
 * when not walking on her, and for an interior without shafts nothing at
 * all (`buildLiftCars` returns null: the Titanic's lift is two rooms).
 *
 * - **The car** (two meshes: its frame, floor, roof, sides and rails in
 *   its own lit material, `carMaterial`; its glass in the see-through
 *   pane material, the lift glass's tile): a marble floor, a lit white
 *   roof with glowing downlights, a brass frame, lit panelled sides, and
 *   a door at each end with its leaves slid back: forward onto the atrium
 *   in glass, aft onto the low and deck 7 lobbies in lit white panels (the
 *   car's bright back, seen through its glass); a cone ringed with
 *   glowing lights under it for the atrium to see.
 * - **The shaft** (one mesh for both): walls round each car's plan from
 *   under the bottom stop to over the top one, facing in, open where the
 *   car looks into a room (the atrium's storeys forward, each lobby aft),
 *   and the slab edge of every deck the car passes as a band (Costa
 *   yellow at a stop): the decks slide by through the glass. Lined dark
 *   (deep blue graphite), so the atrium's glass reads as glass and the
 *   lit car stands out against it.
 *
 * Where each car is drawn (`liftCarTargetZ`): riding it, at the ride's z;
 * standing in it, at that stop (at once: the car is round you); on one of
 * its landings within PARK_NEAR_M of its door there, parked at that stop
 * (it comes to you, doors open); anywhere else, the galleries and the well
 * floor too, on its slow ambient loop between the atrium's stops
 * (`loopStops`, `otherCarZ`, by real seconds, so it glides at lift speed
 * whatever the playback speed; the two cars half a leg apart, one moving
 * while the other waits), so you watch them go up and down. A car the walker is not
 * in never jumps: it glides toward where it should be at no more than
 * LIFT_SPEED_MS. Both are drawn while any of their landings' zones is, or
 * while riding; lit as the walker's room (`setSlot`).
 *
 * The car is lit by its own warm ceiling light, baked into its material
 * (`carMaterial`, no three.js light), so it glows in its dark shaft.
 */

/** The shaft's side walls a little outside the car's plan (m). */
export const SHAFT_GAP_M = 0.06;
/** The pit under the bottom stop and the head over the top car (m). */
const PIT_M = 0.6;
const HEAD_M = 0.6;
/** A lobby's storey the shaft is open onto, aft (m over the stop's floor). */
const LOBBY_OPEN_M = 2.6;
/** The atrium's storeys the shaft is open onto, forward: to its roof (m over the top atrium stop's floor). */
const ATRIUM_OPEN_M = 3.8;
/** A deck's slab edge: from this far under the floor to just over it (m). */
const SLAB_DOWN_M = 0.35;
const SLAB_UP_M = 0.02;
/** The car's door opening (m) and its head (m over the floor). */
const DOOR_HALF_M = 0.6;
const DOOR_HEAD_M = 2.15;
/**
 * The car's glass ends (its doors, the glass beside and over them) stand
 * this far in from its ends (m), so at a stop they never lie on the
 * atrium's glass wall onto the shaft (`liftGlassWalls`, on the car's end
 * line): two panes a hand apart, never one doubled or fighting.
 */
export const CAR_END_INSET_M = 0.1;
/**
 * The car's ends stand this far inside its plan (m): at a stop its
 * frame never lies on the landing's wall (a lobby's is solid beside the
 * door), the sill's slim gap.
 */
const CAR_END_GAP_M = 0.02;

/**
 * A car parks at a landing for a walker this near its door there (m, from
 * the door's middle); farther off, the galleries and the well floor, it
 * keeps gliding on its loop.
 */
export const PARK_NEAR_M = 3;

/** The car's frame: polished brass. */
const FRAME = C.gold;
/** The shafts' lining behind the glass. */
const SHAFT_LINING = lin(0.11, 0.14, 0.22);

/** One car and where it is drawn. */
export interface LiftCar {
  lift: LiftShaft;
  /** Its frame and its glass. */
  body: Mesh;
  pane: Mesh;
  /** The car floor's ship-frame z shown (NaN until first placed). */
  z: number;
  /** Its ambient loop's offset (s): half a leg for the second car. */
  offset: number;
  /** The zones of its landings (drawn while riding it). */
  zones: ReadonlySet<string>;
  /** The same as a plain list (the frame loop walks it without an iterator). */
  zoneList: readonly string[];
  /** Its middle in plan (ship x, y). */
  x: number;
  y: number;
}

export interface LiftCars {
  group: Group;
  cars: LiftCar[];
  shaft: Mesh;
  /** Per lift id, the zones its shaft passes (the riding zone rule). */
  zones: Map<string, ReadonlySet<string>>;
  /** The slot the meshes are lit by (`aRoom`), or −1 before the first. */
  slot: number;
  triangles: number;
}

/** Where a car should be: its floor's ship-frame z, and whether exactly. */
export interface CarTarget {
  z: number;
  exact: boolean;
}

/**
 * Where a lift's car should be (its floor's ship-frame z), and whether
 * exactly (the walker rides it or stands in it), written into `out`:
 * riding it, the ride's z; the walker in one of its car areas, that stop;
 * on one of its landings within PARK_NEAR_M of that stop's door (`x`, `y`:
 * the walker in ship plan; NaN when unknown, which never parks), that
 * stop; else its ambient loop at `t + offset` (s).
 */
export function liftCarTargetZ(
  interior: Pick<InteriorMap, "lifts">,
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  ride: Pick<WalkRide, "lift" | "z"> | null,
  room: string | null,
  x: number,
  y: number,
  t: number,
  offset = 0,
  out: CarTarget = { z: 0, exact: false }
): CarTarget {
  out.exact = false;
  if (ride && ride.lift === lift.id) {
    out.z = ride.z;
    out.exact = true;
    return out;
  }
  if (room !== null) {
    const car = liftAt(interior, room);
    if (car && car.lift === lift) {
      out.z = liftStopZ(lift, spec, car.stop);
      out.exact = true;
      return out;
    }
    const i = landingStop(lift, room);
    if (i >= 0) {
      const [a, b] = lift.stops[i].door;
      const dx = x - (a[0] + b[0]) / 2;
      const dy = y - (a[1] + b[1]) / 2;
      if (dx * dx + dy * dy <= PARK_NEAR_M * PARK_NEAR_M) {
        out.z = liftStopZ(lift, spec, i);
        return out;
      }
    }
  }
  const [lo, hi] = loopStops(lift);
  out.z = otherCarZ(lift, spec, t + offset, lo, hi);
  return out;
}

/** Whether each stop's door is at the shaft's forward end (the atrium's glass). */
function forwardStops(lift: LiftShaft): boolean[] {
  const mid = liftMiddle(lift)[0];
  return lift.stops.map((s) => (s.door[0][0] + s.door[1][0]) / 2 > mid);
}

const LOOPS = new WeakMap<LiftShaft, readonly [number, number]>();

/**
 * The stops a car nobody rides loops between (kept per shaft): the run of
 * stops behind the atrium's glass (the forward ones), so from the floor
 * and the galleries a car is nearly always in sight going up or down; the
 * whole shaft when fewer than two stops face forward.
 */
export function loopStops(lift: LiftShaft): readonly [number, number] {
  let r = LOOPS.get(lift);
  if (!r) {
    const fwd = forwardStops(lift);
    const lo = fwd.indexOf(true);
    const hi = fwd.lastIndexOf(true);
    r = hi > lo ? [lo, hi] : [0, lift.stops.length - 1];
    LOOPS.set(lift, r);
  }
  return r;
}

/** The frame loop's target (no per-frame allocation). */
const target: CarTarget = { z: 0, exact: false };

/** A see-through pane a→b→c→d, both faces (the lift glass's tile). */
function pane(L: ModernLayers, a: P3, b: P3, c: P3, d: P3): void {
  L.pane.tileId = MT.liftGlass;
  L.pane.quad(a, b, c, d, C.glass);
  L.pane.quad(d, c, b, a, C.glass);
}

/** The glass car round its floor's middle (local ship axes, z up). */
function carGeometry(lx: number, ly: number): ModernLayers {
  const L = new ModernLayers();
  L.pieces(true);
  const m = L.metal;
  const X = lx / 2;
  const Y = ly / 2;
  const H = LIFT_CAR_CEILING_M;
  m.box([0, 0, -0.08], lx, ly, 0.16, C.marble);
  m.box([0, 0, H + 0.07], lx, ly, 0.14, C.white);
  // Its downlights, under the roof (they glow: `aGlow` 1, `carMaterial`).
  m.glowV = 1;
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      m.box([x, y, H - 0.01], 0.18, 0.18, 0.02, scale(C.lamp, 1.2), {
        top: true,
      });
  m.glowV = 0;
  // Brass posts at the corners, rims at the foot and the head (bright
  // against the cream atrium and the dark shaft).
  for (const x of [-X + 0.035, X - 0.035])
    for (const y of [-Y + 0.035, Y - 0.035])
      m.box([x, y, H / 2], 0.07, 0.07, H, FRAME, {
        top: true,
        bottom: true,
      });
  for (const z of [0.05, H - 0.04]) {
    for (const y of [-Y + 0.02, Y - 0.02])
      m.box([0, y, z], lx - 0.14, 0.04, 0.09, FRAME);
    for (const x of [-X + 0.02, X - 0.02])
      m.box([x, 0, z], 0.04, ly - 0.14, 0.09, FRAME);
  }
  // A door at each end: its jambs and head, the leaves slid back.
  const z0 = 0.1;
  const z1 = H - 0.09;
  for (const sx of [-1, 1]) {
    const xf = sx * (X - CAR_END_INSET_M);
    for (const sy of [-1, 1])
      m.box(
        [xf, sy * (DOOR_HALF_M + 0.025), H / 2],
        0.05,
        0.05,
        H - 0.1,
        FRAME,
        {
          top: true,
          bottom: true,
        }
      );
    m.box([xf, 0, DOOR_HEAD_M + 0.04], 0.05, 2 * DOOR_HALF_M, 0.08, FRAME);
    if (sx > 0) {
      // Forward (onto the atrium): glass beside the door and over it.
      for (const sy of [-1, 1]) {
        const ya = sy * (Y - 0.04);
        const yb = sy * DOOR_HALF_M;
        pane(L, [xf, ya, z0], [xf, yb, z0], [xf, yb, z1], [xf, ya, z1]);
      }
      pane(
        L,
        [xf, -DOOR_HALF_M, DOOR_HEAD_M + 0.08],
        [xf, DOOR_HALF_M, DOOR_HEAD_M + 0.08],
        [xf, DOOR_HALF_M, z1],
        [xf, -DOOR_HALF_M, z1]
      );
    } else {
      // Aft (onto the lobbies' solid walls): lit white panels beside the
      // door and over it, the car's bright back seen through its glass.
      const ax = xf - sx * 0.02;
      const w = Y - 0.04 - DOOR_HALF_M - 0.05;
      for (const sy of [-1, 1])
        m.box(
          [ax, sy * (DOOR_HALF_M + 0.05 + w / 2), (z0 + z1) / 2],
          0.03,
          w,
          z1 - z0,
          C.white
        );
      m.box(
        [ax, 0, (DOOR_HEAD_M + 0.08 + z1) / 2],
        0.03,
        2 * DOOR_HALF_M + 0.1,
        z1 - DOOR_HEAD_M - 0.08,
        C.white
      );
    }
    // The floor display over the door, inside.
    m.box([xf - sx * 0.04, 0, H - 0.2], 0.02, 0.36, 0.1, C.onyx);
  }
  // Its sides (onto the shaft's walls) lit panels, veneer to the rail and
  // white over it, so its own light fills it and it glows behind the
  // atrium's glass; a chrome handrail along each.
  for (const sy of [-1, 1]) {
    const y = sy * (Y - 0.035);
    m.box([0, y, (z0 + 0.95) / 2], lx - 0.14, 0.03, 0.95 - z0, C.veneer);
    m.box([0, y, (0.95 + z1) / 2], lx - 0.14, 0.03, z1 - 0.95, C.white);
    m.box([0, sy * (Y - 0.1), 0.95], lx - 0.5, 0.04, 0.04, C.chrome);
  }
  // Under it, a chrome cone ringed with lights (the atrium sees it).
  m.cyl([0, 0, -0.5], 0.22, Math.min(X, Y) * 0.85, 0.34, 8, C.chrome);
  m.glowV = 1;
  for (let i = 0; i < 8; i += 1) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    m.ball([Math.cos(a) * 0.62, Math.sin(a) * 0.62, -0.3], 0.04, C.lamp);
  }
  m.glowV = 0;
  return L;
}

/** A wall a→b from z0 to z1, facing left of a→b (into a CCW outline). */
function wall(b: Builder, p: V2, q: V2, z0: number, z1: number, c: RGB): void {
  if (z1 - z0 < 1e-3) return;
  b.quad(
    [q[0], q[1], z0],
    [p[0], p[1], z0],
    [p[0], p[1], z1],
    [q[0], q[1], z1],
    c
  );
}

/** A wall a→b with open spans [lo, hi] (sorted, not overlapping) left out. */
function wallWithGaps(
  b: Builder,
  p: V2,
  q: V2,
  z0: number,
  z1: number,
  gaps: readonly (readonly [number, number])[],
  c: RGB
): void {
  let z = z0;
  for (const [lo, hi] of gaps) {
    wall(b, p, q, z, Math.max(z, lo), c);
    z = Math.max(z, hi);
  }
  wall(b, p, q, z, z1, c);
}

/** Every deck of hers between two heights (ship z at x), by name. */
function decksBetween(
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  lo: number,
  hi: number,
  zAt: (deck: string) => number
): { deck: string; z: number }[] {
  const out: { deck: string; z: number }[] = [];
  for (const d of spec.decks) {
    const z = zAt(d.name);
    if (z > lo && z < hi) out.push({ deck: d.name, z });
  }
  return out;
}

/** One shaft's walls and slab bands (ship frame) into `b`. */
function shaftGeometry(
  b: Builder,
  lift: LiftShaft,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">
): void {
  const top = lift.stops.length - 1;
  // Its ends on the landings' wall lines (never poking through a lobby's
  // wall or the atrium's glass), its sides a little outside the car.
  const x0 = lift.car.min[0];
  const x1 = lift.car.max[0];
  const y0 = lift.car.min[1] - SHAFT_GAP_M;
  const y1 = lift.car.max[1] + SHAFT_GAP_M;
  const zLo = liftStopZ(lift, spec, 0) - PIT_M;
  const zHi = liftStopZ(lift, spec, top) + LIFT_CAR_CEILING_M + HEAD_M;
  const A: V2 = [x0, y0];
  const B: V2 = [x1, y0];
  const Cc: V2 = [x1, y1];
  const D: V2 = [x0, y1];
  // Which end each stop's door is at: aft (the lobbies) or forward.
  const front: number[] = [];
  const back: number[] = [];
  const mid = liftMiddle(lift)[0];
  forwardStops(lift).forEach((fwd, i) => (fwd ? front : back).push(i));
  // Forward: open from the lowest forward stop to the atrium's roof.
  const frontGaps: [number, number][] =
    front.length > 0
      ? [
          [
            liftStopZ(lift, spec, front[0]),
            liftStopZ(lift, spec, front[front.length - 1]) + ATRIUM_OPEN_M,
          ],
        ]
      : [];
  // Aft: open onto each lobby's storey.
  const backGaps: [number, number][] = back.map((i) => {
    const z = liftStopZ(lift, spec, i);
    return [z, z + LOBBY_OPEN_M];
  });
  // A dark lining (deep blue graphite), so the atrium's glass reads as
  // glass and the lit car stands out against it.
  const shell = SHAFT_LINING;
  wall(b, A, B, zLo, zHi, shell);
  wallWithGaps(b, B, Cc, zLo, zHi, frontGaps, shell);
  wall(b, Cc, D, zLo, zHi, shell);
  wallWithGaps(b, D, A, zLo, zHi, backGaps, shell);
  // The pit's floor and the head's ceiling.
  b.quad(
    [x0, y0, zLo],
    [x1, y0, zLo],
    [x1, y1, zLo],
    [x0, y1, zLo],
    C.steelDark
  );
  b.quad(
    [x0, y1, zHi],
    [x1, y1, zHi],
    [x1, y0, zHi],
    [x0, y0, zHi],
    C.steelDark
  );
  // Each deck's slab edge, just proud of the walls (yellow at a stop).
  const stops = new Set(lift.stops.map((s) => s.deck));
  const k = 0.012;
  const a: V2 = [x0 + k, y0 + k];
  const bb: V2 = [x1 - k, y0 + k];
  const c: V2 = [x1 - k, y1 - k];
  const d: V2 = [x0 + k, y1 - k];
  for (const { deck, z } of decksBetween(spec, zLo, zHi, (name) =>
    deckZAt(name, mid, spec)
  )) {
    const col = stops.has(deck) ? C.yellow : C.cream;
    const lo = z - SLAB_DOWN_M;
    const hi = z + SLAB_UP_M;
    for (const [p, q] of [
      [a, bb],
      [bb, c],
      [c, d],
      [d, a],
    ] as const)
      wall(b, p, q, lo, hi, col);
  }
}

/**
 * Her cars and shafts (see the file comment), or null for an interior
 * without shafts. `body` is the rooms' metal material (the shafts),
 * `glass` the see-through panes', `car` the cars' frames and floors (their
 * own lit material, `carMaterial`; the metal by default).
 */
export function buildLiftCars(
  interior: InteriorMap,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  roomZone: ReadonlyMap<string, string>,
  body: Material,
  glass: Material,
  car: Material = body
): LiftCars | null {
  const lifts = interior.lifts ?? [];
  if (lifts.length === 0) return null;
  const group = new Group();
  group.name = "interior-lifts";
  group.matrixAutoUpdate = false;
  const cars: LiftCar[] = [];
  const zones = new Map<string, ReadonlySet<string>>();
  let triangles = 0;
  lifts.forEach((lift) => {
    const L = carGeometry(
      lift.car.max[0] - lift.car.min[0] - 2 * CAR_END_GAP_M,
      lift.car.max[1] - lift.car.min[1]
    );
    const bodyMesh = new Mesh(L.metal.geometry(), car);
    bodyMesh.name = `interior-lift-car-${lift.id}`;
    const paneMesh = new Mesh(L.pane.geometry(), glass);
    paneMesh.name = `interior-lift-glass-${lift.id}`;
    triangles += L.metal.triangles + L.pane.triangles;
    for (const m of [bodyMesh, paneMesh]) {
      m.matrixAutoUpdate = false;
      // Moved by matrix: its plan box is not where it is.
      m.frustumCulled = false;
      group.add(m);
    }
    const z = new Set<string>();
    for (const s of lift.stops) {
      const zone = roomZone.get(s.landing);
      if (zone) z.add(zone);
    }
    zones.set(lift.id, z);
    const mid = liftMiddle(lift);
    cars.push({
      lift,
      body: bodyMesh,
      pane: paneMesh,
      z: NaN,
      offset: 0,
      zones: z,
      zoneList: [...z],
      x: mid[0],
      y: mid[1],
    });
  });
  // The cars' loops half a leg apart (a leg: a dwell and a ride, by the
  // first car's loop), so while one waits at a floor the other moves.
  const n = cars.length;
  const [lo, hi] = loopStops(lifts[0]);
  const leg =
    otherCarLoopS(lifts[0], spec, lo, hi) / Math.max(1, 2 * (hi - lo));
  for (let i = 1; i < n; i += 1) cars[i].offset = (i / n) * leg;
  const sb = new Builder();
  for (const lift of lifts) shaftGeometry(sb, lift, spec);
  const shaft = new Mesh(sb.geometry(), body);
  shaft.name = "interior-lift-shafts";
  triangles += sb.triangles;
  group.add(shaft);
  return { group, cars, shaft, zones, slot: -1, triangles };
}

/** Lights the cars and shafts as room slot `slot` (rewritten only on a change). */
export function setLiftSlot(c: LiftCars, slot: number): void {
  if (slot === c.slot || slot < 0) return;
  c.slot = slot;
  const meshes: Mesh[] = [c.shaft];
  for (const car of c.cars) meshes.push(car.body, car.pane);
  for (const m of meshes) {
    const a = m.geometry.getAttribute("aRoom") as BufferAttribute;
    (a.array as Float32Array).fill(slot);
    a.needsUpdate = true;
  }
}

/**
 * Each frame (Interior, walking on her with her rooms open): places each
 * car (`liftCarTargetZ` for the walker at ship plan `x`, `y`: gliding
 * unless the walker is in it) and shows the cars and
 * shafts while riding or while one of their landings' zones is drawn.
 */
export function updateLiftCars(
  c: LiftCars,
  interior: Pick<InteriorMap, "lifts">,
  spec: Pick<ShipSpec, "decks" | "sheerZ" | "sheerRefDeck">,
  ride: WalkRide | null,
  room: string | null,
  x: number,
  y: number,
  seen: ReadonlySet<string> | undefined,
  open: boolean,
  t: number,
  dt: number
): void {
  let any = false;
  for (let i = 0; i < c.cars.length; i += 1) {
    const car = c.cars[i];
    let show = open && ride !== null && ride.lift === car.lift.id;
    if (open && !show && seen)
      for (let k = 0; k < car.zoneList.length; k += 1)
        if (seen.has(car.zoneList[k])) {
          show = true;
          break;
        }
    car.body.visible = show;
    car.pane.visible = show;
    any = any || show;
    liftCarTargetZ(
      interior,
      car.lift,
      spec,
      ride,
      room,
      x,
      y,
      t,
      car.offset,
      target
    );
    if (target.exact || !Number.isFinite(car.z) || !show) car.z = target.z;
    else {
      const step = LIFT_SPEED_MS * Math.min(Math.max(dt, 0), 0.1);
      car.z += Math.max(-step, Math.min(step, target.z - car.z));
    }
    // Ship (x, y, z) is her part's three-local (x, z, −y).
    car.body.matrix.makeTranslation(car.x, car.z, -car.y);
    car.body.matrixWorldNeedsUpdate = true;
    car.pane.matrix.copy(car.body.matrix);
    car.pane.matrixWorldNeedsUpdate = true;
  }
  c.shaft.visible = any;
}

/** Frees the cars' and shafts' geometry (the materials are the rooms'). */
export function disposeLiftCars(c: LiftCars): void {
  c.shaft.geometry.dispose();
  for (const car of c.cars) {
    car.body.geometry.dispose();
    car.pane.geometry.dispose();
  }
}
