"use client";

import { Suspense, useMemo, useRef, useState } from "react";
import { Box3, Matrix4, type Group } from "three";
import { Canvas, useFrame } from "@react-three/fiber";
import Environment from "@/components/ship-builder/scene/Environment";
import { createGlowController } from "@/components/ship-builder/scene/GlowContext";
import PostEffects from "@/components/ship-builder/scene/PostEffects";
import ReflectionEnvironment from "@/components/ship-builder/scene/ReflectionEnvironment";
import { environmentFor } from "@/components/ship-builder/scene/environmentModel";
import { toRuntimeEnvironment } from "@/components/ship-builder/scene/environmentRuntime";
import { glowFor } from "@/components/ship-builder/scene/timeOfDay";
import {
  GlbSourceContext,
  type GlbSource,
} from "@/components/ship-builder/scene/GlbRegistryPart";
import { glbLoadStatus } from "@/components/ship-builder/scene/glbLoadStatus";
import KitInstances from "@/components/ship-builder/scene/KitInstances";
import type { KitName } from "@/components/ship-builder/scene/kitFiles";
import { useKitGeometry } from "@/components/ship-builder/scene/kitModels";
import Surface from "@/components/ship-builder/scene/Surface";
import { LoadBoundary, setStudioState, StudioCamera } from "./AssetStudio";
import { kitStandIn } from "./kitStandIns";
import { specForPart } from "./partSpecs";
import type { StudioParams } from "./studioParams";

const SETTLE_FRAMES = 3;
const IDENTITY = [new Matrix4()];

interface KitPieceProps {
  name: KitName;
  build: "old" | "new";
  color: string;
  finish?: "metal" | "glass" | "wood";
}

/** The kit piece alone: its stand-in boxes (old) or its glb (new). */
function KitPiece({ name, build, color, finish }: KitPieceProps) {
  const loaded = useKitGeometry(name);
  const standIn = useMemo(() => kitStandIn(name), [name]);
  if (build === "new") {
    return loaded ? (
      <KitInstances
        geometry={loaded}
        matrices={IDENTITY}
        color={color}
        finish={finish}
        tint={null}
        emphasis={null}
      />
    ) : null;
  }
  return (
    <mesh geometry={standIn}>
      <Surface color={color} finish={finish} tint={null} emphasis={null} />
    </mesh>
  );
}

interface ProbeProps {
  groupRef: React.RefObject<Group | null>;
  expectModel: boolean;
}

/** Ready once the piece has drawn; the new build also waits for its glb. */
function KitReadyProbe({ groupRef, expectModel }: ProbeProps) {
  const frames = useRef(0);
  useFrame(() => {
    frames.current += 1;
    if (frames.current < SETTLE_FRAMES) return;
    if (document.body.dataset.studioReady) return;
    if (expectModel) {
      const status = glbLoadStatus();
      if (status.failed > 0) {
        setStudioState("studioError", "The glb failed to load or is invalid");
        return;
      }
      if (status.loaded === 0 || status.pending > 0) return;
    }
    const box = groupRef.current && new Box3().setFromObject(groupRef.current);
    if (!box || box.isEmpty()) {
      setStudioState("studioError", "No part in the scene");
      return;
    }
    document.body.dataset.studioBounds = JSON.stringify({
      min: box.min.toArray(),
      max: box.max.toArray(),
    });
    setStudioState("studioReady", "1");
  });
  return null;
}

interface KitStudioProps {
  params: StudioParams;
}

/**
 * One detail-kit piece (see components/ship-builder/scene/kitModels.ts) in
 * the studio's lighting, in the piece's own frame, so a family sheet can set
 * the old boxes (build=old) beside the Blender piece (build=new). The glb is
 * the work in progress the check-in copies to /asset-studio/<spec>/.
 */
export default function KitStudio({ params }: KitStudioProps) {
  const timeOfDay = params.time.toLowerCase() as "day" | "sunset" | "night";
  const [environment] = useState(() =>
    toRuntimeEnvironment(environmentFor(timeOfDay, "calm"))
  );
  const [glow] = useState(() => createGlowController(glowFor(timeOfDay)));
  const spec = specForPart(params.part)?.spec ?? null;
  const name = params.part as KitName;
  const slot = spec?.slots[0] ?? "frame";
  const look = spec?.slotColors?.[slot];
  const source = useMemo<GlbSource>(
    () => ({
      procedural: params.build === "old",
      kitUrl: (kit) => `/asset-studio/${kit}/${kit}.glb`,
    }),
    [params.build]
  );
  const groupRef = useRef<Group>(null);
  return (
    <div className="fixed inset-0">
      <style>{"nextjs-portal { display: none !important; }"}</style>
      <Canvas shadows="percentage" gl={{ preserveDrawingBuffer: true }}>
        <StudioCamera params={params} />
        <Environment
          current={environment}
          timeOfDay={timeOfDay}
          seaState="calm"
          isBelow={false}
          glow={glow}
        />
        <ReflectionEnvironment timeOfDay={timeOfDay} />
        <LoadBoundary key={params.build}>
          <Suspense fallback={null}>
            <GlbSourceContext.Provider value={source}>
              <group ref={groupRef}>
                <KitPiece
                  name={name}
                  build={params.build}
                  color={look?.color ?? "#ffffff"}
                  finish={look?.finish}
                />
              </group>
            </GlbSourceContext.Provider>
            <KitReadyProbe
              groupRef={groupRef}
              expectModel={params.build === "new"}
            />
          </Suspense>
        </LoadBoundary>
        <PostEffects environment={environment} />
      </Canvas>
    </div>
  );
}
