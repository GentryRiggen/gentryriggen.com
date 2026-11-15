"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Mesh } from "three";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  BODY_RADIUS,
  collisionBody,
  collisionState,
  getBodyChunks,
  useBodyMaterial,
} from "../endings/collisionBody";
import {
  clamp01,
  rand,
  shake,
  stepDt,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const FLIGHT = 2.5;
const END = FLIGHT + 0.2;

/**
 * Another planet (Mars at Earth, Earth at the rest) swings in from far off
 * screen on a curved path, growing as it comes, and slams into the planet.
 * Its 12 chunks are cut ahead of time so the burst does not stall.
 */
export default function PlanetCollision({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const bodyId = useMemo(
    () => collisionBody(useGameStore.getState().progress.planetId),
    []
  );
  const material = useBodyMaterial(bodyId);
  const mesh = useRef<Mesh>(null);
  const run = useRef({
    age: 0,
    ready: false,
    hit: false,
    done: false,
    trail: 0,
  });
  const sys = useSharedParticles(true, 0);
  const p0 = useMemo(() => new Vector3(), []);
  const p1 = useMemo(() => new Vector3(), []);
  const p2 = useMemo(() => new Vector3(), []);
  const pos = useMemo(() => new Vector3(), []);
  const right = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);
  const toCam = useMemo(() => new Vector3(), []);

  // Cut the chunks while the body is still on its way.
  useEffect(() => {
    const t = setTimeout(getBodyChunks, 120);
    return () => clearTimeout(t);
  }, []);

  useFrame((state, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    if (!r.ready) {
      r.ready = true;
      const cam = state.camera;
      right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      up.setFromMatrixColumn(cam.matrixWorld, 1).normalize();
      toCam.copy(cam.position).normalize();
      // It meets the planet on the side facing the viewer, from the left.
      const n = collisionState.dir
        .set(0, 0, 0)
        .addScaledVector(right, -0.55)
        .addScaledVector(up, 0.3)
        .addScaledVector(toCam, 0.75)
        .normalize();
      collisionState.id = bodyId;
      p2.copy(n).multiplyScalar(planetRadius + BODY_RADIUS);
      // Starts small and far behind the planet on the left, then swings in
      // and down toward the viewer, staying in frame for the whole flight.
      p0.copy(p2)
        .addScaledVector(right, -3.4)
        .addScaledVector(up, 1.4)
        .addScaledVector(toCam, -6);
      p1.copy(p2)
        .addScaledVector(right, -1)
        .addScaledVector(up, 0.65)
        .addScaledVector(toCam, -2.4);
    }
    r.age += dt;
    const m = mesh.current;
    if (!r.hit) {
      const t = clamp01(r.age / FLIGHT);
      const k = t ** 1.5;
      const a = (1 - k) ** 2;
      const b = 2 * (1 - k) * k;
      const c = k * k;
      pos
        .set(0, 0, 0)
        .addScaledVector(p0, a)
        .addScaledVector(p1, b)
        .addScaledVector(p2, c);
      if (m) {
        m.position.copy(pos);
        m.rotation.y += dt * 0.5;
        m.rotation.x += dt * 0.2;
      }
      // A glowing wake behind the body.
      r.trail += dt * 70;
      while (r.trail >= 1) {
        r.trail -= 1;
        sys.emit({
          x: pos.x + rand(-1, 1) * BODY_RADIUS * 0.6,
          y: pos.y + rand(-1, 1) * BODY_RADIUS * 0.6,
          z: pos.z + rand(-1, 1) * BODY_RADIUS * 0.6,
          life: 0.6,
          size: BODY_RADIUS * (0.25 + 0.4 * k),
          endSize: 0.03,
          color: [1, 0.75, 0.4],
          endColor: [0.6, 0.15, 0.05],
          alpha: 0.35,
        });
      }
      if (t > 0.6) shake(0.004 + 0.012 * k, 0.12);
      if (r.age >= FLIGHT) {
        r.hit = true;
        if (m) m.visible = false;
        cb.current.onImpact(effect.u, effect.v, effect.point);
      }
    } else if (r.age >= END && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <mesh ref={mesh} material={material} position={[0, 0, -50]}>
      <sphereGeometry args={[BODY_RADIUS, 64, 48]} />
    </mesh>
  );
}
