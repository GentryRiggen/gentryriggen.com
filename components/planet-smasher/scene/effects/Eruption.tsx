"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  stepDt,
  FlashSprite,
  SurfaceRing,
  clamp01,
  easeOut,
  rand,
  tangentBasis,
  toVec,
  useDispose,
  useLatest,
  useParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const BULGE = 0.8;
const END = 3.6;
const RADIUS = 0.15;

/** The supervolcano: the ground glows and swells, then lava and ash erupt. */
export default function Eruption({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const run = useRef({ age: 0, hit: false, done: false });
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const base = useMemo(
    () => n.clone().multiplyScalar(planetRadius),
    [n, planetRadius]
  );
  const basis = useMemo(() => tangentBasis(n), [n]);
  const glow = useMemo(() => new SurfaceRing(0xff4a08), []);
  const rim = useMemo(() => new SurfaceRing(0xff9a20), []);
  const flash = useMemo(() => new FlashSprite(0xffb050), []);
  const lava = useParticles(220, true, 1.7);
  const ash = useParticles(60, false, -0.0);
  useDispose(glow, rim, flash);
  const lifted = useMemo(() => base.clone().multiplyScalar(1.03), [base]);

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    if (!r.hit) {
      const t = clamp01(r.age / BULGE);
      const pulse = 0.75 + 0.25 * Math.sin(r.age * 22);
      glow.set(
        n,
        0,
        RADIUS * (0.4 + 0.6 * easeOut(t)),
        (0.12 + 0.4 * t) * pulse
      );
      rim.set(
        n,
        RADIUS * 0.7 * easeOut(t),
        RADIUS * (0.4 + 0.6 * easeOut(t)),
        0.5 * t
      );
      // Rising embers while it builds.
      if (Math.random() < 0.5) {
        const a = rand(0, Math.PI * 2);
        const d = rand(0, RADIUS * 0.7);
        const px =
          base.x + (basis.t1.x * Math.cos(a) + basis.t2.x * Math.sin(a)) * d;
        const py =
          base.y + (basis.t1.y * Math.cos(a) + basis.t2.y * Math.sin(a)) * d;
        const pz =
          base.z + (basis.t1.z * Math.cos(a) + basis.t2.z * Math.sin(a)) * d;
        lava.emit({
          x: px,
          y: py,
          z: pz,
          vx: n.x * 0.25,
          vy: n.y * 0.25,
          vz: n.z * 0.25,
          life: 0.5,
          size: 0.03,
          color: [1, 0.7, 0.2],
          endColor: [0.8, 0.1, 0.02],
        });
      }
      if (r.age >= BULGE) {
        r.hit = true;
        r.age = BULGE;
        for (let i = 0; i < 140; i++) {
          const spread = rand(0, 0.38);
          const a = rand(0, Math.PI * 2);
          const sp = rand(1, 2.3);
          const dx =
            n.x +
            (basis.t1.x * Math.cos(a) + basis.t2.x * Math.sin(a)) * spread;
          const dy =
            n.y +
            (basis.t1.y * Math.cos(a) + basis.t2.y * Math.sin(a)) * spread;
          const dz =
            n.z +
            (basis.t1.z * Math.cos(a) + basis.t2.z * Math.sin(a)) * spread;
          lava.emit({
            x: base.x,
            y: base.y,
            z: base.z,
            vx: dx * sp,
            vy: dy * sp,
            vz: dz * sp,
            life: rand(1, 1.9),
            size: rand(0.04, 0.085),
            endSize: 0.02,
            color: [1, rand(0.7, 0.9), 0.3],
            endColor: [0.85, 0.12, 0.02],
            drag: 0.15,
          });
        }
        for (let i = 0; i < 28; i++) {
          const g = rand(0.25, 0.4);
          ash.emit({
            x: base.x + rand(-0.04, 0.04),
            y: base.y + rand(-0.04, 0.04),
            z: base.z + rand(-0.04, 0.04),
            vx: n.x * rand(0.2, 0.5) + rand(-0.12, 0.12),
            vy: n.y * rand(0.2, 0.5) + rand(-0.12, 0.12),
            vz: n.z * rand(0.2, 0.5) + rand(-0.12, 0.12),
            life: rand(2, 2.7),
            size: 0.12,
            endSize: rand(0.4, 0.65),
            color: [g, g, g * 1.05],
            endColor: [g * 0.5, g * 0.5, g * 0.55],
            alpha: 0.55,
            drag: 0.5,
          });
        }
        cb.current.onImpact(effect.u, effect.v, effect.point);
      }
    }
    if (r.hit) {
      const since = r.age - BULGE;
      const f = clamp01(since / 0.4);
      flash.set(lifted, 0.5 + 0.5 * f, 1 - f);
      const k = clamp01(since / 1.6);
      glow.set(n, 0, RADIUS, 0.5 * (1 - k));
      rim.set(n, 0, 0, 0);
      if (since > END - BULGE && !r.done) {
        r.done = true;
        cb.current.onDone();
      }
    }
  });

  return (
    <>
      <primitive object={glow.mesh} />
      <primitive object={rim.mesh} />
      <primitive object={flash.sprite} />
      <primitive object={ash.points} />
      <primitive object={lava.points} />
    </>
  );
}
