"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  type Points,
  type PointsMaterial,
} from "three";
import type { RuntimeEnvironment } from "./environmentRuntime";
import { starPositions } from "./skyLayout";

/** Faintest star amount worth drawing. */
const MIN_VISIBLE = 0.01;

interface StarsProps {
  environment: RuntimeEnvironment;
}

/** A fixed starfield that fades in at night and behind thick cloud. */
export default function Stars({ environment }: StarsProps) {
  const points = useRef<Points<BufferGeometry, PointsMaterial>>(null);
  const geometry = useMemo(() => {
    const result = new BufferGeometry();
    result.setAttribute(
      "position",
      new Float32BufferAttribute(starPositions(), 3)
    );
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const stars = points.current;
    if (!stars) return;
    const amount = environment.numbers.starAmount;
    stars.visible = amount > MIN_VISIBLE;
    stars.material.opacity = amount;
  });

  return (
    <points
      ref={points}
      geometry={geometry}
      renderOrder={-1}
      frustumCulled={false}
    >
      <pointsMaterial
        color="#ffffff"
        size={2.2}
        sizeAttenuation={false}
        transparent
        depthWrite={false}
        fog={false}
        toneMapped={false}
      />
    </points>
  );
}
