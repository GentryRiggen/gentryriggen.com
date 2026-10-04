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

/** Funnels lean aft (toward world −X), pivoting at the base (see FunnelMesh). */
export const FUNNEL_RAKE_RADIANS = (5 * Math.PI) / 180;

/** A raked funnel's top, from its attach point in world space. */
function funnelTop(
  [x, y, z]: [number, number, number],
  height: number
): [number, number, number] {
  return [
    x - height * Math.sin(FUNNEL_RAKE_RADIANS),
    y + height * Math.cos(FUNNEL_RAKE_RADIANS),
    z,
  ];
}

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
      part.type === "propeller" ||
      part.type === "funnel-modern" ||
      part.type === "azipod"
  );
  if (emitters.length === 0) return anchors;

  const occupancy = buildOccupancy(ship);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  for (const part of emitters) {
    if (part.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    if (!point) continue;
    const base = modelToWorld(length, beam, point.position);
    if (part.type === "propeller" || part.type === "azipod") {
      anchors.propellers.push(...base);
    } else if (part.type === "funnel" || part.type === "funnel-modern") {
      anchors.smallFunnels.push(...funnelTop(base, FUNNEL_TOP_OFFSET.small));
    } else {
      anchors.largeFunnels.push(...funnelTop(base, FUNNEL_TOP_OFFSET.large));
    }
  }
  return anchors;
}
