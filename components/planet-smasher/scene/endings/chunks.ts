import { BufferGeometry, Float32BufferAttribute, SphereGeometry } from "three";
import type { Vec3 } from "@/lib/planet-smasher/sphere";

export const CHUNK_COUNT = 24;

const WIDTH_SEGMENTS = 96;
const HEIGHT_SEGMENTS = 48;
/** How deep (fraction of the radius) a chunk's pivot sits below the surface. */
const PIVOT_DEPTH = 0.8;
/** Where the inner faces meet: a shallow core, so chunks read as shards. */
const APEX_DEPTH = 0.55;

function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `n` roughly even points on the unit sphere, nudged by `jitter`. */
export function fibonacciSeeds(
  n: number,
  jitter: number,
  seed: number
): Vec3[] {
  const rand = rng(seed);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Vec3[] = [];
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    let x = Math.cos(th) * r + (rand() * 2 - 1) * jitter;
    let yy = y + (rand() * 2 - 1) * jitter;
    let z = Math.sin(th) * r + (rand() * 2 - 1) * jitter;
    const len = Math.hypot(x, yy, z) || 1;
    x /= len;
    yy /= len;
    z /= len;
    out.push({ x, y: yy, z });
  }
  return out;
}

/** Nearest seed for each triangle (by centroid) of a non-indexed mesh. */
export function assignChunks(
  positions: Float32Array,
  seeds: Vec3[]
): Uint16Array {
  const tris = Math.floor(positions.length / 9);
  const out = new Uint16Array(tris);
  for (let t = 0; t < tris; t++) {
    const o = t * 9;
    let cx = positions[o] + positions[o + 3] + positions[o + 6];
    let cy = positions[o + 1] + positions[o + 4] + positions[o + 7];
    let cz = positions[o + 2] + positions[o + 5] + positions[o + 8];
    const len = Math.hypot(cx, cy, cz) || 1;
    cx /= len;
    cy /= len;
    cz /= len;
    let best = 0;
    let bestDot = -2;
    for (let s = 0; s < seeds.length; s++) {
      const d = cx * seeds[s].x + cy * seeds[s].y + cz * seeds[s].z;
      if (d > bestDot) {
        bestDot = d;
        best = s;
      }
    }
    out[t] = best;
  }
  return out;
}

/** Where a chunk's mesh sits (its geometry is built around this point). */
export function chunkPivot(seed: Vec3, radius: number): Vec3 {
  const k = radius * PIVOT_DEPTH;
  return { x: seed.x * k, y: seed.y * k, z: seed.z * k };
}

export interface ChunkSet {
  geometries: BufferGeometry[];
  /** Line-segment positions (pairs of xyz) along every chunk border. */
  seams: Float32Array;
}

const key = (x: number, y: number, z: number) =>
  `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;

/**
 * Splits a sphere into one closed solid per seed. Each geometry has group 0
 * (the planet surface, uses the planet material) and group 1 (the inner side
 * faces, fanned to the centre), and is centred on `chunkPivot`.
 */
export function buildChunkSet(radius: number, seeds: Vec3[]): ChunkSet {
  const sphere = new SphereGeometry(1, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);
  const base = sphere.toNonIndexed();
  sphere.dispose();
  const pos = base.attributes.position.array as Float32Array;
  const nor = base.attributes.normal.array as Float32Array;
  const uv = base.attributes.uv.array as Float32Array;
  const assign = assignChunks(pos, seeds);

  const tris: number[][] = seeds.map(() => []);
  assign.forEach((c, t) => tris[c].push(t));

  const seamKeys = new Set<string>();
  const seams: number[] = [];
  const geometries = seeds.map((seed, c) => {
    const outerP: number[] = [];
    const outerN: number[] = [];
    const outerUv: number[] = [];
    // Edge key -> [count, ax, ay, az, bx, by, bz] (first directed occurrence).
    const edges = new Map<string, number[]>();
    for (const t of tris[c]) {
      for (let k = 0; k < 3; k++) {
        const i = t * 3 + k;
        outerP.push(
          pos[i * 3] * radius,
          pos[i * 3 + 1] * radius,
          pos[i * 3 + 2] * radius
        );
        outerN.push(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]);
        outerUv.push(uv[i * 2], uv[i * 2 + 1]);
      }
      for (let k = 0; k < 3; k++) {
        const a = (t * 3 + k) * 3;
        const b = (t * 3 + ((k + 1) % 3)) * 3;
        const ka = key(pos[a], pos[a + 1], pos[a + 2]);
        const kb = key(pos[b], pos[b + 1], pos[b + 2]);
        if (ka === kb) continue;
        const ek = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
        const e = edges.get(ek);
        if (e) e[0]++;
        else {
          edges.set(ek, [
            1,
            pos[a] * radius,
            pos[a + 1] * radius,
            pos[a + 2] * radius,
            pos[b] * radius,
            pos[b + 1] * radius,
            pos[b + 2] * radius,
          ]);
        }
      }
    }
    const innerP: number[] = [];
    const innerN: number[] = [];
    const innerC: number[] = [];
    const apex = {
      x: seed.x * radius * APEX_DEPTH,
      y: seed.y * radius * APEX_DEPTH,
      z: seed.z * radius * APEX_DEPTH,
    };
    for (const [ek, e] of edges) {
      if (e[0] !== 1) continue;
      const [, ax, ay, az, bx, by, bz] = e;
      // Wall triangle (b, a, apex), facing away from the chunk's inside.
      innerP.push(bx, by, bz, ax, ay, az, apex.x, apex.y, apex.z);
      // Dark rock at the rim, glowing orange toward the core.
      innerC.push(0.12, 0.05, 0.03, 0.12, 0.05, 0.03, 1, 0.45, 0.08);
      const ux = ax - bx;
      const uy = ay - by;
      const uz = az - bz;
      const vx = apex.x - bx;
      const vy = apex.y - by;
      const vz = apex.z - bz;
      let nx = uy * vz - uz * vy;
      let ny = uz * vx - ux * vz;
      let nz = ux * vy - uy * vx;
      const len = Math.hypot(nx, ny, nz) || 1;
      nx /= len;
      ny /= len;
      nz /= len;
      for (let k = 0; k < 3; k++) innerN.push(nx, ny, nz);
      if (!seamKeys.has(ek)) {
        seamKeys.add(ek);
        seams.push(ax, ay, az, bx, by, bz);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new Float32BufferAttribute([...outerP, ...innerP], 3)
    );
    g.setAttribute(
      "normal",
      new Float32BufferAttribute([...outerN, ...innerN], 3)
    );
    const innerUv = new Array((innerP.length / 3) * 2).fill(0);
    g.setAttribute(
      "color",
      new Float32BufferAttribute(
        [...new Array(outerP.length).fill(1), ...innerC],
        3
      )
    );
    g.setAttribute(
      "uv",
      new Float32BufferAttribute([...outerUv, ...innerUv], 2)
    );
    g.addGroup(0, outerP.length / 3, 0);
    g.addGroup(outerP.length / 3, innerP.length / 3, 1);
    const p = chunkPivot(seed, radius);
    g.translate(-p.x, -p.y, -p.z);
    return g;
  });
  base.dispose();
  return { geometries, seams: new Float32Array(seams) };
}

export function buildChunkGeometries(
  radius: number,
  seeds: Vec3[]
): BufferGeometry[] {
  return buildChunkSet(radius, seeds).geometries;
}

let cached: { seeds: Vec3[]; set: ChunkSet } | null = null;

/** The pre-cracked planet, built once per page (the radius is always 1). */
export function getChunkSet(): { seeds: Vec3[]; set: ChunkSet } {
  if (!cached) {
    const seeds = fibonacciSeeds(CHUNK_COUNT, 0.2, 1);
    cached = { seeds, set: buildChunkSet(1, seeds) };
  }
  return cached;
}
