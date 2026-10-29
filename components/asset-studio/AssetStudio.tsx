"use client";

import {
  Component,
  Suspense,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
  type RefObject,
} from "react";
import type { Group } from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
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
import { GLB_PARTS } from "@/components/ship-builder/scene/glbRegistry";
import PartMesh from "@/components/ship-builder/scene/PartMesh";
import { PALETTE } from "@/components/ship-builder/scene/palette";
import { INNER_ROTATION } from "./innerRotation";
import { paletteNames, partBounds, partSlots } from "./partBounds";
import { specForPart } from "./partSpecs";
import { sceneHasPart } from "./sceneHasPart";
import { cameraForView } from "./studioCamera";
import type { StudioParams } from "./studioParams";
import { buildStudioScene } from "./studioShip";
import { studioSource } from "./studioSource";

const PALETTE_NAMES = paletteNames(PALETTE);

/** Frames drawn after the model loads before the studio calls itself ready. */
const SETTLE_FRAMES = 3;

function setStudioState(key: "studioReady" | "studioError", value: string) {
  document.body.dataset[key] = value;
}

interface ReadyProbeProps {
  partRef: RefObject<Group | null>;
  /** True for the new build, which also waits for its glb. */
  expectModel: boolean;
  /** Undo this tilt before reading bounds (a funnel's rake). */
  rakeRadians: number;
}

/**
 * Marks the page ready once the part has drawn: a few frames in, with the
 * scene really holding a part and, for the new build, its glb loaded (a part
 * that fell back to the procedural mesh is an error, not a pass). Publishes
 * the part's bounds as JSON in `data-studio-bounds`.
 */
function ReadyProbe({ partRef, expectModel, rakeRadians }: ReadyProbeProps) {
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
    if (partRef.current && sceneHasPart(partRef.current)) {
      const bounds = partBounds(partRef.current, rakeRadians);
      document.body.dataset.studioBounds = JSON.stringify(bounds);
      document.body.dataset.studioRake = String(rakeRadians);
      document.body.dataset.studioSlots = JSON.stringify(
        partSlots(partRef.current, PALETTE_NAMES)
      );
      setStudioState("studioReady", "1");
    } else setStudioState("studioError", "No part in the scene");
  });
  return null;
}

interface LoadBoundaryProps {
  children: ReactNode;
}

interface LoadBoundaryState {
  failed: boolean;
}

/** A load or slot error lands in the console and on `data-studio-error`. */
class LoadBoundary extends Component<LoadBoundaryProps, LoadBoundaryState> {
  override state: LoadBoundaryState = { failed: false };

  static getDerivedStateFromError(): LoadBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("asset studio load failed", error, info.componentStack);
    setStudioState("studioError", error.message || String(error));
  }

  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface StudioCameraProps {
  params: StudioParams;
}

/** The camera, framed from the variant's bounds exactly as render.py does. */
function StudioCamera({ params }: StudioCameraProps) {
  const aspect = useThree((s) => s.size.width / s.size.height);
  const camera = useMemo(() => {
    const spec = specForPart(params.part)?.spec;
    const variant = spec?.variants.find((v) => v.name === params.variant);
    const view = spec?.views.find((v) => v.name === params.view);
    if (!variant || !view) {
      // No spec yet (measuring): a generic three-quarter view.
      return cameraForView(
        { azimuthDeg: 35, elevationDeg: 20, ortho: false },
        [-1.5, 0, -1.5],
        [1.5, 3, 1.5]
      );
    }
    return cameraForView(
      view,
      variant.expectedBounds.min,
      variant.expectedBounds.max
    );
  }, [params]);
  const half = camera.orthoHalfHeight;
  const lookAt = (c: { lookAt: (...v: number[]) => void }) =>
    c.lookAt(...camera.target);
  return camera.ortho ? (
    <OrthographicCamera
      makeDefault
      manual
      near={0.01}
      far={1000}
      left={-half * aspect}
      right={half * aspect}
      top={half}
      bottom={-half}
      position={camera.position}
      onUpdate={lookAt}
    />
  ) : (
    <PerspectiveCamera
      makeDefault
      near={0.01}
      far={1000}
      fov={camera.fovDeg}
      position={camera.position}
      onUpdate={lookAt}
    />
  );
}

interface AssetStudioProps {
  params: StudioParams;
}

/**
 * One Ship Builder part, drawn by the game's own PartMesh on a minimal ship
 * (see studioShip.ts), lit and post-processed like the game (same Environment,
 * reflection map and ambient occlusion as Scene.tsx, minus ocean and ship
 * store), with the part's origin at the world origin in front of the game's
 * sky. `build=old` forces the procedural mesh; `build=new` draws the glb
 * (work in progress, copied to /asset-studio/<spec id>/ by the check-in).
 * Screenshots are compared with the Blender renders, so keep the viewport
 * square.
 */
export default function AssetStudio({ params }: AssetStudioProps) {
  const timeOfDay = params.time.toLowerCase() as "day" | "sunset" | "night";
  const [environment] = useState(() =>
    toRuntimeEnvironment(environmentFor(timeOfDay, "calm"))
  );
  const [glow] = useState(() => createGlowController(glowFor(timeOfDay)));
  const found = specForPart(params.part);
  const spec = found?.spec ?? null;
  const rakeRadians =
    INNER_ROTATION[params.type] ??
    spec?.rakeRadians ??
    GLB_PARTS[params.type]?.rakeRadians ??
    0;
  const source = useMemo<GlbSource>(
    () => studioSource(params, spec),
    [params, spec]
  );
  const scene = useMemo(() => {
    if (params.build === "new" && !spec) {
      setStudioState(
        "studioError",
        `No spec for ${params.part}: nothing to load`
      );
      return null;
    }
    try {
      return buildStudioScene(params.type);
    } catch (error) {
      setStudioState("studioError", (error as Error).message);
      return null;
    }
  }, [params.type, params.build, params.part, spec]);

  const partRef = useRef<Group>(null);

  return (
    <div className="fixed inset-0">
      {/* Keep the Next dev-tools badge out of check-in screenshots. */}
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
        {scene && (
          <LoadBoundary key={`${params.build}-${params.variant}`}>
            <Suspense fallback={null}>
              <GlbSourceContext.Provider value={source}>
                <group
                  ref={partRef}
                  position={[
                    -scene.origin[0],
                    -scene.origin[1],
                    -scene.origin[2],
                  ]}
                >
                  <PartMesh ship={scene.ship} part={scene.candidate} />
                </group>
              </GlbSourceContext.Provider>
              <ReadyProbe
                partRef={partRef}
                expectModel={params.build === "new"}
                rakeRadians={rakeRadians}
              />
            </Suspense>
          </LoadBoundary>
        )}
        <PostEffects environment={environment} />
      </Canvas>
    </div>
  );
}
