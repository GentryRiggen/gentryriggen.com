"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { uvToDir } from "@/lib/planet-smasher/sphere";
import {
  stepDt,
  rand,
  shake,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const C0: readonly [number, number, number] = [1, 0.5, 0.12];
const C1: readonly [number, number, number] = [0.8, 0.1, 0.02];
const C2: readonly [number, number, number] = [1, 0.95, 0.7];
const C3: readonly [number, number, number] = [1, 0.5, 0.1];
const C4: readonly [number, number, number] = [1, 0.8, 0.4];
const C5: readonly [number, number, number] = [0.9, 0.2, 0.05];

const scratch = new Vector3();
const LENGTH = 0.6;
const SAMPLES = 36;
const GLOW_IN = 1.0;
const STAMP_AT = 0.15;
const END = 2.0;

/**
 * The earthquake: the ground rumbles (camera shake) and a glowing front runs
 * along a jagged crack. The crack is stamped at 0.15 s with a random angle;
 * glowing sparks light the same line in over 1 s.
 */
export default function Quake({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const run = useRef({
    age: 0,
    stamped: false,
    shook: false,
    emitted: 0,
    done: false,
  });
  const angle = useMemo(() => rand(0, Math.PI * 2), []);

  // The crack's line on the globe, matching how DamagePainter walks it.
  const path = useMemo(() => {
    const lat0 = (effect.v - 0.5) * Math.PI;
    let lon = effect.u * Math.PI * 2;
    let lat = lat0;
    const pts: Vector3[] = [];
    const ds = LENGTH / (SAMPLES - 1);
    for (let i = 0; i < SAMPLES; i++) {
      const wob = i > 0 ? rand(-0.5, 0.5) * ds * 1.4 : 0;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      const stepLon = (dx * ds - dy * wob) / Math.max(Math.cos(lat), 0.15);
      const stepLat = dy * ds + dx * wob;
      if (i > 0) {
        lon += stepLon;
        lat = Math.max(-1.5, Math.min(1.5, lat + stepLat));
      }
      const d = uvToDir(lon / (Math.PI * 2), lat / Math.PI + 0.5);
      pts.push(new Vector3(d.x, d.y, d.z).multiplyScalar(planetRadius * 1.006));
    }
    return pts;
  }, [effect.u, effect.v, angle, planetRadius]);

  const sys = useSharedParticles();

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    if (!r.shook) {
      r.shook = true;
      shake(0.02, 0.6);
    }
    if (!r.stamped && r.age >= STAMP_AT) {
      r.stamped = true;
      cb.current.onImpact(effect.u, effect.v, effect.point, {
        angle,
        length: LENGTH,
      });
    }
    // Light the sparks in along the crack as the front passes.
    const front = Math.min(1, r.age / GLOW_IN) * (SAMPLES - 1);
    while (r.emitted <= front && r.emitted < SAMPLES) {
      const p = path[r.emitted];
      sys.emit({
        x: p.x,
        y: p.y,
        z: p.z,
        life: 1.1,
        size: 0.07,
        endSize: 0.03,
        color: C0,
        endColor: C1,
        alpha: 0.85,
      });
      sys.emit({
        x: p.x,
        y: p.y,
        z: p.z,
        life: 0.35,
        size: 0.1,
        endSize: 0.02,
        color: C2,
        endColor: C3,
      });
      if (r.emitted % 2 === 0) {
        const n = scratch.copy(p).normalize();
        sys.emit({
          x: p.x,
          y: p.y,
          z: p.z,
          vx: n.x * 0.5 + rand(-0.3, 0.3),
          vy: n.y * 0.5 + rand(-0.3, 0.3),
          vz: n.z * 0.5 + rand(-0.3, 0.3),
          life: rand(0.3, 0.7),
          size: 0.025,
          color: C4,
          endColor: C5,
          drag: 0.6,
        });
      }
      r.emitted++;
    }
    if (r.age > END && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return null;
}
