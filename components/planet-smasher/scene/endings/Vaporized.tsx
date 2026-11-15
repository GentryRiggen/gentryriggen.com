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
  useSharedParticles,
} from "../effects/particles";
import { sunState } from "../effects/sunState";
import { planetFx } from "./planetFx";

interface VaporizedProps {
  onDone(): void;
}

const TOTAL = 3;
/** How far the planet falls toward the Sun before it is gone. */
const DRIFT = 1.4;
/** The planet starts shrinking, and is gone, at these times. */
const SHRINK_AT = 1.6;
const GONE_AT = 2.6;
/** Plasma streams off the planet at this rate (per second) at full heat. */
const PLASMA_RATE = 110;

const smooth = (t: number) => clamp01(t) * clamp01(t) * (3 - 2 * clamp01(t));

/**
 * The planet falls into the Sun: it glows orange, then white-hot, streams
 * plasma toward the Sun, shrinks to nothing and goes out in a flash. The Sun
 * (from the sun-dive effect) slides back out on its own.
 */
export default function Vaporized({ onDone }: VaporizedProps) {
  const cb = useLatest({ onDone });
  const run = useRef({ age: 0, done: false, plasma: 0, ready: false });
  const halo = useMemo(() => new FlashSprite(0xff7a20), []);
  const flash = useMemo(() => new FlashSprite(0xfff2d0), []);
  useDispose(halo, flash);
  const sys = useSharedParticles(true, 0);
  const toSun = useMemo(() => new Vector3(), []);
  const at = useMemo(() => new Vector3(), []);
  const dir = useMemo(() => new Vector3(), []);

  useFrame((state, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    if (!r.ready) {
      r.ready = true;
      // Forced without a sun dive: the Sun is just off the right edge.
      if (!sunState.active) {
        const cam = state.camera;
        toSun
          .setFromMatrixColumn(cam.matrixWorld, 0)
          .multiplyScalar(3.9)
          .addScaledVector(cam.position.clone().normalize(), -1.2);
        sunState.pos.copy(toSun);
      }
    }
    r.age += dt;
    const age = r.age;
    toSun.copy(sunState.pos).normalize();

    const heat = smooth(age / 2.3);
    planetFx.vapor = heat;
    planetFx.atmosphere = 1 - 0.85 * heat;
    planetFx.spin = age * 0.9;
    planetFx.pos
      .copy(toSun)
      .multiplyScalar(DRIFT * smooth(age / (GONE_AT + 0.2)));
    planetFx.scale = 1 - smooth((age - SHRINK_AT) / (GONE_AT - SHRINK_AT));
    if (age >= GONE_AT) planetFx.hidden = true;
    at.copy(planetFx.pos);

    // A soft orange halo that swells with the heat.
    halo.set(
      at,
      (4.2 + 1.2 * heat) * Math.max(planetFx.scale, 0.2),
      0.4 * heat * (1 - smooth((age - GONE_AT) / 0.3))
    );

    if (age < GONE_AT) shake(0.006 + 0.02 * heat, 0.15);

    // Plasma peels off the Sun-facing side and streams into the Sun.
    r.plasma += dt * PLASMA_RATE * heat;
    while (r.plasma >= 1 && age < GONE_AT) {
      r.plasma -= 1;
      dir.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      dir.addScaledVector(toSun, 1.1).normalize();
      const s = planetFx.scale;
      sys.emit({
        x: at.x + dir.x * s,
        y: at.y + dir.y * s,
        z: at.z + dir.z * s,
        vx: toSun.x * rand(1.4, 2.8) + rand(-0.15, 0.15),
        vy: toSun.y * rand(1.4, 2.8) + rand(-0.15, 0.15),
        vz: toSun.z * rand(1.4, 2.8) + rand(-0.15, 0.15),
        life: rand(0.7, 1.2),
        size: rand(0.04, 0.09) * (0.5 + 0.5 * s),
        endSize: 0.012,
        color: [1, rand(0.4, 0.6), 0.1],
        endColor: [1, 0.95, 0.85],
        alpha: 0.8,
      });
    }

    // The planet is gone: one big white flash.
    const f = clamp01((age - (GONE_AT - 0.15)) / 0.6);
    flash.set(at, 3 + 9 * f, age >= GONE_AT - 0.15 ? 1 - f * f : 0);
    if (age >= GONE_AT - 0.15 && age - dt < GONE_AT - 0.15) shake(0.04, 0.5);

    if (age >= TOTAL && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  }, -1);

  return (
    <>
      <primitive object={halo.sprite} />
      <primitive object={flash.sprite} />
    </>
  );
}
