"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3, type Mesh } from "three";
import { moonPosition } from "../Moon";
import { moonRam } from "./moonState";
import {
  FlashSprite,
  stepDt,
  SurfaceRing,
  clamp01,
  debris,
  easeOut,
  lerp,
  rand,
  shake,
  toVec,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const C0: readonly [number, number, number] = [0.55, 0.65, 0.95];
const C1: readonly [number, number, number] = [0.2, 0.15, 0.5];

const FLIGHT = 2.5;
const START_R = 0.27;
const END_R = 0.55;
const END = 5.0;
const ID = new Quaternion();

interface MoonRamProps extends EffectProps {
  /** The orbiting Moon exists: the ram starts from where it is. */
  hasMoon: boolean;
}

/** The Moon leaves its orbit and falls into the planet, growing as it comes. */
export default function MoonRam({
  effect,
  planetRadius,
  hasMoon,
  onImpact,
  onDone,
}: MoonRamProps) {
  const cb = useLatest({ onImpact, onDone });
  const moon = useRef<Mesh>(null);
  const run = useRef({
    age: 0,
    hit: false,
    done: false,
    trail: 0,
    ready: false,
  });
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const target = useMemo(
    () => n.clone().multiplyScalar(planetRadius),
    [n, planetRadius]
  );
  const flash = useMemo(() => new FlashSprite(0xfff6e0), []);
  const ring = useMemo(() => new SurfaceRing(0xfff0d0), []);
  const sys = useSharedParticles(true, 0.7);
  useDispose(flash, ring);
  const startDir = useMemo(() => new Vector3(), []);
  const pos = useMemo(() => new Vector3(), []);
  const qk = useMemo(() => new Quaternion(), []);
  const qFull = useMemo(() => new Quaternion(), []);
  const startR = useRef(4);
  const lifted = useMemo(() => target.clone().multiplyScalar(1.03), [target]);

  useEffect(() => {
    moonRam.active++;
    return () => {
      moonRam.active--;
    };
  }, []);

  useFrame((state, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    if (!r.ready) {
      r.ready = true;
      if (hasMoon) {
        moonPosition(state.clock.elapsedTime, startDir);
      } else {
        const cam = state.camera;
        const up = new Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
        const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
        startDir.copy(up).multiplyScalar(2.2).addScaledVector(right, -3.4);
      }
      startR.current = startDir.length();
      startDir.normalize();
      qFull.setFromUnitVectors(startDir, n);
    }
    r.age += dt;
    const m = moon.current;
    if (!r.hit) {
      const t = clamp01(r.age / FLIGHT);
      const k = t * t;
      const rad = lerp(START_R, END_R, t);
      // Swing around the planet toward the target while closing in.
      qk.copy(ID).slerp(qFull, k);
      const dist =
        planetRadius +
        rad +
        (startR.current - planetRadius - START_R) * (1 - k);
      pos.copy(startDir).applyQuaternion(qk).multiplyScalar(dist);
      if (m) {
        m.position.copy(pos);
        m.scale.setScalar(rad);
        m.rotation.y += dt * 0.6;
      }
      r.trail += dt * 90;
      while (r.trail >= 1) {
        r.trail -= 1;
        sys.emit({
          x: pos.x + rand(-rad, rad) * 0.5,
          y: pos.y + rand(-rad, rad) * 0.5,
          z: pos.z + rand(-rad, rad) * 0.5,
          life: 0.7,
          size: rad * 0.7,
          endSize: rad * 0.2,
          color: C0,
          endColor: C1,
          alpha: 0.5,
        });
      }
      if (r.age >= FLIGHT) {
        r.hit = true;
        r.age = FLIGHT;
        if (m) m.visible = false;
        debris(sys, target, n, 200, 2.2, 0.06);
        shake(0.03, 0.9);
        cb.current.onImpact(effect.u, effect.v, effect.point);
      }
    }
    if (r.hit) {
      const since = r.age - FLIGHT;
      const f = clamp01(since / 0.6);
      flash.set(lifted, 3 * (0.4 + 0.8 * easeOut(f)), 1 - f * f);
      const k = clamp01(since / 1.5);
      ring.set(
        n,
        Math.max(0, easeOut(k) * 0.9 - 0.07),
        easeOut(k) * 0.9,
        0.9 * (1 - k)
      );
      if (since > END - FLIGHT && !r.done) {
        r.done = true;
        cb.current.onDone();
      }
    }
  });

  return (
    <>
      <mesh ref={moon}>
        <sphereGeometry args={[1, 40, 28]} />
        <meshStandardMaterial
          color="#a8a8ae"
          roughness={1}
          emissive="#3a3a52"
          emissiveIntensity={0.4}
        />
      </mesh>
      <primitive object={ring.mesh} />
      <primitive object={flash.sprite} />
    </>
  );
}
