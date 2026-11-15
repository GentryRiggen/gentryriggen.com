export const NANOBOT_TICKS = 40;
/** Seconds between ticks. */
export const NANOBOT_STEP = 0.25;
/** Seconds the droplet takes to land (tick 0 lands with it). */
export const NANOBOT_FALL = 0.25;
const SPREAD = 0.06;

/** A small deterministic hash of two integers into 0..1. */
function hash(a: number, b: number): number {
  let h = (Math.imul(a | 0, 0x9e3779b1) ^ Math.imul(b | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

/**
 * Where tick `k` (0..39) lands, as a tangent-plane offset in radians from the
 * tap (du toward the first tangent, dv toward the second). A wandering heading
 * with an outward drift: the distance grows about sqrt(k) x 0.06, and the same
 * seed always gives the same path.
 */
export function nanobotTick(
  k: number,
  seed: number
): { du: number; dv: number } {
  let heading = hash(seed, 9001) * Math.PI * 2;
  for (let j = 1; j <= k; j++) heading += (hash(seed, j) - 0.5) * 1.1;
  const r = SPREAD * Math.sqrt(k) * (0.85 + 0.3 * hash(seed, 500 + k));
  return { du: Math.cos(heading) * r, dv: Math.sin(heading) * r };
}

/**
 * The clock behind the swarm: hands out the ticks that are due. Once the game
 * is no longer playing it stops for good.
 */
export class NanobotSchedule {
  private age = 0;
  /** The next tick to fire. */
  next = 0;
  stopped = false;

  get finished(): boolean {
    return this.next >= NANOBOT_TICKS;
  }

  /** Advances by `dt`; returns the tick numbers that fall due. */
  step(dt: number, playing: boolean): number[] {
    if (this.stopped) return [];
    if (!playing) {
      this.stopped = true;
      return [];
    }
    this.age += dt;
    const due: number[] = [];
    while (
      this.next < NANOBOT_TICKS &&
      this.age >= NANOBOT_FALL + this.next * NANOBOT_STEP - 1e-9
    ) {
      due.push(this.next++);
    }
    return due;
  }
}
