/** Radius of the sky dome and the starfield, beyond the fog. */
export const SKY_RADIUS = 450;

/** A small seeded generator so the sky looks the same on every load. */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const STAR_COUNT = 700;
/** Stars start a little above the horizon so none hide in the haze. */
const STAR_MIN_ELEVATION = 0.04;

/** xyz positions of stars scattered over the upper half of the sky. */
export function starPositions(count = STAR_COUNT): Float32Array {
  const random = createRandom(7);
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const up = STAR_MIN_ELEVATION + random() * (1 - STAR_MIN_ELEVATION);
    const around = random() * Math.PI * 2;
    const flat = Math.sqrt(1 - up * up);
    positions[i * 3] = Math.cos(around) * flat * SKY_RADIUS;
    positions[i * 3 + 1] = up * SKY_RADIUS;
    positions[i * 3 + 2] = Math.sin(around) * flat * SKY_RADIUS;
  }
  return positions;
}

export const CLOUD_COUNT = 30;
export const PUFFS_PER_CLOUD = 6;
const CLOUD_MIN_RADIUS = 70;
const CLOUD_MAX_RADIUS = 300;
const CLOUD_MIN_HEIGHT = 24;
const CLOUD_MAX_HEIGHT = 48;

export interface CloudPuffs {
  positions: Float32Array;
  /** World size of each puff. */
  sizes: Float32Array;
  /** Cover at which the puff's cloud appears; puffs of a cloud share it. */
  ranks: Float32Array;
  /** 0 pale top .. 1 dark belly, so a cloud isn't one flat tone. */
  shades: Float32Array;
}

/**
 * Clusters of soft puffs ringed around the ship, far enough out that none
 * drift between a high camera and the ship.
 */
export function cloudPuffs(): CloudPuffs {
  const random = createRandom(31);
  const total = CLOUD_COUNT * PUFFS_PER_CLOUD;
  const positions = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const ranks = new Float32Array(total);
  const shades = new Float32Array(total);
  for (let cloud = 0; cloud < CLOUD_COUNT; cloud++) {
    const around = random() * Math.PI * 2;
    const radius =
      CLOUD_MIN_RADIUS + random() * (CLOUD_MAX_RADIUS - CLOUD_MIN_RADIUS);
    const height =
      CLOUD_MIN_HEIGHT + random() * (CLOUD_MAX_HEIGHT - CLOUD_MIN_HEIGHT);
    const rank = random();
    for (let puff = 0; puff < PUFFS_PER_CLOUD; puff++) {
      const i = cloud * PUFFS_PER_CLOUD + puff;
      positions[i * 3] = Math.cos(around) * radius + (random() - 0.5) * 50;
      positions[i * 3 + 1] = height + (random() - 0.5) * 8;
      positions[i * 3 + 2] = Math.sin(around) * radius + (random() - 0.5) * 50;
      sizes[i] = 30 + random() * 26;
      ranks[i] = rank;
      shades[i] = random();
    }
  }
  return { positions, sizes, ranks, shades };
}
