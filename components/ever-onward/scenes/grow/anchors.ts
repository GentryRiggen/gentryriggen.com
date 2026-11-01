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

/** The farm (same 400 by 300 box): two rows of up to four fields. */
export const FIELD_W = 82;
export const fieldAt = (i: number): Point => ({
  x: 22 + (i % 4) * 90,
  y: i < 4 ? 150 : 196,
});
export const FARM_BARN: Point = { x: 312, y: 88 };
export const SILO: Point = { x: 286, y: 78 };
export const FARM_GLASS: Point = { x: 296, y: 244 };
export const COMPOST: Point = { x: 214, y: 256 };
export const AGENT: Point = { x: 254, y: 252 };
export const DITCH: Point = { x: 200, y: 186 };
export const tractorAt = (i: number): Point => ({ x: 20 + i * 36, y: 248 });
export const wellAt = (i: number): Point => ({ x: 20 + i * 22, y: 278 });
export const droneAt = (i: number): Point => ({
  x: 150 + i * 34,
  y: 56 + (i % 2) * 14,
});
export const FAIR_TENT: Point = { x: 212, y: 98 };
export const TOWN: Point = { x: 24, y: 94 };

/** The globe (same 400 by 300 box). */
export const GLOBE: Point & { r: number } = { x: 200, y: 150, r: 110 };
export const GLOBE_WINDBREAK: Point = { x: 150, y: 104 };
export const GLOBE_RAIN: Point = { x: 246, y: 74 };
export const GLOBE_ROVER: Point = { x: 188, y: 176 };
export const GLOBE_SEEDER: Point = { x: 276, y: 60 };
export const GLOBE_VAULT: Point = { x: 200, y: 262 };
export const riverAt = (i: number): Point => ({
  x: 120 + ((i * 37) % 130),
  y: 118 + ((i * 29) % 90),
});
export const cloudAt = (i: number): Point => ({
  x: 96 + ((i * 61) % 190),
  y: 70 + ((i * 43) % 120),
});
export const GLOBE_FLOCK: Point = { x: 300, y: 96 };

/** The old window box (same 400 by 300 box): the pot sits on the sill. */
export const SILL_Y = 186;
export const POT: Point = { x: 200, y: 158 };
export const SEED_LANTERN: Point = { x: 134, y: 176 };
export const SEED_CAN: Point = { x: 162, y: 180 };
export const SEED_DEW: Point = { x: 246, y: 181 };
export const SEED_MUSIC: Point = { x: 276, y: 178 };
export const SEED_CHIME: Point = { x: 276, y: 50 };
export const SEED_TRELLIS: Point = { x: 200, y: 110 };
export const SEED_SILL: Point = { x: 200, y: 190 };
