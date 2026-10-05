"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { beamOf, gridLength } from "@/lib/ship-builder/model/grid";
import { paintHex } from "@/lib/ship-builder/model/paint";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import { noRaycast } from "./noRaycast";
import { PALETTE } from "./palette";
import type { HalfSide } from "./partHalves";
import { buildTornEdgeGeometry } from "./tornEdgeGeometry";

interface TornEdgeProps {
  side: HalfSide;
  /** Where she broke, cells from the bow. */
  atX: number;
}

/**
 * The ripped steel at one half's broken end: torn plating in the hull's own
 * paint, a bright ragged rim, a dark hollow inside and decks jutting out.
 * Lives in the half's group, so it rides with it.
 */
export default function TornEdge({ side, atX }: TornEdgeProps) {
  const lengthCells = useShipBuilderStore((s) => gridLength(s.ship));
  const beam = useShipBuilderStore((s) => beamOf(s.ship));
  const paint = useShipBuilderStore((s) => s.ship.hull.paint);
  const bottom = paint?.bottom ? paintHex(paint.bottom) : PALETTE.antifouling;
  const topsides = paint?.topsides ? paintHex(paint.topsides) : PALETTE.hull;

  const geometry = useMemo(
    () =>
      buildTornEdgeGeometry({
        lengthCells,
        beam,
        atX,
        side,
        colors: { bottom, topsides, deck: PALETTE.deck },
      }),
    [lengthCells, beam, atX, side, bottom, topsides]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow raycast={noRaycast}>
      {/* Both faces: the skins are thin, and each is seen from either side. */}
      <meshStandardMaterial
        vertexColors
        side={DoubleSide}
        roughness={0.7}
        metalness={0.3}
      />
    </mesh>
  );
}
