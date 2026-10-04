import { resolveAttachPoint } from "@/lib/ship-builder/model/attach";
import {
  beamOf,
  buildOccupancy,
  gridLength,
} from "@/lib/ship-builder/model/grid";
import { getPartDef } from "@/lib/ship-builder/model/catalog";
import type { PartType, Ship } from "@/lib/ship-builder/model/types";
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

function emitsEffect(type: PartType): boolean {
  const def = getPartDef(type);
  return def.placement === "attach" && (def.propels === true || !!def.smoke);
}

/** Where smoke and bubbles come from, resolved once per ship change. */
export function collectEffectAnchors(ship: Ship): EffectAnchors {
  const anchors: EffectAnchors = {
    smallFunnels: [],
    largeFunnels: [],
    propellers: [],
  };
  const emitters = ship.parts.filter((part) => emitsEffect(part.type));
  if (emitters.length === 0) return anchors;

  const occupancy = buildOccupancy(ship);
  const length = gridLength(ship);
  const beam = beamOf(ship);
  for (const part of emitters) {
    if (part.anchor.kind !== "attach") continue;
    const point = resolveAttachPoint(ship, part.anchor, occupancy);
    if (!point) continue;
    const base = modelToWorld(length, beam, point.position);
    const def = getPartDef(part.type);
    if (def.placement !== "attach") continue;
    if (def.propels) anchors.propellers.push(...base);
    if (def.smoke === "small") {
      anchors.smallFunnels.push(...funnelTop(base, FUNNEL_TOP_OFFSET.small));
    } else if (def.smoke === "large") {
      anchors.largeFunnels.push(...funnelTop(base, FUNNEL_TOP_OFFSET.large));
    }
  }
  return anchors;
}
