"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  DoubleSide,
  Vector3,
  type Group,
  type Mesh,
  type MeshBasicMaterial,
  type ShaderMaterial,
} from "three";
import {
  clamp01,
  easeOut,
  rand,
  shake,
  stepDt,
  useLatest,
  useParticles,
} from "../effects/particles";
import { planetFx } from "./planetFx";

interface SwallowedProps {
  onDone(): void;
}

const TOTAL = 3;
const HOLE = 0.4;
const TILT = 1.15;
const SIDE = 1.35;

const RING_VERTEX = `
varying vec2 vPos;
void main() {
  vPos = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// r is 1 at the hole's edge.
const RING_FRAGMENT = `
uniform float uTime;
uniform float uOpacity;
varying vec2 vPos;
void main() {
  float r = length(vPos) / ${HOLE.toFixed(2)};
  float a = atan(vPos.y, vPos.x);
  float swirl = sin(a * 3.0 + r * 7.0 - uTime * 7.0) * 0.5 + 0.5;
  float inner = smoothstep(1.02, 1.3, r);
  float outer = 1.0 - smoothstep(1.7, 2.7, r);
  float heat = 1.0 - smoothstep(1.1, 2.6, r);
  vec3 col = mix(vec3(0.55, 0.25, 1.0), vec3(1.0, 0.65, 0.2), heat);
  col = mix(col, vec3(1.0), heat * heat * swirl * 0.6);
  float k = inner * outer * (0.45 + 0.55 * swirl);
  gl_FragColor = vec4(col * k * 1.4, k * uOpacity);
}`;

/**
 * A black hole opens beside the planet, which stretches toward it, spirals
 * in and shrinks away. Then only the hole is left, and it pops.
 */
export default function Swallowed({ onDone }: SwallowedProps) {
  const cb = useLatest({ onDone });
  const camera = useThree((s) => s.camera);
  const run = useRef({ age: 0, done: false, spin: 0 });
  const body = useRef<Group>(null);
  const bill = useRef<Group>(null);
  const core = useRef<Mesh>(null);
  const ring = useRef<ShaderMaterial>(null);
  const sys = useParticles(300);
  const uniforms = useMemo(
    () => ({ uTime: { value: 0 }, uOpacity: { value: 1 } }),
    []
  );
  // The hole sits to the viewer's right; the planet's stretch axis points there.
  const frame = useMemo(() => {
    const q = camera.quaternion.clone();
    const right = new Vector3(1, 0, 0).applyQuaternion(q);
    const up = new Vector3(0, 1, 0).applyQuaternion(q);
    return { q, right, up, hole: right.clone().multiplyScalar(SIDE) };
  }, [camera]);
  const pos = useMemo(() => new Vector3(), []);
  const ax = useMemo(() => new Vector3(), []);
  const ay = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    r.age += dt;
    const age = r.age;

    // The hole: grows over 0.8 s, holds, then pops (grows and fades).
    const grow = easeOut(age / 0.8);
    const pop = clamp01((age - 2.6) / 0.4);
    const scale = grow * (1 + 1.5 * pop);
    const opacity = 1 - pop;
    pos.copy(frame.hole);
    if (body.current) {
      body.current.visible = pop < 1;
      body.current.position.copy(pos);
      body.current.scale.setScalar(Math.max(scale, 0.0001));
    }
    if (bill.current) bill.current.quaternion.copy(camera.quaternion);
    if (ring.current) {
      ring.current.uniforms.uTime.value = age;
      ring.current.uniforms.uOpacity.value = opacity;
    }
    if (core.current) {
      (core.current.material as MeshBasicMaterial).opacity = opacity;
    }

    // The planet: stretch toward the hole, curve in, spin and shrink away.
    const e = clamp01((age - 0.5) / 1.9);
    const ein = e * e;
    planetFx.quat.copy(frame.q);
    planetFx.pos
      .copy(frame.hole)
      .multiplyScalar(ein)
      .addScaledVector(frame.up, Math.sin(ein * Math.PI) * 0.35);
    planetFx.stretch.set(1 + 1.6 * ein, 1 - 0.4 * ein, 1 - 0.4 * ein);
    planetFx.scale = 1 - ein ** 1.5;
    planetFx.spin = age * 4 * (1 + ein * 4);
    planetFx.hidden = e >= 1;
    if (e > 0 && e < 1) shake(0.004 + 0.012 * e, 0.12);

    // Stuff spiralling into the hole along its ring.
    if (grow > 0.1 && pop < 1) {
      ax.set(1, 0, 0).applyQuaternion(camera.quaternion);
      ay.set(0, Math.cos(TILT), Math.sin(TILT)).applyQuaternion(
        camera.quaternion
      );
      r.spin += dt * 140;
      while (r.spin >= 1) {
        r.spin -= 1;
        const a = rand(0, Math.PI * 2);
        const rad = rand(0.5, 1.1) * scale;
        const cx = Math.cos(a);
        const sx = Math.sin(a);
        sys.emit({
          x: pos.x + (ax.x * cx + ay.x * sx) * rad,
          y: pos.y + (ax.y * cx + ay.y * sx) * rad,
          z: pos.z + (ax.z * cx + ay.z * sx) * rad,
          vx: (-ax.x * sx + ay.x * cx) * 1.1 - (ax.x * cx + ay.x * sx) * 0.9,
          vy: (-ax.y * sx + ay.y * cx) * 1.1 - (ax.y * cx + ay.y * sx) * 0.9,
          vz: (-ax.z * sx + ay.z * cx) * 1.1 - (ax.z * cx + ay.z * sx) * 0.9,
          life: 0.5,
          size: 0.035 * Math.max(scale, 0.3),
          endSize: 0.008,
          color: [0.8, 0.6, 1],
          endColor: [1, 0.5, 0.2],
          alpha: opacity,
        });
      }
    }

    if (age >= TOTAL && !r.done) {
      r.done = true;
      planetFx.hidden = true;
      cb.current.onDone();
    }
  }, -1);

  return (
    <>
      <group ref={body}>
        <mesh ref={core} renderOrder={5}>
          <sphereGeometry args={[HOLE, 32, 24]} />
          <meshBasicMaterial color="#000000" transparent />
        </mesh>
        <group ref={bill}>
          <mesh rotation={[TILT, 0, 0]} renderOrder={6}>
            <ringGeometry args={[HOLE, HOLE * 2.75, 64, 3]} />
            <shaderMaterial
              ref={ring}
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
      <primitive object={sys.points} />
    </>
  );
}
