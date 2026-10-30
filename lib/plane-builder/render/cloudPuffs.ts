import type { Obstacle } from "@/lib/plane-builder/levels/types";

/** One puff in a cloud's layout, in the cloud's unit box (-0.5..0.5). */
export interface PuffSpec {
  x: number;
  y: number;
  z: number;
  /** Sprite diameter as a share of the box's mean horizontal width. */
  size: number;
}

export type CloudStyle = "puff" | "storm";

function ring(
  count: number,
  radius: number,
  y: number,
  size: number,
  turn = 0
): PuffSpec[] {
  return Array.from({ length: count }, (_, i) => {
    const a = turn + (2 * Math.PI * i) / count;
    return {
      x: Math.cos(a) * radius,
      y,
      z: Math.sin(a) * radius,
      size,
    };
  });
}

/**
 * A fair-weather heap: a wide low belly, a middle row and a bright crown.
 */
const PUFF_LAYOUT: readonly PuffSpec[] = [
  ...ring(7, 0.3, -0.3, 0.44),
  { x: 0, y: -0.3, z: 0, size: 0.46 },
  ...ring(6, 0.2, -0.02, 0.4, 0.4),
  { x: 0, y: 0, z: 0, size: 0.44 },
  ...ring(4, 0.1, 0.24, 0.32, 0.9),
  { x: 0, y: 0.36, z: 0, size: 0.32 },
];

/**
 * A thunderhead: a wide dark skirt, a body, a tall narrow tower and a flat
 * anvil spreading out at the top.
 */
const STORM_LAYOUT: readonly PuffSpec[] = [
  ...ring(7, 0.34, -0.32, 0.38),
  ...ring(6, 0.16, -0.1, 0.34, 0.3),
  { x: 0, y: -0.08, z: 0, size: 0.4 },
  ...ring(4, 0.07, 0.14, 0.28, 0.7),
  { x: 0, y: 0.18, z: 0, size: 0.3 },
  ...ring(4, 0.22, 0.34, 0.26, 0.2),
  { x: 0, y: 0.4, z: 0, size: 0.3 },
];

export const CLOUD_LAYOUTS: Readonly<Record<CloudStyle, readonly PuffSpec[]>> =
  { puff: PUFF_LAYOUT, storm: STORM_LAYOUT };

/** Puff diameters never exceed this multiple of a box's height. */
const MAX_SIZE_PER_HEIGHT = 1.2;

/** A repeatable 0..1 number from where a cloud stands. */
function hash01(x: number, z: number, salt: number): number {
  const n = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

export interface CloudPuffs {
  /** x, y, z per puff. */
  positions: Float32Array;
  /** World diameter per puff. */
  sizes: Float32Array;
  /** 0 belly .. 1 crown per puff. */
  shades: Float32Array;
  count: number;
}

/**
 * Every puff of every cloud, in world space, sorted far to near along the
 * course (x descending) so the chase camera blends them back to front without
 * a per-frame sort. Each cloud turns its layout by a hash of its position.
 */
export function buildCloudPuffs(
  clouds: readonly Obstacle[],
  style: CloudStyle
): CloudPuffs {
  const layout = CLOUD_LAYOUTS[style];
  const puffs: {
    x: number;
    y: number;
    z: number;
    size: number;
    shade: number;
  }[] = [];
  for (const cloud of clouds) {
    const { center, half } = cloud;
    const width = half.x * 2;
    const height = half.y * 2;
    const depth = half.z * 2;
    const angle = hash01(center.x, center.z, 1) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    layout.forEach((spec, i) => {
      const jitter = (salt: number) =>
        (hash01(center.x + i, center.z, salt) - 0.5) * 0.06;
      // Turn the layout about the cloud's axis, then stretch it to the box.
      const lx = spec.x + jitter(2);
      const lz = spec.z + jitter(3);
      const x = (lx * cos - lz * sin) * width;
      const z = (lx * sin + lz * cos) * depth;
      const size = Math.min(
        spec.size * ((width + depth) / 2) * (1 + jitter(4)),
        height * MAX_SIZE_PER_HEIGHT
      );
      puffs.push({
        x: center.x + x,
        y: center.y + (spec.y + jitter(5)) * height,
        z: center.z + z,
        size,
        shade: spec.y + 0.5,
      });
    });
  }
  puffs.sort((a, b) => b.x - a.x);
  const positions = new Float32Array(puffs.length * 3);
  const sizes = new Float32Array(puffs.length);
  const shades = new Float32Array(puffs.length);
  puffs.forEach((p, i) => {
    positions.set([p.x, p.y, p.z], i * 3);
    sizes[i] = p.size;
    shades[i] = p.shade;
  });
  return { positions, sizes, shades, count: puffs.length };
}
