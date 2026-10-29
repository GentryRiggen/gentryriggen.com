"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { type BufferGeometry, type Group } from "three";
import { trackGlbPart } from "@/components/ship-builder/scene/glbLoadStatus";
import { buildObstacleGeometry } from "@/components/plane-builder/scene/obstacleGeometry";
import {
  obstacleGeometryFromScene,
  OBSTACLE_TYPICAL_SIZE,
} from "@/components/plane-builder/scene/obstacleModels";
import Sky from "@/components/plane-builder/scene/Sky";
import { LEVELS } from "@/lib/plane-builder/levels";
import type { LevelId, ObstacleKind } from "@/lib/plane-builder/levels/types";
import { LoadBoundary, ReadyProbe, StudioCamera } from "./AssetStudio";
import type { PlaneStudioParams } from "./planeStudioParams";

/** The level whose palette and sky an obstacle kind is drawn with. */
export const OBSTACLE_STUDIO_LEVEL: Readonly<Record<ObstacleKind, LevelId>> = {
  tree: "jungle",
  barn: "meadow",
  balloon: "meadow",
  wall: "canyon",
  arch: "canyon",
  bird: "beach",
  peak: "mountains",
  palm: "beach",
  skyscraper: "city",
  iceberg: "glacier",
  cloud: "storm",
};

interface DrawnProps {
  geometry: BufferGeometry;
  size: readonly [number, number, number];
}

/** The shape at its typical stretch, scaled so the biggest side is 1. */
function Drawn({ geometry, size }: DrawnProps) {
  const biggest = Math.max(...size);
  return (
    <mesh
      geometry={geometry}
      scale={size.map((s) => s / biggest) as [number, number, number]}
      castShadow
      receiveShadow
    >
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  );
}

interface ModelProps extends Pick<DrawnProps, "size"> {
  url: string;
  level: LevelId;
}

function Model({ url, level, size }: ModelProps) {
  const { scene } = useGLTF(url, false, false);
  const geometry = useMemo(
    () => obstacleGeometryFromScene(scene, LEVELS[level].palette, url),
    [scene, level, url]
  );
  useEffect(() => trackGlbPart("loaded"), []);
  return <Drawn geometry={geometry} size={size} />;
}

interface OldProps extends Pick<DrawnProps, "size"> {
  kind: ObstacleKind;
  level: LevelId;
}

function Old({ kind, level, size }: OldProps) {
  const geometry = useMemo(
    () => buildObstacleGeometry(kind, LEVELS[level].palette),
    [kind, level]
  );
  return <Drawn geometry={geometry} size={size} />;
}

interface ObstacleStudioProps {
  params: PlaneStudioParams;
}

/**
 * One obstacle kind at its typical stretch, in its level's palette and sky.
 * `build=old` draws the procedural shape; `build=new` the work-in-progress
 * glb (copied to /asset-studio/obstacle-<kind>/ by the check-in).
 */
export default function ObstacleStudio({ params }: ObstacleStudioProps) {
  const kind = params.part.replace(/^obstacle-/, "") as ObstacleKind;
  const level = OBSTACLE_STUDIO_LEVEL[kind];
  const size = OBSTACLE_TYPICAL_SIZE[kind];
  const partRef = useRef<Group>(null);
  const url = `/asset-studio/${params.part}/${params.variant}.glb`;

  return (
    <div className="fixed inset-0">
      <style>{"nextjs-portal { display: none !important; }"}</style>
      <Canvas shadows="percentage" gl={{ preserveDrawingBuffer: true }}>
        <StudioCamera params={params} />
        <Sky palette={LEVELS[level].palette} />
        <LoadBoundary key={`${params.build}-${params.variant}`}>
          <Suspense fallback={null}>
            <group ref={partRef}>
              {params.build === "old" ? (
                <Old kind={kind} level={level} size={size} />
              ) : (
                <Model url={url} level={level} size={size} />
              )}
            </group>
            <ReadyProbe
              partRef={partRef}
              expectModel={params.build === "new"}
              rakeRadians={0}
              names={new Map()}
            />
          </Suspense>
        </LoadBoundary>
      </Canvas>
    </div>
  );
}
