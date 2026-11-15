"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3, type Mesh } from "three";
import { useGameStore } from "@/lib/planet-smasher/store";
import { dirToUv } from "@/lib/planet-smasher/sphere";
import { startGoo, stopGoo } from "../../audio/sfx";
import {
  FlashSprite,
  clamp01,
  rand,
  stepDt,
  tangentBasisInto,
  toVec,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import {
  NANOBOT_FALL,
  NanobotSchedule,
  nanobotTick,
  NANOBOT_STEP,
} from "./nanobotSpread";
import type { EffectProps } from "./effectQueue";

export { nanobotTick };

const SILVER: readonly [number, number, number] = [0.85, 0.92, 1];
const SILVER_END: readonly [number, number, number] = [0.3, 0.75, 0.95];
const DROP_HEIGHT = 1.5;
/** Seconds after the last tick before the effect is removed. */
const TAIL = NANOBOT_STEP + 0.15;

/**
 * The nanobot swarm: a silver droplet falls in and a goo spot starts at the
 * tap, then it wanders and spreads, one stamp every 250 ms for 10 s. It stops
 * on its own (and quiets its sound) when the game is no longer playing.
 */
export default function Nanobots({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const drop = useRef<Mesh>(null);
  const schedule = useMemo(() => new NanobotSchedule(), []);
  const run = useRef({
    age: 0,
    shimmer: 0,
    started: false,
    goo: null as number | null,
    done: false,
  });
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const t1 = useMemo(() => new Vector3(), []);
  const t2 = useMemo(() => new Vector3(), []);
  const lead = useMemo(() => n.clone(), [n]);
  const tmp = useMemo(() => new Vector3(), []);
  const seed = useMemo(
    () => Math.floor(effect.u * 9973) * 31 + Math.floor(effect.v * 7919) + 1,
    [effect.u, effect.v]
  );
  const glint = useMemo(() => new FlashSprite(0xbfeaff), []);
  const sys = useSharedParticles(true, 0);
  useDispose(glint);

  const stopSound = () => {
    const r = run.current;
    stopGoo(r.goo);
    r.goo = null;
  };
  useEffect(() => stopSound, []);

  useFrame((_, rawDt) => {
    const r = run.current;
    if (r.done) return;
    const dt = stepDt(rawDt);
    r.age += dt;
    if (!r.started) {
      r.started = true;
      r.goo = startGoo();
    }
    const playing = useGameStore.getState().phase === "playing";
    const due = schedule.step(dt, playing);
    if (schedule.stopped) {
      r.done = true;
      stopSound();
      if (drop.current) drop.current.visible = false;
      glint.set(lead, 0, 0);
      cb.current.onDone();
      return;
    }
    for (const k of due) {
      const { du, dv } = nanobotTick(k, seed);
      tangentBasisInto(n, t1, t2);
      lead.copy(n).addScaledVector(t1, du).addScaledVector(t2, dv).normalize();
      const { u, v } = dirToUv(lead);
      cb.current.onImpact(u, v, { x: lead.x, y: lead.y, z: lead.z });
    }

    // The droplet: a stretched silver bead that falls and lands on the tap.
    const d = drop.current;
    if (d) {
      const f = clamp01(r.age / NANOBOT_FALL);
      d.visible = f < 1;
      d.position
        .copy(n)
        .multiplyScalar(planetRadius * (1.005 + (1 - f * f) * DROP_HEIGHT));
      d.scale.set(0.035, 0.06, 0.035);
      d.quaternion.setFromUnitVectors(tmp.set(0, 1, 0), n);
    }

    // A faint shimmer where the swarm is spreading.
    if (!schedule.finished) {
      tmp.copy(lead).multiplyScalar(planetRadius * 1.012);
      glint.set(tmp, 0.14 + 0.03 * Math.sin(r.age * 9), 0.35);
      r.shimmer += dt * 26;
      while (r.shimmer >= 1) {
        r.shimmer -= 1;
        tangentBasisInto(lead, t1, t2);
        const a = rand(0, Math.PI * 2);
        const rr = rand(0, 0.05);
        tmp
          .copy(lead)
          .multiplyScalar(planetRadius * 1.01)
          .addScaledVector(t1, Math.cos(a) * rr)
          .addScaledVector(t2, Math.sin(a) * rr);
        sys.emit({
          x: tmp.x,
          y: tmp.y,
          z: tmp.z,
          vx: lead.x * 0.12 + rand(-0.03, 0.03),
          vy: lead.y * 0.12 + rand(-0.03, 0.03),
          vz: lead.z * 0.12 + rand(-0.03, 0.03),
          life: rand(0.5, 0.9),
          size: rand(0.012, 0.026),
          endSize: 0.004,
          color: SILVER,
          endColor: SILVER_END,
          alpha: 0.7,
        });
      }
    } else {
      glint.set(lead, 0, 0);
      if (r.age > NANOBOT_FALL + 39 * NANOBOT_STEP + TAIL) {
        r.done = true;
        stopSound();
        cb.current.onDone();
      }
    }
  });

  return (
    <>
      <mesh ref={drop}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshStandardMaterial
          color="#d9e2ee"
          metalness={0.6}
          roughness={0.25}
          emissive="#7aa8c8"
          emissiveIntensity={0.7}
        />
      </mesh>
      <primitive object={glint.sprite} />
    </>
  );
}
