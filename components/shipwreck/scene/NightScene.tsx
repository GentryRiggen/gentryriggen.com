"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WebGLRenderer } from "three";
import { useStore } from "zustand";
import {
  QUALITY_TIERS,
  type PlaybackStore,
  type QualityTier,
} from "@/lib/shipwreck/playback";
import { TEST_HOOKS_ENABLED } from "@/lib/shipwreck/testHooks";
import CameraRig from "./CameraRig";
import Effects from "./Effects";
import Environment from "./Environment";
import Iceberg from "./Iceberg";
import PlacePins from "./PlacePins";
import Sea from "./Sea";
import ShipRig from "./ShipRig";
import Sky from "./Sky";
import XRay from "./XRay";
import { createSceneRuntime, type SceneRuntime } from "./runtime";

/**
 * The night: the sky, the sea, the ship from the track, the effects and
 * every camera, inside one `<Canvas>`. Reads the playback store each frame;
 * the DOM UI goes on top (Task 5). See README.md.
 */

/** Device pixel ratio per tier (capped by the device's own). */
/** How long a lost WebGL context may take to come back (ms). */
const LOST_MS = 5000;

export const TIER_DPR: Record<QualityTier, number> = {
  high: 2,
  medium: 1.5,
  low: 1,
};

export interface RenderInfo {
  calls: number;
  triangles: number;
  /** The camera's position (three.js axes), for tests. */
  camera: [number, number, number];
  quality: QualityTier;
  dpr: number;
}

declare global {
  interface Window {
    __shipwreckRenderInfo?: RenderInfo;
  }
}

interface NightSceneProps {
  store: PlaybackStore;
  /** Let the frame rate move the quality tier (off to pin a tier for tests). */
  autoQuality?: boolean;
}

export default function NightScene({
  store,
  autoQuality = true,
}: NightSceneProps) {
  const runtime = useMemo(() => createSceneRuntime(), []);
  const quality = useStore(store, (s) => s.quality);
  // A lost WebGL context that does not come back stops the scene: thrown
  // here so the error boundary around it offers a fresh start.
  const [isLost, setLost] = useState(false);
  const lostCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => lostCleanup.current?.(), []);
  const onCreated = useCallback(({ gl }: { gl: WebGLRenderer }) => {
    lostCleanup.current?.();
    const el = gl.domElement;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onLost = (e: Event) => {
      // Ask the browser to restore it; give it a few seconds.
      e.preventDefault();
      if (timer === null) timer = setTimeout(() => setLost(true), LOST_MS);
    };
    const onRestored = () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
    };
    el.addEventListener("webglcontextlost", onLost);
    el.addEventListener("webglcontextrestored", onRestored);
    lostCleanup.current = () => {
      el.removeEventListener("webglcontextlost", onLost);
      el.removeEventListener("webglcontextrestored", onRestored);
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
  if (isLost) throw new Error("The WebGL context was lost and not restored");
  const dpr = Math.min(
    TIER_DPR[quality],
    typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  );

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={dpr}
        camera={{ fov: 42, near: 0.5, far: 42000, position: [380, 60, 300] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={onCreated}
        className="touch-none"
      >
        {autoQuality && (
          <PerformanceMonitor
            bounds={() => [44, 57]}
            flipflops={4}
            onDecline={() => step(store, 1)}
            // Touch devices (the iPad) never step up on their own: each
            // step up and back down again is a visible stutter.
            onIncline={() => {
              if (!isTouchDevice()) step(store, -1);
            }}
          />
        )}
        <Driver store={store} />
        {TEST_HOOKS_ENABLED && <RenderInfoProbe quality={quality} dpr={dpr} />}
        <Environment runtime={runtime} />
        <Sky dpr={dpr} />
        <ShipRig store={store} runtime={runtime} />
        <Iceberg store={store} />
        <Effects store={store} runtime={runtime} />
        <XRay store={store} runtime={runtime} />
        <SeaFromStore store={store} runtime={runtime} />
        <CameraRig store={store} runtime={runtime} />
        {/* Fixed MSAA: changing it rebuilds the composer (a hitch on a tier step). */}
        <EffectComposer multisampling={4}>
          <Bloom
            luminanceThreshold={1}
            luminanceSmoothing={0.25}
            intensity={1.25}
            mipmapBlur
            resolutionScale={quality === "high" ? 0.5 : 0.35}
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      </Canvas>
      <PlacePins store={store} runtime={runtime} />
    </div>
  );
}

function isTouchDevice(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

function step(store: PlaybackStore, by: 1 | -1) {
  const s = store.getState();
  const i = QUALITY_TIERS.indexOf(s.quality);
  const next = QUALITY_TIERS[Math.max(0, Math.min(2, i + by))];
  if (next !== s.quality) s.setQuality(next);
}

function SeaFromStore({
  store,
  runtime,
}: {
  store: PlaybackStore;
  runtime: SceneRuntime;
}) {
  const quality = useStore(store, (s) => s.quality);
  const xray = useStore(store, (s) => s.xray);
  return <Sea runtime={runtime} quality={quality} xray={xray} />;
}

/** Advances the runner (≤ 6 ms a frame) and the shown time. */
function Driver({ store }: { store: PlaybackStore }) {
  useFrame((_, dt) => {
    const s = store.getState();
    if (!s.done) s.pump();
    s.tick(Math.min(dt, 0.1), performance.now() / 1000);
  }, -3);
  return null;
}

/**
 * Draw calls and triangles of the last whole frame (every pass: the sea's
 * reflection, bloom), on `window.__shipwreckRenderInfo` (dev and e2e).
 */
function RenderInfoProbe({
  quality,
  dpr,
}: {
  quality: QualityTier;
  dpr: number;
}) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
      delete window.__shipwreckRenderInfo;
    };
  }, [gl]);
  useFrame(() => {
    window.__shipwreckRenderInfo = {
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      camera: [camera.position.x, camera.position.y, camera.position.z],
      quality,
      dpr,
    };
    gl.info.reset();
  }, -10);
  return null;
}
