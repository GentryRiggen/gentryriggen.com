"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { dirToUv } from "@/lib/planet-smasher/sphere";
import {
  stepDt,
  approachDir,
  clamp01,
  rand,
  tangentBasis,
  toVec,
  useLatest,
  useParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const COUNT = 10;
const FLIGHT = 0.45;
const SPREAD = 0.25;
const END = 2.3;

interface Meteor {
  startAt: number;
  target: Vector3;
  from: Vector3;
  u: number;
  v: number;
}

/** Ten small streaks over 1.5 s, each with its own mini flash. */
export default function MeteorShower({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const age = useRef(0);
  const hits = useRef<boolean[]>([]);
  const done = useRef(false);

  const meteors = useMemo<Meteor[]>(() => {
    const c = toVec(effect.point);
    const { t1, t2 } = tangentBasis(c);
    return Array.from({ length: COUNT }, (_, i) => {
      const ang = rand(0, Math.PI * 2);
      const off = SPREAD * Math.sqrt(rand());
      const dir = c
        .clone()
        .multiplyScalar(Math.cos(off))
        .addScaledVector(t1, Math.sin(off) * Math.cos(ang))
        .addScaledVector(t2, Math.sin(off) * Math.sin(ang))
        .normalize();
      const { u, v } = dirToUv(dir);
      const target = dir.clone().multiplyScalar(planetRadius);
      const from = target
        .clone()
        .addScaledVector(approachDir(camera, dir, rand(-1.1, -0.7)), 3.5);
      return {
        startAt: (i / (COUNT - 1)) * (1.5 - FLIGHT) + rand(-0.03, 0.03),
        target,
        from,
        u,
        v,
      };
    });
  }, [effect.point, planetRadius, camera]);

  const sys = useParticles(700, true, 0.6);
  const pos = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    age.current += dt;
    meteors.forEach((m, i) => {
      const t = (age.current - m.startAt) / FLIGHT;
      if (t < 0 || hits.current[i]) return;
      pos.copy(m.from).lerp(m.target, clamp01(t) ** 1.4);
      // A streak: a bright head and a line of embers behind it.
      sys.emit({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        life: 0.08,
        size: 0.09,
        color: [1, 0.95, 0.8],
        endColor: [1, 0.6, 0.2],
      });
      for (let k = 1; k <= 3; k++) {
        const back = pos.clone().lerp(m.from, k * 0.02);
        sys.emit({
          x: back.x,
          y: back.y,
          z: back.z,
          life: 0.3,
          size: 0.05,
          endSize: 0.01,
          color: [1, 0.7, 0.3],
          endColor: [0.8, 0.15, 0.05],
        });
      }
      if (t >= 1) {
        hits.current[i] = true;
        // Mini flash and sparks.
        sys.emit({
          x: m.target.x,
          y: m.target.y,
          z: m.target.z,
          life: 0.25,
          size: 0.2,
          endSize: 0.1,
          color: [1, 1, 0.9],
          endColor: [1, 0.6, 0.2],
        });
        const n = m.target.clone().normalize();
        for (let k = 0; k < 6; k++) {
          sys.emit({
            x: m.target.x,
            y: m.target.y,
            z: m.target.z,
            vx: n.x * 0.5 + rand(-0.5, 0.5),
            vy: n.y * 0.5 + rand(-0.5, 0.5),
            vz: n.z * 0.5 + rand(-0.5, 0.5),
            life: rand(0.3, 0.7),
            size: 0.03,
            endSize: 0.005,
            color: [1, 0.8, 0.4],
            endColor: [0.9, 0.2, 0.05],
            drag: 0.5,
          });
        }
        cb.current.onImpact(m.u, m.v, {
          x: m.target.x / planetRadius,
          y: m.target.y / planetRadius,
          z: m.target.z / planetRadius,
        });
      }
    });
    if (age.current > END && !done.current) {
      done.current = true;
      cb.current.onDone();
    }
  });

  return <primitive object={sys.points} />;
}
