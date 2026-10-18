import type { BonusKind } from "./bonuses";

/** Share of squares with nothing on them. */
const EMPTY_SHARE = 0.35;
const STAR_BASE = 0.01;
const STAR_PER_STEP = 0.005;
const STAR_MAX = 0.08;

/** Share of bonus squares that are stars, `distance` steps from the start. */
export function starShareAt(distance: number): number {
  return Math.min(STAR_MAX, STAR_BASE + STAR_PER_STEP * Math.max(0, distance));
}

/** Relative weights of the other kinds; they share what the star leaves. */
const COMMON_WEIGHTS: readonly (readonly [BonusKind, number])[] = [
  ["coins", 22],
  ["fuel", 22],
  ["lift", 14],
  ["launch", 14],
  ["clover", 12],
  ["shield", 8],
  ["treasure", 8],
];
const COMMON_TOTAL = COMMON_WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

/** 32-bit finalizer from MurmurHash3: spreads every input bit over the output. */
function mix(input: number): number {
  let h = input | 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h | 0;
}

/** Maps a hash to [0, 1). */
const unit = (h: number) => (h >>> 0) / 4294967296;

/** Whole numbers only; anything else (or huge) wraps into 32 bits. */
function toInt(v: number): number {
  return Number.isFinite(v) ? Math.trunc(v) | 0 : 0;
}

/**
 * What lies on Sky Map square (x, y): a pure, deterministic hash of the
 * coordinates, so every player sees the same board. (0, 0) is empty. Stars get
 * more common the further from the start.
 */
export function squareAt(x: number, y: number): BonusKind | null {
  if (x === 0 && y === 0) return null;
  const hash = mix(
    mix(toInt(x) ^ 0x9e3779b9) ^ Math.imul(toInt(y), 0x85ebca6b)
  );
  if (unit(hash) < EMPTY_SHARE) return null;
  const roll = unit(mix(hash ^ 0x68e31da4));
  const distance = Math.abs(x) + Math.abs(y);
  const starShare = starShareAt(distance);
  if (roll < starShare) return "star";
  let pick = ((roll - starShare) / (1 - starShare)) * COMMON_TOTAL;
  for (const [kind, weight] of COMMON_WEIGHTS) {
    if (pick < weight) return kind;
    pick -= weight;
  }
  return COMMON_WEIGHTS[COMMON_WEIGHTS.length - 1][0];
}
