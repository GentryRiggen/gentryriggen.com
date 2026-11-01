/** Shared scene geometry (the 400x300 picture): layers draw it, callouts point at it. */

export interface Point {
  x: number;
  y: number;
}

// ------------------------------------------------------------------ Night

export const PLANET = { cx: 200, cy: 440, r: 300 } as const;

/** A point on the planet at `angle` (radians from the top), `depth` below the rim. */
export function planetPoint(angle: number, depth: number): Point {
  const radius = PLANET.r - depth;
  return {
    x: PLANET.cx + radius * Math.sin(angle),
    y: PLANET.cy - radius * Math.cos(angle),
  };
}

/** Where each machine stands on the horizon, as a distance from the middle. */
export const NIGHT_SLOTS = {
  crank: -150,
  gen1: -100,
  gen2: -50,
  gen3: 0,
  gen4: 50,
  grid: 100,
} as const;

export type NightSlot = keyof typeof NIGHT_SLOTS;

export const slotAngle = (slot: NightSlot): number =>
  Math.asin(NIGHT_SLOTS[slot] / PLANET.r);

/** The top of a machine's sprite, where its callout points. */
export function slotTop(slot: NightSlot): Point {
  const base = planetPoint(slotAngle(slot), 0);
  return { x: base.x, y: base.y - 26 };
}

// ------------------------------------------------------------------ Coast

export const LAMP = { x: 110, y: 122 } as const;
/** First far lighthouse, and the gap between them. */
export const FAR_LIGHT_X = 180;
export const FAR_LIGHT_GAP = 21;
export const COTTAGE = { x: 146, y: 232 } as const;
export const DEPOT = { x: 20, y: 252 } as const;
export const GUARD_STATION = { x: 44, y: 255 } as const;
/** Where the tide clock's nets and mill stand, by the rock (kept above the caption bar on a phone, which crops the picture's bottom). */
export const TIDE = { poleX: 198, netsX: 212, millX: 176, y: 246 } as const;

export const QUAY = { market: 340, ferry: 364, terminal: 384, y: 172 } as const;

// -------------------------------------------------------------------- Sky

export const SUN = { x: 200, y: 150 } as const;
export const AIM_DISH = { x: 200, y: 246 } as const;
export const LAKE = { x: 305, y: 288 } as const;
export const RELAY_RADIUS = 118;

// ------------------------------------------------------------------- Last

export const LIGHT_COUNT = 11;
export const LAST_LIGHTS: readonly Point[] = Array.from(
  { length: LIGHT_COUNT },
  (_, i) => ({ x: 30 + i * 34, y: 120 + 45 * Math.sin(i * 2.1) })
);
