"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  FlashSprite,
  clamp01,
  rand,
  shake,
  stepDt,
  useDispose,
  useLatest,
  useParticles,
} from "../effects/particles";
import { planetFx } from "./planetFx";

interface ConsumedProps {
  onDone(): void;
}

const RAMP = 2.5;

/** The nanobots finish the job: the planet becomes a shiny metal ball. */
export default function Consumed({ onDone }: ConsumedProps) {
  const cb = useLatest({ onDone });
  const run = useRef({ age: 0, done: false, glints: 0 });
  const halo = useMemo(() => new FlashSprite(0x4fd8ff), []);
  useDispose(halo);
  const sys = useParticles(140);
  const origin = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    r.age += dt;
    const k = clamp01(r.age / RAMP);
    const m = k * k * (3 - 2 * k);
    planetFx.consumed = m;
    planetFx.atmosphere = 1 - 0.6 * m;
    const beat = 0.9 + 0.1 * Math.sin(r.age * 3.4);
    halo.set(origin, 3.1 + 0.12 * Math.sin(r.age * 2), 0.24 * m * beat);
    if (k < 1) shake(0.003 + 0.006 * m, 0.15);
    // Silver and cyan glints flick off the surface as it turns to metal.
    r.glints += dt * (k < 1 ? 45 : 7);
    while (r.glints >= 1) {
      r.glints -= 1;
      dir.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      const cyan = Math.random() < 0.4;
      sys.emit({
        x: dir.x * 1.02,
        y: dir.y * 1.02,
        z: dir.z * 1.02,
        vx: dir.x * 0.25,
        vy: dir.y * 0.25 + 0.05,
        vz: dir.z * 0.25,
        life: rand(0.5, 1.1),
        size: rand(0.015, 0.03) * (0.4 + m),
        endSize: 0.004,
        color: cyan ? [0.4, 0.9, 1] : [0.9, 0.95, 1],
        endColor: [0.2, 0.5, 0.9],
        alpha: 0.4 + 0.6 * m,
        drag: 0.6,
      });
    }
    if (r.age >= RAMP && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  }, -1);

  return (
    <>
      <primitive object={halo.sprite} />
      <primitive object={sys.points} />
    </>
  );
}
