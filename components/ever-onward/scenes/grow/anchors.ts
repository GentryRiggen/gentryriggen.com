/** Where things stand in the backyard picture (a 400 by 300 box). */
export interface Point {
  x: number;
  y: number;
}

/** Raised beds, four to a row, the second row a little nearer. */
export const BED_W = 62;
export const BED_H = 16;
export const bedAt = (i: number): Point => ({
  x: 40 + (i % 4) * 86 + (i < 4 ? 0 : 14),
  y: i < 4 ? 160 : 196,
});

export const hiveAt = (i: number): Point => ({ x: 26 + i * 26, y: 120 });
export const barrelAt = (i: number): Point => ({ x: 20 + i * 18, y: 226 });
export const gardenerAt = (i: number): Point => ({
  x: 112 + i * 28,
  y: 222,
});
export const basketAt = (i: number): Point => ({ x: 112 + i * 14, y: 244 });

export const GREENHOUSE: Point = { x: 310, y: 112 };
export const TREES: readonly Point[] = [
  { x: 242, y: 110 },
  { x: 264, y: 110 },
  { x: 286, y: 110 },
];
export const STAND: Point = { x: 318, y: 222 };
export const BARROW: Point = { x: 292, y: 238 };
export const TEA: Point = { x: 100, y: 246 };
export const FRAME: Point = { x: 160, y: 250 };
export const KEEPER: Point = { x: 232, y: 124 };
export const SILL_BOX: Point = { x: 250, y: 268 };
export const SPROUT: Point = { x: 298, y: 268 };
export const SUN: Point = { x: 350, y: 44 };
