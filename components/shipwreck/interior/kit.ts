import {
  BufferGeometry,
  Float32BufferAttribute,
  ShapeUtils,
  Vector2,
} from "three";
import {
  roomFloorZ,
  type InteriorMap,
  type Room,
} from "@/lib/shipwreck/interior";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { pointInPolygon, type V2 } from "@/lib/shipwreck/walk";

/**
 * The blockout room kit (see README.md): a ship's rooms to one merged
 * `BufferGeometry` per zone, in her part's local frame (three.js axes:
 * ship x, z, −y), vertex-coloured by finish and shaded by face direction
 * so a plain unlit material reads. Floors, walls from the outlines (a seam
 * is open), ceilings, flights as treads and risers on the walker's ramp,
 * balustrades where a room looks over a stair or the well, the slab edges
 * and soffits a stairwell shows, and lintels over doorways. Every face is
 * single-sided, facing into the room it belongs to.
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
/** Each zone's shell stays under this many triangles (the blockout). */
export const ZONE_TRIANGLE_BUDGET = 20000;

type Spec = Pick<ShipSpec, "decks" | "sheerZ">;
type RGB = readonly [number, number, number];
type P3 = readonly [number, number, number];

/** sRGB as picked, to the linear colours the vertex colours are. */
const lin = (r: number, g: number, b: number): RGB => [
  Math.pow(r, 2.2),
  Math.pow(g, 2.2),
  Math.pow(b, 2.2),
];

/** Colours (all under 1, bloom's threshold). */
const WALL: Record<Room["look"]["finish"], RGB> = {
  oak: lin(0.5, 0.31, 0.17),
  "white-panel": lin(0.86, 0.83, 0.74),
  enamel: lin(0.88, 0.88, 0.84),
  steel: lin(0.8, 0.76, 0.6),
};
const FLOOR: Record<Room["look"]["floor"], RGB> = {
  lino: lin(0.55, 0.36, 0.25),
  carpet: lin(0.55, 0.14, 0.12),
  mosaic: lin(0.82, 0.8, 0.72),
  steel: lin(0.45, 0.45, 0.46),
};
const CEILING_WHITE: RGB = lin(0.9, 0.88, 0.82);
const CEILING_STEEL: RGB = lin(0.82, 0.8, 0.7);
const RAIL_OAK: RGB = lin(0.33, 0.18, 0.09);
const RAIL_STEEL: RGB = lin(0.3, 0.3, 0.31);
const SKIRTING: RGB = lin(0.22, 0.13, 0.07);
/** Wall panels: about this long (m), every other one a shade darker. */
const PANEL_M = 2.4;
const SKIRTING_M = 0.18;

/** Face shading: how much light each kind of face gets. */
const SHADE = {
  floor: 0.9,
  riser: 0.6,
  ceiling: 0.55,
  soffit: 0.45,
  wallLow: 0.7,
  panel: 0.86,
};

/** Rooms whose seams are open stair parts (no lintel over them). */
const STAIR_KINDS: ReadonlySet<string> = new Set(["flight", "landing"]);
/** How near two points count as the same (m), as the walker's seams. */
const TOL = 1e-3;
/** A balustrade needs this much open height shared with the room beside (m). */
const RAIL_OPEN_M = 0.3;

const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/** Positions and colours, three.js axes; faces as given (single-sided). */
class Shell {
  readonly pos: number[] = [];
  readonly col: number[] = [];

  /** A triangle of ship-frame points, counter-clockwise seen from its front. */
  tri(a: P3, b: P3, c: P3, ca: RGB, cb: RGB = ca, cc: RGB = ca): void {
    for (const [p, k] of [
      [a, ca],
      [b, cb],
      [c, cc],
    ] as const) {
      this.pos.push(p[0], p[2], -p[1]);
      this.col.push(k[0], k[1], k[2]);
    }
  }

  /** A quad a→b→c→d, counter-clockwise from its front. */
  quad(a: P3, b: P3, c: P3, d: P3, ca: RGB, cb = ca, cc = ca, cd = ca): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }

  geometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    return g;
  }
}

/** An outline with each edge cut into the walls' panels (PANEL_M). */
function refine(outline: readonly V2[]): V2[] {
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
function triangulate(outline: readonly V2[]): [number, number, number][] {
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
function ceilingZ(room: Room, x: number, y: number, spec: Spec): number {
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
  for (const other of rooms) {
    if (other === room) continue;
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
  /** "wall" to the ceiling, "rail" (a balustrade), or "seam" (open). */
  kind: "wall" | "rail" | "seam";
  /** A seam that needs a lintel (a doorway, not a stair's open edge). */
  lintel?: { other: Room };
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
      // (over a stair or the well): a balustrade, not a wall.
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
          if (Math.abs(theirF - mineF) > 0.05 && open > RAIL_OPEN_M)
            return { kind: "rail" };
        }
      }
      return { kind: "wall" };
    });
    out.set(room.id, infos);
  }
  return out;
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
  /** One merged shell per zone (three.js axes, her part's local frame). */
  zones: Map<string, BufferGeometry>;
  /** Each room's zone. */
  roomZone: Map<string, string>;
  /** The zones drawn with each zone (`zonesSeen`). */
  seen: Map<string, ReadonlySet<string>>;
}

/** Builds the blockout shells of a ship's rooms (see the file comment). */
export function buildInterior(
  interior: InteriorMap,
  spec: Spec
): InteriorBuild {
  const shells = new Map<string, Shell>();
  const kinds = edgeKinds(interior, spec);
  for (const room of interior.rooms) {
    let shell = shells.get(room.zone);
    if (!shell) {
      shell = new Shell();
      shells.set(room.zone, shell);
    }
    addRoom(shell, room, interior.rooms, kinds.get(room.id)!, spec);
  }
  const zones = new Map<string, BufferGeometry>();
  for (const [zone, shell] of shells) zones.set(zone, shell.geometry());
  return {
    zones,
    roomZone: new Map(interior.rooms.map((r) => [r.id, r.zone])),
    seen: zonesSeen(interior),
  };
}

function addRoom(
  shell: Shell,
  room: Room,
  rooms: readonly Room[],
  edges: readonly EdgeInfo[],
  spec: Spec
): void {
  const poly = room.outline;
  const steel = room.look.finish === "steel" || room.look.finish === "enamel";
  const wall = WALL[room.look.finish];
  const floor = FLOOR[room.look.floor];
  const ceiling = steel ? CEILING_STEEL : CEILING_WHITE;
  const rail = room.look.finish === "oak" ? RAIL_OAK : RAIL_STEEL;
  const fz = (p: V2) => roomFloorZ(room, p[0], p[1], spec);
  const cz = (p: V2) => ceilingZ(room, p[0], p[1], spec);
  const stairPart = STAIR_KINDS.has(room.kind);
  const ramp = room.ramp;
  const rise = ramp
    ? ramp.dropM / Math.max(1, Math.round(ramp.dropM / RISER_M))
    : 0;
  /** The floor's lowest line at a point: a flight's treads dip a riser. */
  const low = (p: V2) => fz(p) - rise - 0.01;

  // Floors and ceilings follow her sheer as the walls do: their outline
  // gets the walls' panel joints, so no long flat span sags off them.
  const fine = refine(poly);

  // The floor: flat, or a flight's treads and risers.
  if (!ramp) {
    for (const [a, b, c] of triangulate(fine))
      shell.tri(
        [fine[a][0], fine[a][1], fz(fine[a])],
        [fine[b][0], fine[b][1], fz(fine[b])],
        [fine[c][0], fine[c][1], fz(fine[c])],
        scale(floor, SHADE.floor)
      );
  } else {
    const treads = rampTreads(room, spec);
    const tread = scale(floor, SHADE.floor);
    const riser = scale(floor, SHADE.riser);
    for (let k = 0; k < treads.length; k += 1) {
      const [n0, n1, b1, b0] = treads[k];
      // n0 → n1 → b1 → b0 turns which way? Face it up.
      const up =
        (n1[0] - n0[0]) * (b1[1] - n0[1]) - (n1[1] - n0[1]) * (b1[0] - n0[0]);
      if (up > 0) shell.quad(n0, n1, b1, b0, tread);
      else shell.quad(n0, b0, b1, n1, tread);
      // Its riser, at its back: up to the tread above (or the top floor),
      // whose nosing is on the ramp there, one riser up.
      const hi = rise;
      const r0: P3 = [b0[0], b0[1], b0[2]];
      const r1: P3 = [b1[0], b1[1], b1[2]];
      const r2: P3 = [b1[0], b1[1], b1[2] + hi];
      const r3: P3 = [b0[0], b0[1], b0[2] + hi];
      // Facing down the flight (toward its foot).
      const fx = ramp.to[0] - ramp.from[0];
      const fy = ramp.to[1] - ramp.from[1];
      const nX = r1[1] - r0[1];
      const nY = -(r1[0] - r0[0]);
      if (nX * fx + nY * fy > 0) shell.quad(r0, r1, r2, r3, riser);
      else shell.quad(r1, r0, r3, r2, riser);
    }
  }

  // Under a stair or a landing: its soffit, seen from below.
  if (stairPart) {
    const soffit = scale(ceiling, SHADE.soffit);
    for (const [a, b, c] of triangulate(fine)) {
      const pa = fine[a];
      const pb = fine[b];
      const pc = fine[c];
      shell.tri(
        [pa[0], pa[1], low(pa) - SLAB_M],
        [pc[0], pc[1], low(pc) - SLAB_M],
        [pb[0], pb[1], low(pb) - SLAB_M],
        soffit
      );
    }
  }

  // The ceiling, unless a stair or a floor comes down through it.
  const hasCeiling = !ceilingBlocked(room, rooms, spec);
  if (hasCeiling) {
    const c = scale(ceiling, SHADE.ceiling);
    for (const [a, b, d] of triangulate(fine)) {
      const pa = fine[a];
      const pb = fine[b];
      const pd = fine[d];
      shell.tri(
        [pa[0], pa[1], cz(pa)],
        [pd[0], pd[1], cz(pd)],
        [pb[0], pb[1], cz(pb)],
        c
      );
    }
  }

  // The edges: walls, balustrades, lintels.
  for (let i = 0; i < poly.length; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const info = edges[i];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    // Lit by direction: walls facing along x a little brighter than across.
    const facing = 0.78 + 0.2 * Math.abs(dy / len);
    const top = scale(wall, facing);
    const bottom = scale(wall, facing * SHADE.wallLow);
    if (info.kind === "wall") {
      // Floor (a flight's lowest tread) to the ceiling, facing in: in
      // panels (every other a shade darker), on a dark skirting.
      const n = Math.max(1, Math.round(len / PANEL_M));
      const skirt = scale(SKIRTING, facing);
      for (let k = 0; k < n; k += 1) {
        const p: V2 = [a[0] + (dx * k) / n, a[1] + (dy * k) / n];
        const q: V2 = [a[0] + (dx * (k + 1)) / n, a[1] + (dy * (k + 1)) / n];
        const shade = k % 2 === 0 ? 1 : SHADE.panel;
        inward(
          shell,
          p,
          q,
          low(p),
          low(q),
          fz(p) + SKIRTING_M,
          fz(q) + SKIRTING_M,
          skirt,
          skirt
        );
        inward(
          shell,
          p,
          q,
          fz(p) + SKIRTING_M,
          fz(q) + SKIRTING_M,
          cz(p),
          cz(q),
          scale(bottom, shade),
          scale(top, shade)
        );
      }
    } else if (info.kind === "rail") {
      // A balustrade, both faces, and the slab's edge under it (the room
      // below's ceiling edge is this face too: one face, no fighting).
      const r = scale(rail, facing);
      // Its inner face stands RAIL_THICK_M into the room, so it never
      // fights the outer face of the room beside (on the line itself).
      const ix = (-dy / len) * RAIL_THICK_M;
      const iy = (dx / len) * RAIL_THICK_M;
      const ai: V2 = [a[0] + ix, a[1] + iy];
      const bi: V2 = [b[0] + ix, b[1] + iy];
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
      // Its top, across the thickness.
      shell.quad(
        [a[0], a[1], fz(a) + RAIL_M],
        [b[0], b[1], fz(b) + RAIL_M],
        [bi[0], bi[1], fz(b) + RAIL_M],
        [ai[0], ai[1], fz(a) + RAIL_M],
        scale(r, 1.15)
      );
      outward(
        shell,
        a,
        b,
        fz(a) - SLAB_M - rise,
        fz(b) - SLAB_M - rise,
        fz(a) + RAIL_M,
        fz(b) + RAIL_M,
        scale(r, 0.8),
        r
      );
    } else if (info.lintel) {
      // Over a doorway: from the door's head to the higher ceiling.
      const other = info.lintel.other;
      const hiA = Math.max(cz(a), ceilingZ(other, a[0], a[1], spec));
      const hiB = Math.max(cz(b), ceilingZ(other, b[0], b[1], spec));
      const loA = fz(a) + DOOR_HEAD_M;
      const loB = fz(b) + DOOR_HEAD_M;
      if (hiA > loA + 0.01 || hiB > loB + 0.01)
        inward(
          shell,
          a,
          b,
          loA,
          loB,
          Math.max(hiA, loA),
          Math.max(hiB, loB),
          top,
          top
        );
    }
  }
}

/** A vertical quad on edge a→b of a counter-clockwise outline, facing in. */
function inward(
  shell: Shell,
  a: V2,
  b: V2,
  loA: number,
  loB: number,
  hiA: number,
  hiB: number,
  cLow: RGB,
  cHigh: RGB
): void {
  shell.quad(
    [a[0], a[1], loA],
    [a[0], a[1], hiA],
    [b[0], b[1], hiB],
    [b[0], b[1], loB],
    cLow,
    cHigh,
    cHigh,
    cLow
  );
}

/** As `inward`, facing out of the room (seen from the room beyond). */
function outward(
  shell: Shell,
  a: V2,
  b: V2,
  loA: number,
  loB: number,
  hiA: number,
  hiB: number,
  cLow: RGB,
  cHigh: RGB
): void {
  shell.quad(
    [a[0], a[1], loA],
    [b[0], b[1], loB],
    [b[0], b[1], hiB],
    [a[0], a[1], hiA],
    cLow,
    cLow,
    cHigh,
    cHigh
  );
}
