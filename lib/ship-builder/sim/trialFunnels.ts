import { resolveAttachPoint } from "../model/attach";
import { getPartDef } from "../model/catalog";
import { isFunnelType } from "../model/funnelLivery";
import { buildOccupancy } from "../model/grid";
import type { Ship } from "../model/types";
import { DECK_Y, LEVEL_HEIGHT } from "../model/worldFrame";
import type { TrialFunnel } from "./types";

/**
 * The ship's funnels as the sim sees them, in her resting world frame. A
 * funnel whose mount can't be found is left out.
 */
export function trialFunnelsOf(ship: Ship): TrialFunnel[] {
  const occupancy = buildOccupancy(ship);
  const funnels: TrialFunnel[] = [];
  for (const part of ship.parts) {
    if (!isFunnelType(part.type) || part.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    if (!point) continue;
    funnels.push({
      id: part.id,
      cellX: point.position.x,
      baseY: DECK_Y + point.position.y * LEVEL_HEIGHT,
      baseZ: ship.hull.beam / 2 - point.position.z,
      height: getPartDef(part.type).height,
    });
  }
  return funnels;
}
