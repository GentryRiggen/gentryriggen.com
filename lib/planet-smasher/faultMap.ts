import { seeded } from "./rng";

export const FAULT_W = 512;
export const FAULT_H = 256;
const PLATE_COUNT = 14;
/** Angular distance (radians) over which a border fades out. */
const BORDER_FADE = 0.05;

/** A stable 32-bit seed for a planet id. */
export function faultSeed(planetId: string): number {
  let h = 2166136261;
  for (let i = 0; i < planetId.length; i++) {
    h = Math.imul(h ^ planetId.charCodeAt(i), 16777619);
  }
  return h | 0;
}

/** Plate centres: roughly even points on the sphere, nudged by the rng. */
function plateCentres(rand: () => number): [number, number, number][] {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: [number, number, number][] = [];
  for (let i = 0; i < PLATE_COUNT; i++) {
    const y = 1 - (2 * (i + 0.5)) / PLATE_COUNT + (rand() - 0.5) * 0.25;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = golden * i + (rand() - 0.5) * 0.6;
    const x = Math.cos(th) * r;
    const z = Math.sin(th) * r;
    const len = Math.hypot(x, y, z) || 1;
    out.push([x / len, y / len, z / len]);
  }
  return out;
}

/**
 * A spherical Voronoi of plates, as RGBA bytes (row 0 is v = 0, the south
 * pole). R is 1 on a plate border and fades to 0 over `BORDER_FADE` radians;
 * G is a random "reveal order" shared by every texel of the same border (the
 * two plates that meet there), so a border opens all along its length at once.
 * B is 0 and A is 255. The same seed always gives the same map.
 */
export function buildFaultMap(
  seed: number,
  width = FAULT_W,
  height = FAULT_H
): Uint8Array {
  const rand = seeded(seed);
  const centres = plateCentres(rand);
  const reveal: number[][] = centres.map(() => centres.map(() => 0));
  for (let a = 0; a < PLATE_COUNT; a++) {
    for (let b = a + 1; b < PLATE_COUNT; b++) {
      reveal[a][b] = reveal[b][a] = rand();
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const lat = ((y + 0.5) / height - 0.5) * Math.PI;
    const cy = Math.sin(lat);
    const cr = Math.cos(lat);
    for (let x = 0; x < width; x++) {
      const lon = ((x + 0.5) / width) * Math.PI * 2;
      const px = cr * Math.cos(lon);
      const pz = cr * Math.sin(lon);
      let best = -2;
      let second = -2;
      let bestId = 0;
      let secondId = 0;
      for (let i = 0; i < PLATE_COUNT; i++) {
        const c = centres[i];
        const d = px * c[0] + cy * c[1] + pz * c[2];
        if (d > best) {
          second = best;
          secondId = bestId;
          best = d;
          bestId = i;
        } else if (d > second) {
          second = d;
          secondId = i;
        }
      }
      const gap =
        (Math.acos(Math.min(1, Math.max(-1, second))) -
          Math.acos(Math.min(1, Math.max(-1, best)))) /
        2;
      const closeness = 1 - Math.min(1, gap / BORDER_FADE);
      const o = (y * width + x) * 4;
      data[o] = Math.round(closeness * 255);
      data[o + 1] = Math.round(reveal[bestId][secondId] * 255);
      data[o + 3] = 255;
    }
  }
  return data;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How open the faults are (0..1) for a planet at `health` (0..100). */
export function crackTarget(health: number): number {
  return smoothstep(0.35, 0.95, 1 - health / 100);
}

/** Moves `current` toward `target`, settling in about half a second. */
export function easeCrack(current: number, target: number, dt: number): number {
  // Healing only happens when a new planet starts: clear it at once.
  if (target < current) return target;
  return current + (target - current) * (1 - Math.exp(-dt / 0.15));
}
