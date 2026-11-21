import { BufferAttribute, BufferGeometry, Color } from "three";
import type { V3 } from "./titanicRecipe";

/**
 * A growable triangle list in the ship frame (x forward, y to port, z up),
 * written out in three.js axes (three.x = x, three.y = z, three.z = -y).
 * Both frames are right-handed, so counter-clockwise faces stay
 * counter-clockwise. Normals come from `computeVertexNormals`: shared
 * vertices shade smooth, primitives that want hard edges use their own.
 */

export type RGB = [number, number, number];

const scratch = new Color();
/** An sRGB hex colour as linear RGB, as vertex colours expect. */
export function rgb(hex: number): RGB {
  scratch.setHex(hex);
  return [scratch.r, scratch.g, scratch.b];
}

export interface BufferOptions {
  color?: boolean;
  uv?: boolean;
  uv1?: boolean;
  /** One extra float per vertex (the hull's sheer height). */
  extra?: string;
}

export class GeoBuffer {
  readonly pos: number[] = [];
  readonly col: number[] = [];
  readonly uv: number[] = [];
  readonly uv1: number[] = [];
  readonly extra: number[] = [];
  readonly idx: number[] = [];
  readonly opts: BufferOptions;

  constructor(opts: BufferOptions = {}) {
    this.opts = opts;
  }

  get vertexCount(): number {
    return this.pos.length / 3;
  }

  get triangleCount(): number {
    return this.idx.length / 3;
  }

  /** Adds a vertex given in the ship frame; returns its index. */
  vertex(
    p: V3,
    color?: RGB,
    uv?: [number, number],
    uv1?: [number, number],
    extra?: number
  ): number {
    this.pos.push(p[0], p[2], -p[1]);
    if (this.opts.color) {
      const c = color ?? [1, 1, 1];
      this.col.push(c[0], c[1], c[2]);
    }
    if (this.opts.uv) this.uv.push(uv?.[0] ?? 0, uv?.[1] ?? 0);
    if (this.opts.uv1) this.uv1.push(uv1?.[0] ?? 0, uv1?.[1] ?? 0);
    if (this.opts.extra) this.extra.push(extra ?? 0);
    return this.vertexCount - 1;
  }

  tri(a: number, b: number, c: number): void {
    this.idx.push(a, b, c);
  }

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(this.pos), 3)
    );
    if (this.opts.color)
      g.setAttribute(
        "color",
        new BufferAttribute(new Float32Array(this.col), 3)
      );
    if (this.opts.uv)
      g.setAttribute("uv", new BufferAttribute(new Float32Array(this.uv), 2));
    if (this.opts.uv1)
      g.setAttribute("uv1", new BufferAttribute(new Float32Array(this.uv1), 2));
    if (this.opts.extra)
      g.setAttribute(
        this.opts.extra,
        new BufferAttribute(new Float32Array(this.extra), 1)
      );
    const n = this.vertexCount;
    g.setIndex(
      new BufferAttribute(
        n > 65535 ? new Uint32Array(this.idx) : new Uint16Array(this.idx),
        1
      )
    );
    g.computeVertexNormals();
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// ---------------------------------------------------------------------------
// Vector helpers (ship frame).

export function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function add(a: V3, b: V3): V3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function scale(a: V3, s: number): V3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function cross(a: V3, b: V3): V3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function norm(a: V3): V3 {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}

/** Two unit vectors perpendicular to `axis` (and to each other). */
export function basis(axis: V3): [V3, V3] {
  const a = norm(axis);
  const helper: V3 = Math.abs(a[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm(cross(a, helper));
  const v = cross(a, u);
  return [u, v];
}

// ---------------------------------------------------------------------------
// Primitives. Each uses its own vertices, so it shades on its own.

/** A flat polygon (convex or star-shaped about its centroid) facing `want`. */
export function polygon(
  buf: GeoBuffer,
  pts: V3[],
  want: V3,
  color?: RGB
): void {
  if (pts.length < 3) return;
  const c: V3 = [0, 0, 0];
  for (const p of pts) {
    c[0] += p[0] / pts.length;
    c[1] += p[1] / pts.length;
    c[2] += p[2] / pts.length;
  }
  // Orientation from the polygon's own area vector.
  let area: V3 = [0, 0, 0];
  for (let i = 0; i < pts.length; i += 1) {
    const a = sub(pts[i], c);
    const b = sub(pts[(i + 1) % pts.length], c);
    area = add(area, cross(a, b));
  }
  const flip = dot(area, want) < 0;
  const ci = buf.vertex(c, color);
  const ids = pts.map((p) => buf.vertex(p, color));
  for (let i = 0; i < ids.length; i += 1) {
    const a = ids[i];
    const b = ids[(i + 1) % ids.length];
    if (flip) buf.tri(ci, b, a);
    else buf.tri(ci, a, b);
  }
}

/** A quad from four corners in order round its edge, facing `want`. */
export function quad(
  buf: GeoBuffer,
  pts: [V3, V3, V3, V3],
  want: V3,
  color?: RGB
): void {
  const n = cross(sub(pts[1], pts[0]), sub(pts[2], pts[0]));
  const ids = pts.map((p) => buf.vertex(p, color));
  if (dot(n, want) >= 0) {
    buf.tri(ids[0], ids[1], ids[2]);
    buf.tri(ids[0], ids[2], ids[3]);
  } else {
    buf.tri(ids[0], ids[2], ids[1]);
    buf.tri(ids[0], ids[3], ids[2]);
  }
}

/**
 * A box from its centre and size (along x, y, z), turned `yaw` about z and
 * optionally tilted `pitch` about its own y (+ lifts its +x end).
 */
export function box(
  buf: GeoBuffer,
  c: V3,
  size: V3,
  color?: RGB,
  yaw = 0,
  pitch = 0,
  faces: { bottom?: boolean } = {}
): void {
  const [hx, hy, hz] = [size[0] / 2, size[1] / 2, size[2] / 2];
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const at = (x: number, y: number, z: number): V3 => {
    // Pitch about local y, then yaw about z.
    const x1 = x * cp - z * sp;
    const z1 = x * sp + z * cp;
    return [c[0] + x1 * cy - y * sy, c[1] + x1 * sy + y * cy, c[2] + z1];
  };
  const dir = (x: number, y: number, z: number): V3 => sub(at(x, y, z), c);
  const faceList: [V3, V3, V3, V3, V3][] = [
    [
      at(hx, -hy, -hz),
      at(hx, hy, -hz),
      at(hx, hy, hz),
      at(hx, -hy, hz),
      dir(1, 0, 0),
    ],
    [
      at(-hx, hy, -hz),
      at(-hx, -hy, -hz),
      at(-hx, -hy, hz),
      at(-hx, hy, hz),
      dir(-1, 0, 0),
    ],
    [
      at(hx, hy, -hz),
      at(-hx, hy, -hz),
      at(-hx, hy, hz),
      at(hx, hy, hz),
      dir(0, 1, 0),
    ],
    [
      at(-hx, -hy, -hz),
      at(hx, -hy, -hz),
      at(hx, -hy, hz),
      at(-hx, -hy, hz),
      dir(0, -1, 0),
    ],
    [
      at(-hx, -hy, hz),
      at(hx, -hy, hz),
      at(hx, hy, hz),
      at(-hx, hy, hz),
      dir(0, 0, 1),
    ],
  ];
  if (faces.bottom !== false)
    faceList.push([
      at(-hx, hy, -hz),
      at(hx, hy, -hz),
      at(hx, -hy, -hz),
      at(-hx, -hy, -hz),
      dir(0, 0, -1),
    ]);
  for (const [a, b, cc, d, n] of faceList) quad(buf, [a, b, cc, d], n, color);
}

/**
 * A tapered cylinder from `a` (radius r0) to `b` (radius r1), smooth sides,
 * flat caps where asked.
 */
export function cylinder(
  buf: GeoBuffer,
  a: V3,
  b: V3,
  r0: number,
  r1: number,
  seg: number,
  color?: RGB,
  caps: { start?: boolean; end?: boolean } = { start: true, end: true },
  squash: [number, number] = [1, 1]
): void {
  const axis = sub(b, a);
  const [u, v] = basis(axis);
  const ring = (c: V3, r: number): V3[] => {
    const out: V3[] = [];
    for (let i = 0; i < seg; i += 1) {
      const t = (i / seg) * Math.PI * 2;
      const cu = Math.cos(t) * r * squash[0];
      const sv = Math.sin(t) * r * squash[1];
      out.push([
        c[0] + u[0] * cu + v[0] * sv,
        c[1] + u[1] * cu + v[1] * sv,
        c[2] + u[2] * cu + v[2] * sv,
      ]);
    }
    return out;
  };
  const ra = ring(a, r0);
  const rb = ring(b, r1);
  const ia = ra.map((p) => buf.vertex(p, color));
  const ib = rb.map((p) => buf.vertex(p, color));
  // Faces outward: (u, v, axis) is right-handed, so going round u→v the
  // outward normal is (b - a) × ... ; check one face and keep its sense.
  const n0 = cross(sub(ra[1], ra[0]), sub(rb[0], ra[0]));
  const out0 = sub(ra[0], a);
  const ok = dot(n0, out0) > 0;
  for (let i = 0; i < seg; i += 1) {
    const j = (i + 1) % seg;
    if (ok) {
      buf.tri(ia[i], ia[j], ib[j]);
      buf.tri(ia[i], ib[j], ib[i]);
    } else {
      buf.tri(ia[i], ib[j], ia[j]);
      buf.tri(ia[i], ib[i], ib[j]);
    }
  }
  if (caps.start && r0 > 0) polygon(buf, ra, scale(axis, -1), color);
  if (caps.end && r1 > 0) polygon(buf, rb, axis, color);
}

/** A tube of radius r along a polyline (for davit arms and pipes). */
export function tube(
  buf: GeoBuffer,
  path: V3[],
  r: number,
  seg: number,
  color?: RGB
): void {
  for (let i = 0; i < path.length - 1; i += 1)
    cylinder(buf, path[i], path[i + 1], r, r, seg, color, {
      start: i === 0,
      end: i === path.length - 2,
    });
}

/** The top half of an ellipsoid (a dome), resting on z = c[2]. */
export function dome(
  buf: GeoBuffer,
  c: V3,
  a: number,
  b: number,
  h: number,
  seg: number,
  rings: number,
  color?: RGB
): void {
  const ids: number[][] = [];
  for (let r = 0; r <= rings; r += 1) {
    const el = (r / rings) * (Math.PI / 2);
    const row: number[] = [];
    for (let i = 0; i < seg; i += 1) {
      const t = (i / seg) * Math.PI * 2;
      row.push(
        buf.vertex(
          [
            c[0] + a * Math.cos(el) * Math.cos(t),
            c[1] + b * Math.cos(el) * Math.sin(t),
            c[2] + h * Math.sin(el),
          ],
          color
        )
      );
    }
    ids.push(row);
  }
  for (let r = 0; r < rings; r += 1)
    for (let i = 0; i < seg; i += 1) {
      const j = (i + 1) % seg;
      buf.tri(ids[r][i], ids[r][j], ids[r + 1][j]);
      buf.tri(ids[r][i], ids[r + 1][j], ids[r + 1][i]);
    }
}
