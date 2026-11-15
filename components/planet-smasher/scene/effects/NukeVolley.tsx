"use client";

import { useMemo, useRef } from "react";
import { Vector3 } from "three";
import { dirToUv } from "@/lib/planet-smasher/sphere";
import { rand, tangentBasis, toVec, useLatest } from "./particles";
import { Warhead } from "./Blast";
import type { EffectProps } from "./effectQueue";

interface Shot {
  n: Vector3;
  delay: number;
  scale: number;
  side: number;
  shake: number;
}

const TWIN_GAP_RAD = 0.15;
const TWIN_DELAY = 0.2;
const RAIN_COUNT = 6;
const RAIN_SPREAD = 0.35;
const RAIN_DELAY = 0.25;
const RAIN_SCALE = 0.6;
const RAIN_SHAKE_FROM = 0.01;
const RAIN_SHAKE_TO = 0.03;

/** A unit direction `angle` radians from `c`, toward tangent `(a, b)`. */
function offsetDir(
  c: Vector3,
  t1: Vector3,
  t2: Vector3,
  angle: number,
  heading: number
): Vector3 {
  return c
    .clone()
    .multiplyScalar(Math.cos(angle))
    .addScaledVector(t1, Math.sin(angle) * Math.cos(heading))
    .addScaledVector(t2, Math.sin(angle) * Math.sin(heading))
    .normalize();
}

/**
 * The Twin nuke (two full nukes 0.15 rad apart, 0.2 s apart) and the Nuke
 * rain (six smaller nukes around the tap, 0.25 s apart). Every warhead is a
 * `Warhead` from Blast and reports its own impact.
 */
export default function NukeVolley({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const finished = useRef(0);
  const rain = effect.toolId === "nukeRain";

  const shots = useMemo<Shot[]>(() => {
    const c = toVec(effect.point);
    const { t1, t2 } = tangentBasis(c);
    if (!rain) {
      const heading = rand(0, Math.PI * 2);
      return [-1, 1].map((sign, i) => ({
        n: offsetDir(
          c,
          t1,
          t2,
          TWIN_GAP_RAD / 2,
          heading + (sign < 0 ? Math.PI : 0)
        ),
        delay: i * TWIN_DELAY,
        scale: 1,
        side: sign * 0.4,
        shake: 0.02,
      }));
    }
    return Array.from({ length: RAIN_COUNT }, (_, i) => ({
      n: offsetDir(
        c,
        t1,
        t2,
        RAIN_SPREAD * Math.sqrt(rand()),
        rand(0, Math.PI * 2)
      ),
      delay: i * RAIN_DELAY,
      scale: RAIN_SCALE,
      side: rand(-1.2, 1.2),
      shake:
        RAIN_SHAKE_FROM +
        ((RAIN_SHAKE_TO - RAIN_SHAKE_FROM) * i) / (RAIN_COUNT - 1),
    }));
  }, [effect.point, rain]);

  return (
    <>
      {shots.map((s, i) => (
        <Warhead
          key={i}
          n={s.n}
          planetRadius={planetRadius}
          kind="nuke"
          delay={s.delay}
          scale={s.scale}
          side={s.side}
          shakeAmount={s.shake}
          onImpact={() => {
            const { u, v } = dirToUv(s.n);
            cb.current.onImpact(u, v, { x: s.n.x, y: s.n.y, z: s.n.z });
          }}
          onDone={() => {
            finished.current++;
            if (finished.current === shots.length) cb.current.onDone();
          }}
        />
      ))}
    </>
  );
}
