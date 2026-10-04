import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import {
  beamOf,
  buildOccupancy,
  gridLength,
} from "@/lib/ship-builder/model/grid";
import type { Ship } from "@/lib/ship-builder/model/types";
import { modelToWorld } from "./coords";

/** Height of a funnel's top above its attach point (see PartMesh). */
export const FUNNEL_TOP_OFFSET = { small: 3.2, large: 4.2 } as const;

export interface EffectAnchors {
  /** Flat [x, y, z] triples in the ship's world space. */
  smallFunnels: number[];
  largeFunnels: number[];
  propellers: number[];
}

/** Where smoke and bubbles come from, resolved once per ship change. */
export function collectEffectAnchors(ship: Ship): EffectAnchors {
  const anchors: EffectAnchors = {
    smallFunnels: [],
    largeFunnels: [],
    propellers: [],
  };
  const emitters = ship.parts.filter(
    (part) =>
      part.type === "funnel" ||
      part.type === "funnel-large" ||
      part.type === "propeller"
  );
  if (emitters.length === 0) return anchors;

  const occupancy = buildOccupancy(ship);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  for (const part of emitters) {
    if (part.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    if (!point) continue;
    const [x, y, z] = modelToWorld(length, beam, point.position);
    if (part.type === "propeller") {
      anchors.propellers.push(x, y, z);
    } else if (part.type === "funnel") {
      anchors.smallFunnels.push(x, y + FUNNEL_TOP_OFFSET.small, z);
    } else {
      anchors.largeFunnels.push(x, y + FUNNEL_TOP_OFFSET.large, z);
    }
  }
  return anchors;
}
