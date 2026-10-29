"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import type { Group } from "three";
import { LEVELS } from "@/lib/plane-builder/levels";
import {
  PlaneFreezeContext,
  PlaneGlbSourceContext,
  type PlaneGlbSource,
} from "@/components/plane-builder/scene/PlaneGlbUnit";
import { PLANE_UNITS } from "@/components/plane-builder/scene/planeGlbRegistry";
import {
  createPlaneMaterials,
  disposePlaneMaterials,
  MATERIAL_KEYS,
} from "@/components/plane-builder/scene/planeMaterials";
import { planeParts } from "@/components/plane-builder/scene/planeParts";
import Unit from "@/components/plane-builder/scene/planeUnits";
import Sky from "@/components/plane-builder/scene/Sky";
import { LoadBoundary, ReadyProbe, StudioCamera } from "./AssetStudio";
import type { PlaneStudioParams } from "./planeStudioParams";

const ZERO_TIERS = {
  launcher: 0,
  wings: 0,
  engine: 0,
  fuel: 0,
  body: 0,
  multiplier: 0,
};

interface PlaneAssetStudioProps {
  params: PlaneStudioParams;
}

/**
 * One Plane Builder piece, drawn by the game's own unit component with the
 * game's materials and the unit's level palette and sky lighting. `build=old`
 * forces the procedural mesh; `build=new` draws the work-in-progress glb
 * (copied to /asset-studio/<spec id>/ by the check-in). Propellers hold still.
 */
export default function PlaneAssetStudio({ params }: PlaneAssetStudioProps) {
  const entry = PLANE_UNITS[params.variant];
  const level = LEVELS[entry.level];
  const parts = useMemo(
    () => planeParts(entry.level, ZERO_TIERS),
    [entry.level]
  );
  const materials = useMemo(
    () => createPlaneMaterials(parts, level.palette),
    [parts, level.palette]
  );
  useEffect(() => () => disposePlaneMaterials(materials), [materials]);
  const names = useMemo(() => {
    const map = new Map<string, string>();
    for (const key of MATERIAL_KEYS) {
      const hex = `#${materials[key].color.getHexString()}`;
      if (!map.has(hex)) map.set(hex, key);
    }
    return map;
  }, [materials]);
  const source = useMemo<PlaneGlbSource>(
    () =>
      params.build === "old"
        ? { procedural: true }
        : { urlFor: (e) => `/asset-studio/${e.model}/${e.unit}.glb` },
    [params.build]
  );
  const partRef = useRef<Group>(null);

  return (
    <div className="fixed inset-0">
      <style>{"nextjs-portal { display: none !important; }"}</style>
      <Canvas shadows="percentage" gl={{ preserveDrawingBuffer: true }}>
        <StudioCamera params={params} />
        <Sky palette={level.palette} />
        <LoadBoundary key={`${params.build}-${params.variant}`}>
          <Suspense fallback={null}>
            <PlaneFreezeContext.Provider value>
              <PlaneGlbSourceContext.Provider value={source}>
                <group ref={partRef}>
                  <Unit name={params.variant} materials={materials} />
                </group>
              </PlaneGlbSourceContext.Provider>
            </PlaneFreezeContext.Provider>
            <ReadyProbe
              partRef={partRef}
              expectModel={params.build === "new"}
              rakeRadians={0}
              names={names}
            />
          </Suspense>
        </LoadBoundary>
      </Canvas>
    </div>
  );
}
