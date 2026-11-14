"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  ShaderMaterial,
  Vector3,
  type Group,
} from "three";
import {
  stepDt,
  clamp01,
  easeOut,
  rand,
  toVec,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const C0: readonly [number, number, number] = [0.8, 0.6, 1];
const C1: readonly [number, number, number] = [1, 0.5, 0.2];

const DROP = 1.0;
const END = 2.1;
const TILT = 1.15;

const RING_VERTEX = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const RING_FRAGMENT = `
uniform float uTime;
uniform float uOpacity;
varying vec2 vPos;
void main() {
  float r = length(vPos);
  float a = atan(vPos.y, vPos.x);
  float swirl = sin(a * 3.0 + r * 28.0 - uTime * 7.0) * 0.5 + 0.5;
  float inner = smoothstep(0.14, 0.2, r);
  float outer = 1.0 - smoothstep(0.34, 0.5, r);
  float heat = 1.0 - smoothstep(0.15, 0.5, r);
  vec3 col = mix(vec3(0.55, 0.25, 1.0), vec3(1.0, 0.65, 0.2), heat);
  col = mix(col, vec3(1.0), heat * heat * swirl * 0.6);
  float k = inner * outer * (0.45 + 0.55 * swirl);
  gl_FragColor = vec4(col * k * 1.4, k * uOpacity);
}`;

/** The black hole: a tiny dark sphere with a swirling ring drops in and grows. */
export default function BlackHoleDrop({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const body = useRef<Group>(null);
  const bill = useRef<Group>(null);
  const run = useRef({ age: 0, hit: false, done: false, spin: 0 });
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const target = useMemo(
    () => n.clone().multiplyScalar(planetRadius * 1.08),
    [n, planetRadius]
  );
  const start = useMemo(() => {
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    return target.clone().addScaledVector(up, 2.6).addScaledVector(n, 1.2);
  }, [camera, n, target]);
  const mat = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 1 } }),
    []
  );
  const sys = useSharedParticles();
  const pos = useMemo(() => new Vector3(), []);
  const ax = useMemo(() => new Vector3(), []);
  const ay = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    if (mat.current) mat.current.uniforms.uTime.value = r.age;
    let scale = 1;
    let opacity = clamp01(r.age / 0.2);
    if (!r.hit) {
      const t = clamp01(r.age / DROP);
      pos.copy(start).lerp(target, t * t);
      if (r.age >= DROP) {
        r.hit = true;
        r.age = DROP;
        cb.current.onImpact(effect.u, effect.v, effect.point);
      }
    } else {
      pos.copy(target);
      const s = clamp01((r.age - DROP) / (END - DROP));
      scale = 1 + 3.2 * easeOut(s);
      opacity = 1 - clamp01((s - 0.55) / 0.45);
    }
    if (mat.current) mat.current.uniforms.uOpacity.value = opacity;
    if (body.current) {
      body.current.position.copy(pos);
      body.current.scale.setScalar(scale);
    }
    if (bill.current) bill.current.quaternion.copy(camera.quaternion);
    // Streaks of stuff spiralling in along the (tilted) ring plane.
    ax.set(1, 0, 0).applyQuaternion(camera.quaternion);
    ay.set(0, Math.cos(TILT), Math.sin(TILT)).applyQuaternion(
      camera.quaternion
    );
    r.spin += dt * 120;
    while (r.spin >= 1) {
      r.spin -= 1;
      const a = rand(0, Math.PI * 2);
      const rad = rand(0.2, 0.48) * scale;
      const cx = Math.cos(a);
      const sx = Math.sin(a);
      sys.emit({
        x: pos.x + (ax.x * cx + ay.x * sx) * rad,
        y: pos.y + (ax.y * cx + ay.y * sx) * rad,
        z: pos.z + (ax.z * cx + ay.z * sx) * rad,
        vx: (-ax.x * sx + ay.x * cx) * 0.9 - (ax.x * cx + ay.x * sx) * 0.5,
        vy: (-ax.y * sx + ay.y * cx) * 0.9 - (ax.y * cx + ay.y * sx) * 0.5,
        vz: (-ax.z * sx + ay.z * cx) * 0.9 - (ax.z * cx + ay.z * sx) * 0.5,
        life: 0.45,
        size: 0.03 * scale,
        endSize: 0.008,
        color: C0,
        endColor: C1,
        alpha: opacity,
      });
    }
    if (r.age - DROP > END - DROP && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <group ref={body}>
        <mesh renderOrder={5}>
          <sphereGeometry args={[0.1, 24, 16]} />
          <meshBasicMaterial color="#000000" />
        </mesh>
        <group ref={bill}>
          <mesh rotation={[TILT, 0, 0]} renderOrder={6}>
            <ringGeometry args={[0.1, 0.5, 64, 3]} />
            <shaderMaterial
              ref={mat}
              uniforms={uniforms}
              vertexShader={RING_VERTEX}
              fragmentShader={RING_FRAGMENT}
              transparent
              depthWrite={false}
              side={DoubleSide}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
      </group>
    </>
  );
}
