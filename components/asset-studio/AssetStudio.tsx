"use client";

import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrthographicCamera, PerspectiveCamera } from "@react-three/drei";
import Environment from "@/components/ship-builder/scene/Environment";
import { createGlowController } from "@/components/ship-builder/scene/GlowContext";
import PostEffects from "@/components/ship-builder/scene/PostEffects";
import ReflectionEnvironment from "@/components/ship-builder/scene/ReflectionEnvironment";
import { environmentFor } from "@/components/ship-builder/scene/environmentModel";
import { toRuntimeEnvironment } from "@/components/ship-builder/scene/environmentRuntime";
import { glowFor } from "@/components/ship-builder/scene/timeOfDay";
import { sceneHasPart } from "./sceneHasPart";
import { cameraForView } from "./studioCamera";
import type { StudioParams } from "./studioParams";
import { STUDIO_PARTS } from "./studioParts";

/** Frames drawn after the model loads before the studio calls itself ready. */
const SETTLE_FRAMES = 3;

function setStudioState(key: "studioReady" | "studioError", value: string) {
  document.body.dataset[key] = value;
}

/**
 * Marks the page ready once the model (a suspended sibling) has drawn: a few
 * frames after it mounts, and only if the scene really holds a part.
 */
function ReadyProbe() {
  const frames = useRef(0);
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    frames.current += 1;
    if (frames.current < SETTLE_FRAMES) return;
    if (document.body.dataset.studioReady) return;
    if (sceneHasPart(scene)) setStudioState("studioReady", "1");
    else setStudioState("studioError", "No part in the scene");
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
    const spec = STUDIO_PARTS[params.part].spec;
    const variant = spec.variants.find((v) => v.name === params.variant);
    const view = spec.views.find((v) => v.name === params.view);
    if (!variant || !view) throw new Error("Unknown variant or view");
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
 * One part, lit and post-processed like the game (same Environment, reflection
 * map and ambient occlusion as Scene.tsx, minus ocean and ship store), at the
 * origin in front of the game's sky. Screenshots of it are compared with the
 * Blender renders, so the viewport should be square.
 */
export default function AssetStudio({ params }: AssetStudioProps) {
  const timeOfDay = params.time.toLowerCase() as "day" | "sunset" | "night";
  const [environment] = useState(() =>
    toRuntimeEnvironment(environmentFor(timeOfDay, "calm"))
  );
  const [glow] = useState(() => createGlowController(glowFor(timeOfDay)));
  const part = STUDIO_PARTS[params.part];
  const Model = params.build === "old" ? part.Old : part.New;

  useEffect(() => {
    delete document.body.dataset.studioReady;
    delete document.body.dataset.studioError;
  }, [params]);

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
        <LoadBoundary key={`${params.build}-${params.variant}`}>
          <Suspense fallback={null}>
            <Model variant={params.variant} />
            <ReadyProbe />
          </Suspense>
        </LoadBoundary>
        <PostEffects environment={environment} />
      </Canvas>
    </div>
  );
}
