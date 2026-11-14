import type { PlanetState } from "./damage";
import { cellsWithin } from "./population";
import { angularDistance, dirToUv, uvToDir } from "./sphere";

const wrap01 = (u: number) => u - Math.floor(u);

/**
 * The `n` distinct cells within `radius` of (u, v) holding the most people
 * (ties: nearer first). If fewer than `n` cells have people, the rest are
 * evenly spread points on a circle of radius * 0.6 around the centre.
 */
export function pickTargets(
  state: PlanetState,
  u: number,
  v: number,
  radius: number,
  n: number
): { u: number; v: number }[] {
  const center = uvToDir(u, v);
  const scored: { cell: number; people: number; dist: number }[] = [];
  for (const cell of cellsWithin(state, center, radius)) {
    const people = state.remaining[cell];
    if (!(people > 0)) continue;
    const row = Math.floor(cell / state.w);
    const col = cell % state.w;
    const dist = angularDistance(
      center,
      uvToDir((col + 0.5) / state.w, 1 - (row + 0.5) / state.h)
    );
    scored.push({ cell, people, dist });
  }
  scored.sort((a, b) => b.people - a.people || a.dist - b.dist);

  const out: { u: number; v: number }[] = [];
  for (const s of scored.slice(0, n)) {
    const row = Math.floor(s.cell / state.w);
    const col = s.cell % state.w;
    out.push({
      u: wrap01((col + 0.5) / state.w),
      v: 1 - (row + 0.5) / state.h,
    });
  }

  const missing = n - out.length;
  if (missing > 0) {
    // Tangent basis at the centre, for points on a small circle around it.
    const ref =
      Math.abs(center.y) > 0.99 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
    let tx = ref.y * center.z - ref.z * center.y;
    let ty = ref.z * center.x - ref.x * center.z;
    let tz = ref.x * center.y - ref.y * center.x;
    const tl = Math.hypot(tx, ty, tz) || 1;
    tx /= tl;
    ty /= tl;
    tz /= tl;
    const bx = center.y * tz - center.z * ty;
    const by = center.z * tx - center.x * tz;
    const bz = center.x * ty - center.y * tx;
    const r = radius * 0.6;
    const cr = Math.cos(r);
    const sr = Math.sin(r);
    for (let i = 0; i < missing; i++) {
      const a = (i / missing) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const uv = dirToUv({
        x: center.x * cr + (tx * ca + bx * sa) * sr,
        y: center.y * cr + (ty * ca + by * sa) * sr,
        z: center.z * cr + (tz * ca + bz * sa) * sr,
      });
      out.push({ u: wrap01(uv.u), v: uv.v });
    }
  }
  return out;
}
