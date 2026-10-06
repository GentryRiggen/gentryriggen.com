import type { BowShape, SternShape } from "./types";

export interface HullEndDef<T extends string> {
  id: T;
  name: string;
  description: string;
  /** Cells the shape extends beyond the grid (forward of x = 0, or aft). */
  length: number;
  /** Knots added to top speed before clamping, when the ship can move. */
  speedModifier: number;
}

export const BOW_SHAPES: Record<BowShape, HullEndDef<BowShape>> = {
  straight: {
    id: "straight",
    name: "Straight",
    description: "Tall and upright, like the Titanic",
    length: 2,
    speedModifier: 0,
  },
  clipper: {
    id: "clipper",
    name: "Clipper",
    description: "Long and sharp, leaning forward",
    length: 3,
    speedModifier: 0,
  },
  bulbous: {
    id: "bulbous",
    name: "Bulbous",
    description: "A round bulb under the water · a little faster",
    length: 2.2,
    speedModifier: 1,
  },
  icebreaker: {
    id: "icebreaker",
    name: "Icebreaker",
    description: "Sloped to ride up onto ice · slower",
    length: 2.2,
    speedModifier: -1.5,
  },
  beakhead: {
    id: "beakhead",
    name: "Beakhead",
    description: "A long beak under a bowsprit, like a galleon",
    length: 3,
    speedModifier: 0,
  },
};

export const STERN_SHAPES: Record<SternShape, HullEndDef<SternShape>> = {
  counter: {
    id: "counter",
    name: "Counter",
    description: "Rounded and overhanging, like the Titanic",
    length: 1.5,
    speedModifier: 0,
  },
  cruiser: {
    id: "cruiser",
    name: "Cruiser",
    description: "Smooth and sloping · a little faster",
    length: 1.8,
    speedModifier: 0.5,
  },
  transom: {
    id: "transom",
    name: "Transom",
    description: "Flat and square, cut straight off",
    length: 0.6,
    speedModifier: 0,
  },
  canoe: {
    id: "canoe",
    name: "Canoe",
    description: "Pointed at both ends",
    length: 1.8,
    speedModifier: 0,
  },
  galleon: {
    id: "galleon",
    name: "Galleon",
    description: "Tall and square with a window castle · a little slower",
    length: 1.4,
    speedModifier: -0.5,
  },
};

export function bowLength(bow: BowShape): number {
  return BOW_SHAPES[bow].length;
}

export function sternLength(stern: SternShape): number {
  return STERN_SHAPES[stern].length;
}

/** Knots the ship's bow and stern add to (or take from) its top speed. */
export function hullSpeedModifier(bow: BowShape, stern: SternShape): number {
  return BOW_SHAPES[bow].speedModifier + STERN_SHAPES[stern].speedModifier;
}
