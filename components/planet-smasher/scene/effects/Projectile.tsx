"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3, type Mesh } from "three";
import {
  FlashSprite,
  stepDt,
  SurfaceRing,
  approachDir,
  clamp01,
  debris,
  easeOut,
  lumpyRock,
  rand,
  shake,
  toVec,
  useDispose,
  useLatest,
  useParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const FLIGHT = 0.6;
const AFTER = 1.4;
const RING_RADIUS = 0.25;

/** The asteroid: a lumpy rock with a fiery tail, then flash, ring, debris. */
export default function Projectile({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const rock = useRef<Mesh>(null);
  const run = useRef({ age: 0, hit: false, done: false, tail: 0 });

  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const target = useMemo(
    () => n.clone().multiplyScalar(planetRadius),
    [n, planetRadius]
  );
  const start = useMemo(
    () => target.clone().addScaledVector(approachDir(camera, n), 4.5),
    [camera, n, target]
  );
  const geo = useMemo(() => lumpyRock(0.06, effect.id), [effect.id]);
  const ring = useMemo(() => new SurfaceRing(0xffd9a0), []);
  const flash = useMemo(() => new FlashSprite(0xfff1d0), []);
  const sys = useParticles(260, true, 0.8);
  useDispose(geo, ring, flash);
  const pos = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    if (!r.hit) {
      const t = clamp01(r.age / FLIGHT);
      pos.copy(start).lerp(target, t ** 1.7);
      if (rock.current) {
        rock.current.position.copy(pos);
        rock.current.rotation.x += dt * 7;
        rock.current.rotation.y += dt * 5;
      }
      // Glowing head plus a tail of embers.
      sys.emit({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        life: 0.07,
        size: 0.16,
        color: [1, 0.85, 0.5],
        endColor: [1, 0.4, 0.1],
      });
      r.tail += dt * 150;
      while (r.tail >= 1) {
        r.tail -= 1;
        sys.emit({
          x: pos.x + rand(-0.02, 0.02),
          y: pos.y + rand(-0.02, 0.02),
          z: pos.z + rand(-0.02, 0.02),
          vx: rand(-0.1, 0.1),
          vy: rand(-0.1, 0.1),
          vz: rand(-0.1, 0.1),
          life: rand(0.3, 0.5),
          size: 0.09,
          endSize: 0.015,
          color: [1, 0.7, 0.25],
          endColor: [0.9, 0.15, 0.03],
        });
      }
      if (r.age >= FLIGHT) {
        r.hit = true;
        r.age = FLIGHT;
        if (rock.current) rock.current.visible = false;
        debris(sys, target, n, 60, 1.1);
        shake(0.008, 0.25);
        cb.current.onImpact(effect.u, effect.v, effect.point);
      }
    }
    if (r.hit) {
      const since = r.age - FLIGHT;
      const f = clamp01(since / 0.25);
      flash.set(
        target.clone().multiplyScalar(1.03),
        0.35 + 0.6 * easeOut(f),
        1 - f
      );
      const k = clamp01(since / 0.8);
      ring.set(
        n,
        Math.max(0, easeOut(k) * RING_RADIUS - 0.03),
        easeOut(k) * RING_RADIUS,
        0.9 * (1 - k)
      );
      if (since > AFTER && !r.done) {
        r.done = true;
        cb.current.onDone();
      }
    }
  });

  return (
    <>
      <mesh ref={rock} geometry={geo}>
        <meshStandardMaterial
          color="#5c4838"
          emissive="#ff5a10"
          emissiveIntensity={0.7}
          flatShading
          roughness={1}
        />
      </mesh>
      <primitive object={ring.mesh} />
      <primitive object={flash.sprite} />
      <primitive object={sys.points} />
    </>
  );
}
