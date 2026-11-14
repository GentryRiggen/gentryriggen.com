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

interface MoltenProps {
  onDone(): void;
}

const RAMP = 2.5;

/** The whole surface goes red-hot and the planet ends as a lava ball. */
export default function Molten({ onDone }: MoltenProps) {
  const cb = useLatest({ onDone });
  const run = useRef({ age: 0, done: false, embers: 0 });
  const halo = useMemo(() => new FlashSprite(0xff5a10), []);
  useDispose(halo);
  const sys = useParticles(160);
  const origin = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    r.age += dt;
    const k = clamp01(r.age / RAMP);
    const m = k * k * (3 - 2 * k);
    planetFx.molten = m;
    planetFx.atmosphere = 1 - 0.7 * m;
    const beat = 0.92 + 0.08 * Math.sin(r.age * 3);
    halo.set(origin, 3.1 + 0.15 * Math.sin(r.age * 2), 0.4 * m * beat);
    if (k < 1) shake(0.004 + 0.01 * m, 0.15);
    // Embers lift off the surface, fewer once it has settled.
    r.embers += dt * (k < 1 ? 50 : 8);
    while (r.embers >= 1) {
      r.embers -= 1;
      dir.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      sys.emit({
        x: dir.x * 1.02,
        y: dir.y * 1.02,
        z: dir.z * 1.02,
        vx: dir.x * 0.35,
        vy: dir.y * 0.35 + 0.1,
        vz: dir.z * 0.35,
        life: rand(0.9, 1.6),
        size: rand(0.015, 0.035) * (0.4 + m),
        endSize: 0.005,
        color: [1, rand(0.55, 0.85), 0.25],
        endColor: [0.8, 0.1, 0.02],
        alpha: 0.4 + 0.6 * m,
        drag: 0.5,
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
