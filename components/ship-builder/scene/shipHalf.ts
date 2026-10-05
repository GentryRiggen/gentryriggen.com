"use client";

import { createContext, useContext, useMemo } from "react";
import { DoubleSide, type Plane, type Side } from "three";
import { AO_OCCLUDER } from "./aoLayer";
import type { HalfSide } from "./partHalves";

/**
 * Set inside one half of a broken ship. The ship's own components read it to
 * cut themselves at the break (hull, railings), keep only their half's parts
 * and decide which half the gash rides with. Outside a broken ship it is null
 * and nothing changes.
 */
export interface ShipHalfValue {
  side: HalfSide;
  /** Where she broke, cells from the bow. */
  atX: number;
  /** World-space plane, moved every frame; the far side of it is cut away. */
  clip: Plane;
  /** Whether a part (by id) belongs to this half. */
  includesPart: (partId: string) => boolean;
}

export const ShipHalfContext = createContext<ShipHalfValue | null>(null);

export function useShipHalf(): ShipHalfValue | null {
  return useContext(ShipHalfContext);
}

/** Extra props for a material that must be cut at the break. */
export interface ClipMaterialProps {
  clippingPlanes?: Plane[];
  clipShadows?: boolean;
  side?: Side;
}

const NO_CLIP: ClipMaterialProps = {};

/**
 * Spread onto a material: inside a half it clips at the break and draws both
 * faces so the inside of the hull shows through the cut. Whole, it adds
 * nothing, so the unbroken ship's materials are exactly as before.
 */
export function useClipMaterialProps(): ClipMaterialProps {
  const half = useShipHalf();
  const clip = half?.clip ?? null;
  return useMemo(
    () =>
      clip
        ? { clippingPlanes: [clip], clipShadows: true, side: DoubleSide }
        : NO_CLIP,
    [clip]
  );
}

const NOT_AN_OCCLUDER = {} as const;

/**
 * Spread onto a mesh instead of `AO_OCCLUDER`. The occlusion depth pass draws
 * with one plain material that ignores clipping, so a cut hull would cast
 * occlusion from the part it no longer shows; halves sit out of that pass.
 */
export function useAoOccluder(): typeof AO_OCCLUDER | typeof NOT_AN_OCCLUDER {
  return useShipHalf() ? NOT_AN_OCCLUDER : AO_OCCLUDER;
}
