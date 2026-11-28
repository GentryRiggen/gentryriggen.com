import { ShapeUtils, Vector2, type BufferGeometry } from "three";
import {
  furnitureFootprint,
  liftCars,
  lightSegments,
  roomFloorZ,
  segmentAt,
  type Furniture,
  type InteriorMap,
  type LiftShaft,
  type PieceId,
  type Room,
  type ShutDoor,
} from "@/lib/shipwreck/interior";
import {
  MODERN_PIECE_IDS,
  MODERN_PIECE_MOUNT,
  type ModernPieceId,
} from "@/lib/shipwreck/interior/modernPieces";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { pointInPolygon, type V2 } from "@/lib/shipwreck/walk";
import {
  balustrade,
  cagedBulb,
  ceilingLamp,
  cherubLamp,
  clockPanel,
  COLOR,
  dome,
  doorFrame,
  DOME_LX,
  fireBuckets,
  FURNITURE,
  hoseReel,
  DOME_LY,
  Layers,
  LAYERS,
  liftGate,
  lin,
  newel,
  pipes,
  porthole,
  rope,
  scale,
  sconce,
  shutDoor,
  TILE,
  type Builder,
  type DoorStyle,
  type Lamp,
  type P3,
  type RGB,
} from "./pieces";
import {
  BALCONY_RAIL,
  balconyDoor,
  cabinDoor,
  chandelier,
  downlight,
  emergencyLamp,
  EMERGENCY_LOW_Z,
  EXIT_SIGN_Z,
  exitSign,
  glassRailRun,
  ModernLayers,
  MODERN_COLOR,
  MODERN_PIECES,
  POOL_DEPTH_M,
  stageCurtain,
  stripLight,
  theatreSeatRow,
} from "./modernPieces";
import { MODERN_TILE } from "./modernTextures";
import { SHAFT_GAP_M } from "./liftCar";
import {
  DOOR_FACE_OFFSET_M,
  DOOR_GLOW_HEIGHT_M,
  DOOR_GLOW_WIDTH_M,
} from "./doorGlow";

/**
 * The room kit (see README.md): a ship's rooms to merged geometry, one
 * mesh per layer per zone (`shell`, `wood`, `metal`, `glass`: pieces.ts),
 * in her part's local frame (three.js axes: ship x, z, −y), for the room
 * shader (materials.ts). Floors, walls from the outlines (a seam is open),
 * ceilings with a cove, flights as treads and risers on the walker's ramp,
 * oak balustrades (or steel plate) where a room looks over a stair or the
 * well, the slab edges and soffits a stairwell shows, lintels over
 * doorways, the Grand Staircase's dome and dressing, lamps, portholes and
 * shut doors. Every face is single-sided, facing into the room it belongs
 * to. The lamps' light is baked into each vertex (`aLight`): falling off
 * with distance, facing, walls between rooms, darker into corners.
 *
 * Her modern rooms (the Concordia) add a fifth mesh per zone, `pane`
 * (see-through glass, both faces: `ModernLayers`), her modern pieces
 * (`MODERN_PIECES`) and finishes, and the deck room (1.17's pool hall): a
 * glass room (`glass` finish: glass sides on a low upstand, a flat glass
 * roof with her glass dome on it, solid cream walls on its
 * `solidEdges`), its floor 2 cm over the deck under it (the model's roof
 * there never shows through), its pool's basin cut out of the floor and
 * its faces tagged with the daylight they catch (`aGlow` on the shell,
 * wood and metal: her shader's `uDaylight`, modernTextures.ts).
 */

/** A riser's height (m): a flight has round(drop / RISER_M) of them. */
export const RISER_M = 0.18;
/** A floor slab's thickness under a stair or a landing (m). */
export const SLAB_M = 0.25;
/** A balustrade's height (m). */
export const RAIL_M = 1.0;
/** A balustrade's thickness (m). */
export const RAIL_THICK_M = 0.06;
/** A doorway's head over the floor (m): the lintel above it. */
export const DOOR_HEAD_M = 2.1;
/** The Grand Staircase zone's triangle budget (all its meshes). */
export const GS_TRIANGLE_BUDGET = 45000;
/** Every other zone's triangle budget. */
export const ZONE_TRIANGLE_BUDGET = 40000;
/** Meshes a zone may draw (four layers, the water's surface and body). */
export const ZONE_MESH_BUDGET = 6;
/** The whole interior's triangles (every zone). */
export const INTERIOR_TRIANGLE_BUDGET = 120000;
/** A deck room's zone (the pool hall): its triangle budget (the spec). */
export const DECK_ROOM_TRIANGLE_BUDGET = 25000;
/** A deck room's floor stands this far over the deck under it (m). */
export const DECK_ROOM_FLOOR_M = 0.02;
/** The meshes a zone can have: the room layers, then her see-through glass. */
export const ZONE_LAYERS = [...LAYERS, "pane"] as const;
export type ZoneLayer = (typeof ZONE_LAYERS)[number];

type Spec = Pick<ShipSpec, "decks" | "sheerZ">;

/** Colours (all under 1, bloom's threshold: a room never glows). */
const WALL: Record<Room["look"]["finish"], RGB> = {
  oak: lin(0.5, 0.31, 0.17),
  "white-panel": lin(0.86, 0.83, 0.74),
  enamel: lin(0.88, 0.88, 0.84),
  steel: lin(0.8, 0.76, 0.6),
  // A glass room's solid walls: cream wallcovering.
  glass: MODERN_COLOR.cream,
  // Her rooms (1.18): their tiles carry the detail (the kids' mural its
  // own colours).
  "cabin-veneer": MODERN_COLOR.veneer,
  cream: MODERN_COLOR.cream,
  marble: MODERN_COLOR.marble,
  kids: MODERN_COLOR.white,
  // Deeper than the curtain's red, so the stage stands out.
  theatre: lin(0.4, 0.05, 0.08),
};
const WALL_TILE: Record<Room["look"]["finish"], number> = {
  oak: TILE.oak,
  "white-panel": TILE.white,
  enamel: TILE.none,
  steel: TILE.none,
  glass: MODERN_TILE.cream,
  "cabin-veneer": MODERN_TILE.veneer,
  cream: MODERN_TILE.cream,
  marble: MODERN_TILE.marble,
  kids: MODERN_TILE.mural,
  theatre: MODERN_TILE.theatre,
};
const FLOOR: Record<Room["look"]["floor"], RGB> = {
  lino: lin(0.84, 0.78, 0.66),
  carpet: lin(0.6, 0.12, 0.1),
  mosaic: lin(0.82, 0.8, 0.72),
  steel: lin(0.45, 0.45, 0.46),
  // A pale sea-glass mosaic round the pool; pine-gold teak planks.
  tile: lin(0.82, 0.9, 0.9),
  teak: MODERN_COLOR.teak,
  // Her rooms (1.18); the soft play mats take their colours in the shader.
  "cabin-carpet": MODERN_COLOR.navy,
  marble: MODERN_COLOR.marble,
  soft: MODERN_COLOR.white,
  "stage-wood": MODERN_COLOR.stageWood,
};
const FLOOR_TILE: Record<Room["look"]["floor"], number> = {
  lino: TILE.lino,
  carpet: TILE.carpet,
  mosaic: TILE.none,
  steel: TILE.none,
  tile: MODERN_TILE.poolTile,
  teak: MODERN_TILE.teak,
  "cabin-carpet": MODERN_TILE.cabinCarpet,
  marble: MODERN_TILE.marble,
  soft: MODERN_TILE.softPlay,
  "stage-wood": MODERN_TILE.stageWood,
};
/** Her finishes (1.18): drawn with her look (rails, skirting, lamps). */
const MODERN_FINISHES: ReadonlySet<string> = new Set([
  "cabin-veneer",
  "cream",
  "marble",
  "kids",
  "theatre",
]);
const isHers = (room: Room) => MODERN_FINISHES.has(room.look.finish);
/** Her skirting by finish (the Titanic's is dark oak). */
const MODERN_SKIRTING: Partial<Record<Room["look"]["finish"], RGB>> = {
  "cabin-veneer": MODERN_COLOR.veneerDark,
  cream: lin(0.55, 0.5, 0.44),
  marble: MODERN_COLOR.granite,
  kids: MODERN_COLOR.blue,
  theatre: MODERN_COLOR.theatreDark,
};
/** A room's floor colour: the theatre's carpet is a deep red. */
function floorColor(room: Room): RGB {
  if (room.look.floor === "cabin-carpet" && room.look.finish === "theatre")
    return lin(0.45, 0.1, 0.12);
  return FLOOR[room.look.floor];
}
/** A lift car's look (hers): brushed steel walls, a granite floor. */
const CAR_WALL: RGB = lin(0.72, 0.73, 0.74);
const CAR_FLOOR: RGB = MODERN_COLOR.granite;
const CEILING_WHITE: RGB = lin(0.9, 0.88, 0.82);
const CEILING_STEEL: RGB = lin(0.82, 0.8, 0.7);
const RAIL_STEEL: RGB = lin(0.3, 0.3, 0.31);
const SKIRTING: RGB = lin(0.22, 0.13, 0.07);
/** Long edges are cut into panels this long (floors follow her sheer). */
const PANEL_M = 2.4;
const SKIRTING_M = 0.18;
/** The cove between a wall and its ceiling (m each way). */
const COVE_M = 0.14;
/** Floors and ceilings are cut into cells this big for the baked light. */
const CELL_M = 0.75;
/** Walls are cut into columns this wide. */
const COLUMN_M = 0.75;

/** Face shading on top of the baked light. */
const SHADE = {
  floor: 1.0,
  riser: 0.72,
  ceiling: 0.68,
  soffit: 0.6,
};

/** Rooms whose seams are open stair parts (no lintel over them). */
const STAIR_KINDS: ReadonlySet<string> = new Set(["flight", "landing"]);
/**
 * Her open-plan rooms (1.18): a seam between two of them is open, with no
 * lintel and no step between their ceilings (the atrium's floor and its
 * well, its galleries' arms, the stalls either side of the balcony's
 * edge): the galleries' rails and their slab edges close what is above.
 */
const OPEN_KINDS: ReadonlySet<string> = new Set([
  "atrium",
  "gallery",
  "theatre",
]);
const openPair = (a: Room, b: Room) =>
  OPEN_KINDS.has(a.kind) && OPEN_KINDS.has(b.kind);
/** How near two points count as the same (m), as the walker's seams. */
const TOL = 1e-3;
/** An edge this short is a chamfer's (the kit's 0.15 m cut, √2 long). */
const CHAMFER_EDGE_M = 0.3;
/** A balustrade needs this much open height shared with the room beside (m). */
const RAIL_OPEN_M = 0.3;

/** An outline with each edge cut into the walls' panels (PANEL_M). */
export function refine(outline: readonly V2[]): V2[] {
  const out: V2[] = [];
  for (let i = 0; i < outline.length; i += 1) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    const n = Math.max(
      1,
      Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / PANEL_M)
    );
    for (let k = 0; k < n; k += 1)
      out.push([
        a[0] + ((b[0] - a[0]) * k) / n,
        a[1] + ((b[1] - a[1]) * k) / n,
      ]);
  }
  return out;
}

/** Triangles of a plan outline (index triples), each counter-clockwise. */
export function triangulate(
  outline: readonly V2[]
): [number, number, number][] {
  const pts = outline.map(([x, y]) => new Vector2(x, y));
  const tris = ShapeUtils.triangulateShape(pts, []);
  return tris.map(([a, b, c]) => {
    const [ax, ay] = outline[a];
    const [bx, by] = outline[b];
    const [cx, cy] = outline[c];
    const ccw = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax) > 0;
    return ccw ? [a, b, c] : [a, c, b];
  });
}

function same(p: V2, q: V2): boolean {
  return Math.abs(p[0] - q[0]) <= TOL && Math.abs(p[1] - q[1]) <= TOL;
}

/** A room's flat ceiling (ship z) over (x, y): a flight's over its top. */
export function ceilingZ(room: Room, x: number, y: number, spec: Spec): number {
  if (!room.ramp) return roomFloorZ(room, x, y, spec) + room.ceilingM;
  const [fx, fy] = room.ramp.from;
  return roomFloorZ(room, fx, fy, spec) + room.ceilingM;
}

/** Points on a 0.5 m grid inside an outline (and its corners' middle). */
function samplesIn(outline: readonly V2[]): V2[] {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const out: V2[] = [];
  for (let x = x0 + 0.25; x < x1; x += 0.5)
    for (let y = y0 + 0.25; y < y1; y += 0.5)
      if (pointInPolygon([x, y], outline)) out.push([x, y]);
  return out;
}

/**
 * Whether another room's floor comes between a room's floor and its
 * ceiling anywhere over it (a stair over a stair): then its ceiling is not
 * drawn, and the soffit of what is above shows instead.
 */
export function ceilingBlocked(
  room: Room,
  rooms: readonly Room[],
  spec: Spec
): boolean {
  const pts = samplesIn(room.outline);
  const box = bounds(room.outline);
  for (const other of rooms) {
    if (other === room) continue;
    const ob = bounds(other.outline);
    if (ob[0] > box[2] || ob[2] < box[0] || ob[1] > box[3] || ob[3] < box[1])
      continue;
    for (const [x, y] of pts) {
      if (!pointInPolygon([x, y], other.outline)) continue;
      const z = roomFloorZ(other, x, y, spec);
      if (
        z > roomFloorZ(room, x, y, spec) + 0.05 &&
        z < ceilingZ(room, x, y, spec) + 0.1
      )
        return true;
    }
  }
  return false;
}

/** An outline's plan box: x0, y0, x1, y1. */
function bounds(o: readonly V2[]): [number, number, number, number] {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of o) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/** Whether edge a→b lies along (and overlaps) edge c→d. */
function alongEdge(a: V2, b: V2, c: V2, d: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < TOL) return 0;
  const ux = dx / len;
  const uy = dy / len;
  // Both of c, d on the line through a, b.
  for (const p of [c, d])
    if (Math.abs((p[0] - a[0]) * uy - (p[1] - a[1]) * ux) > TOL) return 0;
  const tc = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy;
  const td = (d[0] - a[0]) * ux + (d[1] - a[1]) * uy;
  return Math.min(len, Math.max(tc, td)) - Math.max(0, Math.min(tc, td));
}

export interface EdgeInfo {
  /**
   * "wall" to the ceiling, "rail" (a balustrade), or "seam" (open: a
   * doorway, or level with a drawn-only room such as the roped flight).
   */
  kind: "wall" | "rail" | "seam";
  /** A seam that needs a lintel (a doorway, not a stair's open edge). */
  lintel?: { other: Room };
  /** A seam's room on the other side. */
  other?: Room;
  /**
   * A balustrade over a void (no room stacked under this one at the edge,
   * as under a twin flight): its outer face goes down to the lowest floor
   * beside it (ship z at the edge's ends), closing the space under the
   * stair seen from the room beside.
   */
  cheek?: readonly [number, number];
}

/** What each edge of each room is. */
export function edgeKinds(
  interior: InteriorMap,
  spec: Spec
): Map<string, EdgeInfo[]> {
  const byId = new Map(interior.rooms.map((r) => [r.id, r]));
  const out = new Map<string, EdgeInfo[]>();
  for (const room of interior.rooms) {
    const poly = room.outline;
    const infos: EdgeInfo[] = poly.map((a, i) => {
      const b = poly[(i + 1) % poly.length];
      // A seam: open, with a lintel over a doorway.
      for (const s of interior.seams) {
        if (s.a !== room.id && s.b !== room.id) continue;
        const [p, q] = s.at;
        if (!((same(a, p) && same(b, q)) || (same(a, q) && same(b, p))))
          continue;
        const other = byId.get(s.a === room.id ? s.b : s.a)!;
        const stair =
          STAIR_KINDS.has(room.kind) ||
          STAIR_KINDS.has(other.kind) ||
          openPair(room, other);
        return stair
          ? { kind: "seam", other }
          : { kind: "seam", lintel: { other }, other };
      }
      // Along another room's edge at a different height in the same zone
      // (over a stair or the well): a balustrade, not a wall. Level with a
      // drawn-only room (the roped B → C flight and its landing) wins over
      // a balustrade to a room stacked above: open, so you can look down
      // it (the rope, not a wall, keeps you out; the walker has no seam).
      let rail = false;
      let lowA = Infinity;
      let lowB = Infinity;
      for (const other of interior.rooms) {
        if (other === room || other.zone !== room.zone) continue;
        const op = other.outline;
        for (let j = 0; j < op.length; j += 1) {
          const c = op[j];
          const d = op[(j + 1) % op.length];
          if (alongEdge(a, b, c, d) < 0.05) continue;
          // Beside it, not stacked over or under it: two counter-clockwise
          // outlines either side of one line run it opposite ways.
          if (
            (b[0] - a[0]) * (d[0] - c[0]) + (b[1] - a[1]) * (d[1] - c[1]) >=
            0
          )
            continue;
          // At a different height, and their space (floor to ceiling)
          // open to ours: a stair or the well beside, not a deck below.
          const ox =
            (Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) +
              Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0]))) /
            2;
          const oy =
            (Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) +
              Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]))) /
            2;
          const mineF = roomFloorZ(room, ox, oy, spec);
          const theirF = roomFloorZ(other, ox, oy, spec);
          const open =
            Math.min(
              ceilingZ(room, ox, oy, spec),
              ceilingZ(other, ox, oy, spec)
            ) - Math.max(mineF, theirF);
          if (open <= RAIL_OPEN_M) continue;
          if (Math.abs(theirF - mineF) > 0.05) {
            rail = true;
            if (theirF < mineF) {
              lowA = Math.min(lowA, floorNear(other, a, spec));
              lowB = Math.min(lowB, floorNear(other, b, spec));
            }
          } else if (room.noWalk || other.noWalk) return { kind: "seam" };
        }
      }
      if (!rail) return { kind: "wall" };
      // A room of another zone walled off along this line, at our height
      // (the third-class passage beside the D → E flight): a wall, so no
      // face of ours lies on its wall facing the same way (z-fighting).
      if (backedByWall(room, a, b, interior.rooms, spec))
        return { kind: "wall" };
      if (
        Number.isFinite(lowA) &&
        Number.isFinite(lowB) &&
        !stackedUnder(room, a, b, interior.rooms, spec)
      )
        return { kind: "rail", cheek: [lowA, lowB] as const };
      return { kind: "rail" };
    });
    // A chamfer's short edge between open edges (a corner of the well)
    // is open too: a balustrade, not a sliver of wall up to the ceiling.
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length];
      if (infos[i].kind !== "wall") return;
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > CHAMFER_EDGE_M) return;
      const prev = infos[(i + poly.length - 1) % poly.length].kind;
      const next = infos[(i + 1) % poly.length].kind;
      if (
        prev !== "wall" &&
        next !== "wall" &&
        !backedByWall(room, a, b, interior.rooms, spec)
      )
        infos[i] = { kind: "rail" };
    });
    // A balcony's outboard side (facing away from her centre line) is its
    // rail, open above to the sea (hers, 1.18).
    if (room.kind === "balcony")
      poly.forEach((a, i) => {
        const b = poly[(i + 1) % poly.length];
        if (infos[i].kind !== "wall") return;
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        // Outward: the right of a counter-clockwise edge.
        const ny = -(b[0] - a[0]) / len;
        if (Math.abs(ny) > 0.9 && Math.sign(ny) === Math.sign(a[1] + b[1]))
          infos[i] = { kind: "rail" };
      });
    out.set(room.id, infos);
  }
  return out;
}

/**
 * Whether a room of another zone has an edge along a → b (beside it, run
 * the other way) whose floor-to-ceiling span overlaps this edge's rail and
 * slab (half a metre under the floor to the rail's top).
 */
function backedByWall(
  room: Room,
  a: V2,
  b: V2,
  rooms: readonly Room[],
  spec: Spec
): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < TOL) return false;
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  for (const other of rooms) {
    if (other === room || other.zone === room.zone) continue;
    const op = other.outline;
    for (let j = 0; j < op.length; j += 1) {
      const c = op[j];
      const d = op[(j + 1) % op.length];
      if (alongEdge(a, b, c, d) < 0.05) continue;
      if ((d[0] - c[0]) * ux + (d[1] - c[1]) * uy >= 0) continue;
      const tc = (c[0] - a[0]) * ux + (c[1] - a[1]) * uy;
      const td = (d[0] - a[0]) * ux + (d[1] - a[1]) * uy;
      const m =
        (Math.max(0, Math.min(tc, td)) + Math.min(len, Math.max(tc, td))) / 2;
      const x = a[0] + ux * m;
      const y = a[1] + uy * m;
      const mine = roomFloorZ(room, x, y, spec);
      const theirs = roomFloorZ(other, x, y, spec);
      if (
        Math.min(mine + RAIL_M, theirs + other.ceilingM) -
          Math.max(mine - 0.5, theirs) >
        0.05
      )
        return true;
    }
  }
  return false;
}

/** A room's floor at the point of it nearest p (a ramp clamps itself). */
function floorNear(room: Room, p: V2, spec: Spec): number {
  return roomFloorZ(room, p[0], p[1], spec);
}

/**
 * Whether another room lies under this one just inside edge a → b (a
 * deck stacked below, as the B foyer under the A foyer), so its rail has
 * no void under it.
 */
function stackedUnder(
  room: Room,
  a: V2,
  b: V2,
  rooms: readonly Room[],
  spec: Spec
): boolean {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const nx = (-(b[1] - a[1]) / len) * 0.1;
  const ny = ((b[0] - a[0]) / len) * 0.1;
  for (const t of [0.25, 0.5, 0.75]) {
    const p: V2 = [
      a[0] + (b[0] - a[0]) * t + nx,
      a[1] + (b[1] - a[1]) * t + ny,
    ];
    const mine = roomFloorZ(room, p[0], p[1], spec);
    for (const other of rooms) {
      if (other === room || other.zone !== room.zone) continue;
      if (!pointInPolygon(p, other.outline)) continue;
      if (roomFloorZ(other, p[0], p[1], spec) < mine - 0.3) return true;
    }
  }
  return false;
}

/**
 * A flight's treads, as ship-frame quads (four corners each, the nosing
 * pair first): round(drop / RISER_M) of them down the ramp, each nosing
 * exactly on the ramp (`floorZ`), each tread one riser under it at its
 * back, the last level with the floor at the foot.
 */
export function rampTreads(room: Room, spec: Spec): P3[][] {
  const r = room.ramp;
  if (!r) return [];
  const n = Math.max(1, Math.round(r.dropM / RISER_M));
  const rise = r.dropM / n;
  const dx = r.to[0] - r.from[0];
  const dy = r.to[1] - r.from[1];
  const len = Math.hypot(dx, dy);
  // Half the width: the outline's widest point off the axis.
  let half = 0;
  for (const [x, y] of room.outline)
    half = Math.max(
      half,
      Math.abs(((x - r.from[0]) * dy - (y - r.from[1]) * dx) / len)
    );
  const nx = (-dy / len) * half;
  const ny = (dx / len) * half;
  const at = (u: number, side: number): V2 => [
    r.from[0] + dx * u + nx * side,
    r.from[1] + dy * u + ny * side,
  ];
  const z = (p: V2) => roomFloorZ(room, p[0], p[1], spec);
  const out: P3[][] = [];
  for (let k = 0; k < n; k += 1) {
    const n0 = at((k + 1) / n, -1);
    const n1 = at((k + 1) / n, 1);
    const b1 = at(k / n, 1);
    const b0 = at(k / n, -1);
    out.push([
      [n0[0], n0[1], z(n0)],
      [n1[0], n1[1], z(n1)],
      [b1[0], b1[1], z(b1) - rise],
      [b0[0], b0[1], z(b0) - rise],
    ]);
  }
  return out;
}

/** The zones drawn with each zone: itself and those it has doorways to. */
export function zonesSeen(
  interior: InteriorMap
): Map<string, ReadonlySet<string>> {
  const zone = new Map(interior.rooms.map((r) => [r.id, r.zone]));
  const out = new Map<string, Set<string>>();
  for (const r of interior.rooms)
    if (!out.has(r.zone)) out.set(r.zone, new Set([r.zone]));
  for (const s of interior.seams) {
    const a = zone.get(s.a);
    const b = zone.get(s.b);
    if (!a || !b) continue;
    out.get(a)!.add(b);
    out.get(b)!.add(a);
  }
  return out;
}

/** A part of a long hall's lamps: its room's slot, part and own slot. */
export interface InteriorSegment {
  room: number;
  part: number;
  slot: number;
}

/**
 * A pool's basin (a `pool-edge` piece): its water's slot (after the rooms'
 * and the long halls' parts), its room's slot and zone, its rim's four
 * corners (ship frame, the rim's z) and its floor's z. Its water stands at
 * the low rim's height (Interior: it spills as she leans).
 */
export interface InteriorBasin {
  slot: number;
  room: number;
  zone: string;
  rim: readonly P3[];
  floorZ: number;
}

export interface InteriorBuild {
  /** Per zone, its non-empty layers' geometry (three.js axes, her part). */
  zones: Map<string, Partial<Record<ZoneLayer, BufferGeometry>>>;
  /** Each room's zone. */
  roomZone: Map<string, string>;
  /** The zones drawn with each zone (`zonesSeen`). */
  seen: Map<string, ReadonlySet<string>>;
  /**
   * Each room's slot (its index in the map: `aRoom`, the water's); a lift
   * car's is its landing's.
   */
  slot: Map<string, number>;
  /**
   * Slots in the power and level uniforms: the rooms', then the parts',
   * then the basins'.
   */
  slots: number;
  /** The pools' basins (their slots follow the parts'). */
  basins: InteriorBasin[];
  /** The zones holding a deck room: drawn whenever walking on her. */
  deckZones: ReadonlySet<string>;
  /**
   * The slots a deck room's own deck doors' glow is tagged with (the rooms
   * beyond them): lit while the rooms are open.
   */
  deckDoorSlots: number[];
  /** Whether her rooms use the modern finishes (`applyModern`). */
  modern: boolean;
  /** A long hall's parts (`lightSegments`): their slots follow the rooms'. */
  segments: InteriorSegment[];
  /**
   * Per slot, the point whose water puts the room's lamps out, in her
   * part's local frame (three.js axes, x y z): its floor's middle, or a
   * flight's head (its lamps are at the top); a part's middle.
   */
  floors: Float32Array;
  /** Per slot, the rooms open to it (a doorway, a stair, the well). */
  neighbours: number[][];
  /** Triangles per zone, every layer. */
  triangles: Map<string, number>;
  /** How long the build took (ms). */
  ms: number;
}

/** A lamp, the room it hangs in, and whether it lights the zone's well. */
interface PlacedLamp extends Lamp {
  room: number;
  wide: boolean;
}

/** Builds the rooms' meshes (see the file comment). */
export function buildInterior(given: InteriorMap, spec: Spec): InteriorBuild {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  // A deck room's floor stands 2 cm over the deck (and everything in it).
  const rooms = given.rooms.map((r) =>
    r.deckRoom ? { ...r, raiseM: (r.raiseM ?? 0) + DECK_ROOM_FLOOR_M } : r
  );
  const interior: InteriorMap = { ...given, rooms };
  const slot = new Map(rooms.map((r, k) => [r.id, k]));
  // Her lifts' cars (one a stop, `liftCars`): their doors open the
  // landings' walls and each takes its landing's zone and slot, but none
  // is drawn here: the glass car rides its shaft (liftCar.ts).
  const lifted = liftCars(given);
  const cars = lifted.rooms;
  const carLanding = new Map(lifted.seams.map((m) => [m.a, m.b]));
  const kinds = edgeKinds(
    cars.length > 0
      ? {
          ...interior,
          rooms: [...rooms, ...cars],
          seams: [...interior.seams, ...lifted.seams],
        }
      : interior,
    spec
  );
  const zoneLayers = new Map<string, ModernLayers>();
  const layersOf = (zone: string) => {
    let L = zoneLayers.get(zone);
    if (!L) {
      L = new ModernLayers();
      zoneLayers.set(zone, L);
    }
    return L;
  };
  const lamps: PlacedLamp[] = [];
  // Her emergency strips' and exit signs' light (a second bake: aGlow).
  const emergency: PlacedLamp[] = [];
  const domes = interior.furniture.filter((f) => f.piece === "dome");
  // Her atrium's glass wall onto the lift shafts (none without lifts).
  const shaftGlass = liftGlassWalls(rooms, given.lifts ?? []);

  // Rooms with no ceiling of their own drawn (a stair through it, the dome).
  const open = new Set(
    rooms
      .filter(
        (r) =>
          underDome(r, domes, rooms, spec) || ceilingBlocked(r, rooms, spec)
      )
      .map((r) => r.id)
  );
  // The pools' basins (cut out of their room's floor, their water's slot).
  const holes = new Map<string, Rect[]>();
  const basinAt: { f: Furniture; room: Room; k: number }[] = [];
  for (const f of interior.furniture) {
    if (f.piece !== "pool-edge") continue;
    const k = slot.get(f.room);
    if (k === undefined) continue;
    const r = pieceRect(f);
    const list = holes.get(f.room);
    if (list) list.push(r);
    else holes.set(f.room, [r]);
    basinAt.push({ f, room: rooms[k], k });
  }
  rooms.forEach((room, k) => {
    const L = layersOf(room.zone);
    L.room(k);
    skyLit(L, room.deckRoom === true);
    if (room.look.finish === "glass") {
      const got = addGlassRoom(
        L,
        room,
        kinds.get(room.id)!,
        spec,
        holes.get(room.id) ?? []
      );
      for (const l of got) lamps.push({ ...l, room: k, wide: false });
    } else
      addRoom(L, room, rooms, kinds.get(room.id)!, spec, open, {
        fronts: shaftGlass.get(room.id),
      });
    skyLit(L, false);
  });
  // The furniture, and its lamps.
  const byId = new Map(rooms.map((r) => [r.id, r]));
  for (const f of interior.furniture) {
    const room = byId.get(f.room);
    if (!room) continue;
    const k = slot.get(f.room)!;
    const L = layersOf(room.zone);
    L.room(k);
    L.pieces(true);
    skyLit(L, room.deckRoom === true);
    const got = addPiece(L, f, room, spec);
    skyLit(L, false);
    L.pieces(false);
    for (const l of got)
      lamps.push({ ...l, room: k, wide: f.piece === "dome" });
    // An exit sign lights the wall round it on the emergency supply.
    if (f.piece === "exit-sign") {
      const c = Math.cos(f.yaw);
      const s = Math.sin(f.yaw);
      const z = roomFloorZ(room, f.at[0], f.at[1], spec);
      emergency.push({
        p: [f.at[0] + c * 0.25, f.at[1] + s * 0.25, z + signZ(room)],
        intensity: 0.7,
        radius: 1.1,
        room: k,
        wide: false,
      });
    }
  }
  for (const d of interior.shutDoors) {
    const room = byId.get(d.room);
    if (!room) continue;
    const L = layersOf(room.zone);
    L.room(slot.get(d.room)!);
    const z = roomFloorZ(room, d.at[0], d.at[1], spec);
    skyLit(L, room.deckRoom === true);
    if (d.style === "glass") glassDoors(L, [d.at[0], d.at[1], z], d.facing);
    else if (isHers(room) && L instanceof ModernLayers)
      // Her cabins' doors: veneer in a cream frame, a card lock.
      cabinDoor(L, [d.at[0], d.at[1], z], d.facing);
    else shutDoor(L, [d.at[0], d.at[1], z], d.facing, d.style);
    skyLit(L, false);
  }
  // Her rooms: their lamp style's lamps (downlights, strips, the
  // chandelier), whatever lamps their pieces have, and the emergency
  // strips along their walls.
  rooms.forEach((room, k) => {
    if (!isHers(room)) return;
    const L = layersOf(room.zone);
    if (!(L instanceof ModernLayers)) return;
    L.room(k);
    if (!STAIR_KINDS.has(room.kind) && !open.has(room.id))
      for (const l of styleLamps(L, room, kinds.get(room.id)!, spec))
        lamps.push({ ...l, room: k });
    if (room.look.portholes)
      seaWindows(L, room, kinds.get(room.id)!, spec, room.look.portholes);
    L.pieces(true);
    for (const l of emergencyStrips(
      L,
      room,
      kinds.get(room.id)!,
      spec,
      interior.shutDoors
    ))
      emergency.push({ ...l, room: k, wide: false });
    L.pieces(false);
  });
  // A deck room's own deck doors (the club's, in her pool hall's wall):
  // their lit doorways in its glass (no draw of their own), tagged with the
  // room beyond, whose power Interior keeps on while the rooms are open.
  const deckDoorSlots: number[] = [];
  for (const link of interior.links) {
    if (link.kind !== "door") continue;
    const room = byId.get(link.from.area);
    const k = slot.get(link.to.area);
    if (!room?.deckRoom || k === undefined) continue;
    const L = layersOf(room.zone);
    L.room(k);
    deckDoorGlow(L, room, link.from.at, link.to.at, spec);
    if (!deckDoorSlots.includes(k)) deckDoorSlots.push(k);
  }
  // Rooms with no lamp of their own get ceiling lamps (and the foyers
  // more, over the floor).
  rooms.forEach((room, k) => {
    if (STAIR_KINDS.has(room.kind) || isHers(room)) return;
    const own = lamps.some((l) => l.room === k);
    if (own && room.kind !== "foyer") return;
    const L = layersOf(room.zone);
    L.room(k);
    const steel = room.look.finish === "steel" || room.look.finish === "enamel";
    for (const [x, y] of lampSpots(room, room.kind === "foyer" ? 4.2 : 5)) {
      const at: P3 = [x, y, ceilingZ(room, x, y, spec)];
      for (const l of steel ? cagedBulb(L, at) : ceilingLamp(L, at))
        lamps.push({ ...l, room: k, wide: false });
    }
  });

  // Bake the light, then the meshes.

  const light = new LightBake(interior, kinds, lamps, spec);
  const dark =
    emergency.length > 0
      ? new LightBake(interior, kinds, emergency, spec)
      : null;
  // A long hall's lamps in parts (lightSegments): each part its own slot
  // after the rooms', so its lamps go out by the water at its middle.
  const segments: InteriorSegment[] = [];
  const firstPart = new Map<number, number>();
  rooms.forEach((room, k) => {
    const parts = lightSegments(room);
    if (parts.length === 0) return;
    firstPart.set(k, rooms.length + segments.length);
    parts.forEach((_, i) =>
      segments.push({ room: k, part: i, slot: rooms.length + segments.length })
    );
  });
  const zones = new Map<string, Partial<Record<ZoneLayer, BufferGeometry>>>();
  const triangles = new Map<string, number>();
  const deckZoneIds = new Set(
    rooms.filter((r) => r.deckRoom).map((r) => r.zone)
  );
  for (const [zone, L] of zoneLayers) {
    const out: Partial<Record<ZoneLayer, BufferGeometry>> = {};
    // Inside her, a zone's panes are drawn last in its glass mesh (one
    // mesh fewer); a deck room keeps its own (seen from her deck).
    if (L instanceof ModernLayers && !deckZoneIds.has(zone))
      L.glass.append(L.pane);
    ZONE_LAYERS.forEach((layer, i) => {
      const b = L.all[i];
      if (b.triangles === 0) return;
      // See-through glass is lit by its own shader (materials.ts).
      if (layer === "pane") {
        out[layer] = b.geometry();
        return;
      }
      const lit = light.bake(b, layer === "shell");
      // Her emergency light, as aGlow under 0 where it is 0 (inside her;
      // a deck room's is its daylight share, glass its glow).
      if (dark && layer !== "glass") {
        const e = dark.bake(b, layer === "shell", 0);
        for (let v = 0; v < e.length; v += 1)
          if (b.glow[v] === 0 && e[v] > 0.004) b.glow[v] = -e[v];
      }
      // Baked by room; then a long hall's vertices to their part's slot.
      if (firstPart.size > 0)
        for (let v = 0; v < b.room.length; v += 1) {
          const first = firstPart.get(b.room[v]);
          if (first === undefined) continue;
          const room = rooms[b.room[v]];
          b.room[v] = first + segmentAt(room, b.pos[v * 3], -b.pos[v * 3 + 2]);
        }
      out[layer] = b.geometry(lit);
    });
    zones.set(zone, out);
    triangles.set(zone, L.triangles);
  }
  // The basins' slots, after the parts'.
  const basins: InteriorBasin[] = basinAt.map(({ f, room, k }, i) => {
    const r = pieceRect(f);
    const z = roomFloorZ(room, f.at[0], f.at[1], spec);
    return {
      slot: rooms.length + segments.length + i,
      room: k,
      zone: room.zone,
      rim: [
        [r.x0, r.y0, z],
        [r.x1, r.y0, z],
        [r.x1, r.y1, z],
        [r.x0, r.y1, z],
      ],
      floorZ: z - POOL_DEPTH_M,
    };
  });
  const slots = rooms.length + segments.length + basins.length;
  // Each room's lowest floor point, in her part's frame (three axes).
  const floors = new Float32Array(slots * 3);
  rooms.forEach((room, k) => {
    if (room.ramp) {
      // A flight's lamps are at its head: its top step.
      const [x, y] = room.ramp.from;
      floors[k * 3] = x;
      floors[k * 3 + 1] = roomFloorZ(room, x, y, spec);
      floors[k * 3 + 2] = -y;
      return;
    }
    // Its middle: a long hall's lamps go out when the water reaches
    // half way along (her trim tilts it; the middle holds the average).
    const [x, y] = centroid(room.outline);
    floors[k * 3] = x;
    floors[k * 3 + 1] = roomFloorZ(room, x, y, spec);
    floors[k * 3 + 2] = -y;
  });
  // Each part's middle.
  for (const seg of segments) {
    const room = rooms[seg.room];
    const [x, y] = lightSegments(room)[seg.part].mid;
    floors[seg.slot * 3] = x;
    floors[seg.slot * 3 + 1] = roomFloorZ(room, x, y, spec);
    floors[seg.slot * 3 + 2] = -y;
  }
  // Each basin's floor middle.
  for (const b of basins) {
    floors[b.slot * 3] = (b.rim[0][0] + b.rim[2][0]) / 2;
    floors[b.slot * 3 + 1] = b.floorZ;
    floors[b.slot * 3 + 2] = -(b.rim[0][1] + b.rim[2][1]) / 2;
  }

  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  // A car is its landing's: its zone, and its slot for the torch.
  const slotOut = new Map(slot);
  for (const car of cars)
    slotOut.set(car.id, slot.get(carLanding.get(car.id)!)!);
  return {
    zones,
    roomZone: new Map([...rooms, ...cars].map((r) => [r.id, r.zone])),
    seen: zonesSeen(interior),
    slot: slotOut,
    slots,
    segments,
    basins,
    deckZones: new Set(rooms.filter((r) => r.deckRoom).map((r) => r.zone)),
    deckDoorSlots,
    modern: usesModern(interior),
    floors,
    neighbours: light.open.map((set, k) => [...set].filter((j) => j !== k)),
    triangles,
    ms: t1 - t0,
  };
}

function centroid(outline: readonly V2[]): V2 {
  let x = 0;
  let y = 0;
  for (const p of outline) {
    x += p[0];
    y += p[1];
  }
  return [x / outline.length, y / outline.length];
}

/** Whether a dome's plan covers a room whose ceiling is at its foot. */
function underDome(
  room: Room,
  domes: readonly Furniture[],
  rooms: readonly Room[],
  spec: Spec
): boolean {
  for (const d of domes) {
    const host = rooms.find((r) => r.id === d.room);
    if (!host || host.zone !== room.zone) continue;
    const inside = room.outline.every(
      (p) =>
        Math.abs(p[0] - d.at[0]) <= DOME_LX / 2 + 0.01 &&
        Math.abs(p[1] - d.at[1]) <= DOME_LY / 2 + 0.01
    );
    if (!inside) continue;
    const c = centroid(room.outline);
    const base = ceilingZ(host, d.at[0], d.at[1], spec);
    if (Math.abs(ceilingZ(room, c[0], c[1], spec) - base) < 0.3) return true;
  }
  return false;
}

/** Ceiling lamp spots: a grid `step` apart inside the outline, 0.8 m clear. */
function lampSpots(room: Room, step: number): V2[] {
  const o = room.outline;
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of o) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const nx = Math.max(1, Math.round((x1 - x0) / step));
  const ny = Math.max(1, Math.round((y1 - y0) / step));
  const out: V2[] = [];
  for (let i = 0; i < nx; i += 1)
    for (let j = 0; j < ny; j += 1) {
      const p: V2 = [
        x0 + ((i + 0.5) * (x1 - x0)) / nx,
        y0 + ((j + 0.5) * (y1 - y0)) / ny,
      ];
      if (pointInPolygon(p, o) && distToEdges(p, o) > 0.8) out.push(p);
    }
  if (out.length === 0) {
    const c = centroid(o);
    if (pointInPolygon(c, o)) out.push(c);
  }
  return out;
}

function distToSegment(p: V2, a: V2, b: V2): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t =
    l2 > 0
      ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2))
      : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

function distToEdges(p: V2, o: readonly V2[]): number {
  let d = Infinity;
  for (let i = 0; i < o.length; i += 1)
    d = Math.min(d, distToSegment(p, o[i], o[(i + 1) % o.length]));
  return d;
}

/** Wall segments packed as ax, ay, bx, by. */
function wallArray(walls: readonly [V2, V2][]): Float64Array {
  const out = new Float64Array(walls.length * 4);
  walls.forEach(([a, b], i) => out.set([a[0], a[1], b[0], b[1]], i * 4));
  return out;
}

/** Whether p → q crosses any of the packed walls (strictly). */
function blockedBy(
  w: Float64Array,
  px: number,
  py: number,
  qx: number,
  qy: number
): boolean {
  const x0 = Math.min(px, qx);
  const x1 = Math.max(px, qx);
  const y0 = Math.min(py, qy);
  const y1 = Math.max(py, qy);
  for (let i = 0; i < w.length; i += 4) {
    const ax = w[i];
    const ay = w[i + 1];
    const bx = w[i + 2];
    const by = w[i + 3];
    if (Math.max(ax, bx) < x0 || Math.min(ax, bx) > x1) continue;
    if (Math.max(ay, by) < y0 || Math.min(ay, by) > y1) continue;
    const d1 = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const d2 = (bx - ax) * (qy - ay) - (by - ay) * (qx - ax);
    if (d1 * d2 >= 0) continue;
    const d3 = (qx - px) * (ay - py) - (qy - py) * (ax - px);
    const d4 = (qx - px) * (by - py) - (qy - py) * (bx - px);
    if (d3 * d4 < 0) return true;
  }
  return false;
}

/** One furniture piece, placed in its room; its lamps. */
export function addPiece(
  L: Layers,
  f: Furniture,
  room: Room,
  spec: Spec
): Lamp[] {
  const fz = roomFloorZ(room, f.at[0], f.at[1], spec);
  const floor: P3 = [f.at[0], f.at[1], fz];
  const ceil: P3 = [f.at[0], f.at[1], ceilingZ(room, f.at[0], f.at[1], spec)];
  switch (f.piece) {
    case "sconce":
      return sconce(L, floor, f.yaw);
    case "caged-bulb":
      return cagedBulb(L, ceil);
    case "cherub-lamp":
      return cherubLamp(L, floor, f.yaw);
    case "newel":
      return newel(L, floor, f.yaw);
    case "dome":
      return dome(L, ceil);
    case "clock-panel":
      return clockPanel(L, floor, f.yaw);
    case "rope":
      return rope(L, floor, f.yaw);
    case "porthole":
      return porthole(L, floor, f.yaw);
    case "pipes":
      return pipes(L, floor, f.yaw, ceil[2] - fz);
    case "fire-buckets":
      return fireBuckets(L, floor, f.yaw);
    case "hose-reel":
      return hoseReel(L, floor, f.yaw);
    default: {
      // Her modern pieces (the pool, loungers, exit signs...): a zone's
      // layers are always `ModernLayers` (buildInterior).
      if (isModern(f.piece)) {
        if (!(L instanceof ModernLayers))
          throw new Error(`modern piece ${f.piece} needs ModernLayers`);
        return addModernPiece(L, f.piece, f, room, floor, ceil);
      }
      // Beds, bunks, wardrobes, washstands, sofas, tables, chairs.
      const build = FURNITURE[f.piece];
      return build ? build(L, floor, f.yaw) : [];
    }
  }
}

/**
 * A modern piece where its mount says (`MODERN_PIECE_MOUNT`): on the
 * floor or a wall's foot at its spot, at the ceiling over it; sized to its
 * room where it has a size (a seat row's seats, the stage's curtain across
 * the stage, an exit sign under a low ceiling). The glass lift's car is
 * the lift's to draw, not placed.
 */
function addModernPiece(
  L: ModernLayers,
  piece: ModernPieceId,
  f: Furniture,
  room: Room,
  floor: P3,
  ceil: P3
): Lamp[] {
  switch (MODERN_PIECE_MOUNT[piece]) {
    case "lift":
      return [];
    case "ceiling":
      return MODERN_PIECES[piece](L, ceil, f.yaw);
    default:
      break;
  }
  switch (piece) {
    case "theatre-seat-row":
      // A seat row of its own length (the theatre's six-seat side rows).
      return theatreSeatRow(L, floor, f.yaw, f.seats ?? 10);
    case "stage-curtain": {
      // Across the stage (its extent square to the curtain's facing),
      // clear of the side walls and under the ceiling.
      const c = Math.cos(f.yaw);
      const s = Math.sin(f.yaw);
      let lo = Infinity;
      let hi = -Infinity;
      for (const [x, y] of room.outline) {
        const u = -(x - f.at[0]) * s + (y - f.at[1]) * c;
        lo = Math.min(lo, u);
        hi = Math.max(hi, u);
      }
      const width = Math.min(14, 2 * Math.min(-lo, hi) - 1.6);
      const height = Math.min(6, ceil[2] - floor[2] - 1.0);
      return stageCurtain(L, floor, f.yaw, width, height);
    }
    case "exit-sign":
      return exitSign(L, floor, f.yaw, signZ(room));
    case "balcony-door":
      // Under the doorway's lintel.
      return balconyDoor(L, floor, f.yaw, 1.8, DOOR_HEAD_M - 0.04);
    default:
      return MODERN_PIECES[piece](L, floor, f.yaw);
  }
}

const MODERN_IDS: ReadonlySet<string> = new Set(MODERN_PIECE_IDS);

function isModern(piece: PieceId): piece is PieceId & ModernPieceId {
  return MODERN_IDS.has(piece);
}

/** Whether an interior uses her modern finishes or pieces. */
export function usesModern(interior: InteriorMap): boolean {
  return (
    interior.rooms.some(
      (r) =>
        r.look.finish === "glass" ||
        r.look.floor === "tile" ||
        r.look.floor === "teak" ||
        isHers(r)
    ) ||
    interior.furniture.some((f) => isModern(f.piece)) ||
    interior.shutDoors.some((d) => d.style === "glass")
  );
}

/**
 * Tags what follows with the daylight it catches (1: a deck room's, under
 * the sky; 0: inside her): `aGlow` on the shell, wood and metal, which
 * only her shader reads (`uDaylight`). Glass keeps its own glow.
 */
function skyLit(L: Layers, on: boolean): void {
  const v = on ? 1 : 0;
  L.shell.glowV = v;
  L.wood.glowV = v;
  L.metal.glowV = v;
}

/** A plan rectangle (ship frame). */
interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A blocking piece's plan box (its footprint, square to the ship). */
function pieceRect(f: Furniture): Rect {
  const fp = furnitureFootprint(f);
  if (!fp) throw new Error(`piece ${f.piece} has no footprint`);
  const turned = Math.abs(Math.round(f.yaw / (Math.PI / 2))) % 2 === 1;
  const hx = (turned ? fp.ly : fp.lx) / 2;
  const hy = (turned ? fp.lx : fp.ly) / 2;
  return {
    x0: f.at[0] - hx,
    y0: f.at[1] - hy,
    x1: f.at[0] + hx,
    y1: f.at[1] + hy,
  };
}

/**
 * An outline cut into the light's cells, less the holes (a pool's
 * basin): each cell clipped round each hole (the parts either side of it,
 * then above and below it).
 */
function cellsMinus(outline: readonly V2[], holes: readonly Rect[]): V2[][] {
  let out = cells(outline);
  const BIG = 1e5;
  for (const h of holes) {
    const next: V2[][] = [];
    for (const c of out) {
      const parts = [
        clipRect(c, -BIG, -BIG, h.x0, BIG),
        clipRect(c, h.x1, -BIG, BIG, BIG),
        clipRect(c, h.x0, -BIG, h.x1, h.y0),
        clipRect(c, h.x0, h.y1, h.x1, BIG),
      ];
      for (const p of parts)
        if (p.length >= 3 && Math.abs(area(p)) > 1e-5) next.push(p);
    }
    out = next;
  }
  return out;
}

/** A glass room's upstand under the glass (m). */
const UPSTAND_M = 0.3;
/** A glass room's mullions are about this far apart (m). */
const MULLION_M = 1.8;
/** A glass room's dome: panes round it, and rings from its foot up. */
const DOME_SEGMENTS = 24;
const DOME_RINGS = 6;
/** A glass room's walls stand in this far from its outline (m): the model's
 * own walls there never fight them. */
const GLASS_INSET_M = 0.04;
/** Her white-painted steel: mullions, ribs, the eaves. */
const FRAME_WHITE: RGB = lin(0.9, 0.91, 0.92);
/** The roof's glass, a little bluer than the walls'. */
const ROOF_GLASS: RGB = lin(0.6, 0.78, 0.84);

/**
 * Where a roof beam across at x crosses the glass round a dome: the spans
 * from ya to yb outside the dome's foot (an ellipse).
 */
function roofSpans(
  x: number,
  ya: number,
  yb: number,
  dome: Room["look"]["dome"]
): [number, number][] {
  if (!dome) return [[ya, yb]];
  const u = (x - dome.at[0]) / dome.a;
  if (Math.abs(u) >= 1) return [[ya, yb]];
  const h = dome.b * Math.sqrt(Math.max(0, 1 - u * u));
  const out: [number, number][] = [];
  if (dome.at[1] - h > ya + 0.2) out.push([ya, dome.at[1] - h]);
  if (dome.at[1] + h < yb - 0.2) out.push([dome.at[1] + h, yb]);
  return out;
}
/** Frosted glass (the doors): the pane shader's own tile. */
export const FROSTED_TILE = MODERN_TILE.pane + 1;

/**
 * A glass room (her pool hall): the floor less its basins, glass walls on
 * a white upstand between white mullions (solid cream walls on its
 * `solidEdges`), a flat glass roof at the eaves (`ceilingM`) over its
 * plan's box and, given one (`look.dome`), a glass dome on it (her
 * model's), its white curb, ribs and rings in the shell and metal.
 * Lamps: spotlights round the dome's lower ring, lighting the floor.
 */
function addGlassRoom(
  L: Layers,
  room: Room,
  edges: readonly EdgeInfo[],
  spec: Spec,
  holes: readonly Rect[]
): Lamp[] {
  if (!(L instanceof ModernLayers))
    throw new Error(`glass room ${room.id} needs ModernLayers`);
  const shell = L.shell;
  const metal = L.metal;
  const poly = room.outline;
  const fz = (p: V2) => roomFloorZ(room, p[0], p[1], spec);
  const ez = (p: V2) => fz(p) + room.ceilingM;
  const solid = new Set(room.look.solidEdges ?? []);
  const wall = WALL[room.look.finish];
  shell.vBase = fz(centroid(poly));

  // The floor, less the basins.
  shell.tileId = FLOOR_TILE[room.look.floor];
  const floor = scale(FLOOR[room.look.floor], SHADE.floor);
  for (const cell of cellsMinus(poly, holes))
    for (const [a, b, c] of cellTris(cell))
      shell.tri(
        P(cell[a], fz(cell[a])),
        P(cell[b], fz(cell[b])),
        P(cell[c], fz(cell[c])),
        floor
      );
  shell.tileId = TILE.none;

  // The walls.
  for (let i = 0; i < poly.length; i += 1) {
    if (edges[i].kind !== "wall") continue;
    const a0 = poly[i];
    const b0 = poly[(i + 1) % poly.length];
    const dx = b0[0] - a0[0];
    const dy = b0[1] - a0[1];
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const a: V2 = [a0[0] + nx * GLASS_INSET_M, a0[1] + ny * GLASS_INSET_M];
    const b: V2 = [b0[0] + nx * GLASS_INSET_M, b0[1] + ny * GLASS_INSET_M];
    if (solid.has(i)) {
      // Cream to the eaves, in columns (points for the light).
      const n = Math.max(1, Math.ceil(len / COLUMN_M));
      for (let k = 0; k < n; k += 1) {
        const p: V2 = [a[0] + (dx * k) / n, a[1] + (dy * k) / n];
        const q: V2 = [a[0] + (dx * (k + 1)) / n, a[1] + (dy * (k + 1)) / n];
        shell.tileId = TILE.none;
        inward(
          shell,
          p,
          q,
          fz(p),
          fz(q),
          fz(p) + SKIRTING_M,
          fz(q) + SKIRTING_M,
          scale(FRAME_WHITE, 0.8),
          scale(FRAME_WHITE, 0.8)
        );
        shell.tileId = WALL_TILE[room.look.finish];
        for (const [lo, hi] of [
          [SKIRTING_M, 1.0],
          [1.0, 2.0],
          [2.0, room.ceilingM],
        ] as const)
          inward(
            shell,
            p,
            q,
            fz(p) + lo,
            fz(q) + lo,
            fz(p) + hi,
            fz(q) + hi,
            wall,
            wall
          );
      }
      shell.tileId = TILE.none;
      continue;
    }
    // Glass on a white upstand, between mullions, under an eaves beam.
    const n = Math.max(1, Math.round(len / MULLION_M));
    for (let k = 0; k < n; k += 1) {
      const p: V2 = [a[0] + (dx * k) / n, a[1] + (dy * k) / n];
      const q: V2 = [a[0] + (dx * (k + 1)) / n, a[1] + (dy * (k + 1)) / n];
      inward(
        shell,
        p,
        q,
        fz(p),
        fz(q),
        fz(p) + UPSTAND_M,
        fz(q) + UPSTAND_M,
        scale(FRAME_WHITE, 0.82),
        FRAME_WHITE
      );
      // The upstand's top, a sill.
      shell.quad(
        P(p, fz(p) + UPSTAND_M),
        P(q, fz(q) + UPSTAND_M),
        P([q[0] + nx * 0.08, q[1] + ny * 0.08], fz(q) + UPSTAND_M),
        P([p[0] + nx * 0.08, p[1] + ny * 0.08], fz(p) + UPSTAND_M),
        FRAME_WHITE
      );
      L.pane.quad(
        P(p, fz(p) + UPSTAND_M),
        P(q, fz(q) + UPSTAND_M),
        P(q, ez(q)),
        P(p, ez(p)),
        MODERN_COLOR.glass
      );
      L.pane.quad(
        P(q, fz(q) + UPSTAND_M),
        P(p, fz(p) + UPSTAND_M),
        P(p, ez(p)),
        P(q, ez(q)),
        MODERN_COLOR.glass
      );
    }
    for (let k = 0; k <= n; k += 1) {
      const p: V2 = [a[0] + (dx * k) / n, a[1] + (dy * k) / n];
      const c: V2 = [p[0] + nx * 0.05, p[1] + ny * 0.05];
      metal.box(
        [c[0], c[1], (fz(p) + ez(p)) / 2],
        0.1,
        0.1,
        ez(p) - fz(p),
        FRAME_WHITE,
        { bottom: true }
      );
    }
    metal.beam(
      [a[0] + nx * 0.08, a[1] + ny * 0.08, ez(a) - 0.06],
      [b[0] + nx * 0.08, b[1] + ny * 0.08, ez(b) - 0.06],
      0.16,
      0.12,
      FRAME_WHITE
    );
  }

  // The roof: flat glass at the eaves over the plan's box, round the
  // dome's foot (a white curb), and the dome, its white ribs and rings.
  const [x0, y0, x1, y1] = bounds(poly);
  const xa = x0 + GLASS_INSET_M;
  const xb = x1 - GLASS_INSET_M;
  const ya = y0 + GLASS_INSET_M;
  const yb = y1 - GLASS_INSET_M;
  const eave = ez(centroid(poly));
  const dome = room.look.dome;
  // The dome's points: `i` round (from +x), `r` up (0 its foot).
  const at = (i: number, r: number): P3 => {
    const t = (i / DOME_SEGMENTS) * Math.PI * 2;
    const el = (r / DOME_RINGS) * (Math.PI / 2);
    return dome
      ? [
          dome.at[0] + dome.a * Math.cos(el) * Math.cos(t),
          dome.at[1] + dome.b * Math.cos(el) * Math.sin(t),
          eave + dome.rise * Math.sin(el),
        ]
      : [0, 0, eave];
  };
  const box = [
    new Vector2(xa, ya),
    new Vector2(xb, ya),
    new Vector2(xb, yb),
    new Vector2(xa, yb),
  ];
  const hole: Vector2[] = [];
  if (dome)
    for (let i = DOME_SEGMENTS - 1; i >= 0; i -= 1) {
      const p = at(i, 0);
      hole.push(new Vector2(p[0], p[1]));
    }
  const flat = [...box, ...hole];
  for (const [i, j, k] of ShapeUtils.triangulateShape(
    box,
    dome ? [hole] : []
  )) {
    const A: P3 = [flat[i].x, flat[i].y, eave];
    const B: P3 = [flat[j].x, flat[j].y, eave];
    const C: P3 = [flat[k].x, flat[k].y, eave];
    L.pane.tri(A, B, C, ROOF_GLASS);
    L.pane.tri(A, C, B, ROOF_GLASS);
  }
  // Its frame: beams across every MULLION_M·2 along x, over the glass.
  const nBeams = Math.max(1, Math.round((xb - xa) / (2 * MULLION_M)));
  for (let i = 1; i < nBeams; i += 1) {
    const x = xa + ((xb - xa) * i) / nBeams;
    for (const [lo, hi] of roofSpans(x, ya, yb, dome))
      metal.beam(
        [x, lo, eave - 0.07],
        [x, hi, eave - 0.07],
        0.08,
        0.12,
        FRAME_WHITE
      );
  }
  for (const y of [ya, yb])
    metal.beam(
      [xa, y, eave - 0.07],
      [xb, y, eave - 0.07],
      0.14,
      0.14,
      FRAME_WHITE
    );
  if (dome) {
    for (let r = 0; r < DOME_RINGS; r += 1)
      for (let i = 0; i < DOME_SEGMENTS; i += 1) {
        const A = at(i, r);
        const B = at(i + 1, r);
        const C = at(i + 1, r + 1);
        const D = at(i, r + 1);
        // Outward, then inward (the top ring's two points meet: one
        // triangle each).
        L.pane.quad(A, B, C, D, ROOF_GLASS);
        L.pane.quad(D, C, B, A, ROOF_GLASS);
      }
    // The curb at its foot, both faces white, and the ribs and rings.
    for (let i = 0; i < DOME_SEGMENTS; i += 1) {
      const p = at(i, 0);
      const q = at(i + 1, 0);
      const lo = eave - 0.06;
      const hi = eave + 0.24;
      shell.quad(
        P([p[0], p[1]], lo),
        P([q[0], q[1]], lo),
        P([q[0], q[1]], hi),
        P([p[0], p[1]], hi),
        FRAME_WHITE
      );
      shell.quad(
        P([q[0], q[1]], lo),
        P([p[0], p[1]], lo),
        P([p[0], p[1]], hi),
        P([q[0], q[1]], hi),
        scale(FRAME_WHITE, 0.85)
      );
    }
    for (let i = 0; i < DOME_SEGMENTS; i += 2)
      for (let r = 0; r < DOME_RINGS; r += 1)
        metal.beam(at(i, r), at(i, r + 1), 0.08, 0.12, FRAME_WHITE, false);
    for (const r of [2, 4])
      for (let i = 0; i < DOME_SEGMENTS; i += 1)
        metal.beam(at(i, r), at(i + 1, r), 0.06, 0.06, FRAME_WHITE, false);
  }

  // Spotlights on the dome's lower ring (or over the middle without one):
  // the hall lit evenly at night (the bake reaches the floor below).
  const lamps: Lamp[] = [];
  const spots: P3[] = [];
  if (dome) for (let i = 1; i < DOME_SEGMENTS; i += 2) spots.push(at(i, 2));
  else {
    const n = Math.max(1, Math.round((xb - xa) / 4));
    for (let i = 0; i < n; i += 1)
      spots.push([xa + ((xb - xa) * (i + 0.5)) / n, (ya + yb) / 2, eave]);
  }
  for (const [x, y, z] of spots) {
    metal.cyl([x, y, z - 0.16], 0.09, 0.07, 0.14, 8, MODERN_COLOR.chrome);
    // Its lens, facing down, glowing (HDR).
    const g = L.glass;
    g.glowV = 2.4;
    const N = 8;
    for (let k = 0; k < N; k += 1) {
      const t0 = (k / N) * Math.PI * 2;
      const t1 = ((k + 1) / N) * Math.PI * 2;
      g.tri(
        [x, y, z - 0.162],
        [x + 0.07 * Math.cos(t1), y + 0.07 * Math.sin(t1), z - 0.162],
        [x + 0.07 * Math.cos(t0), y + 0.07 * Math.sin(t0), z - 0.162],
        COLOR.lamp
      );
    }
    g.glowV = 0;
    lamps.push({ p: [x, y, z - 0.3], intensity: 0.85, radius: 6 });
  }
  return lamps;
}

/**
 * A pair of glass doors on a wall (hers: the stair up to a lido), 1.8 m
 * wide: a chrome frame and mullion, frosted panes, a chrome bar on each
 * leaf. `at` on the wall at the floor, `facing` into the room.
 */
function glassDoors(L: Layers, at: P3, facing: number): void {
  if (!(L instanceof ModernLayers))
    throw new Error("glass doors need ModernLayers");
  const W = 0.9;
  const H = DOOR_HEAD_M;
  const X = GLASS_INSET_M + 0.03;
  L.place(at, facing);
  const m = L.metal;
  const chrome = MODERN_COLOR.chrome;
  for (const y of [-W, 0, W])
    m.box([X, y, H / 2], 0.06, 0.07, H, chrome, { back: true, bottom: true });
  m.box([X, 0, H + 0.04], 0.06, 2 * W + 0.07, 0.08, chrome, { back: true });
  m.box([X, 0, 0.05], 0.06, 2 * W, 0.1, chrome, { back: true, bottom: true });
  for (const s of [-1, 1])
    m.box([X + 0.08, s * 0.16, 1.05], 0.03, 0.03, 0.9, chrome, {
      back: true,
    });
  const pane = L.pane;
  const was = pane.tileId;
  pane.tileId = FROSTED_TILE;
  for (const [ya, yb] of [
    [-W + 0.035, -0.035],
    [0.035, W - 0.035],
  ] as const)
    pane.quad(
      [X, ya, 0.1],
      [X, yb, 0.1],
      [X, yb, H],
      [X, ya, H],
      lin(0.86, 0.92, 0.94)
    );
  pane.tileId = was;
  L.place(null);
}

/** Ship-frame point. */
const P = (p: V2, z: number): P3 => [p[0], p[1], z];

/** Her atrium's glass onto the lift shafts, for one room (`liftGlassWalls`). */
interface RoomOptions {
  /** A landing's glass over its lifts' shafts (the cars glide behind). */
  fronts?: readonly LiftFront[];
}

function addRoom(
  L: Layers,
  room: Room,
  rooms: readonly Room[],
  edges: readonly EdgeInfo[],
  spec: Spec,
  open: ReadonlySet<string>,
  opts: RoomOptions = {}
): void {
  const shell = L.shell;
  const poly = room.outline;
  const steel = room.look.finish === "steel" || room.look.finish === "enamel";
  const oak = room.look.finish === "oak";
  // Her rooms (1.18) and her lift cars (brushed steel, a granite floor).
  const car = room.kind === "lift-car";
  const hers = isHers(room) && L instanceof ModernLayers;
  const wall = car ? CAR_WALL : WALL[room.look.finish];
  const wallTile = car ? TILE.none : WALL_TILE[room.look.finish];
  const skirting = car
    ? MODERN_COLOR.black
    : (MODERN_SKIRTING[room.look.finish] ?? SKIRTING);
  const floor = car ? CAR_FLOOR : floorColor(room);
  const ceiling = steel ? CEILING_STEEL : CEILING_WHITE;
  const fz = (p: V2) => roomFloorZ(room, p[0], p[1], spec);
  const cz = (p: V2) => ceilingZ(room, p[0], p[1], spec);
  const stairPart = STAIR_KINDS.has(room.kind);
  const ramp = room.ramp;
  const rise = ramp
    ? ramp.dropM / Math.max(1, Math.round(ramp.dropM / RISER_M))
    : 0;
  /** The floor's lowest line at a point: a flight's treads dip a riser. */
  const low = (p: V2) => fz(p) - rise - 0.01;
  const c0 = centroid(poly);
  shell.vBase = fz(c0);

  // The floor: flat (in cells, for the light), or treads and risers.
  shell.tileId = FLOOR_TILE[room.look.floor];
  if (!ramp) {
    for (const cell of cells(poly))
      for (const [a, b, c] of cellTris(cell))
        shell.tri(
          P(cell[a], fz(cell[a])),
          P(cell[b], fz(cell[b])),
          P(cell[c], fz(cell[c])),
          scale(floor, SHADE.floor)
        );
  } else {
    const treads = rampTreads(room, spec);
    const tread = scale(floor, SHADE.floor);
    const riser = scale(floor, SHADE.riser);
    const nosing = oak ? COLOR.brass : scale(floor, 0.8);
    for (let k = 0; k < treads.length; k += 1) {
      const [n0, n1, b1, b0] = treads[k];
      const up =
        (n1[0] - n0[0]) * (b1[1] - n0[1]) - (n1[1] - n0[1]) * (b1[0] - n0[0]);
      if (up > 0) shell.quad(n0, n1, b1, b0, tread);
      else shell.quad(n0, b0, b1, n1, tread);
      // Its riser, at its back, up to the tread above.
      const r0: P3 = [b0[0], b0[1], b0[2]];
      const r1: P3 = [b1[0], b1[1], b1[2]];
      const r2: P3 = [b1[0], b1[1], b1[2] + rise];
      const r3: P3 = [b0[0], b0[1], b0[2] + rise];
      const fx = ramp.to[0] - ramp.from[0];
      const fy = ramp.to[1] - ramp.from[1];
      const nX = r1[1] - r0[1];
      const nY = -(r1[0] - r0[0]);
      const t = shell.tileId;
      shell.tileId = TILE.none;
      if (nX * fx + nY * fy > 0) shell.quad(r0, r1, r2, r3, riser);
      else shell.quad(r1, r0, r3, r2, riser);
      // A nosing strip along the tread's front edge (brass on oak stairs).
      const dl = Math.hypot(fx, fy) || 1;
      const ex = (-fx / dl) * 0.04;
      const ey = (-fy / dl) * 0.04;
      const m0: P3 = [n0[0] + ex, n0[1] + ey, n0[2] + 0.004];
      const m1: P3 = [n1[0] + ex, n1[1] + ey, n1[2] + 0.004];
      const s0: P3 = [n0[0], n0[1], n0[2] + 0.004];
      const s1: P3 = [n1[0], n1[1], n1[2] + 0.004];
      if (up > 0) shell.quad(s0, s1, m1, m0, nosing);
      else shell.quad(s0, m0, m1, s1, nosing);
      shell.tileId = t;
    }
  }
  shell.tileId = TILE.none;

  // Under a stair or a landing: its soffit, seen from below.
  const fine = refine(poly);
  if (stairPart) {
    // Panelled oak under the Grand Staircase's flights, plain elsewhere.
    const soffit = oak ? scale(wall, 0.8) : scale(ceiling, SHADE.soffit);
    shell.tileId = oak ? TILE.oak : TILE.none;
    for (const [a, b, c] of triangulate(fine)) {
      const pa = fine[a];
      const pb = fine[b];
      const pc = fine[c];
      shell.tri(
        P(pa, low(pa) - SLAB_M),
        P(pc, low(pc) - SLAB_M),
        P(pb, low(pb) - SLAB_M),
        soffit
      );
    }
    shell.tileId = TILE.none;
  }

  // The ceiling, unless a stair or a floor comes down through it, or the
  // dome stands over it; her atrium's well is roofed in lit glass.
  if (
    !open.has(room.id) &&
    hers &&
    room.kind === "atrium" &&
    room.ceilingM >= 6
  )
    laylight(L as ModernLayers, room, spec);
  else if (!open.has(room.id)) {
    const c = scale(ceiling, SHADE.ceiling);
    for (const cell of cells(poly))
      for (const [a, b, d] of cellTris(cell))
        shell.tri(
          P(cell[a], cz(cell[a])),
          P(cell[d], cz(cell[d])),
          P(cell[b], cz(cell[b])),
          c
        );
  }

  // The edges: walls, balustrades, lintels.
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const info = edges[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // Inward (left of a counter-clockwise edge).
    const nx = -dy / len;
    const ny = dx / len;
    if (info.kind === "wall") {
      shell.tileId = wallTile;
      const n = Math.max(1, Math.ceil(len / COLUMN_M));
      const spans = frontSpans(a, b, opts.fronts);
      const cols = wallColumns(a, b, n, spans);
      for (const [p, q, glassTop] of cols) {
        const top = (v: V2) => cz(v) - COVE_M;
        if (glassTop > 0 && L instanceof ModernLayers) {
          // Glass onto a lift shaft, the wall over it to the cove.
          const g = (v: V2) => Math.min(fz(v) + glassTop, top(v));
          L.pane.quad(
            P(p, fz(p)),
            P(q, fz(q)),
            P(q, g(q)),
            P(p, g(p)),
            MODERN_COLOR.glass
          );
          L.pane.quad(
            P(q, fz(q)),
            P(p, fz(p)),
            P(p, g(p)),
            P(q, g(q)),
            MODERN_COLOR.glass
          );
          if (top(p) - g(p) > 0.005 || top(q) - g(q) > 0.005)
            inward(shell, p, q, g(p), g(q), top(p), top(q), wall, wall);
        } else {
          const t = shell.tileId;
          shell.tileId = TILE.none;
          inward(
            shell,
            p,
            q,
            low(p),
            low(q),
            fz(p) + SKIRTING_M,
            fz(q) + SKIRTING_M,
            steel ? scale(wall, 0.55) : skirting,
            steel ? scale(wall, 0.55) : skirting
          );
          shell.tileId = t;
          // Rows: dado, the panels, up to the cove.
          const rows = [SKIRTING_M, 1.0, 2.0];
          for (let r = 0; r < rows.length; r += 1) {
            const lo = (v: V2) => Math.min(fz(v) + rows[r], top(v));
            const hi = (v: V2) =>
              r + 1 < rows.length
                ? Math.min(fz(v) + rows[r + 1], top(v))
                : top(v);
            if (hi(p) - lo(p) < 0.005 && hi(q) - lo(q) < 0.005) continue;
            inward(shell, p, q, lo(p), lo(q), hi(p), hi(q), wall, wall);
          }
        }
        // The cove: from the wall to the ceiling, facing down and in.
        const t2 = shell.tileId;
        shell.tileId = TILE.none;
        const ci: V2 = [p[0] + nx * COVE_M, p[1] + ny * COVE_M];
        const di: V2 = [q[0] + nx * COVE_M, q[1] + ny * COVE_M];
        shell.quad(
          P(p, top(p)),
          P(ci, cz(p)),
          P(di, cz(q)),
          P(q, top(q)),
          scale(ceiling, 0.95)
        );
        shell.tileId = t2;
      }
      // A proud top to the skirting: a lip that catches the light.
      if (spans.length === 0)
        shell.quad(
          P(a, fz(a) + SKIRTING_M),
          P(b, fz(b) + SKIRTING_M),
          P([b[0] + nx * 0.02, b[1] + ny * 0.02], fz(b) + SKIRTING_M),
          P([a[0] + nx * 0.02, a[1] + ny * 0.02], fz(a) + SKIRTING_M),
          oak ? COLOR.oakDark : scale(wall, 0.9)
        );
      shell.tileId = TILE.none;
      // The shaft glass's chrome: posts at its own ends (not where a door
      // frame stands), a sill and a head.
      for (const sp of spans) {
        const u = (t: number, z: number): P3 => {
          const v: V2 = [
            a[0] + (dx / len) * t + nx * 0.03,
            a[1] + (dy / len) * t + ny * 0.03,
          ];
          return P(v, fz(v) + z);
        };
        const m = L.metal;
        if (sp.post0)
          m.beam(
            u(sp.t0, 0),
            u(sp.t0, sp.top),
            0.06,
            0.06,
            MODERN_COLOR.chrome
          );
        if (sp.post1)
          m.beam(
            u(sp.t1, 0),
            u(sp.t1, sp.top),
            0.06,
            0.06,
            MODERN_COLOR.chrome
          );
        m.beam(u(sp.t0, 0.04), u(sp.t1, 0.04), 0.05, 0.08, MODERN_COLOR.chrome);
        m.beam(
          u(sp.t0, sp.top),
          u(sp.t1, sp.top),
          0.06,
          0.1,
          MODERN_COLOR.chrome
        );
      }
    } else if (info.kind === "rail") {
      if (oak) {
        // An oak balustrade with iron balusters, open between them.
        balustrade(L, P(a, fz(a)), P(b, fz(b)), RAIL_THICK_M);
        L.room(L.shell.slot);
      } else if (hers && room.kind === "balcony") {
        // A balcony's glass rail under a teak cap (over the sea).
        glassRailRun(L as ModernLayers, P(a, fz(a)), P(b, fz(b)), BALCONY_RAIL);
      } else if (hers && room.look.finish === "theatre") {
        // The theatre's balcony front: a velvet parapet; the stage's front
        // is its fascia only.
        if (room.kind !== "stage") parapet(shell, a, b, nx, ny, fz, low, wall);
      } else if (hers) {
        // Her galleries and stair: glass between chrome posts.
        glassRailRun(L as ModernLayers, P(a, fz(a)), P(b, fz(b)));
      } else {
        // Steel plate, both faces.
        const r = RAIL_STEEL;
        const ai: V2 = [a[0] + nx * RAIL_THICK_M, a[1] + ny * RAIL_THICK_M];
        const bi: V2 = [b[0] + nx * RAIL_THICK_M, b[1] + ny * RAIL_THICK_M];
        inward(
          shell,
          ai,
          bi,
          low(a),
          low(b),
          fz(a) + RAIL_M,
          fz(b) + RAIL_M,
          r,
          r
        );
        shell.quad(
          P(a, fz(a) + RAIL_M),
          P(b, fz(b) + RAIL_M),
          P(bi, fz(b) + RAIL_M),
          P(ai, fz(a) + RAIL_M),
          scale(r, 1.15)
        );
        outward(
          shell,
          a,
          b,
          fz(a),
          fz(b),
          fz(a) + RAIL_M,
          fz(b) + RAIL_M,
          r,
          r
        );
      }
      // The slab's edge under it (the fascia), seen from the room beside,
      // and over a void the stair's cheek down to the floor beside.
      const fascia = oak
        ? COLOR.oakDark
        : hers && room.look.finish === "theatre"
          ? scale(MODERN_COLOR.theatreDark, 0.8)
          : hers
            ? scale(MODERN_COLOR.white, 0.86)
            : scale(RAIL_STEEL, 0.8);
      const loA = Math.min(
        fz(a) - SLAB_M - rise,
        info.cheek ? info.cheek[0] : Infinity
      );
      const loB = Math.min(
        fz(b) - SLAB_M - rise,
        info.cheek ? info.cheek[1] : Infinity
      );
      shell.tileId = oak
        ? TILE.oak
        : hers && room.look.finish === "theatre"
          ? MODERN_TILE.theatre
          : TILE.none;
      outward(shell, a, b, loA, loB, fz(a), fz(b), fascia, fascia);
      shell.tileId = TILE.none;
    }
    // A seam onto a room with a higher ceiling (the third-class landing
    // onto its passage): the step between the ceilings, facing into the
    // higher room, so no slit shows the outside through it.
    if (
      info.kind === "seam" &&
      info.other &&
      !info.lintel &&
      !info.other.noWalk &&
      !openPair(room, info.other) &&
      !open.has(room.id) &&
      !open.has(info.other.id)
    ) {
      const o = info.other;
      const hiA = ceilingZ(o, a[0], a[1], spec);
      const hiB = ceilingZ(o, b[0], b[1], spec);
      if (hiA > cz(a) + 0.02 || hiB > cz(b) + 0.02)
        outward(
          shell,
          a,
          b,
          cz(a),
          cz(b),
          Math.max(hiA, cz(a)),
          Math.max(hiB, cz(b)),
          scale(ceiling, 0.9),
          scale(ceiling, 0.9)
        );
    }
    if (info.kind === "seam" && info.lintel) {
      // Over a doorway: from the door's head to the higher ceiling.
      const other = info.lintel.other;
      const hiA = Math.max(cz(a), ceilingZ(other, a[0], a[1], spec));
      const hiB = Math.max(cz(b), ceilingZ(other, b[0], b[1], spec));
      const loA = fz(a) + DOOR_HEAD_M;
      const loB = fz(b) + DOOR_HEAD_M;
      // A lift's door in her atrium's shaft glass: glass over it too, the
      // wall over that to the cove, a chrome transom on the door's head.
      const over =
        L instanceof ModernLayers ? frontSpans(a, b, opts.fronts) : [];
      if (over.length > 0 && L instanceof ModernLayers) {
        const sp = over[0];
        const g = (v: V2) => Math.min(fz(v) + sp.top, cz(v) - COVE_M);
        const ga = g(a);
        const gb = g(b);
        if (ga > loA + 0.01 || gb > loB + 0.01) {
          L.pane.quad(
            P(a, loA),
            P(b, loB),
            P(b, gb),
            P(a, ga),
            MODERN_COLOR.glass
          );
          L.pane.quad(
            P(b, loB),
            P(a, loA),
            P(a, ga),
            P(b, gb),
            MODERN_COLOR.glass
          );
        }
        const u = (v: V2, z: number): P3 =>
          P([v[0] + nx * 0.03, v[1] + ny * 0.03], z);
        L.metal.beam(u(a, loA), u(b, loB), 0.06, 0.08, MODERN_COLOR.chrome);
        L.metal.beam(u(a, ga), u(b, gb), 0.06, 0.1, MODERN_COLOR.chrome);
        if (hiA > ga + 0.01 || hiB > gb + 0.01) {
          shell.tileId = wallTile;
          inward(shell, a, b, ga, gb, hiA, hiB, wall, wall);
          shell.tileId = TILE.none;
        }
      } else if (hiA > loA + 0.01 || hiB > loB + 0.01) {
        shell.tileId = wallTile;
        inward(
          shell,
          a,
          b,
          loA,
          loB,
          Math.max(hiA, loA),
          Math.max(hiB, loB),
          wall,
          wall
        );
        shell.tileId = TILE.none;
      }
      // Its frame, so the doorway reads as a door (and a lift's gates).
      const mid: P3 = [
        (a[0] + b[0]) / 2,
        (a[1] + b[1]) / 2,
        fz([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]),
      ];
      const yaw = Math.atan2(ny, nx);
      doorFrame(L, mid, yaw, len, DOOR_STYLE[room.look.finish], DOOR_HEAD_M);
      if (room.kind === "lift") liftGate(L, mid, yaw, len);
      L.place(null);
    }
  }
}

// --- Her rooms (1.18): shaft glass, rails, the roof, lamps, emergency --------

/** A run of her atrium's glass wall onto a lift shaft (`liftGlassWalls`). */
interface LiftFront {
  a: V2;
  b: V2;
  /** The glass's height over the landing's floor (to its cove). */
  top: number;
}

/**
 * Her atrium's glass wall onto the lift shafts: on every landing where the
 * shaft is open towards it (the car's door at the shaft's forward end, the
 * side `liftCar.ts` leaves open), the landing's wall across the shaft's
 * whole width is glass to the cove, over the door as well, so the cars
 * glide by in full view. The cars carry their own glass (`liftCar.ts`); a
 * lobby's wall (aft, the shaft open only a storey) stays solid but for the
 * door. Keyed by landing; none without lifts.
 */
export function liftGlassWalls(
  rooms: readonly Room[],
  lifts: readonly LiftShaft[]
): Map<string, LiftFront[]> {
  const out = new Map<string, LiftFront[]>();
  if (lifts.length === 0) return out;
  const byId = new Map(rooms.map((r) => [r.id, r]));
  for (const lift of lifts) {
    const { min, max } = lift.car;
    const mid = (min[0] + max[0]) / 2;
    for (const stop of lift.stops) {
      const [p, q] = stop.door;
      const room = byId.get(stop.landing);
      if (!room) continue;
      // The door's line: across x (a wall at x) or along it.
      const atX = Math.abs(p[0] - q[0]) < TOL;
      if (!atX || p[0] < mid) continue;
      const y0 = min[1] - SHAFT_GAP_M;
      const y1 = max[1] + SHAFT_GAP_M;
      const list = out.get(stop.landing) ?? [];
      list.push({
        a: [p[0], y0],
        b: [p[0], y1],
        top: room.ceilingM - COVE_M,
      });
      out.set(stop.landing, list);
    }
  }
  return out;
}

/** A front's span along edge a→b (m from a), and its glass's height. */
interface FrontSpan {
  t0: number;
  t1: number;
  top: number;
  /** Whether the front ends at t0 (t1) here, not cut by the edge's end. */
  post0: boolean;
  post1: boolean;
}

/** The fronts on wall edge a→b, as spans along it (none: an empty list). */
function frontSpans(
  a: V2,
  b: V2,
  fronts: readonly LiftFront[] | undefined
): FrontSpan[] {
  if (!fronts || fronts.length === 0) return [];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (len < TOL) return [];
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const out: FrontSpan[] = [];
  for (const f of fronts) {
    const off = (v: V2) => Math.abs((v[0] - a[0]) * uy - (v[1] - a[1]) * ux);
    if (off(f.a) > TOL || off(f.b) > TOL) continue;
    const ta = (f.a[0] - a[0]) * ux + (f.a[1] - a[1]) * uy;
    const tb = (f.b[0] - a[0]) * ux + (f.b[1] - a[1]) * uy;
    const lo = Math.min(ta, tb);
    const hi = Math.max(ta, tb);
    const t0 = Math.max(0, lo);
    const t1 = Math.min(len, hi);
    if (t1 - t0 > 0.05)
      out.push({
        t0,
        t1,
        top: f.top,
        post0: lo > TOL,
        post1: hi < len - TOL,
      });
  }
  return out.sort((x, y) => x.t0 - y.t0);
}

/**
 * A wall edge's columns (points for the light): n even columns, or with
 * shaft glass on it, cut at each run's ends, each column a run's glass
 * (its height) or wall (0).
 */
function wallColumns(
  a: V2,
  b: V2,
  n: number,
  spans: readonly FrontSpan[]
): [V2, V2, number][] {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const out: [V2, V2, number][] = [];
  if (spans.length === 0) {
    for (let k = 0; k < n; k += 1)
      out.push([
        [a[0] + (dx * k) / n, a[1] + (dy * k) / n],
        [a[0] + (dx * (k + 1)) / n, a[1] + (dy * (k + 1)) / n],
        0,
      ]);
    return out;
  }
  const len = Math.hypot(dx, dy);
  const cuts = [0, len];
  for (let k = 1; k < n; k += 1) cuts.push((len * k) / n);
  for (const sp of spans) cuts.push(sp.t0, sp.t1);
  cuts.sort((x, y) => x - y);
  const ts: number[] = [];
  for (const t of cuts)
    if (ts.length === 0 || t - ts[ts.length - 1] > 0.02) ts.push(t);
    else if (
      spans.some(
        (sp) => Math.abs(sp.t0 - t) < 1e-9 || Math.abs(sp.t1 - t) < 1e-9
      )
    )
      ts[ts.length - 1] = t;
  if (ts[ts.length - 1] < len) ts[ts.length - 1] = len;
  const at = (t: number): V2 => [a[0] + (dx * t) / len, a[1] + (dy * t) / len];
  for (let k = 0; k + 1 < ts.length; k += 1) {
    const mid = (ts[k] + ts[k + 1]) / 2;
    const sp = spans.find((x) => mid > x.t0 && mid < x.t1);
    out.push([at(ts[k]), at(ts[k + 1]), sp ? sp.top : 0]);
  }
  return out;
}

/** A solid parapet along a→b (her theatre's balcony front), both faces. */
function parapet(
  shell: Builder,
  a: V2,
  b: V2,
  nx: number,
  ny: number,
  fz: (p: V2) => number,
  low: (p: V2) => number,
  wall: RGB
): void {
  const H = 0.85;
  const T = 0.16;
  const ai: V2 = [a[0] + nx * T, a[1] + ny * T];
  const bi: V2 = [b[0] + nx * T, b[1] + ny * T];
  const t = shell.tileId;
  shell.tileId = MODERN_TILE.theatre;
  inward(
    shell,
    ai,
    bi,
    low(a),
    low(b),
    fz(a) + H,
    fz(b) + H,
    scale(wall, 0.7),
    wall
  );
  outward(
    shell,
    a,
    b,
    fz(a),
    fz(b),
    fz(a) + H,
    fz(b) + H,
    scale(wall, 0.7),
    wall
  );
  shell.tileId = TILE.none;
  // A dark wooden cap.
  shell.quad(
    P(a, fz(a) + H),
    P(b, fz(b) + H),
    P(bi, fz(b) + H),
    P(ai, fz(a) + H),
    MODERN_COLOR.seatWood
  );
  shell.tileId = t;
}

/** Her atrium's glass roof: a grid of panes this far apart (m). */
const LAYLIGHT_M = 1.5;
/** Its panes' colour (a pale sky; glowing with her lamps). */
const LAYLIGHT: RGB = lin(0.82, 0.9, 0.97);

/**
 * A well's roof in lit glass (a laylight): panes glowing with the room's
 * power in white steel ribs on a grid, facing down.
 */
function laylight(L: ModernLayers, room: Room, spec: Spec): void {
  const poly = room.outline;
  const cz = (p: V2) => ceilingZ(room, p[0], p[1], spec);
  const g = L.glass;
  const was = g.glowV;
  g.glowV = 1.0;
  for (const cell of cells(poly))
    for (const [a, b, d] of cellTris(cell))
      g.tri(
        P(cell[a], cz(cell[a])),
        P(cell[d], cz(cell[d])),
        P(cell[b], cz(cell[b])),
        LAYLIGHT
      );
  g.glowV = was;
  // The ribs: along x and across, inside the outline only.
  const [x0, y0, x1, y1] = bounds(poly);
  const z = cz(centroid(poly)) - 0.06;
  const runs = (from: V2, to: V2) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(1, Math.round(len / 0.25));
    let start: V2 | null = null;
    for (let i = 0; i <= steps; i += 1) {
      const t = i / steps;
      const p: V2 = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ];
      const inside = pointInPolygon(p, poly) && distToEdges(p, poly) > 0.05;
      if (inside && !start) start = p;
      if ((!inside || i === steps) && start) {
        L.metal.beam(P(start, z), P(p, z), 0.08, 0.12, FRAME_WHITE);
        start = null;
      }
    }
  };
  for (let x = x0 + LAYLIGHT_M; x < x1 - 0.1; x += LAYLIGHT_M)
    runs([x, y0], [x, y1]);
  for (let y = y0 + LAYLIGHT_M; y < y1 - 0.1; y += LAYLIGHT_M)
    runs([x0, y], [x1, y]);
}

/** Her cabin's sea window: its sill and head over the floor (m), its width. */
const WINDOW_SILL_M = 0.7;
const WINDOW_HEAD_M = 1.9;
const WINDOW_W_M = 2.0;

/**
 * Her ocean-view cabin's big window, low over the sea, on each outboard
 * wall (its side: the walls facing away from her centre line that way):
 * glass showing the sky, or the sea once it is over it (the porthole's
 * glass), in a white frame with a sill.
 */
function seaWindows(
  L: ModernLayers,
  room: Room,
  edges: readonly EdgeInfo[],
  spec: Spec,
  side: "port" | "starboard"
): void {
  const poly = room.outline;
  const sgn = side === "port" ? 1 : -1;
  const fz = (p: V2) => roomFloorZ(room, p[0], p[1], spec);
  for (let i = 0; i < poly.length; i += 1) {
    if (edges[i].kind !== "wall") continue;
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Outward (the right of a counter-clockwise edge) toward her side.
    const oy = -(b[0] - a[0]) / len;
    if (oy * sgn < 0.9 || len < 1.6) continue;
    const mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const yaw = Math.atan2(b[0] - a[0], -(b[1] - a[1]));
    const W = Math.min(WINDOW_W_M, len - 0.8) / 2;
    L.place(P(mid, fz(mid)), yaw);
    const g = L.glass;
    const t = g.tileId;
    g.tileId = TILE.porthole;
    g.quad(
      [0.006, -W, WINDOW_SILL_M],
      [0.006, W, WINDOW_SILL_M],
      [0.006, W, WINDOW_HEAD_M],
      [0.006, -W, WINDOW_HEAD_M],
      COLOR.white
    );
    g.tileId = t;
    const m = L.metal;
    const white = MODERN_COLOR.white;
    for (const y of [-W - 0.04, W + 0.04])
      m.box(
        [0.03, y, (WINDOW_SILL_M + WINDOW_HEAD_M) / 2],
        0.06,
        0.08,
        WINDOW_HEAD_M - WINDOW_SILL_M + 0.16,
        white,
        { back: true }
      );
    m.box([0.03, 0, WINDOW_HEAD_M + 0.04], 0.06, 2 * W + 0.16, 0.08, white, {
      back: true,
    });
    m.box([0.03, 0, 1.3], 0.04, 2 * W, 0.04, white, { back: true });
    m.box([0.1, 0, WINDOW_SILL_M - 0.03], 0.2, 2 * W + 0.2, 0.06, white, {
      back: true,
    });
    L.place(null);
  }
}

/** Her downlights are about this far apart (m; nearer reads dim in emergency light). */
export const DOWNLIGHT_M = 3.5;
/** A room this tall (m) has downlights as well as its strips. */
const TALL_M = 4;

/** An exit sign's height over its room's floor (under a low ceiling). */
function signZ(room: Room): number {
  return Math.min(EXIT_SIGN_Z, room.ceilingM - COVE_M - 0.12);
}

/**
 * Her lamp styles' lamps for one room: downlights on a grid (along a
 * corridor's axis), cove strips along the walls (a tall room downlights
 * too, reaching its floor), the chandelier over a well (its light wide:
 * the whole zone).
 */
function styleLamps(
  L: ModernLayers,
  room: Room,
  edges: readonly EdgeInfo[],
  spec: Spec
): (Lamp & { wide: boolean })[] {
  const out: (Lamp & { wide: boolean })[] = [];
  const style = room.look.lamp;
  const h = room.ceilingM;
  const cz = (p: V2) => ceilingZ(room, p[0], p[1], spec);
  if (style === "chandelier" && h >= 6) {
    const [x0, y0, x1, y1] = bounds(room.outline);
    const c: V2 = [(x0 + x1) / 2, (y0 + y1) / 2];
    for (const l of chandelier(L, P(c, cz(c)))) out.push({ ...l, wide: true });
    return out;
  }
  if (style === "strip") {
    const poly = room.outline;
    for (let i = 0; i < poly.length; i += 1) {
      if (edges[i].kind !== "wall") continue;
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1.5) continue;
      const mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const yaw = Math.atan2(b[0] - a[0], -(b[1] - a[1]));
      for (const l of stripLight(L, P(mid, cz(mid)), yaw, len - 0.3))
        out.push({ ...l, wide: false });
    }
    if (h <= TALL_M) return out;
  }
  const step = h > TALL_M ? DOWNLIGHT_M * 1.3 : DOWNLIGHT_M;
  const spots: V2[] = [];
  if (room.axis) {
    const [p, q] = room.axis;
    const n = Math.max(
      1,
      Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / step)
    );
    for (let i = 0; i < n; i += 1) {
      const t = (i + 0.5) / n;
      spots.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  } else spots.push(...lampSpots(room, step));
  // A tall room's downlights reach its floor.
  const radius = Math.max(2.3, 0.8 * h);
  for (const s of spots)
    for (const l of downlight(L, P(s, cz(s))))
      out.push({ ...l, radius, wide: false });
  return out;
}

/** Her emergency path lights run in these rooms (low, along the walls). */
const PATH_KINDS: ReadonlySet<string> = new Set([
  "corridor",
  "lobby",
  "atrium",
  "gallery",
  "theatre",
  "passage",
  "club",
]);
/** And white lamps under the ceiling in these (pools of light between dark). */
const HIGH_KINDS: ReadonlySet<string> = new Set(["corridor", "lobby"]);
/** A high emergency lamp's length (m), and at most one per this much wall. */
const HIGH_LAMP_M = 0.7;
const HIGH_EVERY_M = 4.5;
/** A strip keeps this far from a shut door's middle (m). */
const STRIP_DOOR_GAP_M = 0.65;
/** Its light for the emergency bake: a point every this far (m). */
const STRIP_LIGHT_M = 1.2;

/**
 * Her emergency strips along a room's walls: dashed green path lights at
 * the floor (gapped round shut doors; a raked floor's in short level
 * pieces) and, in corridors and lobbies, short white lamps under the
 * ceiling on the walls facing +x or +y (one side), every few metres,
 * glowing on the emergency supply. Returns the light they throw (for the
 * emergency bake).
 */
function emergencyStrips(
  L: ModernLayers,
  room: Room,
  edges: readonly EdgeInfo[],
  spec: Spec,
  shutDoors: readonly ShutDoor[]
): Lamp[] {
  const out: Lamp[] = [];
  const lowOn = PATH_KINDS.has(room.kind);
  const highOn = HIGH_KINDS.has(room.kind);
  if (!lowOn && !highOn) return out;
  const poly = room.outline;
  const fz = (p: V2) => roomFloorZ(room, p[0], p[1], spec);
  const doors = shutDoors.filter((d) => d.room === room.id);
  // Narrow halls catch their strips' light from both walls: softer there.
  const k = room.kind === "corridor" || room.kind === "lobby" ? 0.7 : 1;
  for (let i = 0; i < poly.length; i += 1) {
    if (edges[i].kind !== "wall") continue;
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.9) continue;
    const ux = (b[0] - a[0]) / len;
    const uy = (b[1] - a[1]) / len;
    const nx = -uy;
    const ny = ux;
    const yaw = Math.atan2(ny, nx);
    // The free stretches: the edge less its ends and the shut doors.
    let free: [number, number][] = [[0.2, len - 0.2]];
    for (const d of doors) {
      const off = Math.abs((d.at[0] - a[0]) * uy - (d.at[1] - a[1]) * ux);
      if (off > 0.05) continue;
      const t = (d.at[0] - a[0]) * ux + (d.at[1] - a[1]) * uy;
      free = free.flatMap(
        ([u0, u1]): [number, number][] =>
          [
            [u0, Math.min(u1, t - STRIP_DOOR_GAP_M)],
            [Math.max(u0, t + STRIP_DOOR_GAP_M), u1],
          ].filter(([x, y]) => y - x > 0.5) as [number, number][]
      );
    }
    const at = (t: number): V2 => [a[0] + ux * t, a[1] + uy * t];
    // The high lamps: on one side, spread along the free stretches.
    const highSide = highOn && (ny > 0.5 || nx > 0.5);
    let sinceHigh = HIGH_EVERY_M / 2;
    for (const [u0, u1] of free) {
      const span = u1 - u0;
      if (lowOn) {
        // A raked floor's strip in short level pieces.
        const n = room.ramp ? Math.max(1, Math.round(span / 1.2)) : 1;
        for (let k = 0; k < n; k += 1) {
          const t0 = u0 + (span * k) / n;
          const t1 = u0 + (span * (k + 1)) / n;
          const mid = at((t0 + t1) / 2);
          emergencyLamp(
            L,
            P(mid, fz(mid)),
            yaw,
            t1 - t0 - 0.02,
            EMERGENCY_LOW_Z
          );
        }
      }
      // Their light, every STRIP_LIGHT_M along.
      if (lowOn) {
        const m = Math.max(1, Math.round(span / STRIP_LIGHT_M));
        for (let k = 0; k < m; k += 1) {
          const p = at(u0 + (span * (k + 0.5)) / m);
          out.push({
            p: [p[0] + nx * 0.15, p[1] + ny * 0.15, fz(p) + 0.15],
            intensity: 0.5 * k,
            radius: 0.6,
          });
        }
      }
      if (highSide && span > HIGH_LAMP_M + 0.2) {
        sinceHigh += span;
        if (sinceHigh >= HIGH_EVERY_M) {
          sinceHigh = 0;
          const mid = at((u0 + u1) / 2);
          const h = ceilingZ(room, mid[0], mid[1], spec) - fz(mid);
          const z = h - COVE_M - 0.06;
          emergencyLamp(L, P(mid, fz(mid)), yaw, HIGH_LAMP_M, z);
          out.push({
            p: [mid[0] + nx * 0.3, mid[1] + ny * 0.3, fz(mid) + z - 0.2],
            intensity: 0.45 * k,
            radius: 1.4,
          });
        }
      }
    }
  }
  return out;
}

/** A deck door's lit doorway in a deck room (as doorGlow.ts's), its glow. */
const DECK_DOOR_GLOW = 1.75;

/**
 * A deck door's warm lit doorway on a deck room's wall (her pool hall's
 * door to the club), as `doorGlowGeometry` draws one on a house face: a
 * dark frame, the light (HDR, so bloom catches it), the open leaf's edge.
 * `out` is the door's end in the room, `inside` its end beyond the wall.
 */
function deckDoorGlow(
  L: Layers,
  room: Room,
  out: V2,
  inside: V2,
  spec: Spec
): void {
  const len = Math.hypot(out[0] - inside[0], out[1] - inside[1]) || 1;
  const nx = (out[0] - inside[0]) / len;
  const ny = (out[1] - inside[1]) / len;
  // Proud of the deck room's wall (its glass room's walls stand in).
  const off = DOOR_FACE_OFFSET_M - GLASS_INSET_M - 0.03;
  const o: P3 = [
    out[0] - nx * off,
    out[1] - ny * off,
    roomFloorZ(room, out[0], out[1], spec),
  ];
  const w = DOOR_GLOW_WIDTH_M / 2;
  const h = DOOR_GLOW_HEIGHT_M;
  const f = 0.09;
  const g = L.glass;
  const was = g.glowV;
  const tile = g.tileId;
  g.tileId = TILE.none;
  L.place(o, Math.atan2(ny, nx));
  const face = (x: number, y0: number, y1: number, z1: number, c: RGB) =>
    g.quad([x, y0, 0], [x, y1, 0], [x, y1, z1], [x, y0, z1], c);
  g.glowV = 0;
  face(0, -w - f, w + f, h + f, lin(0.12, 0.065, 0.03));
  g.glowV = DECK_DOOR_GLOW;
  face(0.005, -w, w, h, [0.98, 0.55, 0.21]);
  g.glowV = 1;
  face(0.01, w - 0.22, w, h, [0.9, 0.5, 0.22]);
  L.place(null);
  g.glowV = was;
  g.tileId = tile;
}

/** A doorway's frame by the room's finish. */
const DOOR_STYLE: Record<Room["look"]["finish"], DoorStyle> = {
  oak: "oak",
  "white-panel": "white",
  enamel: "white",
  steel: "steel",
  glass: "white",
  "cabin-veneer": "white",
  cream: "white",
  marble: "white",
  kids: "white",
  theatre: "white",
};

/**
 * An outline cut into CELL_M squares (each piece the outline's part in
 * it), so the baked light has points to land on.
 */
export function cells(outline: readonly V2[]): V2[][] {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  for (const [x, y] of outline) {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  }
  const nx = Math.max(1, Math.ceil((x1 - x0) / CELL_M - 1e-6));
  const ny = Math.max(1, Math.ceil((y1 - y0) / CELL_M - 1e-6));
  const sx = (x1 - x0) / nx;
  const sy = (y1 - y0) / ny;
  const out: V2[][] = [];
  for (let i = 0; i < nx; i += 1)
    for (let j = 0; j < ny; j += 1) {
      const cx0 = x0 + i * sx;
      const cy0 = y0 + j * sy;
      const piece = clipRect(outline, cx0, cy0, cx0 + sx, cy0 + sy);
      if (piece.length >= 3 && Math.abs(area(piece)) > 1e-5) out.push(piece);
    }
  return out;
}

function area(o: readonly V2[]): number {
  let s = 0;
  for (let i = 0; i < o.length; i += 1) {
    const a = o[i];
    const b = o[(i + 1) % o.length];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return s / 2;
}

const QUAD_TRIS: [number, number, number][] = [
  [0, 1, 2],
  [0, 2, 3],
];

/** A cell's triangles: a whole square (convex, CCW) as two, else earcut. */
function cellTris(cell: readonly V2[]): [number, number, number][] {
  if (cell.length === 4 && area(cell) > 0) {
    let convex = true;
    for (let i = 0; i < 4 && convex; i += 1) {
      const a = cell[i];
      const b = cell[(i + 1) % 4];
      const c = cell[(i + 2) % 4];
      if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) <= 0)
        convex = false;
    }
    if (convex) return QUAD_TRIS;
  }
  return triangulate(cell);
}

/** Sutherland–Hodgman: the outline's part inside a rectangle. */
function clipRect(
  outline: readonly V2[],
  x0: number,
  y0: number,
  x1: number,
  y1: number
): V2[] {
  let pts: V2[] = outline.slice();
  const planes: [(p: V2) => number][] = [
    [(p) => p[0] - x0],
    [(p) => x1 - p[0]],
    [(p) => p[1] - y0],
    [(p) => y1 - p[1]],
  ];
  for (const [f] of planes) {
    if (pts.length === 0) break;
    const next: V2[] = [];
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const fa = f(a);
      const fb = f(b);
      if (fa >= 0) next.push(a);
      if (fa >= 0 !== fb >= 0) {
        const t = fa / (fa - fb);
        next.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    pts = next;
  }
  // Drop repeats (a corner on the rectangle's edge).
  const out: V2[] = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.abs(q[0] - p[0]) > 1e-7 || Math.abs(q[1] - p[1]) > 1e-7)
      out.push(p);
  }
  if (out.length > 1) {
    const f = out[0];
    const l = out[out.length - 1];
    if (Math.abs(f[0] - l[0]) < 1e-7 && Math.abs(f[1] - l[1]) < 1e-7) out.pop();
  }
  return out;
}

/** A vertical quad on edge a→b of a counter-clockwise outline, facing in. */
function inward(
  b: Builder,
  p: V2,
  q: V2,
  loA: number,
  loB: number,
  hiA: number,
  hiB: number,
  cLow: RGB,
  cHigh: RGB
): void {
  b.quad(P(p, loA), P(p, hiA), P(q, hiB), P(q, loB), cLow, cHigh, cHigh, cLow);
}

/** As `inward`, facing out of the room (seen from the room beyond). */
function outward(
  b: Builder,
  p: V2,
  q: V2,
  loA: number,
  loB: number,
  hiA: number,
  hiB: number,
  cLow: RGB,
  cHigh: RGB
): void {
  b.quad(P(p, loA), P(q, loB), P(q, hiB), P(p, hiA), cLow, cLow, cHigh, cHigh);
}

// --- The baked light -----------------------------------------------------------

/** The light every surface has without a lamp near (with the power on). */
const AMBIENT = 0.1;
/** A lamp reaches this many of its radii, squared. */
const REACH2 = 2.6 * 2.6;
/** No vertex gets more than this (bloom's threshold stays the lamps'). */
const LIGHT_MAX = 1.6;

/**
 * The lamps' light at each vertex: an ambient share, then each lamp in the
 * room or a room open to it (a seam or a balustrade between them; the
 * dome's over the whole zone), by distance (1 / (1 + (d / reach)²)),
 * facing, and not through a wall (a wall edge of either room between them
 * in plan, for a lamp in another room). Room surfaces are darker into the
 * corners and toward the floor (a cheap occlusion).
 */
class LightBake {
  private readonly rooms: readonly Room[];
  readonly open: Set<number>[];
  private readonly walls: [V2, V2][][];
  private readonly packed: Float64Array[];
  private readonly lit: { lamp: PlacedLamp; walls: Float64Array | null }[][];
  private readonly spec: Spec;

  constructor(
    interior: InteriorMap,
    kinds: Map<string, EdgeInfo[]>,
    lamps: readonly PlacedLamp[],
    spec: Spec
  ) {
    this.spec = spec;
    this.rooms = interior.rooms;
    const n = this.rooms.length;
    const idx = new Map(this.rooms.map((r, k) => [r.id, k]));
    this.walls = this.rooms.map((r) => {
      const ks = kinds.get(r.id)!;
      const out: [V2, V2][] = [];
      r.outline.forEach((a, i) => {
        if (ks[i].kind === "wall")
          out.push([a, r.outline[(i + 1) % r.outline.length]]);
      });
      return out;
    });
    this.packed = this.walls.map(wallArray);
    // Open to each other: a seam, or edges beside each other that are
    // not walls (a balustrade, an open edge).
    this.open = this.rooms.map((_, k) => new Set([k]));
    // Through a doorway the walls round it can hide a lamp; across a
    // stair or the well nothing does.
    const doorway = this.rooms.map(() => new Set<number>());
    for (const s of interior.seams) {
      const a = idx.get(s.a);
      const b = idx.get(s.b);
      if (a === undefined || b === undefined) continue;
      if (
        !STAIR_KINDS.has(this.rooms[a].kind) &&
        !STAIR_KINDS.has(this.rooms[b].kind)
      ) {
        doorway[a].add(b);
        doorway[b].add(a);
      }
      this.open[a].add(b);
      this.open[b].add(a);
    }
    for (let i = 0; i < n; i += 1)
      for (let j = i + 1; j < n; j += 1) {
        const A = this.rooms[i];
        const B = this.rooms[j];
        if (A.zone !== B.zone) continue;
        if (openBetween(A, B, kinds) || openBetween(B, A, kinds)) {
          this.open[i].add(j);
          this.open[j].add(i);
        }
      }
    // Each room's lamps: its own and its open neighbours' (each once,
    // with the walls to test for a lamp in another room), and the dome's,
    // which light every room of its zone.
    this.lit = this.rooms.map((r, k) => {
      const list: { lamp: PlacedLamp; walls: Float64Array | null }[] = [];
      for (const l of lamps) {
        if (l.wide) {
          if (this.rooms[l.room].zone === r.zone)
            list.push({ lamp: l, walls: null });
        } else if (l.room === k) list.push({ lamp: l, walls: null });
        else if (this.open[k].has(l.room))
          list.push({
            lamp: l,
            walls: doorway[k].has(l.room)
              ? wallArray([...this.walls[k], ...this.walls[l.room]])
              : null,
          });
      }
      return list;
    });
  }

  /**
   * Each vertex's light (`aLight`) for one layer's builder, from `ambient`
   * up (her emergency light starts from nothing).
   */
  bake(b: Builder, shell: boolean, ambient = AMBIENT): Float32Array {
    const count = b.pos.length / 3;
    const out = new Float32Array(count);
    const spec = this.spec;
    // A piece is small: lit once per 0.3 m cell (its facing evened out),
    // not per vertex. Room surfaces and pieces keep their own caches.
    const surfaces = new Map<number, number>();
    const pieces = new Map<number, number>();
    for (let v = 0; v < count; v += 1) {
      // The shell's room surfaces (not the pieces painted in it).
      const room = shell && b.piece[v] === 0;
      const cache = room ? surfaces : pieces;
      // Back to the ship frame.
      const x = b.pos[v * 3];
      const z = b.pos[v * 3 + 1];
      const y = -b.pos[v * 3 + 2];
      const k = b.room[v];
      // A room surface's point repeats in up to six triangles: lit once
      // per place (2 cm) and facing (its main axis).
      const key = room
        ? (((k * 32768 + Math.round(x * 50 + 15000)) * 8192 +
            Math.round(y * 50 + 4000)) *
            8192 +
            Math.round(z * 50 + 4000)) *
            8 +
          axisCode(b.nrm[v * 3], b.nrm[v * 3 + 1], b.nrm[v * 3 + 2])
        : ((k * 4096 + Math.floor((x + 600) / 0.3)) * 4096 +
            Math.floor((y + 600) / 0.3)) *
            4096 +
          Math.floor((z + 600) / 0.3);
      const had = cache.get(key);
      if (had !== undefined) {
        out[v] = had;
        continue;
      }
      // Pieces: as if facing every lamp half way.
      const nx = room ? b.nrm[v * 3] : 0;
      const nz = room ? b.nrm[v * 3 + 1] : 0;
      const ny = room ? -b.nrm[v * 3 + 2] : 0;
      const r = this.rooms[k];
      let light = ambient;
      const list = this.lit[k];
      for (let li = 0; li < list.length; li += 1) {
        const l = list[li].lamp;
        const walls = list[li].walls;
        const lx = l.p[0] - x;
        const ly = l.p[1] - y;
        const lz = l.p[2] - z;
        const d2 = lx * lx + ly * ly + lz * lz;
        const reach2 = l.radius * l.radius * REACH2;
        if (d2 >= reach2) continue;
        const d = Math.sqrt(d2);
        const facing = !room
          ? 0.55
          : d > 1e-4
            ? (nx * lx + ny * ly + nz * lz) / d
            : 1;
        if (facing < -0.05) continue;
        if (walls) {
          // Not through a wall of either room.
          if (blockedBy(walls, x + nx * 0.03, y + ny * 0.03, l.p[0], l.p[1]))
            continue;
        }
        // 1 / (1 + (d / r)²), eased to nothing at REACH radii.
        const w = 1 - d2 / reach2;
        const fall = (w * w) / (1 + d2 / (l.radius * l.radius));
        light += l.intensity * fall * (0.3 + 0.7 * Math.max(0, facing));
      }
      if (room) {
        // Into the corners: near another wall (in plan), and toward the
        // floor on a wall.
        let dw2 = 0.49;
        const w = this.packed[k];
        for (let i = 0; i < w.length; i += 4) {
          const ax = w[i];
          const ay = w[i + 1];
          const dx = w[i + 2] - ax;
          const dy = w[i + 3] - ay;
          const l2 = dx * dx + dy * dy;
          let t = l2 > 0 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = x - ax - dx * t;
          const ey = y - ay - dy * t;
          const d2 = ex * ex + ey * ey;
          if (d2 > 0.0025 && d2 < dw2) dw2 = d2;
        }
        const near = Math.min(1, Math.sqrt(dw2) / 0.7);
        let ao = 0.68 + 0.32 * near * (2 - near);
        if (Math.abs(nz) < 0.5) {
          const h = z - roomFloorZ(r, x, y, spec);
          const t = Math.min(1, Math.max(0, h / 0.9));
          ao *= 0.72 + 0.28 * t;
        }
        light *= ao;
      }
      out[v] = Math.min(LIGHT_MAX, light);
      cache.set(key, out[v]);
    }
    return out;
  }
}

/** A normal's main axis and its sign (0..5). */
function axisCode(x: number, y: number, z: number): number {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  if (ax >= ay && ax >= az) return x > 0 ? 0 : 1;
  if (ay >= az) return y > 0 ? 2 : 3;
  return z > 0 ? 4 : 5;
}

/** Whether room A has an edge that is not a wall beside an edge of B. */
function openBetween(
  A: Room,
  B: Room,
  kinds: Map<string, EdgeInfo[]>
): boolean {
  const ka = kinds.get(A.id)!;
  const o = A.outline;
  for (let i = 0; i < o.length; i += 1) {
    if (ka[i].kind === "wall") continue;
    const a = o[i];
    const b = o[(i + 1) % o.length];
    const q = B.outline;
    for (let j = 0; j < q.length; j += 1)
      if (alongEdge(a, b, q[j], q[(j + 1) % q.length]) > 0.05) return true;
  }
  return false;
}
