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
import { Color, type Object3D, type WebGLRenderer } from "three";
import { useStore } from "zustand";
import {
  stageSpec,
  type PlaybackStore,
  type QualityTier,
} from "@/lib/shipwreck/playback";
import { storyIdOf } from "@/lib/shipwreck/ships/types";
import { TEST_HOOKS_ENABLED } from "@/lib/shipwreck/testHooks";
import CameraRig from "./CameraRig";
import Coast, { GiglioBuild } from "./Coast";
import Convoy from "./Convoy";
import Effects from "./Effects";
import Environment from "./Environment";
import Iceberg from "./Iceberg";
import PlacePins from "./PlacePins";
import Sea from "./Sea";
import { ShipOnStage } from "./ShipRig";
import GreenWater from "./GreenWater";
import Sky, { DaySky, StormSky } from "./Sky";
import StormSea from "./StormSea";
import Torpedo, { hasTorpedoTrack } from "./Torpedo";
import WalkRunner from "./WalkRunner";
import Wreckage from "./Wreckage";
import XRay from "./XRay";
import { stepQuality } from "./quality";
import { createSceneRuntime, type SceneRuntime } from "./runtime";
import {
  SCENE_SETTINGS,
  dayLookOf,
  isDaylit,
  sceneSettingsFor,
  sunDirection,
  type SceneSettings,
} from "./settings";

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
  /** Whether a named object (and every parent) is visible, for tests. */
  isShown: (name: string) => boolean;
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
  /** The scene's shared runtime, when the DOM over it reads it too (walking). */
  runtime?: SceneRuntime;
}

export default function NightScene({
  store,
  autoQuality = true,
  runtime: given,
}: NightSceneProps) {
  const own = useMemo(() => createSceneRuntime(), []);
  const runtime = given ?? own;
  const quality = useStore(store, (s) => s.quality);
  const spec = stageSpec({
    ship: useStore(store, (s) => s.ship),
    wreck: useStore(store, (s) => s.wreck),
  });
  // Her wreck's story: the sky, sea, coast and weather are its own.
  const story = storyIdOf(spec);
  // The time button's hour (her real one unless changed), live: the sky,
  // light and water follow it; what happens (her boats, smoke, rockets)
  // stays her real day's (`real`).
  const time = useStore(store, (s) => s.time);
  const settings = sceneSettingsFor(story, time);
  const real = SCENE_SETTINGS[story];
  const day = isDaylit(settings);
  useEffect(() => {
    runtime.stormLight = settings.stormLight ?? null;
  }, [runtime, settings]);
  const storm = settings.storm === true;
  const haze = useMemo(() => new Color(settings.fog), [settings]);
  const sunDir = useMemo(
    () =>
      settings.sun
        ? sunDirection(settings.sun, settings.headingDeg ?? 90)
        : ([0, 1, 0] as [number, number, number]),
    [settings]
  );
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
            // Not while her run is still computing (`stepQuality`).
            onDecline={() => stepQuality(store, 1)}
            // Touch devices (the iPad) never step up on their own: each
            // step up and back down again is a visible stutter.
            onIncline={() => {
              if (!isTouchDevice()) stepQuality(store, -1);
            }}
          />
        )}
        <Driver store={store} runtime={runtime} />
        {TEST_HOOKS_ENABLED && <RenderInfoProbe quality={quality} dpr={dpr} />}
        <Environment
          runtime={runtime}
          ship={story}
          seaDepthM={spec.seaDepthM}
          settings={settings}
        />
        {day ? (
          <DaySky
            sunDir={sunDir}
            horizon={haze}
            look={dayLookOf(settings)}
            zenith={settings.daylight?.zenith}
            clouds={settings.daylight?.clouds}
          />
        ) : storm && !settings.stars ? (
          <StormSky runtime={runtime} fog={settings.fog} dpr={dpr} />
        ) : (
          <Sky
            dpr={dpr}
            moon={settings.moon}
            clouds={settings.clouds}
            headingDeg={settings.headingDeg}
            runtime={runtime}
          />
        )}
        {settings.coast && <Coast ship={story} />}
        {story === "concordia" && <GiglioBuild store={store} />}
        {settings.convoy && quality !== "low" && <Convoy store={store} />}
        {/* Another ship builds her own model, disposing the old. */}
        <ShipOnStage store={store} runtime={runtime} />
        {settings.iceberg && <Iceberg store={store} />}
        {hasTorpedoTrack(spec) && <Torpedo store={store} />}
        {storm && (
          <>
            <GreenWater store={store} runtime={runtime} spec={spec} />
            <Wreckage store={store} seaDepthM={spec.seaDepthM} />
          </>
        )}
        <Effects
          store={store}
          runtime={runtime}
          spec={spec}
          settings={real}
          dark={!day && isDaylit(real)}
        />
        <XRay store={store} runtime={runtime} spec={spec} />
        <SeaFromStore store={store} runtime={runtime} settings={settings} />
        <WalkRunner key={spec.id} store={store} runtime={runtime} spec={spec} />
        <CameraRig store={store} runtime={runtime} spec={spec} />
        {/* Fixed MSAA: changing it rebuilds the composer (a hitch on a tier step). */}
        <EffectComposer multisampling={4}>
          <Bloom
            // By day the sunlit paint must not glow: only the sun, its
            // glitter on the sea and the flashes bloom. In the storm her
            // lights and the far lights bloom, as at night.
            luminanceThreshold={day ? 1.6 : 1}
            luminanceSmoothing={0.25}
            intensity={day ? 0.9 : storm ? 1 : 1.25}
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

function SeaFromStore({
  store,
  runtime,
  settings,
}: {
  store: PlaybackStore;
  runtime: SceneRuntime;
  settings: SceneSettings;
}) {
  const quality = useStore(store, (s) => s.quality);
  const xray = useStore(store, (s) => s.xray);
  const ship = useStore(store, (s) => s.ship);
  const wreck = useStore(store, (s) => s.wreck);
  // The storm's sea is her track's waves (no mirror: trap 3).
  if (settings.storm)
    return (
      <StormSea
        runtime={runtime}
        quality={quality}
        xray={xray}
        settings={settings}
        spec={stageSpec({ ship, wreck })}
      />
    );
  return (
    <Sea runtime={runtime} quality={quality} xray={xray} settings={settings} />
  );
}

/**
 * Advances the runner (≤ 6 ms a frame) and the shown time; hands the
 * water-light button's step to the scene.
 */
function Driver({
  store,
  runtime,
}: {
  store: PlaybackStore;
  runtime: SceneRuntime;
}) {
  useFrame((_, dt) => {
    const s = store.getState();
    runtime.underLight = s.underLight;
    if (!s.done) s.pump();
    s.tick(Math.min(dt, 0.1), performance.now() / 1000);
  }, -3);
  return null;
}

/** Whether the named object and every parent of it are visible. */
function shownIn(root: Object3D, name: string): boolean {
  const o = root.getObjectByName(name);
  if (!o) return false;
  let visible = true;
  o.traverseAncestors((a) => {
    if (!a.visible) visible = false;
  });
  return visible && o.visible;
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
  const scene = useThree((s) => s.scene);
  // Looked up only when a test asks, never per frame.
  const isShown = useCallback((name: string) => shownIn(scene, name), [scene]);
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
      isShown,
    };
    gl.info.reset();
  }, -10);
  return null;
}
