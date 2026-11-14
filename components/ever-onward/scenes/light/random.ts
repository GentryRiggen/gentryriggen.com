/** Small seeded generator so the scene's stars and lights never move. */
export function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Star {
  x: number;
  y: number;
  r: number;
  twinkle: "lm-twinkle" | "lm-twinkle-b" | "lm-twinkle-c" | "";
}

const TWINKLES = ["lm-twinkle", "lm-twinkle-b", "lm-twinkle-c", ""] as const;

/** `count` stars spread across (and a little beyond) the 400x300 scene. */
export function makeStars(
  seed: number,
  count: number,
  avoid?: { x: number; y: number; radius: number }
): Star[] {
  const rand = seeded(seed);
  const stars: Star[] = [];
  while (stars.length < count) {
    const x = -60 + rand() * 520;
    const y = -40 + rand() * 380;
    const r = 0.6 + rand() * 1;
    const twinkle = TWINKLES[Math.floor(rand() * TWINKLES.length)];
    if (avoid && Math.hypot(x - avoid.x, y - avoid.y) < avoid.radius) continue;
    stars.push({ x, y, r, twinkle });
  }
  return stars;
}
