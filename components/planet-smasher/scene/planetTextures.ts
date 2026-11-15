import type { PlanetId } from "@/lib/planet-smasher/planets";
import {
  POP_H,
  POP_W,
  gridFromLuminance,
  type PopulationGrid,
} from "@/lib/planet-smasher/population";

export interface PlanetTextures {
  id: PlanetId;
  day: HTMLImageElement | HTMLCanvasElement;
  night: HTMLImageElement | HTMLCanvasElement | null;
  population: PopulationGrid;
}

const cache = new Map<PlanetId, Promise<PlanetTextures>>();

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${src}`));
    img.src = src;
  });
}

function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Earth's night map has a dark-blue base over land and sea; only the lights
 * (red and green beyond the blue) count as people.
 */
function earthLuminance(night: HTMLImageElement): Float32Array {
  const c = makeCanvas(POP_W, POP_H);
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const lum = new Float32Array(POP_W * POP_H);
  if (!ctx) return lum.fill(1);
  ctx.drawImage(night, 0, 0, POP_W, POP_H);
  const data = ctx.getImageData(0, 0, POP_W, POP_H).data;
  for (let i = 0; i < lum.length; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    lum[i] = Math.max(0, (r + g) / 2 - b * 0.5);
  }
  return lum;
}

// --- Procedural worlds --------------------------------------------------

function hash(x: number, y: number, seed: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + seed) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise on a lattice of `cols` x `rows` cells, wrapping in x. */
function valueNoise(
  x: number,
  y: number,
  cols: number,
  rows: number,
  seed: number
): number {
  const fx = x * cols;
  const fy = y * rows;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = smooth(fx - x0);
  const ty = smooth(fy - y0);
  const at = (ix: number, iy: number) =>
    hash(((ix % cols) + cols) % cols, iy, seed);
  const top = at(x0, y0) * (1 - tx) + at(x0 + 1, y0) * tx;
  const bottom = at(x0, y0 + 1) * (1 - tx) + at(x0 + 1, y0 + 1) * tx;
  return top * (1 - ty) + bottom * ty;
}

function fractal(u: number, v: number, seed: number, octaves = 5): number {
  let sum = 0;
  let amp = 0.5;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const f = 1 << o;
    sum += amp * valueNoise(u, v, 4 * f, 2 * f, seed + o * 101);
    total += amp;
    amp *= 0.5;
  }
  return sum / total;
}

const W = 1024,
  H = 512;

function mix(a: number[], b: number[], t: number): number[] {
  const k = Math.min(1, Math.max(0, t));
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * k);
}

const ramp = (x: number, lo: number, hi: number): number =>
  Math.min(1, Math.max(0, (x - lo) / (hi - lo)));

/** Where a pixel sits: its noise, a finer noise, latitude and map position. */
interface Spot {
  n: number;
  detail: number;
  /** 0 at the equator, 1 at the poles. */
  lat: number;
  u: number;
  v: number;
}

interface WorldSpec {
  seed: number;
  settleSeed: number;
  colorAt: (p: Spot) => number[];
  /** 0..1 multiplier on where people may live (default everywhere). */
  settleMask?: (p: Spot) => number;
  /** Repaints a settlement blob of strength `w` (0..1) on the day map. */
  paintSettlement?: (c: number[], w: number, p: Spot) => number[];
  /** People at a spot, given the raw settle noise (default: its blobs). */
  population?: (p: Spot, s: number) => number;
  /** Light added to the night map (lava glow, for example). */
  nightGlow?: (p: Spot) => number[] | null;
}

export interface WorldPixels {
  w: number;
  h: number;
  /** RGBA, w * h * 4. */
  day: Uint8ClampedArray<ArrayBuffer>;
  night: Uint8ClampedArray<ArrayBuffer>;
  /** People per cell on the POP_W x POP_H grid, before the floor. */
  lum: Float32Array;
}

const settleStrength = (s: number): number =>
  s > 0.58 ? Math.min(1, (s - 0.58) / 0.12) : 0;

/** Pure pixel maker (no canvas), so tests can read the maps. */
function renderWorld(spec: WorldSpec, w = W, h = H): WorldPixels {
  const day = new Uint8ClampedArray(w * h * 4);
  const night = new Uint8ClampedArray(w * h * 4);
  const lum = new Float32Array(POP_W * POP_H);
  const spotAt = (u: number, v: number): Spot => ({
    n: fractal(u, v, spec.seed),
    detail: fractal(u, v, spec.seed + 7, 6),
    lat: Math.abs(v - 0.5) * 2,
    u,
    v,
  });
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = spotAt(x / w, y / h);
      const s =
        fractal(p.u, p.v, spec.settleSeed, 4) * (spec.settleMask?.(p) ?? 1);
      const k = settleStrength(s);
      let c = spec.colorAt(p);
      if (spec.paintSettlement && k > 0) c = spec.paintSettlement(c, k, p);
      const i = (y * w + x) * 4;
      day[i] = c[0];
      day[i + 1] = c[1];
      day[i + 2] = c[2];
      day[i + 3] = 255;
      const g = spec.nightGlow?.(p);
      night[i] = 8 + k * 247 + (g ? g[0] : 0);
      night[i + 1] = 8 + k * 170 + (g ? g[1] : 0);
      night[i + 2] = 14 + k * 70 + (g ? g[2] : 0);
      night[i + 3] = 255;
    }
  }
  for (let y = 0; y < POP_H; y++) {
    for (let x = 0; x < POP_W; x++) {
      const p = spotAt((x + 0.5) / POP_W, (y + 0.5) / POP_H);
      const raw = fractal(p.u, p.v, spec.settleSeed, 4);
      const s = raw * (spec.settleMask?.(p) ?? 1);
      lum[y * POP_W + x] = spec.population
        ? spec.population(p, raw)
        : s > 0.58
          ? (s - 0.58) / 0.42
          : 0;
    }
  }
  return { w, h, day, night, lum };
}

function toCanvas(data: Uint8ClampedArray<ArrayBuffer>, w: number, h: number) {
  const c = makeCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx?.putImageData(new ImageData(data, w, h), 0, 0);
  return { c, ok: !!ctx };
}

function proceduralWorld(spec: WorldSpec): Proc {
  const px = renderWorld(spec);
  const day = toCanvas(px.day, px.w, px.h);
  const night = toCanvas(px.night, px.w, px.h);
  return {
    day: day.c,
    night: night.c,
    population: gridFromLuminance(
      day.ok && night.ok ? px.lum : new Float32Array(px.lum.length).fill(1),
      POP_W,
      POP_H
    ),
  };
}

interface Proc {
  day: HTMLCanvasElement;
  night: HTMLCanvasElement;
  population: PopulationGrid;
}

const MARS: WorldSpec = {
  seed: 1337,
  settleSeed: 4242,
  colorAt: ({ n, detail, lat }) => {
    let c = mix([150, 62, 34], [205, 120, 70], detail);
    if (n < 0.42) c = mix(c, [58, 30, 24], (0.42 - n) * 6);
    const cap = Math.min(1, Math.max(0, (lat - 0.86) * 12 + (n - 0.5)));
    return mix(c, [245, 245, 250], cap);
  },
};

const ICE: WorldSpec = {
  seed: 909,
  settleSeed: 777,
  colorAt: ({ n, detail, lat }) => {
    let c = mix([200, 225, 240], [245, 250, 255], detail);
    if (n < 0.45) c = mix(c, [70, 120, 170], (0.45 - n) * 6);
    const crack = Math.abs(detail - 0.5) < 0.012 ? 1 : 0;
    c = mix(c, [60, 230, 245], crack * 0.9);
    return mix(c, [250, 252, 255], Math.max(0, (lat - 0.9) * 8));
  },
};

/** How much of a lava river is here: 0 on crust, 1 in the white-hot core. */
const lavaVein = ({ n, detail }: Spot): number =>
  Math.max(
    1 - Math.abs(detail - 0.5) / 0.06,
    1 - Math.abs(n - 0.5) / 0.035,
    ramp(0.3 - n, 0, 0.06) * 0.8
  );

/** Magmar: black-red basalt cut by glowing orange-yellow lava rivers. */
export const LAVA: WorldSpec = {
  seed: 5150,
  settleSeed: 313,
  colorAt: (p) => {
    const t = Math.min(1, Math.max(0, lavaVein(p)));
    const plates = ramp(Math.abs(p.detail - 0.5), 0.1, 0.2);
    let crust = mix([26, 16, 18], [112, 46, 32], ramp(p.detail, 0.3, 0.75));
    crust = mix(crust, [14, 9, 12], plates * 0.6);
    const rim = mix(crust, [220, 64, 14], ramp(t, 0.03, 0.4));
    const swirl = ramp(
      Math.sin(p.u * 90 + p.detail * 14) * 0.5 + 0.5,
      0.3,
      0.9
    );
    const lava = mix(
      [255, 112, 18],
      [255, 236, 120],
      ramp(t, 0.5, 1) * 0.7 + swirl * 0.3
    );
    return mix(rim, lava, ramp(t, 0.3, 0.6));
  },
  settleMask: (p) => ramp(0.2 - lavaVein(p), 0, 0.2) * ramp(p.n, 0.3, 0.38),
  paintSettlement: (c, w) => mix(c, [120, 84, 76], w * 0.3),
  nightGlow: (p) => {
    const t = lavaVein(p);
    return t > 0.15 ? [235 * t, 85 * t, 14 * t] : null;
  },
};

const SPRINKLES = [
  [255, 70, 130],
  [60, 200, 255],
  [255, 232, 60],
  [120, 255, 150],
  [200, 130, 255],
];
const CANDY_BLOBS = [
  [255, 90, 150],
  [90, 220, 255],
  [255, 210, 60],
  [150, 255, 120],
  [220, 140, 255],
];

/** A sprinkle on a 170 x 85 lattice: a short bar at a random angle. */
function sprinkle({ u, v }: Spot): number[] | null {
  const cx = u * 170;
  const cy = v * 85;
  const ix = Math.floor(cx);
  const iy = Math.floor(cy);
  if (hash(ix, iy, 31) > 0.1) return null;
  const a = hash(ix, iy, 32) * Math.PI;
  const dx = cx - ix - 0.5;
  const dy = cy - iy - 0.5;
  const along = dx * Math.cos(a) + dy * Math.sin(a);
  const across = -dx * Math.sin(a) + dy * Math.cos(a);
  if (Math.abs(along) > 0.36 || Math.abs(across) > 0.13) return null;
  return SPRINKLES[Math.floor(hash(ix, iy, 33) * SPRINKLES.length)];
}

/** Sweetopia: pastel pink, mint and lemon swirls over chocolate seas. */
export const CANDY: WorldSpec = {
  seed: 2024,
  settleSeed: 99,
  colorAt: (p) => {
    const wave =
      (Math.sin(p.v * Math.PI * 7 + p.n * 11 + p.detail * 2.5) + 1) / 2;
    const pink = [255, 168, 205];
    const mint = [160, 238, 200];
    const lemon = [255, 242, 150];
    let c =
      wave < 0.5
        ? mix(pink, mint, ramp(wave, 0.2, 0.5))
        : mix(mint, lemon, ramp(wave, 0.5, 0.8));
    c = mix(c, [255, 255, 255], ramp(p.detail, 0.62, 0.9) * 0.35);
    if (p.n < 0.4) {
      const choc = mix([84, 48, 30], [128, 76, 48], p.detail);
      c = mix(c, choc, ramp(0.4 - p.n, 0, 0.025));
    }
    const dot = sprinkle(p);
    return dot ?? c;
  },
  settleMask: (p) => ramp(p.n, 0.42, 0.46) * 0.92,
  paintSettlement: (c, w, p) =>
    mix(
      c,
      CANDY_BLOBS[Math.floor(p.detail * 17) % CANDY_BLOBS.length],
      Math.min(1, w * 1.4)
    ),
};

/** Aquaria: a deep teal ocean with small sandy-green islands and reefs. */
const OCEAN_ISLAND = 0.575;
/** The land height: broad noise plus a little fine noise, for islets. */
const islandness = ({ n, detail }: Spot): number => n + (detail - 0.5) * 0.25;
export const OCEAN: WorldSpec = {
  seed: 7788,
  settleSeed: 1212,
  colorAt: (p) => {
    const { detail } = p;
    const n = islandness(p);
    const depth = ramp(OCEAN_ISLAND - n, 0, 0.22);
    let c = mix([30, 168, 172], [6, 66, 104], depth);
    c = mix(c, [14, 120, 150], ramp(detail, 0.55, 0.85) * 0.25);
    const shore = n - OCEAN_ISLAND;
    // Reef: a pale turquoise ring just outside each island.
    c = mix(c, [190, 255, 245], ramp(0.034 - Math.abs(shore + 0.034), 0, 0.02));
    // A white surf line where the sea meets the sand.
    if (shore > -0.012) c = mix(c, [248, 252, 250], ramp(shore, -0.012, 0));
    if (shore > 0.004) {
      const land = mix([214, 200, 128], [96, 170, 92], ramp(detail, 0.45, 0.7));
      c = mix(
        c,
        mix(land, [58, 140, 74], ramp(shore, 0.02, 0.07)),
        ramp(shore, 0.004, 0.014)
      );
    }
    return c;
  },
  settleMask: (p) => ramp(islandness(p) - OCEAN_ISLAND, 0.004, 0.012),
  // Everyone lives on the islands, thickest in the towns.
  population: (p, s) =>
    ramp(islandness(p) - OCEAN_ISLAND, 0.004, 0.012) * (0.4 + 0.6 * s),
  paintSettlement: (c, w) => mix(c, [250, 245, 235], w * 0.7),
};

/** The generated pixels of a procedural world (for tests; `size` is the map width). */
export function worldPixels(
  id: "lava" | "candy" | "ocean",
  w = W,
  h = H
): WorldPixels {
  return renderWorld({ lava: LAVA, candy: CANDY, ocean: OCEAN }[id], w, h);
}

const marsWorld = (): Proc => proceduralWorld(MARS);
const iceWorld = (): Proc => proceduralWorld(ICE);

async function load(id: PlanetId): Promise<Omit<PlanetTextures, "id">> {
  if (id === "earth") {
    const [day, night] = await Promise.all([
      loadImage("/planet-smasher/textures/earth-day.jpg"),
      loadImage("/planet-smasher/textures/earth-night.jpg"),
    ]);
    return {
      day,
      night,
      population: gridFromLuminance(earthLuminance(night), POP_W, POP_H),
    };
  }
  if (id === "lava") return proceduralWorld(LAVA);
  if (id === "candy") return proceduralWorld(CANDY);
  if (id === "ocean") return proceduralWorld(OCEAN);
  return id === "mars" ? marsWorld() : iceWorld();
}

/** Loads (and caches) a planet's maps and its population grid. */
export function loadPlanetTextures(id: PlanetId): Promise<PlanetTextures> {
  let p = cache.get(id);
  if (!p) {
    p = load(id).then((t) => ({ ...t, id }));
    // A failed load must not stick.
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}
