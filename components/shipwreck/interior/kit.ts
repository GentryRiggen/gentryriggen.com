import { ShapeUtils, Vector2, type BufferGeometry } from "three";
import {
  roomFloorZ,
  type Furniture,
  type InteriorMap,
  type Room,
} from "@/lib/shipwreck/interior";
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
  DOME_LX,
  fireBuckets,
  FURNITURE,
  hoseReel,
  DOME_LY,
  Layers,
  LAYERS,
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
  type Lamp,
  type Layer,
  type P3,
  type RGB,
} from "./pieces";

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

type Spec = Pick<ShipSpec, "decks" | "sheerZ">;

/** Colours (all under 1, bloom's threshold: a room never glows). */
const WALL: Record<Room["look"]["finish"], RGB> = {
  oak: lin(0.5, 0.31, 0.17),
  "white-panel": lin(0.86, 0.83, 0.74),
  enamel: lin(0.88, 0.88, 0.84),
  steel: lin(0.8, 0.76, 0.6),
};
const WALL_TILE: Record<Room["look"]["finish"], number> = {
  oak: TILE.oak,
  "white-panel": TILE.white,
  enamel: TILE.none,
  steel: TILE.none,
};
const FLOOR: Record<Room["look"]["floor"], RGB> = {
  lino: lin(0.84, 0.78, 0.66),
  carpet: lin(0.6, 0.12, 0.1),
  mosaic: lin(0.82, 0.8, 0.72),
  steel: lin(0.45, 0.45, 0.46),
};
const FLOOR_TILE: Record<Room["look"]["floor"], number> = {
  lino: TILE.lino,
  carpet: TILE.carpet,
  mosaic: TILE.none,
  steel: TILE.none,
};
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
  ceiling: 0.78,
  soffit: 0.6,
};

/** Rooms whose seams are open stair parts (no lintel over them). */
const STAIR_KINDS: ReadonlySet<string> = new Set(["flight", "landing"]);
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
        const stair = STAIR_KINDS.has(room.kind) || STAIR_KINDS.has(other.kind);
        return stair ? { kind: "seam" } : { kind: "seam", lintel: { other } };
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
      if (prev !== "wall" && next !== "wall") infos[i] = { kind: "rail" };
    });
    out.set(room.id, infos);
  }
  return out;
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

export interface InteriorBuild {
  /** Per zone, its non-empty layers' geometry (three.js axes, her part). */
  zones: Map<string, Partial<Record<Layer, BufferGeometry>>>;
  /** Each room's zone. */
  roomZone: Map<string, string>;
  /** The zones drawn with each zone (`zonesSeen`). */
  seen: Map<string, ReadonlySet<string>>;
  /** Each room's slot (its index in the map: `aRoom`, the water's). */
  slot: Map<string, number>;
  /**
   * Per slot, the point whose water puts the room's lamps out, in her
   * part's local frame (three.js axes, x y z): its floor's middle, or a
   * flight's head (its lamps are at the top).
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
export function buildInterior(
  interior: InteriorMap,
  spec: Spec
): InteriorBuild {
  const t0 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const rooms = interior.rooms;
  const slot = new Map(rooms.map((r, k) => [r.id, k]));
  const kinds = edgeKinds(interior, spec);
  const zoneLayers = new Map<string, Layers>();
  const layersOf = (zone: string) => {
    let L = zoneLayers.get(zone);
    if (!L) {
      L = new Layers();
      zoneLayers.set(zone, L);
    }
    return L;
  };
  const lamps: PlacedLamp[] = [];
  const domes = interior.furniture.filter((f) => f.piece === "dome");

  rooms.forEach((room, k) => {
    const L = layersOf(room.zone);
    L.room(k);
    addRoom(
      L,
      room,
      rooms,
      kinds.get(room.id)!,
      spec,
      underDome(room, domes, rooms, spec)
    );
  });
  // The furniture, and its lamps.
  const byId = new Map(rooms.map((r) => [r.id, r]));
  for (const f of interior.furniture) {
    const room = byId.get(f.room);
    if (!room) continue;
    const k = slot.get(f.room)!;
    const L = layersOf(room.zone);
    L.room(k);
    const got = addPiece(L, f, room, spec);
    for (const l of got)
      lamps.push({ ...l, room: k, wide: f.piece === "dome" });
  }
  for (const d of interior.shutDoors) {
    const room = byId.get(d.room);
    if (!room) continue;
    const L = layersOf(room.zone);
    L.room(slot.get(d.room)!);
    const z = roomFloorZ(room, d.at[0], d.at[1], spec);
    shutDoor(L, [d.at[0], d.at[1], z], d.facing, d.style);
  }
  // Rooms with no lamp of their own get ceiling lamps (and the foyers
  // more, over the floor).
  rooms.forEach((room, k) => {
    if (STAIR_KINDS.has(room.kind)) return;
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
  const zones = new Map<string, Partial<Record<Layer, BufferGeometry>>>();
  const triangles = new Map<string, number>();
  for (const [zone, L] of zoneLayers) {
    const out: Partial<Record<Layer, BufferGeometry>> = {};
    LAYERS.forEach((layer, i) => {
      const b = L.all[i];
      if (b.triangles === 0) return;
      out[layer] = b.geometry(light.bake(b, layer === "shell"));
    });
    zones.set(zone, out);
    triangles.set(zone, L.triangles);
  }
  // Each room's lowest floor point, in her part's frame (three axes).
  const floors = new Float32Array(rooms.length * 3);
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

  const t1 =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  return {
    zones,
    roomZone: new Map(rooms.map((r) => [r.id, r.zone])),
    seen: zonesSeen(interior),
    slot,
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
      // Beds, bunks, wardrobes, washstands, sofas, tables, chairs.
      const build = FURNITURE[f.piece];
      return build ? build(L, floor, f.yaw) : [];
    }
  }
}

/** Ship-frame point. */
const P = (p: V2, z: number): P3 => [p[0], p[1], z];

function addRoom(
  L: Layers,
  room: Room,
  rooms: readonly Room[],
  edges: readonly EdgeInfo[],
  spec: Spec,
  domed: boolean
): void {
  const shell = L.shell;
  const poly = room.outline;
  const steel = room.look.finish === "steel" || room.look.finish === "enamel";
  const oak = room.look.finish === "oak";
  const wall = WALL[room.look.finish];
  const floor = FLOOR[room.look.floor];
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
  // dome stands over it.
  if (!domed && !ceilingBlocked(room, rooms, spec)) {
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
      shell.tileId = WALL_TILE[room.look.finish];
      const n = Math.max(1, Math.ceil(len / COLUMN_M));
      for (let k = 0; k < n; k += 1) {
        const p: V2 = [a[0] + (dx * k) / n, a[1] + (dy * k) / n];
        const q: V2 = [a[0] + (dx * (k + 1)) / n, a[1] + (dy * (k + 1)) / n];
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
          steel ? scale(wall, 0.55) : SKIRTING,
          steel ? scale(wall, 0.55) : SKIRTING
        );
        shell.tileId = t;
        // Rows: dado, the panels, up to the cove.
        const rows = [SKIRTING_M, 1.0, 2.0];
        const top = (v: V2) => cz(v) - COVE_M;
        for (let r = 0; r < rows.length; r += 1) {
          const lo = (v: V2) => Math.min(fz(v) + rows[r], top(v));
          const hi = (v: V2) =>
            r + 1 < rows.length
              ? Math.min(fz(v) + rows[r + 1], top(v))
              : top(v);
          if (hi(p) - lo(p) < 0.005 && hi(q) - lo(q) < 0.005) continue;
          inward(shell, p, q, lo(p), lo(q), hi(p), hi(q), wall, wall);
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
      shell.quad(
        P(a, fz(a) + SKIRTING_M),
        P(b, fz(b) + SKIRTING_M),
        P([b[0] + nx * 0.02, b[1] + ny * 0.02], fz(b) + SKIRTING_M),
        P([a[0] + nx * 0.02, a[1] + ny * 0.02], fz(a) + SKIRTING_M),
        oak ? COLOR.oakDark : scale(wall, 0.9)
      );
      shell.tileId = TILE.none;
    } else if (info.kind === "rail") {
      if (oak) {
        // An oak balustrade with iron balusters, open between them.
        balustrade(L, P(a, fz(a)), P(b, fz(b)), RAIL_THICK_M);
        L.room(L.shell.slot);
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
      const fascia = oak ? COLOR.oakDark : scale(RAIL_STEEL, 0.8);
      const loA = Math.min(
        fz(a) - SLAB_M - rise,
        info.cheek ? info.cheek[0] : Infinity
      );
      const loB = Math.min(
        fz(b) - SLAB_M - rise,
        info.cheek ? info.cheek[1] : Infinity
      );
      shell.tileId = oak ? TILE.oak : TILE.none;
      outward(shell, a, b, loA, loB, fz(a), fz(b), fascia, fascia);
      shell.tileId = TILE.none;
    } else if (info.lintel) {
      // Over a doorway: from the door's head to the higher ceiling.
      const other = info.lintel.other;
      const hiA = Math.max(cz(a), ceilingZ(other, a[0], a[1], spec));
      const hiB = Math.max(cz(b), ceilingZ(other, b[0], b[1], spec));
      const loA = fz(a) + DOOR_HEAD_M;
      const loB = fz(b) + DOOR_HEAD_M;
      if (hiA > loA + 0.01 || hiB > loB + 0.01) {
        shell.tileId = WALL_TILE[room.look.finish];
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
    }
  }
}

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
const AMBIENT = 0.13;
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

  /** Each vertex's light (`aLight`) for one layer's builder. */
  bake(b: Builder, room: boolean): Float32Array {
    const count = b.pos.length / 3;
    const out = new Float32Array(count);
    const spec = this.spec;
    // A piece is small: lit once per 0.3 m cell (its facing evened out),
    // not per vertex.
    const cache = new Map<number, number>();
    for (let v = 0; v < count; v += 1) {
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
      let light = AMBIENT;
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
