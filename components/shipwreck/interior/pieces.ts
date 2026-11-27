import { BufferGeometry, Float32BufferAttribute } from "three";
import type { PieceId } from "@/lib/shipwreck/interior";

/**
 * The room kit's pieces (README.md "The look"): a geometry builder that
 * writes everything the room shader needs per vertex, and small builders
 * for the Grand Staircase's dressing and the lamps, doors and portholes
 * every room shares. Low poly with good proportions: realism of look over
 * fidelity.
 *
 * Every piece is built in its own frame (x out of the wall it stands on,
 * or the way it faces; y to its left; z up; the origin on the floor, or the
 * wall's foot) and placed with `Layers.place(origin, yaw)`. It writes into
 * the four layers of its zone (one mesh each): `shell` (room surfaces and
 * painted pieces), `wood` (varnished oak), `metal` (brass, bronze, iron)
 * and `glass` (lamps and the dome, HDR so bloom catches them, and
 * portholes). It returns the lamps it holds, for the baked light.
 */

export type RGB = readonly [number, number, number];
export type P3 = readonly [number, number, number];

/** The four meshes of a zone, in draw order. */
export const LAYERS = ["shell", "wood", "metal", "glass"] as const;
export type Layer = (typeof LAYERS)[number];

/**
 * The detail each face samples (`aTile`): the detail texture's channels
 * (textures.ts) and, on glass, what the pane shows.
 */
export const TILE = {
  none: 0,
  /** Oak panelling: raised panels in frames, with grain (channel R). */
  oak: 1,
  /** Oak grain only, for turned and moulded pieces (G). */
  grain: 2,
  /** Lino tiles (B). */
  lino: 3,
  /** Carpet (A). */
  carpet: 4,
  /** White painted panelling (R, faint). */
  white: 5,
  /** Glass: a porthole, showing the sky or the sea. */
  porthole: 6,
  /** Glass: the dome's panes in their iron lattice. */
  dome: 7,
} as const;

/** The detail texture's repeat (m): one tile of every channel. */
export const DETAIL_M = 1.2;

/** sRGB as picked, to the linear colours the vertex colours are. */
export const lin = (r: number, g: number, b: number): RGB => [
  Math.pow(r, 2.2),
  Math.pow(g, 2.2),
  Math.pow(b, 2.2),
];
export const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

export const COLOR = {
  oak: lin(0.52, 0.32, 0.17),
  oakDark: lin(0.36, 0.2, 0.1),
  brass: lin(0.8, 0.62, 0.3),
  gilt: lin(0.86, 0.7, 0.38),
  bronze: lin(0.42, 0.3, 0.17),
  iron: lin(0.13, 0.13, 0.14),
  white: lin(0.88, 0.86, 0.8),
  steel: lin(0.62, 0.62, 0.58),
  velvet: lin(0.55, 0.06, 0.08),
  /** A lamp's glass (times its glow: over 1, so it blooms). */
  lamp: lin(1.0, 0.86, 0.62),
  /** The dome's panes, lit from above at night. */
  domeGlass: lin(0.95, 0.88, 0.72),
  clockFace: lin(0.92, 0.88, 0.76),
  /** Bed linen, pillows. */
  sheet: lin(0.93, 0.92, 0.88),
  /** The brass bed's eiderdown, the twin beds' coverlets. */
  rose: lin(0.66, 0.24, 0.28),
  coverlet: lin(0.36, 0.5, 0.62),
  /** Third class: a warm wool blanket with dark stripes. */
  blanket: lin(0.6, 0.24, 0.16),
  stripe: lin(0.24, 0.12, 0.09),
  /** Painted steel bunk frames (white enamel). */
  bunkFrame: lin(0.86, 0.86, 0.82),
  ticking: lin(0.8, 0.8, 0.74),
  green: lin(0.24, 0.42, 0.3),
  marble: lin(0.9, 0.89, 0.86),
  enamel: lin(0.94, 0.94, 0.92),
  mirror: lin(0.58, 0.66, 0.72),
  fireRed: lin(0.8, 0.13, 0.09),
  canvas: lin(0.82, 0.74, 0.56),
  lagging: lin(0.86, 0.84, 0.76),
  copper: lin(0.62, 0.32, 0.18),
  pipeGrey: lin(0.46, 0.47, 0.47),
  flowers: lin(0.92, 0.5, 0.62),
  leaf: lin(0.3, 0.52, 0.28),
} as const;

/** A lamp for the baked light: ship frame, its strength and reach (m). */
export interface Lamp {
  p: P3;
  intensity: number;
  radius: number;
}

/** Positions (three.js axes), normals, colours, uvs and tags of one mesh. */
export class Builder {
  /** Three.js axes (ship x, z, −y). */
  readonly pos: number[] = [];
  readonly nrm: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  readonly tile: number[] = [];
  readonly room: number[] = [];
  readonly glow: number[] = [];
  /** 1 where a vertex is a piece's, not a room surface (the light bake). */
  readonly piece: number[] = [];
  /** The current room's slot (`aRoom`), tile and glow. */
  slot = 0;
  tileId: number = TILE.none;
  glowV = 0;
  /** What follows is a piece (lit as one, not as a wall or floor). */
  pieceV = 0;
  /** Wall uvs measure height from here (ship z): panels start at the floor. */
  vBase = 0;
  /** Own uvs instead (local point, the triangle's local centroid). */
  uvFn: ((p: P3, centroid: P3) => readonly [number, number]) | null = null;
  // The placement: origin and yaw (local → ship frame).
  private ox = 0;
  private oy = 0;
  private oz = 0;
  private c = 1;
  private s = 0;

  get triangles(): number {
    return this.pos.length / 9;
  }

  place(origin: P3 | null, yaw = 0): void {
    this.ox = origin ? origin[0] : 0;
    this.oy = origin ? origin[1] : 0;
    this.oz = origin ? origin[2] : 0;
    this.c = Math.cos(yaw);
    this.s = Math.sin(yaw);
  }

  /** A local point to the ship frame. */
  ship(p: P3): P3 {
    return [
      this.ox + p[0] * this.c - p[1] * this.s,
      this.oy + p[0] * this.s + p[1] * this.c,
      this.oz + p[2],
    ];
  }

  /** A triangle (local points), counter-clockwise seen from its front. */
  tri(a: P3, b: P3, c: P3, ca: RGB, cb: RGB = ca, cc: RGB = ca): void {
    const co = this.c;
    const si = this.s;
    // To the ship frame (no arrays: this runs for every triangle).
    const ax = this.ox + a[0] * co - a[1] * si;
    const ay = this.oy + a[0] * si + a[1] * co;
    const az = this.oz + a[2];
    const bx = this.ox + b[0] * co - b[1] * si;
    const by = this.oy + b[0] * si + b[1] * co;
    const bz = this.oz + b[2];
    const cx = this.ox + c[0] * co - c[1] * si;
    const cy = this.oy + c[0] * si + c[1] * co;
    const cz = this.oz + c[2];
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    if (!(len > 1e-12)) return; // degenerate: nothing to draw
    nx /= len;
    ny /= len;
    nz /= len;
    // Planar uvs (in detail tiles): floors and ceilings by plan, walls
    // along their run and up from vBase.
    const flat = Math.abs(nz) > 0.7;
    const hl = Math.sqrt(nx * nx + ny * ny) || 1;
    const tx = -ny / hl;
    const ty = nx / hl;
    const fn = this.uvFn;
    const cen: P3 | null = fn
      ? [
          (a[0] + b[0] + c[0]) / 3,
          (a[1] + b[1] + c[1]) / 3,
          (a[2] + b[2] + c[2]) / 3,
        ]
      : null;
    this.vert(
      ax,
      ay,
      az,
      nx,
      ny,
      nz,
      ca,
      flat,
      tx,
      ty,
      fn ? fn(a, cen!) : null
    );
    this.vert(
      bx,
      by,
      bz,
      nx,
      ny,
      nz,
      cb,
      flat,
      tx,
      ty,
      fn ? fn(b, cen!) : null
    );
    this.vert(
      cx,
      cy,
      cz,
      nx,
      ny,
      nz,
      cc,
      flat,
      tx,
      ty,
      fn ? fn(c, cen!) : null
    );
  }

  private vert(
    x: number,
    y: number,
    z: number,
    nx: number,
    ny: number,
    nz: number,
    k: RGB,
    flat: boolean,
    tx: number,
    ty: number,
    uv: readonly [number, number] | null
  ): void {
    this.pos.push(x, z, -y);
    this.nrm.push(nx, nz, -ny);
    // Under 1 (bloom's threshold): glass glows by its aGlow only.
    this.col.push(
      Math.min(k[0], 0.98),
      Math.min(k[1], 0.98),
      Math.min(k[2], 0.98)
    );
    if (uv) this.uv.push(uv[0], uv[1]);
    else if (flat) this.uv.push(x / DETAIL_M, y / DETAIL_M);
    else
      this.uv.push((x * tx + y * ty) / DETAIL_M, (z - this.vBase) / DETAIL_M);
    this.tile.push(this.tileId);
    this.room.push(this.slot);
    this.glow.push(this.glowV);
    this.piece.push(this.pieceV);
  }

  /** A quad a→b→c→d, counter-clockwise from its front. */
  quad(a: P3, b: P3, c: P3, d: P3, ca: RGB, cb = ca, cc = ca, cd = ca): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }

  /**
   * A box centred at `c` (local), lx × ly × lz, its faces outward; `skip`
   * leaves out faces never seen ("bottom", "back": −x).
   */
  box(
    c: P3,
    lx: number,
    ly: number,
    lz: number,
    color: RGB,
    skip: { bottom?: boolean; back?: boolean; top?: boolean } = {}
  ): void {
    const x0 = c[0] - lx / 2;
    const x1 = c[0] + lx / 2;
    const y0 = c[1] - ly / 2;
    const y1 = c[1] + ly / 2;
    const z0 = c[2] - lz / 2;
    const z1 = c[2] + lz / 2;
    const side = scale(color, 0.86);
    const low = scale(color, 0.7);
    // +x (front), −x (back), +y, −y, top, bottom.
    this.quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], color);
    if (!skip.back)
      this.quad([x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1], side);
    this.quad([x1, y1, z0], [x0, y1, z0], [x0, y1, z1], [x1, y1, z1], side);
    this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], side);
    if (!skip.top)
      this.quad(
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
        scale(color, 1.08)
      );
    if (!skip.bottom)
      this.quad([x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [x0, y0, z0], low);
  }

  /**
   * A beam from p to q (local), `w` wide and `h` tall, square to the
   * horizontal (a handrail, a sloping string), four sides and both ends.
   */
  beam(p: P3, q: P3, w: number, h: number, color: RGB, ends = true): void {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const dz = q[2] - p[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    const hl = Math.hypot(dx, dy);
    // Sideways (horizontal, left of the run) and "up" (run × side: up for
    // a level run, across for an upright one).
    const sx = hl > 1e-6 ? -dy / hl : 1;
    const sy = hl > 1e-6 ? dx / hl : 0;
    const ux = ((dy * 0 - dz * sy) / dl) * (h / 2);
    const uy = ((dz * sx - dx * 0) / dl) * (h / 2);
    const uz = ((dx * sy - dy * sx) / dl) * (h / 2);
    const at = (o: P3, a: number, b: number): P3 => [
      o[0] + sx * (w / 2) * a + ux * b,
      o[1] + sy * (w / 2) * a + uy * b,
      o[2] + uz * b,
    ];
    const side = scale(color, 0.82);
    // Top, left, bottom, right (each counter-clockwise from outside).
    this.quad(at(p, -1, 1), at(q, -1, 1), at(q, 1, 1), at(p, 1, 1), color);
    this.quad(at(p, 1, 1), at(q, 1, 1), at(q, 1, -1), at(p, 1, -1), side);
    this.quad(
      at(p, 1, -1),
      at(q, 1, -1),
      at(q, -1, -1),
      at(p, -1, -1),
      scale(color, 0.6)
    );
    this.quad(at(p, -1, -1), at(q, -1, -1), at(q, -1, 1), at(p, -1, 1), side);
    if (ends) {
      this.quad(at(p, 1, 1), at(p, 1, -1), at(p, -1, -1), at(p, -1, 1), side);
      this.quad(at(q, -1, 1), at(q, -1, -1), at(q, 1, -1), at(q, 1, 1), side);
    }
  }

  /** An upright cylinder (or cone) on `base`, `n` sides, outward faces. */
  cyl(
    base: P3,
    r0: number,
    r1: number,
    h: number,
    n: number,
    color: RGB,
    caps = true
  ): void {
    const ring = (r: number, z: number, i: number): P3 => {
      const a = (i / n) * Math.PI * 2;
      return [base[0] + r * Math.cos(a), base[1] + r * Math.sin(a), z];
    };
    const z0 = base[2];
    const z1 = base[2] + h;
    for (let i = 0; i < n; i += 1) {
      const shade = scale(
        color,
        0.78 + 0.22 * Math.abs(Math.cos(((i + 0.5) / n) * Math.PI * 2 - 0.6))
      );
      this.quad(
        ring(r0, z0, i),
        ring(r0, z0, i + 1),
        ring(r1, z1, i + 1),
        ring(r1, z1, i),
        shade
      );
      if (caps && r1 > 0)
        this.tri(
          [base[0], base[1], z1],
          ring(r1, z1, i),
          ring(r1, z1, i + 1),
          scale(color, 1.08)
        );
      if (caps && r0 > 0)
        this.tri(
          [base[0], base[1], z0],
          ring(r0, z0, i + 1),
          ring(r0, z0, i),
          scale(color, 0.6)
        );
    }
  }

  /**
   * A tube from p to q (local, any direction), radius r, `n` sides,
   * outward faces; `caps` closes both ends.
   */
  tube(p: P3, q: P3, r: number, n: number, color: RGB, caps = false): void {
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const dz = q[2] - p[2];
    const dl = Math.hypot(dx, dy, dz);
    if (!(dl > 1e-6)) return;
    const d: P3 = [dx / dl, dy / dl, dz / dl];
    // u ⟂ d (from a helper axis not along d), v = d × u: (u, v, d) is
    // right-handed, as (x, y, z) for `cyl`, so the same winding is out.
    const h: P3 = Math.abs(d[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
    let ux = d[1] * h[2] - d[2] * h[1];
    let uy = d[2] * h[0] - d[0] * h[2];
    let uz = d[0] * h[1] - d[1] * h[0];
    const ul = Math.hypot(ux, uy, uz);
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const vx = d[1] * uz - d[2] * uy;
    const vy = d[2] * ux - d[0] * uz;
    const vz = d[0] * uy - d[1] * ux;
    const ring = (o: P3, i: number): P3 => {
      const a = (i / n) * Math.PI * 2;
      const c = Math.cos(a) * r;
      const s = Math.sin(a) * r;
      return [
        o[0] + ux * c + vx * s,
        o[1] + uy * c + vy * s,
        o[2] + uz * c + vz * s,
      ];
    };
    for (let i = 0; i < n; i += 1) {
      const shade = scale(
        color,
        0.78 + 0.22 * Math.abs(Math.cos(((i + 0.5) / n) * Math.PI * 2 - 0.6))
      );
      this.quad(ring(p, i), ring(p, i + 1), ring(q, i + 1), ring(q, i), shade);
      if (caps) {
        this.tri(q, ring(q, i), ring(q, i + 1), scale(color, 1.04));
        this.tri(p, ring(p, i + 1), ring(p, i), scale(color, 0.8));
      }
    }
  }

  /** A small ball (an octahedron, stretched): finials, heads, bulbs. */
  ball(c: P3, r: number, color: RGB, rz = r): void {
    const top: P3 = [c[0], c[1], c[2] + rz];
    const bot: P3 = [c[0], c[1], c[2] - rz];
    const n = 6;
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      const p: P3 = [c[0] + r * Math.cos(a0), c[1] + r * Math.sin(a0), c[2]];
      const q: P3 = [c[0] + r * Math.cos(a1), c[1] + r * Math.sin(a1), c[2]];
      this.tri(p, q, top, scale(color, 1.05));
      this.tri(q, p, bot, scale(color, 0.7));
    }
  }

  geometry(light?: Float32Array): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.col, 3));
    g.setAttribute("uv", new Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aTile", new Float32BufferAttribute(this.tile, 1));
    g.setAttribute("aRoom", new Float32BufferAttribute(this.room, 1));
    g.setAttribute("aGlow", new Float32BufferAttribute(this.glow, 1));
    g.setAttribute(
      "aLight",
      light
        ? new Float32BufferAttribute(light, 1)
        : new Float32BufferAttribute(
            new Float32Array(this.pos.length / 3).fill(1),
            1
          )
    );
    return g;
  }
}

/** A zone's four layers, placed and tagged together. */
export class Layers {
  readonly shell = new Builder();
  readonly wood = new Builder();
  readonly metal = new Builder();
  readonly glass = new Builder();

  get all(): readonly Builder[] {
    return [this.shell, this.wood, this.metal, this.glass];
  }

  place(origin: P3 | null, yaw = 0): void {
    for (const b of this.all) b.place(origin, yaw);
  }

  /** Marks what follows as a piece (1) or a room surface (0). */
  pieces(on: boolean): void {
    for (const b of this.all) b.pieceV = on ? 1 : 0;
  }

  /** Tags what follows with a room's slot (its lamps' power). */
  room(slot: number): void {
    for (const b of this.all) b.slot = slot;
  }

  get triangles(): number {
    let n = 0;
    for (const b of this.all) n += b.triangles;
    return n;
  }
}

/** Runs `fn` with the layers placed at origin/yaw, then resets them. */
function placed<T>(L: Layers, origin: P3, yaw: number, fn: () => T): T {
  L.place(origin, yaw);
  try {
    return fn();
  } finally {
    L.place(null);
  }
}

/** Glass that glows: HDR (colour × glow over 1, so bloom catches it). */
function lit(L: Layers, glow: number, fn: (g: Builder) => void): void {
  const g = L.glass;
  const was = g.glowV;
  const tile = g.tileId;
  g.glowV = glow;
  g.tileId = TILE.none;
  fn(g);
  g.glowV = was;
  g.tileId = tile;
}

function grain(b: Builder, fn: () => void): void {
  const t = b.tileId;
  b.tileId = TILE.grain;
  fn();
  b.tileId = t;
}

// --- Lamps -------------------------------------------------------------------

/** Height of a wall sconce's shade over the floor (m). */
export const SCONCE_Z = 1.95;

/** A brass wall sconce, two tulip shades. Origin: the wall at the floor. */
export function sconce(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    L.metal.box([0.015, 0, SCONCE_Z - 0.05], 0.03, 0.12, 0.26, COLOR.brass, {
      back: true,
    });
    for (const side of [-1, 1]) {
      L.metal.beam(
        [0.03, 0, SCONCE_Z - 0.1],
        [0.14, side * 0.13, SCONCE_Z - 0.04],
        0.02,
        0.02,
        COLOR.brass
      );
      lit(L, 2.6, (g) =>
        g.cyl(
          [0.15, side * 0.14, SCONCE_Z - 0.06],
          0.03,
          0.065,
          0.12,
          6,
          COLOR.lamp
        )
      );
    }
  });
  return [
    {
      p: placedPoint(at, yaw, [0.25, 0, SCONCE_Z]),
      intensity: 1.15,
      radius: 2.6,
    },
  ];
}

/** A local point placed (pure, without a builder). */
function placedPoint(at: P3, yaw: number, p: P3): P3 {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [
    at[0] + p[0] * c - p[1] * s,
    at[1] + p[0] * s + p[1] * c,
    at[2] + p[2],
  ];
}

/** A caged working bulb under a ceiling. Origin: the ceiling point. */
export function cagedBulb(L: Layers, at: P3): Lamp[] {
  placed(L, at, 0, () => {
    L.metal.cyl([0, 0, -0.05], 0.09, 0.09, 0.05, 6, COLOR.iron);
    lit(L, 3.2, (g) => g.ball([0, 0, -0.17], 0.055, COLOR.lamp, 0.075));
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const x = Math.cos(a) * 0.085;
      const y = Math.sin(a) * 0.085;
      L.metal.beam(
        [x, y, -0.05],
        [x * 0.7, y * 0.7, -0.27],
        0.012,
        0.012,
        COLOR.iron,
        false
      );
    }
    L.metal.cyl([0, 0, -0.29], 0.06, 0.06, 0.02, 6, COLOR.iron);
  });
  return [{ p: [at[0], at[1], at[2] - 0.3], intensity: 1.25, radius: 3.4 }];
}

/** A brass ceiling lamp with a glass bowl. Origin: the ceiling point. */
export function ceilingLamp(L: Layers, at: P3): Lamp[] {
  placed(L, at, 0, () => {
    L.metal.cyl([0, 0, -0.04], 0.11, 0.11, 0.04, 8, COLOR.brass);
    L.metal.cyl([0, 0, -0.2], 0.012, 0.012, 0.16, 4, COLOR.brass, false);
    lit(L, 1.9, (g) => g.cyl([0, 0, -0.34], 0.1, 0.24, 0.14, 8, COLOR.lamp));
    L.metal.cyl([0, 0, -0.21], 0.245, 0.25, 0.015, 8, COLOR.gilt, false);
  });
  return [{ p: [at[0], at[1], at[2] - 0.4], intensity: 1.15, radius: 2.5 }];
}

// --- The Grand Staircase -----------------------------------------------------

/** The dome's plan over the well (m): x by y, and its rise. */
export const DOME_LX = 6.4;
export const DOME_LY = 6.0;
export const DOME_RISE_M = 1.7;
/** The dome's ceiling ring reaches this far past the well (m). */
const RING_OVER_M = 0.12;

/**
 * The glass dome over the well, its panes in an iron lattice (drawn in
 * the glass shader), lit from above at night; a gilt ring at its foot, the
 * ceiling cove from the well's corners to the ring, and the chandelier
 * hanging under it. Origin: the well's centre at the ceiling's height.
 */
export function dome(L: Layers, at: P3): Lamp[] {
  const RX = DOME_LX / 2;
  const RY = DOME_LY / 2;
  const SEG = 24;
  const RINGS = 6;
  placed(L, at, 0, () => {
    // The ceiling round it: from the well's rectangle in to the ellipse
    // (inset a little), facing down.
    const ex = RX * 0.94;
    const ey = RY * 0.94;
    const ceiling = scale(COLOR.white, 0.62);
    for (let i = 0; i < SEG; i += 1) {
      const a0 = (i / SEG) * Math.PI * 2;
      const a1 = ((i + 1) / SEG) * Math.PI * 2;
      const e0: P3 = [ex * Math.cos(a0), ey * Math.sin(a0), 0];
      const e1: P3 = [ex * Math.cos(a1), ey * Math.sin(a1), 0];
      // Out past the well's edge and a hair above the ceiling round it,
      // so no crack shows where the two meet.
      const r0 = toRect(a0, RX + RING_OVER_M, RY + RING_OVER_M, 0.01);
      const r1 = toRect(a1, RX + RING_OVER_M, RY + RING_OVER_M, 0.01);
      L.shell.quad(r0, e0, e1, r1, ceiling);
      // A corner of the well between this step's two ends: fill it.
      const CX = RX + RING_OVER_M;
      const CY = RY + RING_OVER_M;
      for (const [cx, cy] of [
        [CX, CY],
        [-CX, CY],
        [-CX, -CY],
        [CX, -CY],
      ]) {
        let ac = Math.atan2(cy, cx);
        if (ac < 0) ac += Math.PI * 2;
        if (!(ac > a0 && ac < a1)) continue;
        const rc: P3 = [cx, cy, 0.01];
        const down =
          (r1[0] - r0[0]) * (rc[1] - r0[1]) -
            (r1[1] - r0[1]) * (rc[0] - r0[0]) <
          0;
        if (down) L.shell.tri(r0, r1, rc, ceiling);
        else L.shell.tri(r0, rc, r1, ceiling);
      }
      // The gilt ring, a step up.
      const u0: P3 = [e0[0], e0[1], 0.12];
      const u1: P3 = [e1[0], e1[1], 0.12];
      L.metal.quad(e0, u0, u1, e1, COLOR.gilt);
    }
    // The dome: rings of panes up to a crown; the glass shader draws the
    // lattice from the uv (round, up).
    const g = L.glass;
    const tile = g.tileId;
    const glow = g.glowV;
    g.tileId = TILE.dome;
    g.glowV = 1.25;
    const pt = (i: number, k: number): P3 => {
      const a = (i / SEG) * Math.PI * 2;
      const t = (k / RINGS) * (Math.PI / 2);
      const r = Math.cos(t);
      return [
        ex * r * Math.cos(a),
        ey * r * Math.sin(a),
        0.12 + DOME_RISE_M * Math.sin(t),
      ];
    };
    // Lattice uvs: u round (one per pane), v up (one per ring), the angle
    // unwrapped about each triangle's middle (no seam).
    g.uvFn = (p, cen) => {
      const ac = Math.atan2(cen[1] / ey, cen[0] / ex);
      let a = Math.atan2(p[1] / ey, p[0] / ex);
      if (a - ac > Math.PI) a -= Math.PI * 2;
      if (ac - a > Math.PI) a += Math.PI * 2;
      const t = Math.asin(
        Math.min(1, Math.max(0, (p[2] - 0.12) / DOME_RISE_M))
      );
      return [(a / (Math.PI * 2)) * SEG, (t / (Math.PI / 2)) * RINGS];
    };
    for (let k = 0; k < RINGS; k += 1)
      for (let i = 0; i < SEG; i += 1) {
        // Seen from below: wound to face down and in.
        g.quad(
          pt(i, k),
          pt(i, k + 1),
          pt(i + 1, k + 1),
          pt(i + 1, k),
          COLOR.domeGlass
        );
      }
    g.uvFn = null;
    g.tileId = tile;
    g.glowV = glow;
    // The chandelier: a gilt stem and a ring of glowing globes.
    const top = 0.12 + DOME_RISE_M;
    L.metal.cyl([0, 0, top - 1.6], 0.02, 0.02, 1.6, 4, COLOR.gilt, false);
    L.metal.cyl([0, 0, top - 1.75], 0.35, 0.38, 0.06, 10, COLOR.gilt);
    L.metal.cyl([0, 0, top - 1.9], 0.05, 0.12, 0.16, 6, COLOR.gilt);
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      lit(L, 3.0, (gl) =>
        gl.ball(
          [0.38 * Math.cos(a), 0.38 * Math.sin(a), top - 1.62],
          0.06,
          COLOR.lamp,
          0.07
        )
      );
    }
    lit(L, 3.0, (gl) => gl.ball([0, 0, top - 2.0], 0.09, COLOR.lamp, 0.1));
  });
  const top = at[2] + 0.12 + DOME_RISE_M;
  return [
    // The chandelier, and the dome's own glow over the well.
    { p: [at[0], at[1], top - 1.8], intensity: 1.6, radius: 5.5 },
    { p: [at[0], at[1], at[2] + 0.6], intensity: 0.9, radius: 7.5 },
  ];
}

/** Where the ray at angle a meets the rectangle ±rx, ±ry (z 0). */
function toRect(a: number, rx: number, ry: number, z = 0): P3 {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = Math.min(
    rx / Math.max(Math.abs(c), 1e-9),
    ry / Math.max(Math.abs(s), 1e-9)
  );
  return [c * k, s * k, z];
}

/** A newel post: a square oak post with a moulded cap. Origin: floor. */
function newelPost(L: Layers): void {
  grain(L.wood, () => {
    L.wood.box([0, 0, 0.08], 0.3, 0.3, 0.16, COLOR.oakDark, { bottom: true });
    L.wood.box([0, 0, 0.62], 0.22, 0.22, 0.92, COLOR.oak, { bottom: true });
    L.wood.box([0, 0, 1.12], 0.3, 0.3, 0.08, COLOR.oakDark);
  });
}

/** The newel at a flight's foot, a gilt urn on it. */
export function newel(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    newelPost(L);
    L.metal.cyl([0, 0, 1.16], 0.05, 0.09, 0.12, 6, COLOR.gilt);
    L.metal.ball([0, 0, 1.33], 0.07, COLOR.gilt);
  });
  return [];
}

/**
 * The cherub lamp on the newel: a little bronze figure holding up a
 * torch with a glowing globe.
 */
export function cherubLamp(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    newelPost(L);
    const b = L.metal;
    const z = 1.16;
    b.cyl([0, 0, z], 0.1, 0.08, 0.05, 8, COLOR.bronze);
    // Legs, body, head, the raised arm and the torch.
    b.beam(
      [0, -0.035, z + 0.05],
      [0.01, -0.03, z + 0.26],
      0.05,
      0.05,
      COLOR.bronze
    );
    b.beam(
      [0, 0.035, z + 0.05],
      [-0.01, 0.03, z + 0.26],
      0.05,
      0.05,
      COLOR.bronze
    );
    b.cyl([0, 0, z + 0.24], 0.065, 0.055, 0.2, 6, COLOR.bronze);
    b.ball([0, 0, z + 0.5], 0.06, COLOR.bronze, 0.065);
    b.beam([0, 0.05, z + 0.4], [0.03, 0.1, z + 0.62], 0.03, 0.03, COLOR.bronze);
    b.beam(
      [0, -0.05, z + 0.4],
      [0.06, -0.08, z + 0.3],
      0.03,
      0.03,
      COLOR.bronze
    );
    b.cyl([0.03, 0.1, z + 0.6], 0.012, 0.02, 0.14, 4, COLOR.gilt, false);
    lit(L, 3.4, (g) => g.ball([0.03, 0.1, z + 0.8], 0.07, COLOR.lamp, 0.075));
  });
  return [
    { p: placedPoint(at, yaw, [0.03, 0.1, 2.0]), intensity: 1.1, radius: 3.2 },
  ];
}

/**
 * The carved clock panel ("Honour and Glory Crowning Time", simplified):
 * an oak frame with a pediment, two figures in low relief either side, and
 * the clock face. Origin: the wall at the floor; x out of the wall.
 */
export function clockPanel(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    grain(w, () => {
      // The surround: plinth, pilasters, entablature, pediment.
      w.box([0.05, 0, 0.45], 0.1, 2.5, 0.9, COLOR.oakDark, {
        back: true,
        bottom: true,
      });
      for (const y of [-1.15, 1.15])
        w.box([0.06, y, 1.6], 0.12, 0.2, 1.5, COLOR.oak, {
          back: true,
          bottom: true,
        });
      w.box([0.07, 0, 2.42], 0.14, 2.6, 0.16, COLOR.oakDark, { back: true });
      w.box([0.03, 0, 1.6], 0.06, 2.1, 1.5, scale(COLOR.oak, 0.85), {
        back: true,
        bottom: true,
        top: true,
      });
      // The pediment: a low triangle.
      w.tri([0.1, -1.3, 2.5], [0.1, 1.3, 2.5], [0.1, 0, 2.95], COLOR.oak);
      w.tri(
        [0.1, 1.3, 2.5],
        [0.0, 1.3, 2.5],
        [0.0, 0, 2.95],
        scale(COLOR.oak, 0.8)
      );
      w.tri(
        [0.0, -1.3, 2.5],
        [0.1, -1.3, 2.5],
        [0.1, 0, 2.95],
        scale(COLOR.oak, 0.8)
      );
      // Honour and Glory: two figures in low relief, leaning in.
      for (const side of [-1, 1]) {
        const y = side * 0.62;
        w.box([0.09, y, 1.15], 0.06, 0.26, 0.5, COLOR.oak, { back: true });
        w.box([0.09, y - side * 0.03, 1.6], 0.07, 0.3, 0.42, COLOR.oak, {
          back: true,
        });
        w.ball([0.1, y - side * 0.07, 1.92], 0.09, COLOR.oak, 0.1);
        // The wing (Glory) or the wreath (Honour), raised to the clock.
        w.beam([0.1, y, 1.75], [0.11, side * 0.32, 2.1], 0.06, 0.14, COLOR.oak);
      }
    });
    // The clock: a gilt bezel, the face and its hands.
    clockFace(L, [0.1, 0, 1.7]);
  });
  return [];
}

/** A clock face in the wall's plane at local c (facing +x). */
function clockFace(L: Layers, c: P3): void {
  const n = 16;
  const R = 0.24;
  for (let i = 0; i < n; i += 1) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1) / n) * Math.PI * 2;
    const p = (r: number, a: number, dx = 0): P3 => [
      c[0] + dx,
      c[1] + r * Math.cos(a),
      c[2] + r * Math.sin(a),
    ];
    L.shell.tri(
      [c[0] + 0.01, c[1], c[2]],
      p(R, a0, 0.01),
      p(R, a1, 0.01),
      COLOR.clockFace
    );
    L.metal.quad(
      p(R, a0, 0.01),
      p(R + 0.05, a0, 0.03),
      p(R + 0.05, a1, 0.03),
      p(R, a1, 0.01),
      COLOR.gilt
    );
  }
  // The hands at ten past ten, and the hour marks.
  L.metal.beam(
    [c[0] + 0.02, c[1], c[2]],
    [c[0] + 0.02, c[1] + 0.12, c[2] + 0.08],
    0.012,
    0.02,
    COLOR.iron,
    false
  );
  L.metal.beam(
    [c[0] + 0.02, c[1], c[2]],
    [c[0] + 0.02, c[1] - 0.17, c[2] + 0.1],
    0.012,
    0.015,
    COLOR.iron,
    false
  );
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    L.metal.box(
      [c[0] + 0.015, c[1] + 0.2 * Math.cos(a), c[2] + 0.2 * Math.sin(a)],
      0.01,
      0.025,
      0.025,
      COLOR.iron,
      { back: true }
    );
  }
}

/** The red rope across the roped flight, on two brass posts. */
export function rope(L: Layers, at: P3, yaw: number, width = 2.8): Lamp[] {
  placed(L, at, yaw, () => {
    const h = width / 2;
    for (const y of [-h, h]) {
      L.metal.cyl([0, y, 0], 0.12, 0.1, 0.04, 8, COLOR.brass);
      L.metal.cyl([0, y, 0.04], 0.025, 0.025, 0.88, 6, COLOR.brass, false);
      L.metal.ball([0, y, 0.95], 0.045, COLOR.brass);
    }
    // A sagging catenary of short beams.
    const n = 10;
    const pt = (i: number): P3 => {
      const t = i / n;
      const y = -h + (2 * h * i) / n;
      return [0, y, 0.9 - 0.22 * 4 * t * (1 - t)];
    };
    for (let i = 0; i < n; i += 1)
      L.shell.beam(pt(i), pt(i + 1), 0.04, 0.04, COLOR.velvet, false);
  });
  return [];
}

// --- Doors, portholes ----------------------------------------------------------

export type DoorStyle = "oak" | "white" | "steel";

/** Height of a porthole's centre over the floor (m). */
export const PORTHOLE_Z = 1.55;

/** A brass porthole (the glass shows the sky, or the sea above it). */
export function porthole(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const n = 12;
    const R = 0.19;
    const z = PORTHOLE_Z;
    const p = (r: number, a: number, x: number): P3 => [
      x,
      r * Math.cos(a),
      z + r * Math.sin(a),
    ];
    const g = L.glass;
    const tile = g.tileId;
    g.tileId = TILE.porthole;
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      g.tri([0.005, 0, z], p(R, a0, 0.005), p(R, a1, 0.005), COLOR.white);
      // The brass ring: its face and inner lip.
      L.metal.quad(
        p(R, a0, 0.005),
        p(R + 0.07, a0, 0.04),
        p(R + 0.07, a1, 0.04),
        p(R, a1, 0.005),
        COLOR.brass
      );
      L.metal.quad(
        p(R + 0.07, a0, 0.04),
        p(R + 0.09, a0, 0.0),
        p(R + 0.09, a1, 0.0),
        p(R + 0.07, a1, 0.04),
        scale(COLOR.brass, 0.7)
      );
    }
    g.tileId = tile;
  });
  return [];
}

/**
 * A shut door on a wall: architrave, a panelled leaf (or a steel one with
 * ribs) and a knob. Origin: the wall's foot; x out of the wall.
 */
export function shutDoor(
  L: Layers,
  at: P3,
  yaw: number,
  style: DoorStyle
): Lamp[] {
  placed(L, at, yaw, () => {
    const W = 0.86;
    const H = 2.02;
    if (style === "steel") {
      const steel = lin(0.55, 0.56, 0.52);
      L.shell.box([0.02, 0, H / 2], 0.04, W, H, steel, {
        back: true,
        bottom: true,
      });
      L.shell.box(
        [0.03, 0, H + 0.04],
        0.06,
        W + 0.16,
        0.08,
        scale(steel, 0.8),
        { back: true }
      );
      for (const z of [0.5, 1.5])
        L.shell.box([0.045, 0, z], 0.02, W - 0.1, 0.05, scale(steel, 0.9), {
          back: true,
        });
      L.metal.box([0.06, -W / 2 + 0.1, 1.0], 0.04, 0.05, 0.16, COLOR.iron, {
        back: true,
      });
      return;
    }
    const oak = style === "oak";
    const b = oak ? L.wood : L.shell;
    const leaf = oak ? COLOR.oakDark : lin(0.9, 0.88, 0.82);
    const trim = oak ? COLOR.oak : lin(0.95, 0.93, 0.88);
    const tile = b.tileId;
    b.tileId = oak ? TILE.grain : TILE.none;
    // Architrave: two jambs and a head.
    for (const y of [-(W / 2 + 0.06), W / 2 + 0.06])
      b.box([0.03, y, (H + 0.1) / 2], 0.06, 0.12, H + 0.1, trim, {
        back: true,
        bottom: true,
      });
    b.box([0.03, 0, H + 0.1], 0.06, W + 0.24, 0.12, trim, { back: true });
    // The leaf, set in, and its four raised panels.
    b.box([0.012, 0, H / 2], 0.024, W, H, leaf, { back: true, bottom: true });
    for (const [z, h] of [
      [0.5, 0.62],
      [1.42, 0.86],
    ])
      for (const y of [-0.2, 0.2])
        b.box([0.03, y, z], 0.014, 0.3, h, scale(leaf, oak ? 1.25 : 1.04), {
          back: true,
        });
    b.tileId = tile;
    L.metal.ball([0.06, -W / 2 + 0.1, 1.0], 0.035, COLOR.brass);
  });
  return [];
}

// --- Balustrades ---------------------------------------------------------------

/** The balustrade's height over its floor (m). */
export const BALUSTRADE_M = 1.0;

/**
 * An oak balustrade with wrought-iron balusters along a floor line p → q
 * (ship frame, the floor's height at each end), standing `inset` into the
 * room on the left of p → q: a moulded handrail, a base string and iron
 * balusters every 0.16 m, gilt at their middle.
 */
export function balustrade(L: Layers, p: P3, q: P3, inset: number): Lamp[] {
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const len = Math.hypot(dx, dy);
  if (len < 0.05) return [];
  const ix = (-dy / len) * inset;
  const iy = (dx / len) * inset;
  const a: P3 = [p[0] + ix, p[1] + iy, p[2]];
  const b: P3 = [q[0] + ix, q[1] + iy, q[2]];
  const up = (v: P3, z: number): P3 => [v[0], v[1], v[2] + z];
  L.place(null);
  grain(L.wood, () => {
    L.wood.beam(
      up(a, BALUSTRADE_M - 0.04),
      up(b, BALUSTRADE_M - 0.04),
      0.09,
      0.08,
      COLOR.oak
    );
    L.wood.beam(up(a, 0.06), up(b, 0.06), 0.07, 0.12, COLOR.oakDark);
  });
  // Iron balusters: flat bars, a face each way (four triangles, not a
  // box's eight: a long balustrade has hundreds), every third with a
  // gilt boss at its middle.
  const n = Math.max(1, Math.round(len / 0.16));
  const ux = (dx / len) * 0.012;
  const uy = (dy / len) * 0.012;
  const m = L.metal;
  for (let k = 0; k < n; k += 1) {
    const t = (k + 0.5) / n;
    const bx = a[0] + (b[0] - a[0]) * t;
    const by = a[1] + (b[1] - a[1]) * t;
    const bz = a[2] + (b[2] - a[2]) * t;
    const lo = bz + 0.12;
    const hi = bz + BALUSTRADE_M - 0.08;
    const p0: P3 = [bx - ux, by - uy, lo];
    const p1: P3 = [bx + ux, by + uy, lo];
    const p2: P3 = [bx + ux, by + uy, hi];
    const p3: P3 = [bx - ux, by - uy, hi];
    // Facing into the room (left of a → b), and back out.
    m.quad(p1, p0, p3, p2, COLOR.iron);
    m.quad(p0, p1, p2, p3, scale(COLOR.iron, 0.8));
    if (k % 3 === 1) {
      const g0: P3 = [bx - ux * 2, by - uy * 2, bz + 0.5];
      const g1: P3 = [bx + ux * 2, by + uy * 2, bz + 0.5];
      const g2: P3 = [bx + ux * 2, by + uy * 2, bz + 0.6];
      const g3: P3 = [bx - ux * 2, by - uy * 2, bz + 0.6];
      m.quad(g1, g0, g3, g2, scale(COLOR.gilt, 0.6));
      m.quad(g0, g1, g2, g3, scale(COLOR.gilt, 0.5));
    }
  }
  return [];
}

// --- Furniture -----------------------------------------------------------------
//
// The rooms' furniture (Task 7: the suites and third class). A blocking
// piece is centred on its footprint (`PIECE_FOOTPRINT`, lib's kit.ts: the
// walker's blocker), its back (the wall side) to −x and its front to +x; a
// bed's or bunk's head is at −x. Painted and fabric parts are `shell`,
// varnished oak `wood`, brass and iron `metal`.

/** Runs `fn` with a builder's detail tile set, then puts it back. */
function tiled(b: Builder, tile: number, fn: () => void): void {
  const t = b.tileId;
  b.tileId = tile;
  fn();
  b.tileId = t;
}

/** Bedding: a mattress, a cover over its foot, a turned-down sheet, pillows. */
function bedding(
  L: Layers,
  len: number,
  wide: number,
  z: number,
  cover: RGB,
  pillows: number,
  ticking: RGB = COLOR.sheet
): void {
  const s = L.shell;
  tiled(s, TILE.none, () => {
    s.box([0, 0, z + 0.09], len, wide, 0.18, ticking, { bottom: true });
    const cl = len * 0.7;
    const cx = len / 2 - cl / 2 + 0.01;
    s.box([cx, 0, z + 0.13], cl, wide + 0.05, 0.12, cover, { bottom: true });
    // The sheet turned down over the cover's head.
    s.box(
      [cx - cl / 2 + 0.05, 0, z + 0.19],
      0.13,
      wide + 0.06,
      0.02,
      COLOR.sheet,
      {
        bottom: true,
      }
    );
    const pw = (wide - 0.1) / pillows;
    for (let k = 0; k < pillows; k += 1)
      s.box(
        [-len / 2 + 0.2, -wide / 2 + 0.05 + pw * (k + 0.5), z + 0.24],
        0.32,
        pw - 0.04,
        0.11,
        COLOR.sheet,
        { bottom: true }
      );
  });
}

/**
 * The brass bed (2.0 × 1.5): a brass frame with ball finials, a tall
 * spindled head and a lower foot, a rose eiderdown and two pillows.
 */
export function brassBed(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    tiled(L.shell, TILE.none, () =>
      L.shell.box([0, 0, 0.2], 1.86, 1.38, 0.22, scale(COLOR.rose, 0.7), {
        bottom: true,
      })
    );
    bedding(L, 1.9, 1.4, 0.31, COLOR.rose, 2);
    const m = L.metal;
    const X = 0.96;
    const Y = 0.71;
    for (const [x, h] of [
      [-X, 1.32],
      [X, 0.98],
    ] as const)
      for (const y of [-Y, Y]) {
        m.cyl([x, y, 0], 0.026, 0.026, h, 6, COLOR.brass, false);
        m.ball([x, y, h + 0.035], 0.045, COLOR.brass);
      }
    for (const [x, top, low, n] of [
      [-X, 1.22, 0.62, 7],
      [X, 0.9, 0.6, 5],
    ] as const) {
      m.beam([x, -Y, top], [x, Y, top], 0.04, 0.04, COLOR.brass, false);
      m.beam([x, -Y, low], [x, Y, low], 0.03, 0.03, COLOR.brass, false);
      for (let k = 1; k < n; k += 1) {
        const y = -Y + (2 * Y * k) / n;
        m.beam([x, y, low], [x, y, top], 0.018, 0.018, COLOR.brass, false);
      }
      m.ball([x, 0, top + 0.03], 0.045, COLOR.gilt);
    }
    for (const y of [-Y, Y])
      m.beam([-X, y, 0.3], [X, y, 0.3], 0.03, 0.06, COLOR.iron, false);
  });
  return [];
}

/** A twin bed (2.0 × 0.95): an oak bedstead, a blue coverlet. */
export function singleBed(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    tiled(w, TILE.grain, () => {
      for (const [x, h] of [
        [-0.96, 1.1],
        [0.96, 0.78],
      ] as const) {
        w.box([x, 0, h / 2], 0.06, 0.95, h, COLOR.oak, { bottom: true });
        w.box([x, 0, h + 0.025], 0.09, 0.95, 0.05, COLOR.oakDark);
        const px = x < 0 ? x + 0.035 : x - 0.035;
        w.box(
          [px, 0, h * 0.62],
          0.012,
          0.62,
          h * 0.42,
          scale(COLOR.oak, 1.25),
          {
            back: true,
          }
        );
      }
      for (const y of [-0.44, 0.44])
        w.box([0, y, 0.28], 1.86, 0.05, 0.18, COLOR.oakDark, { bottom: true });
    });
    bedding(L, 1.84, 0.84, 0.3, COLOR.coverlet, 1);
  });
  return [];
}

/**
 * Third class's steel bunk (1.9 × 0.8): a white tube frame, two berths
 * with wool blankets (two dark stripes) and pillows, a guard rail on the
 * top berth and a ladder on its right (−y), away from the wall.
 */
export function bunk(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const m = L.metal;
    const f = COLOR.bunkFrame;
    const X = 0.92;
    const Y = 0.37;
    const H = 1.78;
    for (const x of [-X, X])
      for (const y of [-Y, Y]) {
        m.cyl([x, y, 0], 0.025, 0.025, H, 6, f, false);
        m.ball([x, y, H + 0.02], 0.032, f);
      }
    for (const x of [-X, X])
      m.beam([x, -Y, H - 0.08], [x, Y, H - 0.08], 0.03, 0.03, f, false);
    for (const z of [0.3, 1.2]) {
      for (const y of [-Y, Y])
        m.beam([-X, y, z], [X, y, z], 0.035, 0.04, f, false);
      for (const x of [-X, X])
        m.beam([x, -Y, z], [x, Y, z], 0.035, 0.04, f, false);
      bedding(L, 1.78, 0.68, z + 0.02, COLOR.blanket, 1, COLOR.ticking);
      // The blanket's stripes.
      for (const sx of [0.02, 0.62])
        tiled(L.shell, TILE.none, () =>
          L.shell.box([sx, 0, z + 0.155], 0.07, 0.735, 0.122, COLOR.stripe, {
            bottom: true,
          })
        );
    }
    // The top berth's guard rail, and the ladder at its foot.
    m.beam([-X, -Y, 1.52], [0.35, -Y, 1.52], 0.03, 0.03, f, false);
    m.beam([0.35, -Y, 1.2], [0.35, -Y, 1.52], 0.025, 0.025, f, false);
    for (const x of [0.5, 0.82])
      m.beam([x, -Y - 0.02, 0], [x, -Y - 0.02, 1.5], 0.03, 0.03, f, false);
    for (const z of [0.55, 0.85, 1.12, 1.4])
      m.beam([0.5, -Y - 0.02, z], [0.82, -Y - 0.02, z], 0.025, 0.025, f, false);
  });
  return [];
}

/** An oak wardrobe (0.6 × 1.2): two doors, one with a mirror, a cornice. */
export function wardrobe(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    tiled(w, TILE.grain, () => {
      w.box([-0.02, 0, 1.0], 0.54, 1.16, 1.84, COLOR.oak, {
        back: true,
        bottom: true,
      });
      w.box([0, 0, 0.05], 0.58, 1.18, 0.1, COLOR.oakDark, {
        back: true,
        bottom: true,
      });
      w.box([0, 0, 1.97], 0.6, 1.2, 0.1, COLOR.oakDark, { back: true });
      w.box([-0.03, 0, 2.06], 0.48, 0.9, 0.08, COLOR.oak, {
        back: true,
        bottom: true,
      });
      for (const y of [-0.285, 0.285]) {
        w.box([0.256, y, 1.0], 0.012, 0.54, 1.76, scale(COLOR.oak, 1.1), {
          back: true,
        });
        w.box([0.266, y, 0.5], 0.01, 0.4, 0.55, scale(COLOR.oak, 1.3), {
          back: true,
        });
        if (y < 0)
          w.box([0.266, y, 1.35], 0.01, 0.4, 0.85, scale(COLOR.oak, 1.3), {
            back: true,
          });
      }
    });
    tiled(L.shell, TILE.none, () =>
      L.shell.box([0.266, 0.285, 1.33], 0.01, 0.38, 0.88, COLOR.mirror, {
        back: true,
      })
    );
    for (const y of [-0.04, 0.04])
      L.metal.ball([0.28, y, 1.0], 0.022, COLOR.brass);
  });
  return [];
}

/**
 * A first-class washstand (0.5 × 0.9): an oak cupboard, a marble top and
 * splashback, a white basin with brass taps, a jug, a mirror over it.
 */
export function washstand(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    const s = L.shell;
    const m = L.metal;
    tiled(w, TILE.grain, () => {
      w.box([0, 0, 0.39], 0.46, 0.86, 0.7, COLOR.oak, {
        back: true,
        bottom: true,
      });
      w.box([0.0, 0, 0.04], 0.48, 0.88, 0.08, COLOR.oakDark, {
        back: true,
        bottom: true,
      });
      for (const y of [-0.2, 0.2])
        w.box([0.235, y, 0.42], 0.014, 0.34, 0.5, scale(COLOR.oak, 1.25), {
          back: true,
        });
      w.box([-0.225, 0, 1.5], 0.03, 0.6, 0.62, COLOR.oakDark, { back: true });
    });
    tiled(s, TILE.none, () => {
      s.box([0.01, 0, 0.765], 0.5, 0.9, 0.05, COLOR.marble, { bottom: true });
      s.box([-0.22, 0, 0.95], 0.04, 0.9, 0.32, COLOR.marble, {
        back: true,
        bottom: true,
      });
      s.cyl([0.05, 0, 0.79], 0.15, 0.19, 0.05, 10, COLOR.enamel);
      s.box([-0.205, 0, 1.5], 0.01, 0.5, 0.52, COLOR.mirror, { back: true });
      s.cyl([0.08, 0.31, 0.79], 0.07, 0.05, 0.2, 8, COLOR.enamel);
    });
    m.cyl([0.05, 0, 0.841], 0.03, 0.03, 0.002, 6, COLOR.iron);
    for (const y of [-0.07, 0.07]) {
      m.cyl([-0.14, y, 0.79], 0.016, 0.016, 0.12, 6, COLOR.brass, false);
      m.beam([-0.14, y, 0.9], [-0.07, y, 0.88], 0.022, 0.022, COLOR.brass);
    }
    for (const y of [-0.2, 0.2])
      m.ball([0.25, y > 0 ? 0.04 : -0.04, 0.55], 0.018, COLOR.brass);
  });
  return [];
}

/**
 * Third class's enamel washbasin (0.45 × 0.6): a white enamelled stand
 * and basin, one brass tap, a small mirror.
 */
export function washbasin(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    tiled(s, TILE.none, () => {
      s.box([-0.02, 0, 0.38], 0.4, 0.56, 0.76, scale(COLOR.enamel, 0.92), {
        back: true,
        bottom: true,
      });
      s.box([0.183, 0, 0.4], 0.01, 0.44, 0.56, scale(COLOR.enamel, 0.82), {
        back: true,
      });
      s.box([0, 0, 0.79], 0.45, 0.6, 0.06, COLOR.enamel, { bottom: true });
      s.cyl([0.03, 0, 0.82], 0.13, 0.16, 0.03, 10, COLOR.enamel);
      s.box([-0.21, 0, 1.0], 0.03, 0.6, 0.36, COLOR.enamel, {
        back: true,
        bottom: true,
      });
      s.box([-0.2, 0, 1.45], 0.01, 0.28, 0.36, COLOR.mirror, { back: true });
    });
    m.box([-0.212, 0, 1.45], 0.015, 0.34, 0.42, COLOR.bunkFrame, {
      back: true,
    });
    m.cyl([0.03, 0, 0.851], 0.025, 0.025, 0.002, 6, COLOR.iron);
    m.cyl([-0.15, 0, 0.82], 0.016, 0.016, 0.12, 6, COLOR.brass, false);
    m.beam([-0.15, 0, 0.93], [-0.07, 0, 0.91], 0.022, 0.022, COLOR.brass);
    m.ball([0.195, 0.15, 0.45], 0.018, COLOR.brass);
  });
  return [];
}

/** A green velvet sofa (0.8 × 1.9): rolled back and arms, two cushions. */
export function sofa(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    const g = COLOR.green;
    tiled(s, TILE.none, () => {
      s.box([0.02, 0, 0.21], 0.74, 1.6, 0.26, scale(g, 0.8), { bottom: true });
      s.box([0.06, 0, 0.4], 0.66, 1.56, 0.12, g, { bottom: true });
      s.box([-0.3, 0, 0.6], 0.18, 1.84, 0.62, scale(g, 0.92), { bottom: true });
      s.tube([-0.3, -0.9, 0.9], [-0.3, 0.9, 0.9], 0.09, 8, g, true);
      for (const y of [-0.85, 0.85]) {
        s.box([0.0, y, 0.42], 0.74, 0.18, 0.5, scale(g, 0.95), {
          bottom: true,
        });
        s.tube([-0.36, y, 0.68], [0.36, y, 0.68], 0.09, 8, g, true);
      }
      for (const y of [-0.5, 0.5])
        s.box([-0.15, y, 0.62], 0.12, 0.38, 0.34, COLOR.rose, { bottom: true });
    });
    tiled(L.wood, TILE.grain, () => {
      for (const x of [-0.3, 0.3])
        for (const y of [-0.85, 0.85])
          L.wood.box([x, y, 0.04], 0.06, 0.06, 0.08, COLOR.oakDark, {
            bottom: true,
          });
    });
  });
  return [];
}

/** A round oak table (1.0 × 1.0) on a pedestal, a vase of flowers on it. */
export function table(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    tiled(w, TILE.grain, () => {
      w.cyl([0, 0, 0.7], 0.48, 0.48, 0.04, 14, COLOR.oak);
      w.cyl([0, 0, 0.64], 0.42, 0.42, 0.06, 14, COLOR.oakDark, false);
      w.cyl([0, 0, 0.1], 0.07, 0.05, 0.54, 8, COLOR.oak, false);
      w.beam([-0.34, 0, 0.05], [0.34, 0, 0.05], 0.08, 0.08, COLOR.oakDark);
      w.beam([0, -0.34, 0.05], [0, 0.34, 0.05], 0.08, 0.08, COLOR.oakDark);
    });
    const s = L.shell;
    tiled(s, TILE.none, () => {
      s.cyl([0, 0, 0.74], 0.22, 0.22, 0.004, 12, COLOR.sheet);
      s.cyl([0, 0, 0.744], 0.045, 0.07, 0.15, 8, COLOR.mirror, false);
      for (const [x, y, z] of [
        [0, 0, 0.99],
        [0.06, 0.04, 0.95],
        [-0.06, 0.03, 0.95],
        [0.01, -0.07, 0.95],
      ])
        s.ball([x, y, z], 0.045, COLOR.flowers, 0.04);
      for (const [x, y] of [
        [0.08, 0.04],
        [-0.06, 0.07],
        [0.0, -0.09],
      ])
        s.ball([x, y, 0.9], 0.05, COLOR.leaf, 0.035);
    });
  });
  return [];
}

/** An oak dining chair with a green velvet seat (not blocking). */
export function chair(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const w = L.wood;
    tiled(w, TILE.grain, () => {
      for (const x of [-0.19, 0.19])
        for (const y of [-0.19, 0.19])
          w.beam([x, y, 0], [x, y, 0.42], 0.04, 0.04, COLOR.oakDark, false);
      w.box([0, 0, 0.44], 0.44, 0.44, 0.04, COLOR.oak);
      for (const y of [-0.19, 0.19])
        w.beam([-0.19, y, 0.46], [-0.23, y, 0.96], 0.04, 0.04, COLOR.oak);
      w.beam([-0.23, -0.2, 0.92], [-0.23, 0.2, 0.92], 0.05, 0.08, COLOR.oak);
      w.box([-0.21, 0, 0.68], 0.02, 0.14, 0.4, COLOR.oak);
    });
    tiled(L.shell, TILE.none, () =>
      L.shell.box([0.01, 0, 0.485], 0.4, 0.4, 0.05, COLOR.green, {
        bottom: true,
      })
    );
  });
  return [];
}

/**
 * A run of pipes high on a wall, 8 m along it (local y ±4): a fat lagged
 * steam pipe with bands, a copper and a grey pipe, on iron brackets.
 * Origin: the wall's foot; x out of the wall. `ceilingM` over the floor.
 */
export function pipes(
  L: Layers,
  at: P3,
  yaw: number,
  ceilingM: number
): Lamp[] {
  placed(L, at, yaw, () => {
    const c = ceilingM;
    tiled(L.shell, TILE.none, () => {
      L.shell.tube(
        [0.14, -4, c - 0.15],
        [0.14, 4, c - 0.15],
        0.06,
        6,
        COLOR.lagging
      );
      for (const y of [-2, 0, 2])
        L.shell.tube(
          [0.14, y - 0.03, c - 0.15],
          [0.14, y + 0.03, c - 0.15],
          0.068,
          6,
          scale(COLOR.lagging, 0.75)
        );
    });
    const m = L.metal;
    m.tube([0.05, -4, c - 0.2], [0.05, 4, c - 0.2], 0.028, 6, COLOR.pipeGrey);
    m.tube([0.26, -4, c - 0.21], [0.26, 4, c - 0.21], 0.03, 6, COLOR.copper);
    for (const y of [-3, -1, 1, 3])
      m.box([0.15, y, c - 0.25], 0.3, 0.04, 0.02, COLOR.iron, { back: true });
  });
  return [];
}

/**
 * Fire buckets: four red round-bottomed buckets of sand on an iron shelf,
 * a red board behind them. Origin: the wall's foot; x out of the wall.
 */
export function fireBuckets(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    tiled(s, TILE.none, () => {
      s.box([0.01, 0, 1.02], 0.02, 1.0, 0.62, scale(COLOR.fireRed, 0.62), {
        back: true,
      });
      const sand = lin(0.72, 0.62, 0.42);
      for (const y of [-0.33, -0.11, 0.11, 0.33]) {
        s.cyl([0.14, y, 0.795], 0.07, 0.1, 0.24, 8, COLOR.fireRed, false);
        for (let i = 0; i < 8; i += 1) {
          const a0 = (i / 8) * Math.PI * 2;
          const a1 = ((i + 1) / 8) * Math.PI * 2;
          s.tri(
            [0.14, y, 1.0],
            [0.14 + 0.094 * Math.cos(a0), y + 0.094 * Math.sin(a0), 1.0],
            [0.14 + 0.094 * Math.cos(a1), y + 0.094 * Math.sin(a1), 1.0],
            sand
          );
        }
        m.cyl([0.14, y, 1.02], 0.103, 0.103, 0.02, 8, COLOR.iron, false);
      }
    });
    m.box([0.13, 0, 0.78], 0.26, 0.92, 0.03, COLOR.iron, { back: true });
    for (const y of [-0.42, 0.42])
      m.beam([0.0, y, 0.55], [0.24, y, 0.765], 0.025, 0.025, COLOR.iron);
  });
  return [];
}

/**
 * A fire hose reel: a red drum of canvas hose on an iron bracket, the
 * hose's end hanging with its brass nozzle, a red valve wheel beside it.
 * Origin: the wall's foot; x out of the wall.
 */
export function hoseReel(L: Layers, at: P3, yaw: number): Lamp[] {
  placed(L, at, yaw, () => {
    const s = L.shell;
    const m = L.metal;
    const z = 1.45;
    m.box([0.04, 0, z], 0.08, 0.2, 0.5, COLOR.iron, { back: true });
    m.tube([0.0, 0, z], [0.35, 0, z], 0.03, 6, COLOR.iron, true);
    tiled(s, TILE.none, () => {
      for (const x of [0.1, 0.3])
        s.tube([x, 0, z], [x + 0.02, 0, z], 0.3, 12, COLOR.fireRed, true);
      s.tube([0.12, 0, z], [0.3, 0, z], 0.22, 12, COLOR.canvas);
      s.tube(
        [0.205, 0, z],
        [0.215, 0, z],
        0.226,
        12,
        scale(COLOR.canvas, 0.75)
      );
      s.beam(
        [0.21, 0.0, z - 0.2],
        [0.21, 0.08, z - 0.5],
        0.05,
        0.05,
        COLOR.canvas
      );
      // The valve wheel and its pipe.
      s.tube([0.05, -0.45, z], [0.08, -0.45, z], 0.08, 8, COLOR.fireRed, true);
    });
    m.cyl([0.21, 0.08, z - 0.66], 0.014, 0.03, 0.16, 6, COLOR.brass);
    m.tube(
      [0.03, -0.45, 0.6],
      [0.03, -0.45, z + 0.7],
      0.025,
      6,
      COLOR.pipeGrey
    );
  });
  return [];
}

/** The floor-standing pieces by id (wall pieces take more: see kit.ts). */
export const FURNITURE: Partial<
  Record<PieceId, (L: Layers, at: P3, yaw: number) => Lamp[]>
> = {
  bed: brassBed,
  "single-bed": singleBed,
  bunk,
  wardrobe,
  washstand,
  washbasin,
  sofa,
  table,
  chair,
};

// --- Doorways --------------------------------------------------------------------

/**
 * The frame round an open doorway (an architrave: two jambs and a head),
 * on the wall either side of the opening, so a doorway reads as a door
 * and not a gap. Origin: the opening's middle at the floor, x into the
 * room; `width` the opening's.
 */
export function doorFrame(
  L: Layers,
  at: P3,
  yaw: number,
  width: number,
  style: DoorStyle,
  head = 2.1
): Lamp[] {
  placed(L, at, yaw, () => {
    const oak = style === "oak";
    const b = oak ? L.wood : L.shell;
    const trim =
      style === "oak"
        ? COLOR.oakDark
        : style === "white"
          ? lin(0.95, 0.93, 0.88)
          : lin(0.5, 0.51, 0.48);
    tiled(b, oak ? TILE.grain : TILE.none, () => {
      for (const s of [-1, 1])
        b.box(
          [0.025, s * (width / 2 + 0.06), head / 2],
          0.05,
          0.12,
          head,
          trim,
          {
            back: true,
            bottom: true,
          }
        );
      b.box([0.025, 0, head + 0.04], 0.05, width + 0.24, 0.08, trim, {
        back: true,
      });
    });
  });
  return [];
}

/**
 * The lift's folding brass gates, folded back to each side of the car's
 * opening (a lattice of bars), and a brass rail across the top. Origin:
 * the opening's middle at the floor, x into the car.
 */
export function liftGate(
  L: Layers,
  at: P3,
  yaw: number,
  width: number
): Lamp[] {
  placed(L, at, yaw, () => {
    const m = L.metal;
    const h = 2.05;
    for (const s of [-1, 1]) {
      const y0 = s * (width / 2 - 0.02);
      // Folded leaves: bars close together, a diagonal lattice across them.
      for (let i = 0; i < 5; i += 1) {
        const y = y0 - s * i * 0.035;
        m.beam([0.06, y, 0.02], [0.06, y, h], 0.015, 0.015, COLOR.brass, false);
      }
      for (let z = 0.2; z < h - 0.1; z += 0.3)
        m.beam(
          [0.06, y0, z],
          [0.06, y0 - s * 0.14, z + 0.15],
          0.012,
          0.012,
          COLOR.brass,
          false
        );
    }
    m.beam(
      [0.06, -width / 2, h],
      [0.06, width / 2, h],
      0.03,
      0.05,
      COLOR.brass
    );
    m.beam(
      [0.06, -width / 2, 0.02],
      [0.06, width / 2, 0.02],
      0.03,
      0.03,
      COLOR.brass
    );
  });
  return [];
}
