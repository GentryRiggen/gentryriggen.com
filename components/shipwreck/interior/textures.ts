import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  type Texture,
} from "three";

/**
 * The rooms' detail, drawn once (nothing is downloaded), as
 * `model/textures.ts` draws the hull's: one 256 × 256 tile that repeats
 * every `DETAIL_M` (1.2 m), a pattern per channel, each 0..1 around a
 * middle of about 0.5 (the shader turns it into a tint, `materials.ts`):
 *
 * - **R, oak panelling**: a raised panel in its frame (stiles and rails,
 *   the bevel catching the light above, a shadow under), with grain.
 * - **G, oak grain** alone, for turned and moulded pieces.
 * - **B, lino tiles**: cream squares with a dark red key pattern, grout.
 * - **A, carpet**: a deep pile with a small repeating motif.
 *
 * Filled pixel by pixel into a `DataTexture` (no 2D canvas needed, so it
 * builds the same in tests), mipmapped, repeating.
 */

export const DETAIL_PX = 256;

/** A small deterministic generator (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise on an n × n lattice, sampled at (u, v) in 0..1. */
function noise(n: number, seed: number): (u: number, v: number) => number {
  const r = rng(seed);
  const g = Array.from({ length: n * n }, () => r());
  const at = (i: number, j: number) => g[((j + n) % n) * n + ((i + n) % n)];
  return (u, v) => {
    const x = u * n;
    const y = v * n;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * sx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * sx;
    return a + (b - a) * sy;
  };
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The four channels' values at (u, v) in the tile (0..1, v up). */
export function detailAt(
  u: number,
  v: number,
  n: {
    grain: (u: number, v: number) => number;
    fine: (u: number, v: number) => number;
    pile: (u: number, v: number) => number;
  }
): [number, number, number, number] {
  // Oak grain: long streaks up the board, wavy.
  const wave = n.grain(u * 2, v) * 0.08;
  const streak = Math.sin((u + wave) * Math.PI * 2 * 22);
  const grain =
    0.5 + 0.16 * streak * streak - 0.08 + 0.22 * (n.fine(u * 4, v) - 0.5);

  // Oak panelling: a frame 0.1 of the tile, the panel within, its bevel
  // lit from above (light at the top edge, shadow at the bottom).
  const F = 0.1;
  const B = 0.035;
  const inPanel = u > F && u < 1 - F && v > F && v < 1 - F;
  let panel: number;
  if (!inPanel) {
    // The frame, a shade lighter, a groove at its outer edge.
    const edge = Math.min(u, 1 - u, v, 1 - v);
    panel = 0.6 - (edge < 0.008 ? 0.3 : 0) + 0.25 * (grain - 0.5);
  } else {
    const du = Math.min(u - F, 1 - F - u);
    const dv = Math.min(v - F, 1 - F - v);
    const d = Math.min(du, dv);
    if (d < B) {
      // The bevel: which side it is on decides its light.
      const top = dv === d && v > 0.5;
      const bottom = dv === d && v < 0.5;
      panel = top ? 0.28 : bottom ? 0.72 : du === d && u < 0.5 ? 0.62 : 0.4;
    } else panel = 0.5 + 0.5 * (grain - 0.5);
  }

  // Lino: 4 × 4 squares a tile (0.3 m), cream with a dark key at the
  // corners where four meet, and grout.
  const tu = (u * 4) % 1;
  const tv = (v * 4) % 1;
  const ci = Math.floor(u * 4);
  const cj = Math.floor(v * 4);
  const corner = Math.min(
    Math.hypot(tu, tv),
    Math.hypot(1 - tu, tv),
    Math.hypot(tu, 1 - tv),
    Math.hypot(1 - tu, 1 - tv)
  );
  const key = 1 - smooth(0.15, 0.18, corner);
  const alt = (ci + cj) % 2 === 0 ? 0.04 : -0.02;
  const grout = Math.min(tu, 1 - tu, tv, 1 - tv) < 0.02 ? 0.25 : 0;
  const lino = clamp01(
    0.82 + alt - 0.78 * key - grout + 0.06 * (n.fine(u * 8, v * 8) - 0.5)
  );

  // Carpet: a soft pile and a small diamond motif, a 4 × 4 repeat.
  const md = Math.abs(tu - 0.5) + Math.abs(tv - 0.5);
  const motif = smooth(0.18, 0.14, md) - 0.6 * smooth(0.06, 0.03, md);
  const border = Math.min(u, 1 - u, v, 1 - v) < 0.03 ? -0.15 : 0;
  const carpet = clamp01(
    0.5 + 0.28 * motif + border + 0.28 * (n.pile(u * 32, v * 32) - 0.5)
  );

  return [clamp01(panel), clamp01(grain), lino, carpet];
}

/** The detail texture (one tile, every channel), made on first use. */
export function detailTexture(): Texture {
  const N = DETAIL_PX;
  const data = new Uint8Array(N * N * 4);
  const n = {
    grain: noise(8, 11),
    fine: noise(32, 23),
    pile: noise(32, 37),
  };
  for (let j = 0; j < N; j += 1)
    for (let i = 0; i < N; i += 1) {
      const c = detailAt((i + 0.5) / N, (j + 0.5) / N, n);
      const k = (j * N + i) * 4;
      for (let ch = 0; ch < 4; ch += 1) data[k + ch] = Math.round(c[ch] * 255);
    }
  const t = new DataTexture(data, N, N, RGBAFormat, UnsignedByteType);
  t.colorSpace = NoColorSpace;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.magFilter = LinearFilter;
  t.minFilter = LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}
