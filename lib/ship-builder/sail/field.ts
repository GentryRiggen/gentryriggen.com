import type { Obstacle, ObstacleKind, SailState } from "./types";

/** Side length of one square sector, in cells. */
export const SECTOR_SIZE = 40;
/** Sectors seeded around the ship (Chebyshev distance). */
export const FIELD_RING = 3;
/** Sectors farther than this from the ship are dropped. */
export const FIELD_KEEP = 5;
/** Nothing is seeded this close to the start, so a new sail begins in open water. */
export const START_CLEAR_RADIUS = 30;

export type Density = "few" | "some" | "many";

export interface FieldConfig {
  seed: number;
  kinds: ObstacleKind[];
  density: Density;
}

/** Expected obstacles per sector. */
export const DENSITY_COUNT: Record<Density, number> = {
  few: 1,
  some: 2,
  many: 4,
};

const RADIUS_RANGE: Record<ObstacleKind, readonly [number, number]> = {
  iceberg: [3, 5],
  rock: [1.5, 3],
  buoy: [0.8, 0.8],
  ship: [4, 4],
};

const OTHER_SHIP_SPEED: readonly [number, number] = [1, 3];

export function sectorKey(sx: number, sz: number): string {
  return `${sx}:${sz}`;
}

function parseSectorKey(key: string): [number, number] {
  const [sx, sz] = key.split(":").map(Number);
  return [sx, sz];
}

/** FNV-1a: a small, well-spread string hash. */
function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (rand: () => number, [lo, hi]: readonly [number, number]) =>
  lo + rand() * (hi - lo);

export function obstaclesForSector(
  config: FieldConfig,
  sx: number,
  sz: number
): Obstacle[] {
  if (config.kinds.length === 0) return [];

  const key = sectorKey(sx, sz);
  const rand = mulberry32(hashString(`${config.seed}:${key}`));
  const jitter = Math.floor(rand() * 3) - 1;
  const count = Math.max(0, DENSITY_COUNT[config.density] + jitter);

  const obstacles: Obstacle[] = [];
  for (let i = 0; i < count; i++) {
    // Draw everything for obstacle i before deciding whether to keep it, so
    // skipping one never shifts the others.
    const kind = config.kinds[Math.floor(rand() * config.kinds.length)];
    const x = (sx + rand()) * SECTOR_SIZE;
    const z = (sz + rand()) * SECTOR_SIZE;
    const radius = between(rand, RADIUS_RANGE[kind]);
    const heading = rand() * Math.PI * 2;
    const speed = between(rand, OTHER_SHIP_SPEED);

    if (Math.hypot(x, z) < START_CLEAR_RADIUS) continue;

    obstacles.push({
      id: `${key}:${i}`,
      kind,
      x,
      z,
      radius,
      sector: key,
      ...(kind === "ship" ? { heading, speed } : {}),
    });
  }
  return obstacles;
}

const chebyshev = (sx: number, sz: number, cx: number, cz: number) =>
  Math.max(Math.abs(sx - cx), Math.abs(sz - cz));

/**
 * Seed the sectors around the ship and drop the ones left far behind.
 * Returns the same object when nothing changed.
 */
export function syncField(state: SailState, config: FieldConfig): SailState {
  const cx = Math.floor(state.x / SECTOR_SIZE);
  const cz = Math.floor(state.z / SECTOR_SIZE);

  const kept = state.sectors.filter((key) => {
    const [sx, sz] = parseSectorKey(key);
    return chebyshev(sx, sz, cx, cz) <= FIELD_KEEP;
  });
  const known = new Set(kept);

  const added: Obstacle[] = [];
  for (let sx = cx - FIELD_RING; sx <= cx + FIELD_RING; sx++) {
    for (let sz = cz - FIELD_RING; sz <= cz + FIELD_RING; sz++) {
      const key = sectorKey(sx, sz);
      if (known.has(key)) continue;
      known.add(key);
      added.push(...obstaclesForSector(config, sx, sz));
    }
  }

  const dropped = kept.length !== state.sectors.length;
  if (!dropped && added.length === 0 && known.size === state.sectors.length) {
    return state;
  }

  const survivors = dropped
    ? state.obstacles.filter((o) => known.has(o.sector))
    : state.obstacles;
  return {
    ...state,
    sectors: [...known],
    obstacles: [...survivors, ...added],
  };
}
