import type { ShipSpec } from "../ships/types";
import { HEADWAY_LOST_HALF_LIFE_S } from "./constants";

// Local bindings: global lookups are slow inside test sandboxes (vm).
const { exp, max } = Math;

/**
 * Earth x the way she still has carries her over real seconds t0..t1
 * (kinematic: no propulsion model).
 *
 * - With `halfLifeS` (1.1, the Lusitania): u = u₀·2^(−t/T½) from the first
 *   event, integrated exactly.
 * - Without it (steady way, her engine still turning): u₀ until `lostAt`
 *   (real seconds, when she went under; null while she has not), then
 *   u₀·2^(−(t − lostAt)/HEADWAY_LOST_HALF_LIFE_S).
 */
export function headwayRun(
  h: ShipSpec["headway"],
  t0: number,
  t1: number,
  lostAt: number | null = null
): number {
  if (!h || h.startMs === 0) return 0;
  if (h.halfLifeS !== undefined) {
    const k = Math.LN2 / h.halfLifeS;
    return (h.startMs / k) * (exp(-k * t0) - exp(-k * t1));
  }
  if (lostAt === null || t1 <= lostAt) return h.startMs * (t1 - t0);
  const steady = h.startMs * max(0, lostAt - t0);
  const k = Math.LN2 / HEADWAY_LOST_HALF_LIFE_S;
  const a = max(0, t0 - lostAt);
  const b = t1 - lostAt;
  return steady + (h.startMs / k) * (exp(-k * a) - exp(-k * b));
}
