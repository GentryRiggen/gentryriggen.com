"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  Quaternion,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
} from "three";
import {
  stepDt,
  FlashSprite,
  clamp01,
  rand,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import { laserAim } from "./laserAim";
import type { EffectProps } from "./effectQueue";

const C0: readonly [number, number, number] = [1, 0.85, 0.4];
const C1: readonly [number, number, number] = [1, 0.25, 0.05];

const HOVER = 1.8;
const FADE_IN = 0.2;
const FADE_OUT = 0.35;
const Y = new Vector3(0, 1, 0);
const hot = new Vector3();
const hot2 = new Vector3();

/**
 * The alien saucer and its beam. Mounted while the button is held; follows the
 * aim, deals damage on each tick the cooldown allows, and fades on release.
 */
export default function LaserBeam({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const saucer = useRef<Group>(null);
  const beam = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);
  const beamMat = useRef<MeshBasicMaterial>(null);
  const coreMat = useRef<MeshBasicMaterial>(null);
  const run = useRef({ age: 0, released: -1, seen: 0, done: false, spark: 0 });

  const dir = useMemo(
    () =>
      new Vector3(effect.point.x, effect.point.y, effect.point.z).normalize(),
    [effect.point]
  );
  const surf = useMemo(() => new Vector3(), []);
  const from = useMemo(() => new Vector3(), []);
  const tmp = useMemo(() => new Vector3(), []);
  const tilt = useMemo(() => new Vector3(), []);
  const q = useMemo(() => new Quaternion(), []);
  const flash = useMemo(() => new FlashSprite(0xffe9a8), []);
  const sys = useSharedParticles(true, 0.3);
  useDispose(flash);

  useFrame((state, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    const driving = laserAim.owner === effect.id;
    const held = driving && laserAim.held;
    if (!held && r.released < 0) r.released = r.age;
    if (driving) {
      // The aim moves, and the saucer glides after it.
      tmp.set(laserAim.point.x, laserAim.point.y, laserAim.point.z).normalize();
      dir.lerp(tmp, 1 - Math.exp(-14 * dt)).normalize();
      surf.copy(tmp).multiplyScalar(planetRadius * 1.005);
      const ticks = laserAim.ticks - r.seen;
      r.seen = laserAim.ticks;
      // Ticks counted just before the release still land.
      for (let i = 0; i < Math.min(ticks, 3); i++) {
        cb.current.onImpact(laserAim.u, laserAim.v, laserAim.point);
      }
    }
    const appear = clamp01(r.age / FADE_IN);
    const vanish =
      r.released < 0 ? 1 : 1 - clamp01((r.age - r.released) / FADE_OUT);
    const vis = appear * vanish;

    from.copy(dir).multiplyScalar(HOVER + (1 - vanish) * 1.5);
    if (saucer.current) {
      saucer.current.position.copy(from);
      // Tilt the disc toward the viewer's up so it reads as a saucer.
      tilt
        .setFromMatrixColumn(state.camera.matrixWorld, 1)
        .add(dir)
        .normalize();
      saucer.current.quaternion.setFromUnitVectors(Y, tilt);
      saucer.current.rotateX(Math.sin(r.age * 3) * 0.08);
      saucer.current.rotateZ(Math.cos(r.age * 2.3) * 0.08);
      saucer.current.scale.setScalar(0.001 + vis * 0.65);
      saucer.current.visible = vis > 0.01;
    }
    const length = from.distanceTo(surf);
    const pulse = 0.8 + 0.2 * Math.sin(r.age * 40);
    for (const [m, mat, w] of [
      [beam.current, beamMat.current, 1],
      [core.current, coreMat.current, 1],
    ] as const) {
      if (!m || !mat) continue;
      m.visible = vis > 0.05 && driving;
      m.position.copy(from).add(surf).multiplyScalar(0.5);
      q.setFromUnitVectors(Y, tmp.copy(from).sub(surf).normalize());
      m.quaternion.copy(q);
      m.scale.set(w * (0.9 + 0.1 * pulse), length, w * (0.9 + 0.1 * pulse));
      mat.opacity = (m === beam.current ? 0.5 : 0.95) * vis * pulse;
    }
    // A hot spot and sparks where the beam bites.
    if (driving && vis > 0.3) {
      flash.set(
        hot.copy(surf).multiplyScalar(1.02),
        0.17 * (0.8 + 0.4 * pulse),
        vis
      );
      r.spark += dt * 70;
      const n = hot2.copy(surf).normalize();
      while (r.spark >= 1) {
        r.spark -= 1;
        sys.emit({
          x: surf.x,
          y: surf.y,
          z: surf.z,
          vx: n.x * 0.5 + rand(-0.5, 0.5),
          vy: n.y * 0.5 + rand(-0.5, 0.5),
          vz: n.z * 0.5 + rand(-0.5, 0.5),
          life: rand(0.2, 0.5),
          size: 0.03,
          endSize: 0.005,
          color: C0,
          endColor: C1,
          drag: 0.5,
        });
      }
    } else {
      flash.set(surf, 0, 0);
    }
    if (r.released >= 0 && r.age - r.released > FADE_OUT + 0.4 && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <group ref={saucer}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.12, 0.05, 28]} />
          <meshStandardMaterial
            color="#8d98ad"
            metalness={0.7}
            roughness={0.35}
          />
        </mesh>
        <mesh position={[0, 0.03, 0]}>
          <sphereGeometry
            args={[0.1, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
          />
          <meshStandardMaterial
            color="#7be8ff"
            emissive="#35c8ff"
            emissiveIntensity={0.9}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh position={[0, -0.005, 0]}>
          <torusGeometry args={[0.205, 0.014, 8, 40]} />
          <meshBasicMaterial color="#8dffb4" toneMapped={false} />
        </mesh>
      </group>
      <mesh ref={beam}>
        <cylinderGeometry args={[0.025, 0.07, 1, 14, 1, true]} />
        <meshBasicMaterial
          ref={beamMat}
          color="#ff4d4d"
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core}>
        <cylinderGeometry args={[0.01, 0.025, 1, 10, 1, true]} />
        <meshBasicMaterial
          ref={coreMat}
          color="#fff4d6"
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <primitive object={flash.sprite} />
    </>
  );
}
