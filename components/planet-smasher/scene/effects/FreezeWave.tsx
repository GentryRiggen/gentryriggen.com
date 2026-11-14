"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  FlashSprite,
  stepDt,
  SurfaceRing,
  clamp01,
  easeOut,
  rand,
  tangentBasis,
  toVec,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const C0: readonly [number, number, number] = [0.85, 0.97, 1];
const C1: readonly [number, number, number] = [0.3, 0.7, 1];

const WAVE = 1.2;
const RADIUS = 0.35;
const IMPACT_AT = 0.12;
const END = 1.8;

/** The freeze ray: a bluish cap of cold that spreads over the ground. */
export default function FreezeWave({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const run = useRef({ age: 0, hit: false, done: false, sparkle: 0 });
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const basis = useMemo(() => tangentBasis(n), [n]);
  const cap = useMemo(() => new SurfaceRing(0x2f9dff), []);
  const rim = useMemo(() => new SurfaceRing(0x9fe6ff), []);
  const flash = useMemo(() => new FlashSprite(0xbfeaff), []);
  const sys = useSharedParticles();
  useDispose(cap, rim, flash);
  const lifted = useMemo(
    () => n.clone().multiplyScalar(planetRadius * 1.03),
    [n, planetRadius]
  );

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    const t = clamp01(r.age / WAVE);
    const outer = RADIUS * easeOut(t);
    cap.set(n, 0, outer, 0.5 * (1 - t * t));
    rim.set(n, Math.max(0, outer - 0.035), outer, 0.9 * (1 - t));
    const f = clamp01(r.age / 0.3);
    flash.set(lifted, 0.3 + 0.35 * f, 0.55 * (1 - f));
    // Ice sparkles inside the growing cap.
    r.sparkle += dt * 90;
    while (r.sparkle >= 1 && outer > 0.02) {
      r.sparkle -= 1;
      const a = rand(0, Math.PI * 2);
      const ang = outer * Math.sqrt(rand());
      const ca = Math.cos(ang);
      const sa = Math.sin(ang);
      const c = Math.cos(a);
      const s = Math.sin(a);
      sys.emit({
        x:
          (n.x * ca + (basis.t1.x * c + basis.t2.x * s) * sa) *
          planetRadius *
          1.02,
        y:
          (n.y * ca + (basis.t1.y * c + basis.t2.y * s) * sa) *
          planetRadius *
          1.02,
        z:
          (n.z * ca + (basis.t1.z * c + basis.t2.z * s) * sa) *
          planetRadius *
          1.02,
        vx: n.x * 0.1,
        vy: n.y * 0.1,
        vz: n.z * 0.1,
        life: rand(0.5, 0.9),
        size: rand(0.025, 0.05),
        endSize: 0.01,
        color: C0,
        endColor: C1,
      });
    }
    if (!r.hit && r.age >= IMPACT_AT) {
      r.hit = true;
      cb.current.onImpact(effect.u, effect.v, effect.point);
    }
    if (r.age > END && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <primitive object={cap.mesh} />
      <primitive object={rim.mesh} />
      <primitive object={flash.sprite} />
    </>
  );
}
