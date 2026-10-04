"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Shape, ShapeGeometry, type Mesh } from "three";
import { beamOf } from "@/lib/ship-builder/model/grid";
import { gashOf, GASH_LENGTH } from "@/lib/ship-builder/sim/compartments";
import { useShipBuilderStore } from "@/lib/ship-builder/state/store";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { hullXOfImpact } from "./icebergAim";
import { ICEBERG_IMPACT_S } from "./icebergMotion";
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

/** A jagged dark strip, `width` cells long, centred on x = 0. */
function buildGashGeometry(width: number): ShapeGeometry {
  const height = GASH_TOP - GASH_BOTTOM;
  const step = width / (TOP_JAGS.length - 1);
  const shape = new Shape();
  BOTTOM_JAGS.forEach((jag, i) => {
    const x = -width / 2 + i * step;
    const y = GASH_BOTTOM + jag * height;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  for (let i = TOP_JAGS.length - 1; i >= 0; i--) {
    const x = -width / 2 + i * step;
    shape.lineTo(x, GASH_TOP - TOP_JAGS[i] * height);
  }
  shape.closePath();
  return new ShapeGeometry(shape);
}

interface GashStripProps {
  impactX: number;
  length: number;
  beam: number;
}

function GashStrip({ impactX, length, beam }: GashStripProps) {
  const mesh = useRef<Mesh>(null);
  const reducedMotion = usePrefersReducedMotion();
  const geometry = useMemo(() => buildGashGeometry(GASH_LENGTH), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const { fromX, toX } = gashOf(impactX, length);
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
      <meshBasicMaterial color={GASH_COLOR} />
    </mesh>
  );
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
  if (!iceberg) return null;
  return (
    <GashStrip impactX={iceberg.impactX} length={iceberg.length} beam={beam} />
  );
}
