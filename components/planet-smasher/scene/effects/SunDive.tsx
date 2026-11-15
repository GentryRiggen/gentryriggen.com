"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  CanvasTexture,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Mesh,
} from "three";
import {
  clamp01,
  easeOut,
  lerp,
  rand,
  shake,
  stepDt,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";
import { SUN_RADIUS, resetSunState, sunState } from "./sunState";

/** Seconds the Sun takes to slide in; the planet falls in right after. */
export const SUN_ARRIVE = 2.5;
/** The Vaporized ending's length: the Sun stays for it, then slides out. */
const ENDING = 3;
const LEAVE_AT = SUN_ARRIVE + 2.2;
const END = SUN_ARRIVE + ENDING + 0.2;

/** Sideways distance of the Sun's centre from the planet, far then near. */
const FAR = 9;
const NEAR = 3.9;
/** How far behind the planet (away from the viewer) the Sun sits. */
const BEHIND = 1.2;
/** How much closer the Sun creeps while the planet falls in. */
const CREEP = 0.9;

const VERTEX = `
varying vec3 vObj;
varying vec3 vNormalView;
void main() {
  vObj = position;
  vNormalView = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// A boiling surface: layered noise, hotter and whiter toward the middle of
// the disc, darker orange at the rim, with a quick flicker.
const FRAGMENT = `
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormalView;
float h(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float n(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(h(i), h(i + vec3(1, 0, 0)), f.x), mix(h(i + vec3(0, 1, 0)), h(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(h(i + vec3(0, 0, 1)), h(i + vec3(1, 0, 1)), f.x), mix(h(i + vec3(0, 1, 1)), h(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
void main() {
  vec3 p = vObj * 1.3;
  float a = n(p * 2.0 + vec3(0.0, uTime * 0.25, 0.0));
  float b = n(p * 4.5 - vec3(uTime * 0.4, 0.0, 0.0));
  float c = n(p * 9.0 + vec3(0.0, 0.0, uTime * 0.9));
  float g = a * 0.5 + b * 0.3 + c * 0.2;
  float face = clamp(abs(vNormalView.z), 0.0, 1.0);
  vec3 col = mix(vec3(0.95, 0.22, 0.02), vec3(1.0, 0.78, 0.2), smoothstep(0.25, 0.8, g));
  col = mix(col, vec3(1.0, 0.97, 0.78), pow(face, 3.0) * 0.55);
  col *= 0.55 + 0.6 * face;
  col += vec3(0.25, 0.12, 0.0) * sin(uTime * 7.0 + g * 12.0) * 0.3;
  gl_FragColor = vec4(col * 1.25, 1.0);
}`;

function coronaTexture(): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,200,90,1)");
    g.addColorStop(0.45, "rgba(255,130,30,0.45)");
    g.addColorStop(1, "rgba(255,80,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new CanvasTexture(c);
}

/** Sets the shader clock (kept out of the component body for the linter). */
function setSunTime(u: { value: number }, t: number) {
  u.value = t;
}

const smooth = (t: number) => clamp01(t) * clamp01(t) * (3 - 2 * clamp01(t));

/**
 * A huge Sun slides in from the right while the light turns warm. Then the
 * planet falls into it (the Vaporized ending): the Sun stays, creeps closer,
 * and slides back out.
 */
export default function SunDive({ onImpact, onDone, effect }: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const sun = useRef<Mesh>(null);
  const run = useRef({
    age: 0,
    ready: false,
    hit: false,
    done: false,
    flare: 0,
  });
  const time = useMemo(() => ({ value: 0 }), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: time },
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
      }),
    [time]
  );
  const corona = useMemo(() => {
    const map = coronaTexture();
    const mat = new SpriteMaterial({
      map,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      opacity: 0.9,
    });
    return { sprite: new Sprite(mat), map, mat };
  }, []);
  const coronaDispose = useMemo(
    () => ({
      dispose() {
        corona.map.dispose();
        corona.mat.dispose();
      },
    }),
    [corona]
  );
  useDispose(material, coronaDispose);
  const sys = useSharedParticles(true, 0);
  const right = useMemo(() => new Vector3(), []);
  const back = useMemo(() => new Vector3(), []);
  const pos = useMemo(() => new Vector3(), []);
  const out = useMemo(() => new Vector3(), []);

  useEffect(() => {
    sunState.active = true;
    return resetSunState;
  }, []);

  useFrame((state, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    if (!r.ready) {
      r.ready = true;
      const cam = state.camera;
      right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
      back.copy(cam.position).normalize().negate();
    }
    r.age += dt;
    const age = r.age;

    let dist: number;
    if (age < SUN_ARRIVE) {
      dist = lerp(FAR, NEAR, easeOut(age / SUN_ARRIVE));
    } else {
      const since = age - SUN_ARRIVE;
      dist = NEAR - CREEP * smooth(since / ENDING);
      if (age > LEAVE_AT)
        dist += 7 * smooth((age - LEAVE_AT) / (END - LEAVE_AT));
    }
    pos.copy(right).multiplyScalar(dist).addScaledVector(back, BEHIND);
    sunState.pos.copy(pos);
    // Warm light follows the Sun in, and fades as it leaves.
    sunState.warm =
      smooth(age / SUN_ARRIVE) *
      (1 - smooth((age - LEAVE_AT) / (END - LEAVE_AT)));

    setSunTime(time, age);
    const m = sun.current;
    if (m) {
      m.position.copy(pos);
      m.rotation.y += dt * 0.15;
    }
    const pulse = 1 + 0.03 * Math.sin(age * 5) + 0.02 * Math.sin(age * 11.3);
    corona.sprite.position.copy(pos);
    corona.sprite.scale.setScalar(SUN_RADIUS * 2 * 1.9 * pulse);

    // Flares lick off the side that faces the planet.
    r.flare += dt * 40;
    while (r.flare >= 1) {
      r.flare -= 1;
      out.set(-rand(0.05, 1), rand(-1, 1), rand(-1, 1)).normalize();
      out.applyQuaternion(state.camera.quaternion);
      sys.emit({
        x: pos.x + out.x * SUN_RADIUS,
        y: pos.y + out.y * SUN_RADIUS,
        z: pos.z + out.z * SUN_RADIUS,
        vx: out.x * rand(0.4, 1),
        vy: out.y * rand(0.4, 1),
        vz: out.z * rand(0.4, 1),
        life: rand(0.5, 1.1),
        size: rand(0.05, 0.12),
        endSize: 0.01,
        color: [1, rand(0.55, 0.8), 0.2],
        endColor: [0.9, 0.2, 0.02],
        alpha: 0.7,
        drag: 0.6,
      });
    }

    if (age < SUN_ARRIVE) shake(0.004 + 0.01 * (age / SUN_ARRIVE), 0.15);
    if (age >= SUN_ARRIVE && !r.hit) {
      r.hit = true;
      shake(0.03, 0.8);
      cb.current.onImpact(effect.u, effect.v, effect.point);
    }
    if (age >= END && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <mesh ref={sun} material={material}>
        <sphereGeometry args={[SUN_RADIUS, 64, 48]} />
      </mesh>
      <primitive object={corona.sprite} />
    </>
  );
}
