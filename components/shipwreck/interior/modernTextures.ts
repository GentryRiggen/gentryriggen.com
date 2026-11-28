import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  RGBAFormat,
  UnsignedByteType,
  type IUniform,
  type Texture,
} from "three";
import type { Layer } from "./pieces";
import type { RoomMaterials } from "./materials";

/**
 * The modern cruise ship's detail (the Concordia, 1.18), drawn once as
 * `textures.ts` draws the Titanic's (nothing downloaded, the same in
 * tests): three tiles beside the Edwardian one, sampled by the room shader
 * once `withModern` adds them (only her materials: the Titanic's shader is
 * untouched).
 *
 * - **A** (256², every 1.2 m like the Edwardian tile): R cabin veneer
 *   (flush pale-wood panels, reveals, straight grain), G marble (0.6 m
 *   slabs, veins), B pool tile (5 cm mosaic, bright grout), A teak decking
 *   (12 cm planks, black caulking, butt joints).
 * - **B** (256², every 1.2 m): R cabin carpet (a wave pattern in loop
 *   pile), G stage wood (dark 15 cm boards, scuffed), B soft play (0.6 m
 *   jigsaw foam mats, the shader colours them red, yellow, blue, green),
 *   A theatre red (velvet in soft vertical folds).
 * - **C** (512², every 2.4 m, in colour): RGB the kids' mural (a sunny sea:
 *   sky, rainbow, sun, clouds, a sailboat, waves, fish, bubbles, sand, a
 *   starfish, a frieze of waves top and bottom), A the cream wallcovering
 *   (a fine linen weave with a faint stripe).
 *
 * Memory: A and B 256 KB each, C 1 MB, about 2 MB with their mipmaps.
 * The tile ids (`MODERN_TILE`) carry on from the Edwardian `TILE`s.
 */

export const MODERN_PX = 256;
export const MURAL_PX = 512;
/** The mural (and the cream) repeat every this many detail tiles (2.4 m). */
export const MURAL_TILES = 2;

/** The faces' `aTile` for the modern finishes (after `TILE`'s 0..7). */
export const MODERN_TILE = {
  veneer: 8,
  marble: 9,
  poolTile: 10,
  teak: 11,
  cabinCarpet: 12,
  stageWood: 13,
  softPlay: 14,
  theatre: 15,
  cream: 16,
  mural: 17,
  /** Glass: an emergency lamp or exit sign, lit on the emergency supply. */
  emergency: 18,
  /** See-through glass (lift cars, rails, balcony doors): the pane builder. */
  pane: 19,
} as const;

/** A small deterministic generator (mulberry32), as textures.ts. */
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

/**
 * Tileable value noise on an nx × ny lattice (stretched: fewer cells one
 * way draws streaks along it), sampled at (u, v); it repeats every 1 in
 * each. Its lattice is a typed array and the wrap done once per sample:
 * it runs for every pixel.
 */
function noise2(
  nx: number,
  ny: number,
  seed: number
): (u: number, v: number) => number {
  const r = rng(seed);
  const g = new Float64Array(nx * ny);
  for (let k = 0; k < g.length; k += 1) g[k] = r();
  return (u, v) => {
    const x = u * nx;
    const y = v * ny;
    const fi = Math.floor(x);
    const fj = Math.floor(y);
    const fx = x - fi;
    const fy = y - fj;
    const i0 = ((fi % nx) + nx) % nx;
    const j0 = ((fj % ny) + ny) % ny;
    const i1 = i0 + 1 === nx ? 0 : i0 + 1;
    const r0 = j0 * nx;
    const r1 = (j0 + 1 === ny ? 0 : j0 + 1) * nx;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = g[r0 + i0] + (g[r0 + i1] - g[r0 + i0]) * sx;
    const b = g[r1 + i0] + (g[r1 + i1] - g[r1 + i0]) * sx;
    return a + (b - a) * sy;
  };
}

/** Square tileable value noise (n × n). */
const noise = (n: number, seed: number) => noise2(n, n, seed);

/** A cell's own random value (0..1), stable. */
function hash(i: number, j: number, seed: number): number {
  const h = Math.imul(i * 374761393 + j * 668265263 + seed * 1442695041, 1);
  const x = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const fract = (x: number) => x - Math.floor(x);
/** The length of (x, y) (cheaper than hypot in a per-pixel loop). */
const len = (x: number, y: number) => Math.sqrt(x * x + y * y);
/** The cell of x among n a tile, wrapped (so a tile repeats exactly). */
const cell = (x: number, n: number) => ((Math.floor(x) % n) + n) % n;
/** Distance to the nearest whole number. */
const nearInt = (x: number) => Math.abs(x - Math.round(x));

export interface ModernNoise {
  grain: (u: number, v: number) => number;
  fine: (u: number, v: number) => number;
  warp: (u: number, v: number) => number;
  pile: (u: number, v: number) => number;
  /** Fine across u, long up v: the veneer's grain. */
  streak: (u: number, v: number) => number;
  /** Long along u, fine across v: the teak planks' grain. */
  plank: (u: number, v: number) => number;
}

export function modernNoise(): ModernNoise {
  return {
    grain: noise(8, 101),
    fine: noise(64, 103),
    warp: noise(4, 107),
    pile: noise(64, 109),
    streak: noise2(64, 16, 113),
    plank: noise2(16, 128, 127),
  };
}

/** Tile A at (u, v) in 0..1: veneer, marble, pool tile, teak. */
export function modernAAt(
  u: number,
  v: number,
  n: ModernNoise
): [number, number, number, number] {
  // Veneer: two flush panels a tile (0.6 m), a dark reveal round each, a
  // straight vertical grain with a slow figure.
  const pu = fract(u * 2);
  const reveal = Math.min(pu, 1 - pu) < 0.012 || nearInt(v) < 0.006 ? 1 : 0;
  const figure = n.grain(u * 2, v) * 0.6;
  const streak = Math.sin((u * 2 + figure * 0.08) * Math.PI * 2 * 26);
  const panelTone = (hash(cell(u * 2, 2), 0, 3) - 0.5) * 0.08;
  const veneer = reveal
    ? 0.08
    : 0.55 +
      panelTone +
      0.1 * streak * streak -
      0.05 +
      0.14 * (n.streak(u, v) - 0.5);

  // Marble: 0.6 m slabs, light, with dark veins running across, a faint
  // light grout line between slabs.
  const mu = fract(u * 2);
  const mv = fract(v * 2);
  const slab = (hash(cell(u * 2, 2), cell(v * 2, 2), 5) - 0.5) * 0.06;
  const turb =
    n.warp(u, v) * 1.0 + n.grain(u * 2, v * 2) * 0.5 + n.fine(u, v) * 0.12;
  const t1 = Math.sin(Math.PI * 2 * (u * 1 + v * 2) + turb * 7);
  const t2 = Math.sin(Math.PI * 2 * (u * 3 - v * 1) + turb * 9 + 1.3);
  const vein = 1 - smooth(0, 0.14, Math.abs(t1));
  const fineVein = 1 - smooth(0, 0.06, Math.abs(t2));
  const grout = Math.min(mu, 1 - mu, mv, 1 - mv) < 0.004 ? 1 : 0;
  const marble = grout
    ? 0.82
    : 0.66 +
      slab +
      0.1 * (n.grain(u * 4, v * 4) - 0.5) -
      0.34 * vein -
      0.16 * fineVein;

  // Pool tile: 24 × 24 squares a tile (5 cm), each its own shade, and
  // bright grout over 0.8.
  const tu = fract(u * 24);
  const tv = fract(v * 24);
  const pool =
    Math.min(tu, 1 - tu, tv, 1 - tv) < 0.07
      ? 0.95
      : 0.2 +
        0.32 * hash(cell(u * 24, 24), cell(v * 24, 24), 7) +
        0.08 * (n.fine(u * 2, v * 2) - 0.5);

  // Teak: planks along u, ten a tile (12 cm), black caulking between,
  // one butt joint a plank a tile, the grain along the plank.
  const row = cell(v * 10, 10);
  const pv = fract(v * 10);
  const butt = hash(row, 0, 11);
  const caulk =
    Math.min(pv, 1 - pv) < 0.05 || nearInt(u - butt) < 0.003 ? 1 : 0;
  const plank = (hash(row, 1, 13) - 0.5) * 0.16;
  const grainT = Math.sin(
    Math.PI * 2 * (v * 70 + 0.5 * n.grain(u * 2, v * 10))
  );
  const teak = caulk
    ? 0.03
    : 0.55 + plank + 0.08 * grainT + 0.12 * (n.plank(u, v) - 0.5);

  return [clamp01(veneer), clamp01(marble), clamp01(pool), clamp01(teak)];
}

/** Tile B at (u, v): cabin carpet, stage wood, soft play, theatre red. */
export function modernBAt(
  u: number,
  v: number,
  n: ModernNoise
): [number, number, number, number] {
  // Cabin carpet: light wave lines on a dark ground, small dots between,
  // a loop pile.
  const w = Math.sin(
    Math.PI * 2 * (v * 3 + 0.12 * Math.sin(Math.PI * 2 * u * 2))
  );
  const wave = smooth(0.72, 0.86, w);
  const du = fract(u * 6) - 0.5;
  const dv = fract(v * 6 + 0.25) - 0.5;
  const dot = w < -0.3 ? 1 - smooth(0.06, 0.1, len(du, dv)) : 0;
  const carpet =
    0.32 + 0.42 * wave + 0.22 * dot + 0.26 * (n.pile(u * 4, v * 4) - 0.5);

  // Stage wood: dark boards along u, eight a tile (15 cm), the seams dark,
  // each board its own shade, scuffs and grain.
  const row = cell(v * 8, 8);
  const pv = fract(v * 8);
  const seam =
    Math.min(pv, 1 - pv) < 0.035 || nearInt(u - hash(row, 2, 17)) < 0.003;
  const grainS = Math.sin(Math.PI * 2 * (v * 48 + 0.6 * n.grain(u * 2, v * 8)));
  const scuff = smooth(0.62, 0.75, n.grain(u * 4 + 0.3, v * 4));
  const stage = seam
    ? 0.12
    : 0.5 +
      (hash(row, 3, 19) - 0.5) * 0.22 +
      0.08 * grainS +
      0.12 * scuff +
      0.1 * (n.fine(u * 2, v * 2) - 0.5);

  // Soft play: 0.6 m foam mats (two a tile) with jigsaw teeth along their
  // edges, a fine embossed dot.
  const cu = fract(u * 2);
  const cv = fract(v * 2);
  const teethU = Math.sin(Math.PI * 2 * cv * 6) > 0 ? 0.03 : -0.03;
  const teethV = Math.sin(Math.PI * 2 * cu * 6) > 0 ? 0.03 : -0.03;
  const eu = Math.min(
    Math.abs(cu - 0.03 - teethU),
    Math.abs(cu - 1.03 - teethU)
  );
  const ev = Math.min(
    Math.abs(cv - 0.03 - teethV),
    Math.abs(cv - 1.03 - teethV)
  );
  const softSeam = Math.min(eu, ev) < 0.006 ? 1 : 0;
  const emboss =
    Math.sin(Math.PI * 2 * u * 40) * Math.sin(Math.PI * 2 * v * 40) > 0.6
      ? 0.06
      : 0;
  const soft = softSeam ? 0.15 : 0.62 + emboss + 0.06 * (n.fine(u, v) - 0.5);

  // Theatre red: velvet in soft vertical folds, a deep seam each tile.
  const fold = Math.sin(Math.PI * 2 * u * 6);
  const panelSeam = nearInt(u) < 0.006 ? 1 : 0;
  const theatre = panelSeam
    ? 0.1
    : 0.52 + 0.22 * fold * Math.abs(fold) + 0.18 * (n.pile(u * 2, v * 2) - 0.5);

  return [clamp01(carpet), clamp01(stage), clamp01(soft), clamp01(theatre)];
}

type RGB = readonly [number, number, number];
/** sRGB as picked, to linear (the texture holds linear, as vertex colours). */
const lin = (r: number, g: number, b: number): RGB => [
  Math.pow(r, 2.2),
  Math.pow(g, 2.2),
  Math.pow(b, 2.2),
];
const mixC = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Horizontal distance (in mural widths) wrapped, so the mural tiles. */
const wdx = (u: number, cx: number) => {
  const x = u - cx + 0.5;
  return x - Math.floor(x) - 0.5;
};

const MURAL = {
  skyHigh: lin(0.42, 0.7, 0.95),
  skyLow: lin(0.74, 0.9, 0.98),
  sun: lin(1.0, 0.86, 0.25),
  cloud: lin(0.98, 0.98, 1.0),
  seaTop: lin(0.2, 0.62, 0.86),
  seaDeep: lin(0.08, 0.36, 0.66),
  foam: lin(0.92, 0.97, 1.0),
  sand: lin(0.96, 0.84, 0.56),
  sandDark: lin(0.86, 0.7, 0.42),
  frieze: lin(0.12, 0.42, 0.78),
  boat: lin(0.9, 0.22, 0.2),
  sail: lin(0.99, 0.97, 0.92),
  fish: [lin(1.0, 0.55, 0.12), lin(1.0, 0.86, 0.2), lin(0.96, 0.45, 0.7)],
  eye: lin(0.08, 0.08, 0.12),
  star: lin(0.95, 0.35, 0.3),
  rainbow: [
    lin(0.92, 0.25, 0.25),
    lin(0.98, 0.6, 0.2),
    lin(0.98, 0.88, 0.25),
    lin(0.35, 0.78, 0.35),
    lin(0.3, 0.55, 0.92),
    lin(0.58, 0.38, 0.85),
  ],
} as const;

/** The mural's clouds, fish (x, y, way, colour) and bubbles (x, y, r). */
const CLOUDS = [
  [0.55, 0.7],
  [0.04, 0.8],
] as const;
const FISHES = [
  [0.15, 0.3, 1, 0],
  [0.45, 0.21, -1, 1],
  [0.75, 0.32, 1, 2],
  [0.94, 0.19, -1, 0],
] as const;
const BUBBLES = [
  [0.19, 0.36, 0.008],
  [0.205, 0.33, 0.006],
  [0.41, 0.27, 0.007],
  [0.79, 0.38, 0.006],
] as const;

/** Inside a five-pointed star of outer radius r at (x, y) from its middle. */
function inStar(x: number, y: number, r: number): boolean {
  const a = Math.atan2(y, x) + Math.PI / 2;
  const k = Math.PI / 5;
  const t = Math.abs(((((a % (2 * k)) + 2 * k) % (2 * k)) - k) / k);
  const edge = r * (0.45 + 0.55 * t * t);
  return len(x, y) < edge;
}

/**
 * Tile C at (u, v), u along the wall and v up, each 0..1 over 2.4 m: the
 * mural's linear colour, and the cream wallcovering's weave.
 */
export function muralAt(
  u: number,
  v: number,
  n: ModernNoise
): [number, number, number, number] {
  const SEA = 0.42 + 0.016 * Math.sin(Math.PI * 2 * u * 5);
  let c: RGB;
  if (v > SEA) {
    // The sky, paler toward the sea.
    c = mixC(MURAL.skyLow, MURAL.skyHigh, smooth(SEA, 0.92, v));
    // The rainbow, its foot in the sea.
    const rd = len(wdx(u, 0.27), v - SEA + 0.03);
    const band = Math.floor((0.34 - rd) / 0.018);
    if (band >= 0 && band < 6) c = MURAL.rainbow[band];
    // The sun, a halo round it.
    const sd = len(wdx(u, 0.8), v - 0.78);
    if (sd < 0.075) c = MURAL.sun;
    else if (sd < 0.11)
      c = mixC(c, MURAL.sun, 0.45 * (1 - (sd - 0.075) / 0.035));
    // Two clouds, each three puffs.
    if (v > 0.6)
      for (const [cx, cy] of CLOUDS) {
        const puff = Math.min(
          len(wdx(u, cx - 0.05), v - cy),
          len(wdx(u, cx), (v - cy - 0.03) * 1.1),
          len(wdx(u, cx + 0.05), v - cy)
        );
        const flat = v > cy - 0.035;
        if (puff < 0.045 && flat) c = MURAL.cloud;
      }
    // A sailboat on the waves.
    const bx = wdx(u, 0.6);
    const by = v - SEA;
    if (by < 0.035 && by > -0.01 && Math.abs(bx) < 0.07 - (0.035 - by) * 0.6)
      c = MURAL.boat;
    if (
      by >= 0.035 &&
      by < 0.17 &&
      bx > -0.005 &&
      bx < 0.005 + (0.17 - by) * 0.4
    )
      c = MURAL.sail;
    if (by >= 0.035 && by < 0.18 && Math.abs(bx + 0.006) < 0.004)
      c = MURAL.boat;
  } else {
    // The sea, deeper down, foam along its top.
    c = mixC(MURAL.seaDeep, MURAL.seaTop, smooth(0.1, SEA, v));
    if (v > SEA - 0.012) c = MURAL.foam;
    // Light ripples.
    const rip = Math.sin(Math.PI * 2 * (u * 9 + v * 3 + 0.3 * n.warp(u, v)));
    if (rip > 0.93 && v > 0.16) c = mixC(c, MURAL.foam, 0.35);
    // Fish: a body, a tail, an eye, each its colour.

    if (v > 0.15 && v < 0.36)
      for (const [fx, fy, dir, k] of FISHES) {
        const x = wdx(u, fx) * dir;
        const y = v - fy;
        const body = (x / 0.06) ** 2 + (y / 0.032) ** 2 < 1;
        const tail = x < -0.05 && x > -0.09 && Math.abs(y) < (-0.05 - x) * 0.9;
        if (body || tail) c = MURAL.fish[k];
        if (len(x - 0.03, y - 0.008) < 0.007) c = MURAL.eye;
      }
    // Bubbles.
    if (v > 0.25 && v < 0.4)
      for (const [bx, by, br] of BUBBLES) {
        const d = len(wdx(u, bx), v - by);
        if (d < br && d > br * 0.55) c = MURAL.foam;
      }
    // The sand and a starfish.
    const dune = 0.13 + 0.012 * Math.sin(Math.PI * 2 * u * 3);
    if (v < dune) c = mixC(MURAL.sandDark, MURAL.sand, smooth(0.08, dune, v));
    if (inStar(wdx(u, 0.62), v - 0.115, 0.03)) c = MURAL.star;
  }
  // A blue band of waves at the foot (to 0.18 m) and the top (from
  // 2.23 m): the mural repeats every 2.4 m, so on a taller wall the two
  // run on into one band under the ceiling.
  const wave = 0.012 * Math.abs(Math.sin(Math.PI * u * 16));
  if (v < 0.063 + wave || v > 0.93 - wave) c = MURAL.frieze;
  const line = Math.min(Math.abs(v - 0.03), Math.abs(v - 0.965));
  if (line < 0.004) c = mixC(MURAL.frieze, MURAL.foam, 0.6);

  // Cream: a fine linen weave and a faint 10 cm stripe.
  const weave =
    0.5 +
    0.08 * Math.sin(Math.PI * 2 * u * 160) * Math.sin(Math.PI * 2 * v * 160) +
    0.12 * (n.fine(u * 2, v * 2) - 0.5);
  const stripe = fract(u * 24) < 0.5 ? 0.04 : -0.04;
  return [c[0], c[1], c[2], clamp01(weave + stripe)];
}

function dataTexture(data: Uint8Array, size: number): Texture {
  const t = new DataTexture(data, size, size, RGBAFormat, UnsignedByteType);
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

function fill(
  size: number,
  at: (u: number, v: number) => readonly number[]
): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j += 1)
    for (let i = 0; i < size; i += 1) {
      const c = at((i + 0.5) / size, (j + 0.5) / size);
      const k = (j * size + i) * 4;
      for (let ch = 0; ch < 4; ch += 1) {
        const x = c[ch];
        data[k + ch] = x <= 0 ? 0 : x >= 1 ? 255 : Math.round(x * 255);
      }
    }
  return data;
}

export interface ModernTextures {
  a: Texture;
  b: Texture;
  c: Texture;
  /** Frees the tiles' GPU copies (they upload again if used again). */
  dispose(): void;
}

let made: ModernTextures | null = null;

/**
 * The three modern tiles (about 2 MB with mipmaps), drawn on the first call
 * (the first walk on her: about a second on an older iPad, so never for a
 * ship without modern rooms) and kept: later calls return the same tiles.
 * Whoever builds her rooms disposes them with the build, as it disposes the
 * room materials (`roomMaterials(...).dispose()` does not free these); a
 * disposed tile uploads again when next drawn, from the data kept here.
 */
export function modernTextures(): ModernTextures {
  if (made) return made;
  const n = modernNoise();
  const a = dataTexture(
    fill(MODERN_PX, (u, v) => modernAAt(u, v, n)),
    MODERN_PX
  );
  const b = dataTexture(
    fill(MODERN_PX, (u, v) => modernBAt(u, v, n)),
    MODERN_PX
  );
  const c = dataTexture(
    fill(MURAL_PX, (u, v) => muralAt(u, v, n)),
    MURAL_PX
  );
  made = {
    a,
    b,
    c,
    dispose() {
      a.dispose();
      b.dispose();
      c.dispose();
    },
  };
  return made;
}

// --- The shader's modern finishes ------------------------------------------------

/**
 * Declared before the fragment's main: the three tiles, the emergency
 * supply and `modernBase`, which turns a face's colour into its modern
 * finish. Every tile is sampled before any branch (mipmaps need it).
 */
export const MODERN_FRAGMENT_HEAD = /* glsl */ `
    uniform sampler2D uModernA;
    uniform sampler2D uModernB;
    uniform sampler2D uModernC;
    // The emergency lamps' and exit signs' supply (0..1, its own flicker).
    uniform float uEmergency;
    vec3 modernBase(vec3 base, float tile, vec2 uv) {
      vec4 a = texture2D(uModernA, uv);
      vec4 b = texture2D(uModernB, uv);
      vec4 c = texture2D(uModernC, uv * 0.5);
      if (tile < 7.5 || tile > 17.5) return base;
      // Cabin veneer.
      if (tile < 8.5) return base * mix(vec3(0.62, 0.56, 0.5), vec3(1.3, 1.24, 1.16), a.r);
      // Marble.
      if (tile < 9.5) return base * mix(vec3(0.5, 0.5, 0.54), vec3(1.16, 1.15, 1.13), a.g);
      // Pool tile: each square its shade, the grout near white.
      if (tile < 10.5) {
        vec3 body = base * mix(vec3(0.62, 0.66, 0.7), vec3(1.4, 1.36, 1.3), clamp(a.b * 1.6, 0.0, 1.0));
        return mix(body, vec3(0.74, 0.78, 0.78), smoothstep(0.7, 0.85, a.b));
      }
      // Teak, black caulking.
      if (tile < 11.5) return base * mix(vec3(0.06, 0.05, 0.045), vec3(1.28, 1.2, 1.1), a.a);
      // Cabin carpet.
      if (tile < 12.5) return base * mix(vec3(0.55, 0.55, 0.6), vec3(1.5, 1.45, 1.35), b.r);
      // Stage wood.
      if (tile < 13.5) return base * mix(vec3(0.3, 0.28, 0.26), vec3(1.4, 1.32, 1.24), b.g);
      // Soft play: the mats red, yellow, blue and green in turn.
      if (tile < 14.5) {
        vec2 cell = mod(floor(uv * 2.0), 2.0);
        vec3 mat = cell.x < 0.5
          ? (cell.y < 0.5 ? vec3(0.78, 0.09, 0.07) : vec3(0.06, 0.24, 0.74))
          : (cell.y < 0.5 ? vec3(0.95, 0.66, 0.04) : vec3(0.1, 0.52, 0.12));
        return mat * mix(vec3(0.35), vec3(1.08), b.b);
      }
      // Theatre red velvet.
      if (tile < 15.5) return base * mix(vec3(0.42, 0.36, 0.38), vec3(1.45, 1.36, 1.36), b.a);
      // Cream wallcovering.
      if (tile < 16.5) return base * mix(vec3(0.88, 0.88, 0.87), vec3(1.08, 1.07, 1.06), c.a);
      // The kids' mural, in its own colours.
      return c.rgb;
    }
`;

/** After the Edwardian detail (`base *= f;`): the modern finish. */
export const MODERN_DETAIL_LINE = /* glsl */ `
        base = modernBase(base, vTile, vUv);`;

/**
 * Glass: an emergency lamp or exit sign glows on the emergency supply,
 * whatever the room's own lamps (its `aGlow` times `uEmergency`).
 */
export const MODERN_GLASS_BRANCH = /* glsl */ `if (vTile > 17.5 && vTile < 18.5) {
          // An emergency lamp or an exit sign: on its own supply.
          lit = vColor * (vGlow * uEmergency + 0.04) + vColor * torch * 0.4;
        } else `;

/** Where the modern code goes in `roomShaders`' fragment (each once). */
export const MODERN_ANCHORS = {
  head: "const vec3 LAMP",
  detail: "base *= f;",
  glass: "if (vTile > 6.5) {",
} as const;

function insertOnce(src: string, anchor: string, before: string, after = "") {
  const i = src.indexOf(anchor);
  if (i < 0 || src.indexOf(anchor, i + 1) >= 0)
    throw new Error(`modern shader: anchor "${anchor}" not found once`);
  return (
    src.slice(0, i) + before + anchor + after + src.slice(i + anchor.length)
  );
}

/**
 * A layer's room fragment shader with the modern finishes: the head before
 * the constants, the finish after the Edwardian detail (shell and wood),
 * the emergency glow ahead of the dome's branch (glass).
 */
export function withModern(fragment: string, layer: Layer): string {
  let out = insertOnce(fragment, MODERN_ANCHORS.head, MODERN_FRAGMENT_HEAD);
  if (layer === "shell" || layer === "wood")
    out = insertOnce(out, MODERN_ANCHORS.detail, "", MODERN_DETAIL_LINE);
  if (layer === "glass")
    out = insertOnce(out, MODERN_ANCHORS.glass, MODERN_GLASS_BRANCH);
  return out;
}

export interface ModernUniforms {
  uModernA: IUniform<Texture>;
  uModernB: IUniform<Texture>;
  uModernC: IUniform<Texture>;
  /** The emergency supply (0..1): 1, dipped by her flicker. */
  uEmergency: IUniform<number>;
}

/**
 * Gives a ship's room materials the modern finishes (before their first
 * compile): each layer's fragment through `withModern`, and the three
 * tiles and the emergency supply shared by every layer. Returns the
 * uniforms (set `uEmergency.value` each frame). Safe to call again on the
 * same materials (a rebuild, an effect run twice): a layer that has them
 * already keeps its shader, and the uniforms it has are reused.
 */
export function applyModern(
  mats: RoomMaterials,
  tex: ModernTextures
): ModernUniforms {
  const had = mats.shell.uniforms as Partial<ModernUniforms>;
  const u: ModernUniforms = {
    uModernA: had.uModernA ?? { value: tex.a },
    uModernB: had.uModernB ?? { value: tex.b },
    uModernC: had.uModernC ?? { value: tex.c },
    uEmergency: had.uEmergency ?? { value: 1 },
  };
  u.uModernA.value = tex.a;
  u.uModernB.value = tex.b;
  u.uModernC.value = tex.c;
  for (const layer of ["shell", "wood", "metal", "glass"] as const) {
    const m = mats[layer];
    if (!m.fragmentShader.includes("uModernA")) {
      m.fragmentShader = withModern(m.fragmentShader, layer);
      m.needsUpdate = true;
    }
    Object.assign(m.uniforms, u);
  }
  return u;
}
