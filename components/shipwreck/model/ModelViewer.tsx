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
import { Color, PMREMGenerator, Vector3, type Mesh } from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { carpathia } from "@/lib/shipwreck/ships/carpathia";
import { britannic } from "@/lib/shipwreck/ships/britannic";
import { concordia } from "@/lib/shipwreck/ships/concordia";
import { fitzgerald } from "@/lib/shipwreck/ships/fitzgerald";
import { lusitania } from "@/lib/shipwreck/ships/lusitania";
import { poseidon } from "@/lib/shipwreck/ships/poseidon";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type {
  ModelInfo,
  ModelViewOptions,
  ShipwreckModelHooks,
} from "@/lib/shipwreck/testHooks";
import TitanicModel from "./TitanicModel";
import { applyBowBend } from "./bowBend";
import { createRockMesh, disposeRockMesh } from "./rock";
import type { TitanicHandles } from "./shipModel";

/**
 * A neutral stage for checking the model (`/shipwreck?model`, dev and e2e
 * builds only; `&ship=lusitania`, `&ship=fitzgerald`, `&ship=carpathia`,
 * `&ship=britannic`, `&ship=concordia` or `&ship=poseidon`): orbit controls, a day light or
 * the night with bloom (`&livery=<id>` picks a livery, e.g.
 * `&ship=lusitania&livery=cunard-1907` or the Carpathia's `grey-1918`; the
 * old `&paint=dazzle|grey|cunard` still names hers, and the Britannic's
 * 1.4 `&paint=liner` hers), and
 * `window.__shipwreck.setModelView` to set the break, lights, quality, a
 * camera preset and the livery (repainted live, no rebuild).
 */

type Required3 = Required<Omit<ModelViewOptions, "livery">>;

const DEFAULT_VIEW: Required3 = {
  breakX: null,
  power: 0,
  flicker: 0,
  quality: "high",
  camera: "bow",
  stage: "day",
  bowBend: 0,
  roll: 0,
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
  "bow-port": { pos: [245, 46, -150], target: [30, 18, 0] },
  gantry: { pos: [-20, 44, 48], target: [-50, 32, 6] },
  funnel: { pos: [-10, 66, 40], target: [-52, 56, 0] },
  rock: { pos: [-55, 9, -45], target: [-86, 4, -17] },
  dome: { pos: [40, 70, 60], target: [-3, 54, 0] },
  keel: { pos: [-230, 75, 120], target: [-80, 38, 0] },
};

/** Presets reframed for a ship whose stern is not the Titanic's. */
const SHIP_CAMERAS: Partial<Record<ShipSpec["id"], Partial<typeof CAMERAS>>> = {
  lusitania: {
    stern: { pos: [-205, 2, 120], target: [-62, 13, 0] },
    "stern-close": { pos: [-168, 20, 56], target: [-104, 12, 0] },
    astern: { pos: [-160, 17, 0], target: [-118, 15.5, 0] },
  },
  // Her sister's hull: the Titanic's frames, with views of her gantry
  // davits (the aft sets from the starboard quarter) and her bent bow.
  britannic: {
    gantry: { pos: [-4, 46, 46], target: [-46, 33, 8] },
    bridge: { pos: [112, 36, 30], target: [74, 30, 0] },
    "break-close": { pos: [150, 10, -95], target: [92, 12, 0] },
  },
  // A 729 ft laker: houses at the ends, the hatches between.
  fitzgerald: {
    bow: { pos: [225, 40, 140], target: [30, 10, 0] },
    stern: { pos: [-185, 12, 82], target: [-92, 4, 0] },
    side: { pos: [0, 16, 400], target: [0, 12, 0] },
    top: { pos: [0, 330, 16], target: [0, 0, 0] },
    break: { pos: [10, 34, 360], target: [10, 12, 0] },
    bridge: { pos: [138, 30, 46], target: [97, 20, 0] },
    "bow-close": { pos: [142, 15, 34], target: [100, 11.5, 0] },
    "stern-close": { pos: [-150, 12, 46], target: [-108, 6, 0] },
    astern: { pos: [-150, 14, 0], target: [-110, 10, 0] },
    "break-close": { pos: [40, 30, 60], target: [18, 12, 0] },
    "boat-deck": { pos: [-56, 30, 44], target: [-92, 19, 0] },
  },
  // A 290 m cruise ship, 14 decks: everything further and higher.
  concordia: {
    bow: { pos: [310, 80, 240], target: [10, 30, 0] },
    "bow-port": { pos: [300, 70, -250], target: [-10, 26, 0] },
    stern: { pos: [-235, 22, 150], target: [-105, 16, 0] },
    side: { pos: [0, 34, 600], target: [6, 30, 0] },
    top: { pos: [6, 540, 24], target: [6, 0, 0] },
    bridge: { pos: [195, 44, 34], target: [100, 36, 0] },
    "boat-deck": { pos: [46, 30, 52], target: [8, 25, 16] },
    "bow-close": { pos: [196, 24, 66], target: [126, 16, 0] },
    "stern-close": { pos: [-190, 6, 58], target: [-122, 5, 0] },
    astern: { pos: [-210, 34, 0], target: [-130, 26, 0] },
  },
  // A made-up 305 m cruise ship, 15 decks: the Concordia's frames, a
  // little further; her funnel aft and the ballroom's dome.
  poseidon: {
    bow: { pos: [330, 82, 255], target: [14, 30, 0] },
    "bow-port": { pos: [320, 72, -265], target: [-6, 26, 0] },
    stern: { pos: [-250, 22, 160], target: [-112, 14, 0] },
    side: { pos: [0, 34, 640], target: [6, 30, 0] },
    top: { pos: [6, 580, 24], target: [6, 0, 0] },
    bridge: { pos: [200, 44, 40], target: [105, 36, 0] },
    "boat-deck": { pos: [46, 30, 54], target: [8, 25, 16] },
    "bow-close": { pos: [210, 24, 70], target: [138, 16, 0] },
    "stern-close": { pos: [-200, 6, 60], target: [-132, 5, 0] },
    astern: { pos: [-225, 34, 0], target: [-140, 26, 0] },
    funnel: { pos: [-20, 72, 55], target: [-74, 60, 0] },
  },
  // A 558 ft intermediate liner: one funnel, four masts, wells.
  carpathia: {
    bow: { pos: [190, 45, 130], target: [20, 18, 0] },
    stern: { pos: [-170, 18, 95], target: [-60, 12, 0] },
    side: { pos: [0, 22, 330], target: [0, 21, 0] },
    top: { pos: [0, 300, 14], target: [0, 0, 0] },
    break: { pos: [5, 32, 300], target: [0, 16, 0] },
    bridge: { pos: [42, 36, 44], target: [2, 26, 0] },
    "bow-close": { pos: [118, 26, 48], target: [70, 18, 0] },
    "stern-close": { pos: [-128, 14, 44], target: [-80, 8, 0] },
    astern: { pos: [-130, 14, 0], target: [-88, 10, 0] },
    "break-close": { pos: [10, 30, 60], target: [-10, 15, 0] },
    "boat-deck": { pos: [26, 34, 40], target: [-12, 23, 6] },
  },
};

/** The ship named by `?ship=` (the Titanic by default). */
function shipFromUrl(): ShipSpec {
  if (typeof window === "undefined") return titanic;
  const id = new URLSearchParams(window.location.search).get("ship");
  return id === "lusitania"
    ? lusitania
    : id === "fitzgerald"
      ? fitzgerald
      : id === "carpathia"
        ? carpathia
        : id === "britannic"
          ? britannic
          : id === "concordia"
            ? concordia
            : id === "poseidon"
              ? poseidon
              : titanic;
}

/** The Carpathia's 1.4 `?paint=` names, as livery ids. */
const PAINT_LIVERY: Record<string, string> = {
  dazzle: "dazzle-1918",
  grey: "grey-1918",
  cunard: "cunard-1912",
};

/**
 * The livery named by `?livery=` (or `?paint=`: the Carpathia's 1.4 names,
 * else a livery id as is, the Britannic's `liner`), null for hers.
 */
function liveryFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const paint = q.get("paint") ?? "";
  const own = shipFromUrl().liveries?.some((l) => l.id === paint);
  return q.get("livery") ?? PAINT_LIVERY[paint] ?? (own ? paint : null);
}

interface ModelViewerProps {
  hooksRef: RefObject<ShipwreckModelHooks | null>;
}

export default function ModelViewer({ hooksRef }: ModelViewerProps) {
  const [view, setView] = useState<Required3>(DEFAULT_VIEW);
  const [spec] = useState(shipFromUrl);
  const [livery, setLivery] = useState(liveryFromUrl);
  const info = useRef<ModelInfo>({
    ready: false,
    calls: 0,
    triangles: 0,
    modelTriangles: 0,
    buildMs: 0,
  });

  useEffect(() => {
    hooksRef.current = {
      setModelView: ({ livery: next, ...v }) => {
        info.current.ready = false;
        if (next !== undefined) setLivery(next);
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
        <Stage view={view} spec={spec} livery={livery} onInfo={onInfo} />
      </Canvas>
    </div>
  );
}

interface StageProps {
  view: Required3;
  spec: ShipSpec;
  livery: string | null;
  onInfo(patch: Partial<ModelInfo>): void;
}

function Stage({ view, spec, livery, onInfo }: StageProps) {
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
    // The presets frame the Titanic; some are reframed for other ships.
    const c = SHIP_CAMERAS[spec.id]?.[view.camera] ?? CAMERAS[view.camera];
    camera.position.set(c.pos[0], c.pos[1], c.pos[2]);
    controls.current?.target.set(c.target[0], c.target[1], c.target[2]);
    controls.current?.update();
    camera.lookAt(new Vector3(c.target[0], c.target[1], c.target[2]));
  }, [get, view.camera, spec]);

  const apply = useCallback(
    (h: TitanicHandles) => {
      h.setPower(view.power);
      h.setFlicker(view.flicker);
      // Her emergency lights (the Concordia's) at night, as after her
      // blackout.
      h.setEmergency(view.stage === "night" ? 1 : 0);
      // Rolled about her length through 20 m over the keel (keel up at
      // 180: the hull in the air over the turned-over decks).
      const roll = (view.roll * Math.PI) / 180;
      h.root.rotation.x = roll;
      h.root.position.y = 20 * (1 - Math.cos(roll));
      h.root.position.z = -20 * Math.sin(roll);
      if (h.bend && h.recipe.hinge)
        applyBowBend(h.bend, view.bowBend, h.recipe.hinge);
      if (h.breakX !== null) {
        // Drawn apart for checking: hinged at the keel, the stern lifted.
        poseHalf(h.bow, h.breakX, -0.1, 4);
        poseHalf(h.stern, h.breakX, -0.3, -4);
      }
    },
    [view.power, view.flicker, view.bowBend, view.stage, view.roll]
  );

  // The Concordia's rock in her side (the scene shows it from the strike;
  // here always, whole ship only).
  const rock = useRef<Mesh | null>(null);
  const onReady = useCallback(
    (h: TitanicHandles) => {
      handles.current = h;
      frames.current = 0;
      apply(h);
      if (rock.current) {
        rock.current.removeFromParent();
        disposeRockMesh(rock.current);
        rock.current = null;
      }
      if (h.recipe.rock && h.breakX === null) {
        rock.current = createRockMesh(h.recipe.rock);
        h.whole.add(rock.current);
      }
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
      livery: handles.current?.livery ?? null,
      liveryMs: handles.current?.stats.liveryMs ?? 0,
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
        livery={livery}
        onReady={(h) => {
          onInfo({
            modelTriangles: modelTriangles(h),
            buildMs: Math.round(h.stats.buildMs),
            ship: h.recipe.spec.id,
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
  // Visible only: a livery's hidden parts (another funnel) are not drawn.
  h.root.traverseVisible((o) => {
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
