"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Shape, ShapeGeometry, type Mesh } from "three";
import { beamOf } from "@/lib/ship-builder/model/grid";
import { gashOf } from "@/lib/ship-builder/sim/compartments";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { hullXOfImpact } from "./icebergAim";
import { ICEBERG_IMPACT_S } from "./icebergMotion";
import { hullHalfWidth } from "./hullShapes";
import type { HalfSide } from "./partHalves";
import { useClipMaterialProps, useShipHalf } from "./shipHalf";
import { trialPlayback } from "./trialPlayback";

/** Highest and lowest points of the strip, around the waterline (y = 0). */
const GASH_TOP = 0.2;
const GASH_BOTTOM = -0.8;
/** The strip floats just off the hull's side so it never fights the paint. */
const GASH_OFFSET = 0.03;
/** Ragged top and bottom edges, as 0..1 fractions of the strip's height. */
const TOP_JAGS = [0.1, 0.55, 0.2, 0.7, 0.15, 0.6, 0.25, 0.5, 0.1] as const;
const BOTTOM_JAGS = [0.3, 0.05, 0.4, 0.1, 0.35, 0.0, 0.45, 0.08, 0.3] as const;
const GASH_COLOR = "#1c1526";

/** Cells between jag points, so a long gash is as ragged as a short one. */
const JAG_SPACING = 0.75;

/** The ragged pattern repeats; each point reads it by index. */
function jagAt(jags: readonly number[], i: number): number {
  return jags[i % jags.length];
}

/** How many segments a strip `width` cells long is cut into. */
export function gashSegments(width: number): number {
  return Math.max(TOP_JAGS.length - 1, Math.round(width / JAG_SPACING));
}

/**
 * A jagged dark strip, `width` cells long, centred on x = 0. With a
 * `halfBeam` it hugs the hull: each point sits where the hull's side is at
 * its height (z relative to the full beam), so the strip does not float off
 * the narrowing below the bilge. The gash itself stays on the parallel
 * midbody (`gashOf` keeps it inside the hull's length).
 */
export function buildGashGeometry(
  width: number,
  halfBeam?: number
): ShapeGeometry {
  const height = GASH_TOP - GASH_BOTTOM;
  const segments = gashSegments(width);
  const step = width / segments;
  const shape = new Shape();
  for (let i = 0; i <= segments; i++) {
    const x = -width / 2 + i * step;
    const y = GASH_BOTTOM + jagAt(BOTTOM_JAGS, i) * height;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  for (let i = segments; i >= 0; i--) {
    const x = -width / 2 + i * step;
    shape.lineTo(x, GASH_TOP - jagAt(TOP_JAGS, i) * height);
  }
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  if (halfBeam !== undefined) {
    const positions = geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      positions.setZ(i, hullHalfWidth(positions.getY(i), halfBeam) - halfBeam);
    }
    positions.needsUpdate = true;
  }
  return geometry;
}

interface GashStripProps {
  impactX: number;
  length: number;
  /** Cells the gash runs; absent means the usual short gash. */
  gashLength?: number;
  beam: number;
}

function GashStrip({ impactX, length, gashLength, beam }: GashStripProps) {
  const mesh = useRef<Mesh>(null);
  const reducedMotion = usePrefersReducedMotion();
  const clip = useClipMaterialProps();
  const { fromX, toX } = gashOf(impactX, length, gashLength);
  const width = toX - fromX;
  const geometry = useMemo(
    () => buildGashGeometry(width, beam / 2),
    [width, beam]
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  const x = hullXOfImpact((fromX + toX) / 2, length);

  // The strip appears when the berg meets the hull.
  useFrame(() => {
    const target = mesh.current;
    if (!target) return;
    target.visible = reducedMotion || trialPlayback.time >= ICEBERG_IMPACT_S;
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      position={[x, 0, beam / 2 + GASH_OFFSET]}
      visible={false}
    >
      <meshBasicMaterial color={GASH_COLOR} {...clip} />
    </mesh>
  );
}

/**
 * The halves of a broken ship the gash reaches. A gash across the break is
 * drawn on both, and each half's clip plane cuts it at the break.
 */
export function gashHalves(
  impactX: number,
  length: number,
  gashLength: number | undefined,
  atX: number
): HalfSide[] {
  const { fromX, toX } = gashOf(impactX, length, gashLength);
  const sides: HalfSide[] = [];
  if (fromX < atX) sides.push("bow");
  if (toX > atX) sides.push("stern");
  return sides;
}

/**
 * The dark gash the iceberg tears in the starboard side, below the waterline.
 * It lives in the ship's group, so it rides with her pose. Iceberg trials
 * only.
 */
export default function HullGash() {
  const iceberg = useShipBuilderStore((s) =>
    s.trial.status === "running" || s.trial.status === "result"
      ? s.trial.input.iceberg
      : undefined
  );
  const beam = useShipBuilderStore((s) => beamOf(s.ship));
  const half = useShipHalf();
  if (!iceberg) return null;
  // On a broken ship the gash goes with each half it reaches.
  if (
    half &&
    !gashHalves(
      iceberg.impactX,
      iceberg.length,
      iceberg.gashLength,
      half.atX
    ).includes(half.side)
  ) {
    return null;
  }
  return (
    <GashStrip
      impactX={iceberg.impactX}
      length={iceberg.length}
      gashLength={iceberg.gashLength}
      beam={beam}
    />
  );
}
