import {
  aerialTarget,
  resolveAttachPoint,
  stringTarget,
} from "@/lib/ship-builder/model/attach";
import { isFunnelType } from "@/lib/ship-builder/model/funnelLivery";
import { buildOccupancy, type Occupancy } from "@/lib/ship-builder/model/grid";
import type { PlacedPart, Ship } from "@/lib/ship-builder/model/types";
import { TOPPLE_S } from "@/lib/ship-builder/sim/funnelFall";
import type { FunnelFall } from "@/lib/ship-builder/sim/types";

/**
 * The funnels that have snapped off by `time` (sim seconds). Worked out from
 * the time alone, so scrubbing back before a fall puts the funnel back.
 */
export function fallenIdsAt(
  falls: readonly FunnelFall[],
  time: number
): Set<string> {
  const ids = new Set<string>();
  for (const fall of falls) {
    if (fall.at <= time) ids.add(fall.funnelId);
  }
  return ids;
}

/** Deeper than this when it snaps, a funnel sinks without a splash. */
const SPLASH_DEPTH = 0.5;

/**
 * Seconds since a fallen funnel slapped onto the water; negative before it
 * does. Null for one that broke off already deep under: it makes no splash.
 */
export function funnelSplashSeconds(
  fall: FunnelFall,
  time: number
): number | null {
  if (fall.origin.y < -SPLASH_DEPTH) return null;
  return time - fall.at - TOPPLE_S;
}

function isWire(part: PlacedPart): boolean {
  return part.type === "string-lights" || part.type === "wireless-aerial";
}

/**
 * For every funnel, the parts that go when it snaps off: the funnel, anything
 * fixed to it (lights hung from it), and wires strung to it from another pole,
 * which lose their far end.
 */
export function funnelDependents(
  ship: Ship,
  occupancy: Occupancy = buildOccupancy(ship)
): Map<string, Set<string>> {
  const byId = new Map(ship.parts.map((part) => [part.id, part]));
  const dependents = new Map<string, Set<string>>();

  // The funnel a part hangs from, following its parents down (loop safe).
  const funnelUnder = (part: PlacedPart): string | null => {
    const seen = new Set<string>();
    let current: PlacedPart | undefined = part;
    while (current && !seen.has(current.id)) {
      if (isFunnelType(current.type)) return current.id;
      seen.add(current.id);
      current =
        current.anchor.kind === "attach"
          ? byId.get(current.anchor.parentId)
          : undefined;
    }
    return null;
  };

  // Each funnel's base in model space, for matching a wire's far end.
  const bases: { id: string; x: number; z: number }[] = [];
  for (const part of ship.parts) {
    if (!isFunnelType(part.type)) continue;
    dependents.set(part.id, new Set([part.id]));
    if (part.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    if (point) bases.push({ id: part.id, ...point.position });
  }

  const add = (funnelId: string | null, partId: string) => {
    if (funnelId) dependents.get(funnelId)?.add(partId);
  };
  for (const part of ship.parts) {
    if (isFunnelType(part.type)) continue;
    add(funnelUnder(part), part.id);
    if (!isWire(part) || part.anchor.kind !== "attach") continue;
    const pole = byId.get(part.anchor.parentId);
    if (!pole) continue;
    const find = part.type === "string-lights" ? stringTarget : aerialTarget;
    const to = find(ship, pole, occupancy);
    const target = to && bases.find((b) => b.x === to.x && b.z === to.z);
    if (target) add(target.id, part.id);
  }
  return dependents;
}

/** Every part hidden on the ship once the `fallen` funnels have gone. */
export function hiddenByFalls(
  dependents: ReadonlyMap<string, ReadonlySet<string>>,
  fallen: ReadonlySet<string>
): Set<string> {
  const hidden = new Set<string>();
  for (const id of fallen) {
    for (const partId of dependents.get(id) ?? []) hidden.add(partId);
  }
  return hidden;
}
