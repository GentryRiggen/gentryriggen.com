/**
 * The room kit's modern cruise-ship pieces (the Concordia, 1.18): their ids,
 * where each is mounted and the floor footprint of each that can block the
 * walker. Pure data, no three.js; the geometry is
 * `components/shipwreck/interior/modernPieces.ts`.
 *
 * The ids are the spec's `PieceId` additions, spelled the same. Until they
 * join `PieceId` (`types.ts`), `ModernPieceId` names them; then it becomes
 * `Extract<PieceId, ...>` and `MODERN_PIECE_FOOTPRINT` spreads into
 * `PIECE_FOOTPRINT` (kit.ts), with the same rules: a piece is centred on
 * its footprint, its back (the wall side) to −x and its front to +x, a
 * quarter turn swaps lx and ly.
 */

export const MODERN_PIECE_IDS = [
  "glass-lift-car",
  "lift-shaft",
  "glass-rail",
  "theatre-seat-row",
  "stage-curtain",
  "stage-lights",
  "pool-edge",
  "lounger",
  "cabin-bed",
  "cabin-sofa",
  "desk",
  "tv",
  "balcony-door",
  "balcony-rail",
  "balcony-chair",
  "cabin-door",
  "bar-counter",
  "bar-stool",
  "atrium-stair",
  "pirate-ship",
  "castle-tower",
  "beanbag",
  "kids-table",
  "toy-shelf",
  "soft-play",
  "exit-sign",
  "emergency-lamp",
] as const;

export type ModernPieceId = (typeof MODERN_PIECE_IDS)[number];

/**
 * Where a piece's origin goes (`addPiece` in the scene's kit.ts):
 *
 * - `floor`: on the floor at its spot, facing its yaw.
 * - `wall`: at a wall's foot, x out of the wall into the room.
 * - `ceiling`: at the ceiling over its spot.
 * - `edge`: along a room edge (a run from one point to another).
 * - `lift`: drawn by the lift (the car, moved by matrix), not placed.
 */
export type PieceMount = "floor" | "wall" | "ceiling" | "edge" | "lift";

export const MODERN_PIECE_MOUNT: Record<ModernPieceId, PieceMount> = {
  "glass-lift-car": "lift",
  "lift-shaft": "floor",
  "glass-rail": "edge",
  "theatre-seat-row": "floor",
  "stage-curtain": "floor",
  "stage-lights": "ceiling",
  "pool-edge": "floor",
  lounger: "floor",
  "cabin-bed": "floor",
  "cabin-sofa": "floor",
  desk: "floor",
  tv: "wall",
  "balcony-door": "wall",
  "balcony-rail": "edge",
  "balcony-chair": "floor",
  "cabin-door": "wall",
  "bar-counter": "floor",
  "bar-stool": "floor",
  "atrium-stair": "edge",
  "pirate-ship": "floor",
  "castle-tower": "floor",
  beanbag: "floor",
  "kids-table": "floor",
  "toy-shelf": "floor",
  "soft-play": "floor",
  "exit-sign": "wall",
  "emergency-lamp": "wall",
};

/**
 * The floor footprint of each modern piece that can block the walker (m),
 * as `PIECE_FOOTPRINT`. A seat row is ten 0.55 m seats (the theatre's
 * sections are about 5.9 m between the aisles' 1.1 m clear); the pool is
 * its 9 × 4.5 m basin and coping; a cabin bed is a twin (two pushed
 * together make the stateroom's queen, as on the real ship).
 */
export const MODERN_PIECE_FOOTPRINT: Partial<
  Record<ModernPieceId, { lx: number; ly: number }>
> = {
  "theatre-seat-row": { lx: 0.8, ly: 5.5 },
  "pool-edge": { lx: 9.8, ly: 5.3 },
  lounger: { lx: 1.95, ly: 0.7 },
  "cabin-bed": { lx: 2.0, ly: 0.9 },
  "cabin-sofa": { lx: 0.85, ly: 1.8 },
  desk: { lx: 0.5, ly: 1.2 },
  "bar-counter": { lx: 0.7, ly: 3.0 },
  "pirate-ship": { lx: 3.2, ly: 1.6 },
  "castle-tower": { lx: 1.6, ly: 1.6 },
  beanbag: { lx: 0.8, ly: 0.8 },
  "kids-table": { lx: 1.3, ly: 1.3 },
  "toy-shelf": { lx: 0.4, ly: 1.4 },
  "soft-play": { lx: 2.0, ly: 2.0 },
};
