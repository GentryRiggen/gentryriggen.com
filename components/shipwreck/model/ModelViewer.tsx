"use client";

import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Bloom,
  EffectComposer,
  ToneMapping,
} from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Color, PMREMGenerator, Vector3 } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type {
  ModelInfo,
  ModelViewOptions,
  ShipwreckModelHooks,
} from "@/lib/shipwreck/testHooks";
import TitanicModel from "./TitanicModel";
import type { TitanicHandles } from "./shipModel";

/**
 * A neutral stage for checking the model (`/shipwreck?model`, dev and e2e
 * builds only; `&ship=lusitania` for her): orbit controls, a day light or
 * the night with bloom, and `window.__shipwreck.setModelView` to set the
 * break, lights, quality and a camera preset.
 */

type Required3 = Required<ModelViewOptions>;

const DEFAULT_VIEW: Required3 = {
  breakX: null,
  power: 0,
  flicker: 0,
  quality: "high",
  camera: "bow",
  stage: "day",
};

/** Camera presets (three.js axes: +x forward, +y up, +z starboard). */
const CAMERAS: Record<
  Required3["camera"],
  { pos: number[]; target: number[] }
> = {
  bow: { pos: [245, 46, 150], target: [30, 18, 0] },
  stern: { pos: [-222, -4, 62], target: [-122, 7, 0] },
  side: { pos: [0, 24, 470], target: [-4, 24, 0] },
  top: { pos: [-4, 390, 18], target: [-4, 0, 0] },
  break: { pos: [10, 40, 420], target: [-20, 18, 0] },
  bridge: { pos: [118, 48, 66], target: [52, 30, 0] },
  "bow-close": { pos: [168, 30, 62], target: [104, 19, 0] },
  "stern-close": { pos: [-176, 22, 52], target: [-118, 16, 0] },
  astern: { pos: [-172, 17, 0], target: [-130, 15.5, 0] },
  "break-close": { pos: [-2, 34, 72], target: [-27, 14, 0] },
  "boat-deck": { pos: [52, 40, 52], target: [18, 26, 6] },
};

const STERN_CAMERAS: Required3["camera"][] = ["stern", "stern-close", "astern"];

/** The ship named by `?ship=` (the Titanic by default). */
function shipFromUrl(): ShipSpec {
  if (typeof window === "undefined") return titanic;
  const id = new URLSearchParams(window.location.search).get("ship");
  return id === "lusitania" ? lusitania : titanic;
}

interface ModelViewerProps {
  hooksRef: RefObject<ShipwreckModelHooks | null>;
}

export default function ModelViewer({ hooksRef }: ModelViewerProps) {
  const [view, setView] = useState<Required3>(DEFAULT_VIEW);
  const [spec] = useState(shipFromUrl);
  const info = useRef<ModelInfo>({
    ready: false,
    calls: 0,
    triangles: 0,
    modelTriangles: 0,
    buildMs: 0,
  });

  useEffect(() => {
    hooksRef.current = {
      setModelView: (v) => {
        info.current.ready = false;
        setView((old) => ({ ...old, ...v }));
      },
      getModelInfo: () => ({ ...info.current }),
    };
    return () => {
      hooksRef.current = null;
    };
  }, [hooksRef]);

  const onInfo = useCallback((patch: Partial<ModelInfo>) => {
    Object.assign(info.current, patch);
  }, []);

  const isNight = view.stage === "night";
  return (
    <div
      data-testid="shipwreck-model"
      // safe-area-ok: a full-bleed stage for checking the model, no controls
      className={`fixed inset-0 ${isNight ? "bg-[#04060b]" : "bg-[#cfd5dc]"}`}
    >
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 30, near: 1, far: 4000, position: [215, 58, 190] }}
        gl={{ antialias: true }}
      >
        <Stage view={view} spec={spec} onInfo={onInfo} />
      </Canvas>
    </div>
  );
}

interface StageProps {
  view: Required3;
  spec: ShipSpec;
  onInfo(patch: Partial<ModelInfo>): void;
}

function Stage({ view, spec, onInfo }: StageProps) {
  const get = useThree((s) => s.get);
  const controls = useRef<OrbitControlsImpl>(null);
  const handles = useRef<TitanicHandles | null>(null);
  const frames = useRef(0);
  const isNight = view.stage === "night";

  // A reflection map made in code (nothing downloaded).
  useEffect(() => {
    const { gl, scene } = get();
    const pmrem = new PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = isNight ? 0.05 : 0.7;
    scene.background = new Color(isNight ? 0x04060b : 0xcfd5dc);
    return () => {
      env.dispose();
      pmrem.dispose();
    };
  }, [get, isNight]);

  useEffect(() => {
    const { camera } = get();
    const c = CAMERAS[view.camera];
    // The presets frame the Titanic; slide the stern ones to this ship's.
    const dx = STERN_CAMERAS.includes(view.camera)
      ? spec.stations[0].x - titanic.stations[0].x
      : 0;
    camera.position.set(c.pos[0] + dx, c.pos[1], c.pos[2]);
    controls.current?.target.set(c.target[0] + dx, c.target[1], c.target[2]);
    controls.current?.update();
    camera.lookAt(new Vector3(c.target[0] + dx, c.target[1], c.target[2]));
  }, [get, view.camera, spec]);

  const apply = useCallback(
    (h: TitanicHandles) => {
      h.setPower(view.power);
      h.setFlicker(view.flicker);
      if (h.breakX !== null) {
        // Drawn apart for checking: hinged at the keel, the stern lifted.
        poseHalf(h.bow, h.breakX, -0.1, 4);
        poseHalf(h.stern, h.breakX, -0.3, -4);
      }
    },
    [view.power, view.flicker]
  );

  const onReady = useCallback(
    (h: TitanicHandles) => {
      handles.current = h;
      frames.current = 0;
      apply(h);
    },
    [apply]
  );

  useEffect(() => {
    if (handles.current) apply(handles.current);
  }, [apply]);

  useEffect(() => {
    const { info } = get().gl;
    info.autoReset = false;
    return () => {
      info.autoReset = true;
    };
  }, [get]);

  // Counts accumulate over every pass of a frame (bloom included) and are
  // read and reset before the next one.
  useFrame(({ gl }) => {
    frames.current += 1;
    onInfo({
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      // Ready once the model built for this view has drawn a few frames.
      ...(isBuiltFor(handles.current, view) && frames.current > 3
        ? { ready: true }
        : {}),
    });
    gl.info.reset();
  });

  return (
    <>
      <OrbitControls ref={controls} makeDefault enableDamping={false} />
      {isNight ? (
        <>
          <ambientLight intensity={0.12} color={0x8899bb} />
          <directionalLight
            position={[-200, 300, 300]}
            intensity={0.18}
            color={0xaabbdd}
          />
        </>
      ) : (
        <>
          <hemisphereLight args={[0xffffff, 0x8a8f96, 1.1]} />
          <directionalLight position={[260, 380, 300]} intensity={2.4} />
        </>
      )}
      <TitanicModel
        spec={spec}
        breakX={view.breakX}
        quality={view.quality}
        onReady={(h) => {
          onInfo({
            modelTriangles: modelTriangles(h),
            buildMs: Math.round(h.stats.buildMs),
          });
          onReady(h);
        }}
      />
      {isNight && (
        <EffectComposer multisampling={4}>
          <Bloom
            luminanceThreshold={1}
            luminanceSmoothing={0.2}
            intensity={1.3}
            mipmapBlur
          />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
        </EffectComposer>
      )}
    </>
  );
}

function isBuiltFor(h: TitanicHandles | null, view: Required3): boolean {
  return h !== null && h.breakX === view.breakX && h.quality === view.quality;
}

/** Turns a half about the keel at the break, and slides it along. */
function poseHalf(
  group: TitanicHandles["bow"],
  breakX: number,
  angle: number,
  shift: number
): void {
  const pivot = new Vector3(breakX, 0, 0);
  group.rotation.set(0, 0, angle);
  const turned = pivot.clone().negate().applyEuler(group.rotation);
  group.position
    .copy(pivot)
    .add(turned)
    .add(new Vector3(shift, 0, 0));
}

function modelTriangles(h: TitanicHandles): number {
  let n = 0;
  h.root.traverse((o) => {
    const m = o as unknown as {
      isMesh?: boolean;
      isInstancedMesh?: boolean;
      count?: number;
      geometry?: {
        index: { count: number } | null;
        attributes: { position: { count: number } };
      };
    };
    if (!m.isMesh || !m.geometry) return;
    const tris =
      (m.geometry.index
        ? m.geometry.index.count
        : m.geometry.attributes.position.count) / 3;
    n += m.isInstancedMesh ? tris * (m.count ?? 0) : tris;
  });
  return n;
}
