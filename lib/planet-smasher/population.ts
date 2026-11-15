import type { Vec3 } from "./sphere";
import { angularDistance, uvToDir } from "./sphere";

export const POP_W = 256,
  POP_H = 128;

export interface PopulationGrid {
  w: number;
  h: number;
  /** Per-cell share of the people; sums to 1. Row 0 is the north pole. */
  weights: Float32Array;
}

/** Share of the brightest cell that every cell holds at least. */
export const POP_FLOOR = 0.001;

/**
 * Builds the population grid from a brightness map: bright land (cities) holds
 * most people. Oceans and empty land hold almost nobody (the floor is
 * POP_FLOOR of the brightest cell), so a hit on a city kills far more than one
 * in the sea, yet every hit still counts a little.
 */
export function gridFromLuminance(
  lum: ArrayLike<number>,
  w: number,
  h: number,
  floor?: number
): PopulationGrid {
  const n = w * h;
  let max = 0;
  for (let i = 0; i < n; i++) if (lum[i] > max) max = lum[i];
  const min = floor ?? POP_FLOOR * max;
  const raw = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    raw[i] = Math.max(lum[i], min);
    sum += raw[i];
  }
  const weights = new Float32Array(n);
  for (let i = 0; i < n; i++) weights[i] = sum > 0 ? raw[i] / sum : 1 / n;
  return { w, h, weights };
}

/** Indices (row * w + col) of cells whose centre is within `radius` of `center`. */
export function cellsWithin(
  grid: { w: number; h: number },
  center: Vec3,
  radius: number
): number[] {
  const { w, h } = grid;
  const out: number[] = [];
  const polar = Math.acos(Math.min(1, Math.max(-1, center.y)));
  const rowOf = (theta: number) =>
    Math.min(h - 1, Math.max(0, Math.floor((theta / Math.PI) * h)));
  const r0 = rowOf(polar - radius);
  const r1 = rowOf(polar + radius);
  for (let row = r0; row <= r1; row++) {
    const v = 1 - (row + 0.5) / h;
    for (let col = 0; col < w; col++) {
      const d = angularDistance(center, uvToDir((col + 0.5) / w, v));
      if (d <= radius) out.push(row * w + col);
    }
  }
  if (out.length === 0) {
    // Tiny radius: always include the cell containing the centre.
    let u = Math.atan2(center.z, -center.x) / (2 * Math.PI);
    u -= Math.floor(u);
    const col = Math.min(w - 1, Math.floor(u * w));
    out.push(rowOf(polar) * w + col);
  }
  return out;
}
