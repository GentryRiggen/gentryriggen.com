"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Canvas,
  useFrame,
  useThree,
  type ThreeEvent,
} from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import RenderInfoProbe from "./RenderInfoProbe";
import ChunkWarmup from "./ChunkWarmup";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3, type DirectionalLight, type Mesh } from "three";
import type { Vec3 } from "@/lib/planet-smasher/sphere";
import type { ToolId } from "@/lib/planet-smasher/tools";
import Moon from "./Moon";
import type { DamagePainter } from "./DamagePainter";
import Planet, { SUN_VIEW_DIR } from "./Planet";
import type { PlanetTextures } from "./planetTextures";
import { isTap } from "./tapGesture";
import EndingStage from "./endings/EndingStage";
import EffectLayer from "./effects/EffectLayer";
import type { ActiveEffect, ImpactOpts } from "./effects/effectQueue";

interface StageProps {
  onFire(u: number, v: number, point: Vec3): void;
  onHoldStart?(u: number, v: number, point: Vec3): void;
  onHoldMove?(u: number, v: number, point: Vec3): void;
  onHoldEnd?(): void;
  holdMode: boolean;
  textures: PlanetTextures;
  painter: DamagePainter;
  hasMoon: boolean;
  effects: ActiveEffect[];
  onImpact(
    toolId: ToolId,
    u: number,
    v: number,
    point: Vec3,
    opts?: ImpactOpts
  ): void;
  onEffectDone(id: number): void;
}

const AUTO_ROTATE_PAUSE_MS = 4000;

interface Down {
  id: number;
  x: number;
  y: number;
  t: number;
}

function Scene({
  onFire,
  onHoldStart,
  onHoldMove,
  onHoldEnd,
  holdMode,
  textures,
  painter,
  hasMoon,
  effects,
  onImpact,
  onEffectDone,
}: StageProps) {
  const controls = useRef<OrbitControlsImpl>(null);
  const planet = useRef<Mesh>(null);
  const down = useRef<Down | null>(null);
  const holding = useRef(false);
  const sun = useRef<DirectionalLight>(null);
  const [sunDir] = useState(() => new Vector3(...SUN_VIEW_DIR).normalize());
  const resume = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the whole planet in view on tall screens: back the camera off.
  const aspect = useThree((s) => s.size.width / s.size.height);
  const cam = useThree((s) => s.camera);
  useEffect(() => {
    cam.position.setLength(Math.max(3.7, 3.1 / aspect));
  }, [aspect, cam]);

  // The sun stays upper left of the viewer as the camera orbits, so the
  // face in view is mostly lit with a night crescent on the right.
  useFrame(({ camera }) => {
    sunDir
      .set(...SUN_VIEW_DIR)
      .normalize()
      .transformDirection(camera.matrixWorld);
    sun.current?.position.copy(sunDir).multiplyScalar(6);
  });

  const pauseRotate = useCallback(() => {
    const c = controls.current;
    if (!c) return;
    c.autoRotate = false;
    if (resume.current) clearTimeout(resume.current);
    resume.current = setTimeout(() => {
      if (controls.current && !holding.current) {
        controls.current.autoRotate = true;
      }
    }, AUTO_ROTATE_PAUSE_MS);
  }, []);

  useEffect(
    () => () => {
      if (resume.current) clearTimeout(resume.current);
    },
    []
  );

  // A release anywhere ends a hold.
  useEffect(() => {
    const end = () => {
      if (!holding.current) return;
      holding.current = false;
      if (controls.current) controls.current.enabled = true;
      onHoldEnd?.();
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [onHoldEnd]);

  const hitOf = (e: ThreeEvent<PointerEvent>) =>
    e.uv
      ? {
          u: e.uv.x,
          v: e.uv.y,
          point: { x: e.point.x, y: e.point.y, z: e.point.z },
        }
      : null;

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    pauseRotate();
    // A second finger (pinch) cancels the tap and never fires a shot.
    if (!e.isPrimary) {
      down.current = null;
      return;
    }
    if (e.pointerType === "mouse" && e.button !== 0) return;
    down.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
    };
    if (!holdMode) return;
    const hit = hitOf(e);
    if (!hit) return;
    e.stopPropagation();
    holding.current = true;
    if (controls.current) controls.current.enabled = false;
    onHoldStart?.(hit.u, hit.v, hit.point);
  };

  const handleMove = (e: ThreeEvent<PointerEvent>) => {
    if (!holding.current) return;
    const hit = hitOf(e);
    if (hit) onHoldMove?.(hit.u, hit.v, hit.point);
  };

  const handleUp = (e: ThreeEvent<PointerEvent>) => {
    const d = down.current;
    if (!d || e.pointerId !== d.id) return;
    down.current = null;
    if (holdMode) return;
    if (!isTap(d, { x: e.clientX, y: e.clientY, t: performance.now() })) return;
    const hit = hitOf(e);
    if (hit) onFire(hit.u, hit.v, hit.point);
  };

  return (
    <>
      <color attach="background" args={["#05060f"]} />
      <Stars count={3000} radius={60} depth={40} factor={3} fade />
      <ambientLight intensity={0.35} />
      <directionalLight ref={sun} intensity={2.2} />
      <Planet
        ref={planet}
        textures={textures}
        painter={painter}
        sunDir={sunDir}
        onPointerDown={handleDown}
        onPointerUp={handleUp}
        onPointerMove={handleMove}
        renderEnding={(m) => <EndingStage material={m} />}
      />
      {hasMoon && <Moon />}
      <EffectLayer
        effects={effects}
        hasMoon={hasMoon}
        onImpact={onImpact}
        onEffectDone={onEffectDone}
      />
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={1.6}
        maxDistance={6}
        enableDamping
        autoRotate
        autoRotateSpeed={0.3}
        onStart={pauseRotate}
      />
    </>
  );
}

/** The 3D canvas: planet, stars, sun, moon and tap/hold input. */
export default function Stage(props: StageProps) {
  return (
    <div
      data-testid="planet-canvas"
      className="h-full w-full touch-none select-none"
    >
      <Canvas dpr={[1, 2]} camera={{ position: [0, 0, 3.7], fov: 45 }}>
        <Scene {...props} />
        <RenderInfoProbe />
        <ChunkWarmup />
      </Canvas>
    </div>
  );
}
