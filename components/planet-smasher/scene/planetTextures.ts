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
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
}

interface Proc {
  day: HTMLCanvasElement;
  night: HTMLCanvasElement;
  population: PopulationGrid;
}

function proceduralWorld(
  seed: number,
  colorAt: (n: number, detail: number, lat: number) => number[],
  settleSeed: number
): Proc {
  const day = makeCanvas(W, H);
  const night = makeCanvas(W, H);
  const dctx = day.getContext("2d");
  const nctx = night.getContext("2d");
  const lum = new Float32Array(POP_W * POP_H);
  if (dctx && nctx) {
    const dimg = dctx.createImageData(W, H);
    const nimg = nctx.createImageData(W, H);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      const lat = Math.abs(v - 0.5) * 2;
      for (let x = 0; x < W; x++) {
        const u = x / W;
        const n = fractal(u, v, seed);
        const detail = fractal(u, v, seed + 7, 6);
        const [r, g, b] = colorAt(n, detail, lat);
        const i = (y * W + x) * 4;
        dimg.data[i] = r;
        dimg.data[i + 1] = g;
        dimg.data[i + 2] = b;
        dimg.data[i + 3] = 255;
        const s = fractal(u, v, settleSeed, 4);
        const glow = s > 0.58 ? Math.min(1, (s - 0.58) / 0.12) : 0;
        nimg.data[i] = 8 + glow * 247;
        nimg.data[i + 1] = 8 + glow * 170;
        nimg.data[i + 2] = 14 + glow * 70;
        nimg.data[i + 3] = 255;
      }
    }
    dctx.putImageData(dimg, 0, 0);
    nctx.putImageData(nimg, 0, 0);
    for (let y = 0; y < POP_H; y++) {
      for (let x = 0; x < POP_W; x++) {
        const s = fractal((x + 0.5) / POP_W, (y + 0.5) / POP_H, settleSeed, 4);
        lum[y * POP_W + x] = s > 0.58 ? (s - 0.58) / 0.42 : 0;
      }
    }
  } else {
    lum.fill(1);
  }
  return { day, night, population: gridFromLuminance(lum, POP_W, POP_H) };
}

function marsWorld(): Proc {
  return proceduralWorld(
    1337,
    (n, detail, lat) => {
      let c = mix([150, 62, 34], [205, 120, 70], detail);
      if (n < 0.42) c = mix(c, [58, 30, 24], Math.min(1, (0.42 - n) * 6));
      const cap = Math.min(1, Math.max(0, (lat - 0.86) * 12 + (n - 0.5)));
      return mix(c, [245, 245, 250], cap);
    },
    4242
  );
}

function iceWorld(): Proc {
  return proceduralWorld(
    909,
    (n, detail, lat) => {
      let c = mix([200, 225, 240], [245, 250, 255], detail);
      if (n < 0.45) c = mix(c, [70, 120, 170], Math.min(1, (0.45 - n) * 6));
      const crack = Math.abs(detail - 0.5) < 0.012 ? 1 : 0;
      c = mix(c, [60, 230, 245], crack * 0.9);
      return mix(c, [250, 252, 255], Math.max(0, (lat - 0.9) * 8));
    },
    777
  );
}

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
