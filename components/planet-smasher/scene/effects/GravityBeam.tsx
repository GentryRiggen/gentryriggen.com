"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  Vector3,
  type Mesh,
} from "three";
import {
  FlashSprite,
  SurfaceRing,
  clamp01,
  debris,
  easeOut,
  lumpyRock,
  rand,
  shake,
  stepDt,
  tangentBasisInto,
  toVec,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const END = 3.5;
const DROP = 0.5;
const IMPACT_AT = 0.6;
const CHUNKS_AT = 0.7;
const CHUNK_COUNT = 8;
const COLUMN_FADE_FROM = 2.3;
const COLUMN_FADE_TO = 3.1;
const HEIGHT = 2.2;

const VIOLET: readonly [number, number, number] = [0.75, 0.55, 1];
const WHITE: readonly [number, number, number] = [1, 0.95, 1];
const EMBER: readonly [number, number, number] = [1, 0.55, 0.15];
const EMBER_END: readonly [number, number, number] = [0.5, 0.1, 0.02];

const COLUMN_VERTEX = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
// vUv.y is 1 at the top of the column and 0 at the ground.
const COLUMN_FRAGMENT = `
uniform float uTime;
uniform float uAlpha;
varying vec2 vUv;
void main() {
  float a = vUv.x * 6.2831853;
  float swirl = sin(a * 3.0 + vUv.y * 18.0 - uTime * 9.0) * 0.5 + 0.5;
  float rush = sin(vUv.y * 40.0 + uTime * 22.0) * 0.5 + 0.5;
  float ground = 1.0 - smoothstep(0.0, 0.6, vUv.y) * 0.35;
  float base = smoothstep(0.0, 0.05, vUv.y) * (1.0 - smoothstep(0.6, 1.0, vUv.y));
  float k = (0.3 + 0.4 * swirl + 0.2 * rush) * ground * base;
  vec3 col = mix(vec3(0.55, 0.25, 1.0), vec3(1.0), swirl * 0.7 + 0.15);
  gl_FragColor = vec4(col * k * 1.1, k * uAlpha);
}`;

/** Open column, wide at the top (y = 0) and narrow at the ground (y = -1). */
function columnGeometry(): BufferGeometry {
  return new CylinderGeometry(0.2, 0.1, 1, 28, 1, true).translate(0, -0.5, 0);
}

/** Chunky rock with brown-grey faces (a different tint per face). */
function rockGeometry(): BufferGeometry {
  const g = lumpyRock(0.5, 7);
  const pos = g.attributes.position as BufferAttribute;
  const colors: number[] = [];
  for (let f = 0; f < pos.count / 3; f++) {
    const h = Math.sin(f * 12.9898 + 4.1) * 43758.5453;
    const k = h - Math.floor(h);
    const grey = 0.16 + k * 0.18;
    for (let v = 0; v < 3; v++) {
      colors.push(grey * 1.15, grey * 0.95, grey * 0.8);
    }
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g;
}

/** Rock whose underside (facing the crater) glows orange, then cools. */
function rockMaterial(
  up: Vector3,
  heat: { value: number }
): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uUp = { value: up };
    shader.uniforms.uHeat = heat;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWN;")
      .replace(
        "#include <beginnormal_vertex>",
        `#include <beginnormal_vertex>
        vWN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vWN;\nuniform vec3 uUp;\nuniform float uHeat;"
      )
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
        float under = smoothstep(-0.3, 0.7, dot(normalize(vWN), -uUp));
        totalEmissiveRadiance += vec3(1.0, 0.36, 0.06) * under * uHeat;`
      );
  };
  return mat;
}

interface Chunk {
  lateral: Vector3;
  drift: Vector3;
  axis: Vector3;
  spin: number;
  tilt: number;
  size: number;
  height: number;
  rise: number;
}

const scratch = new Vector3();
const scratch2 = new Vector3();
const t1 = new Vector3();
const t2 = new Vector3();
const q = new Quaternion();
const Y = new Vector3(0, 1, 0);
const m = new Matrix4();
const zero = new Vector3();

/**
 * The Gravity beam: a purple-white column with a swirling helix comes down,
 * hits at 0.6 s, and eight glowing rocks are pulled up out of the crater to
 * drift away. Three draw calls plus the ring and flash.
 */
export default function GravityBeam({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const run = useRef({
    age: 0,
    hit: false,
    done: false,
    chunksOn: false,
    cooled: 0,
  });
  const sys = useSharedParticles(true, 0);
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const camera = useThree((st) => st.camera);
  // Straight out of the planet the column is seen end-on, so it leans toward
  // the top of the screen and the rocks rise along the lean.
  const lean = useMemo(() => {
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    up.addScaledVector(n, -up.dot(n)).normalize();
    return n.clone().addScaledVector(up, 0.6).normalize();
  }, [camera, n]);

  const ring = useMemo(() => new SurfaceRing(0xc8a0ff), []);
  const flash = useMemo(() => new FlashSprite(0xe8d8ff), []);
  useDispose(ring, flash);

  const column = useMemo(() => {
    const geo = columnGeometry();
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uAlpha: { value: 0 } },
      vertexShader: COLUMN_VERTEX,
      fragmentShader: COLUMN_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    return { geo, mat };
  }, []);
  const colMesh = useRef<Mesh>(null);
  const rockMesh = useRef<InstancedMesh>(null);

  const chunks = useMemo<Chunk[]>(() => {
    tangentBasisInto(lean, t1, t2);
    return Array.from({ length: CHUNK_COUNT }, (_, i) => {
      const a = (i / CHUNK_COUNT) * Math.PI * 2 + rand(-0.3, 0.3);
      const r = rand(0.01, 0.05);
      const lateral = t1
        .clone()
        .multiplyScalar(Math.cos(a) * r)
        .addScaledVector(t2, Math.sin(a) * r);
      return {
        lateral,
        drift: t1
          .clone()
          .multiplyScalar(Math.cos(a) * rand(0.03, 0.09))
          .addScaledVector(t2, Math.sin(a) * rand(0.03, 0.09)),
        axis: new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
        spin: rand(1.2, 3.2) * (rand() < 0.5 ? -1 : 1),
        tilt: rand(0, Math.PI * 2),
        size: rand(0.06, 0.11),
        height: planetRadius * rand(1.6, 2.2),
        rise: rand(1.3, 1.9),
      };
    });
  }, [lean, planetRadius]);

  const rocks = useMemo(() => {
    const heat = { value: 2.2 };
    const mesh = new InstancedMesh(
      rockGeometry(),
      rockMaterial(lean, heat),
      CHUNK_COUNT
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.visible = false;
    for (let i = 0; i < CHUNK_COUNT; i++) {
      mesh.setMatrixAt(i, m.compose(zero, q.identity(), zero));
    }
    mesh.userData.heat = heat;
    return { mesh };
  }, [lean]);

  useEffect(
    () => () => {
      column.geo.dispose();
      column.mat.dispose();
      rocks.mesh.geometry.dispose();
      (rocks.mesh.material as MeshStandardMaterial).dispose();
      rocks.mesh.dispose();
    },
    [column, rocks]
  );

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    const age = r.age;
    const R = planetRadius;

    // The column: grows down from 2.2 x radius, holds, then fades.
    const grow = easeOut(age / DROP);
    const fadeIn = clamp01(age / 0.25);
    const fadeOut =
      1 -
      clamp01((age - COLUMN_FADE_FROM) / (COLUMN_FADE_TO - COLUMN_FADE_FROM));
    const mesh = colMesh.current;
    if (mesh) {
      const u = (mesh.material as ShaderMaterial).uniforms;
      u.uTime.value = age;
      u.uAlpha.value = fadeIn * fadeOut * (age > IMPACT_AT ? 1 : 0.8);
      const len = Math.max(0.001, R * (HEIGHT - 1) * grow);
      mesh.visible = fadeOut > 0.001;
      // The top stays put; the bottom comes down to the surface.
      mesh.position
        .copy(n)
        .multiplyScalar(R * 0.995)
        .addScaledVector(lean, R * (HEIGHT - 1));
      mesh.quaternion.setFromUnitVectors(Y, lean);
      mesh.scale.set(1, len, 1);
    }

    // A helix of sparks spirals down the column.
    if (age < COLUMN_FADE_FROM) {
      tangentBasisInto(lean, t1, t2);
      for (let k = 0; k < 3; k++) {
        const h = rand();
        const th = h * 16 - age * 9 + k * 2.1;
        const radius = (0.1 + 0.1 * h) * (0.85 + 0.3 * rand());
        const along = R * (HEIGHT - 1) * h;
        if (h < 1 - grow) continue;
        scratch
          .copy(n)
          .multiplyScalar(R * 0.995)
          .addScaledVector(lean, along)
          .addScaledVector(t1, Math.cos(th) * radius)
          .addScaledVector(t2, Math.sin(th) * radius);
        sys.emit({
          x: scratch.x,
          y: scratch.y,
          z: scratch.z,
          vx: -lean.x * 0.9,
          vy: -lean.y * 0.9,
          vz: -lean.z * 0.9,
          life: 0.3,
          size: 0.035,
          endSize: 0.01,
          color: k === 0 ? WHITE : VIOLET,
          endColor: VIOLET,
          alpha: 0.9,
        });
      }
    }

    if (!r.hit && age >= IMPACT_AT) {
      r.hit = true;
      scratch.copy(n).multiplyScalar(R * 1.005);
      debris(sys, scratch, n, 26, 0.9, 0.04);
      shake(0.015, 0.5);
      cb.current.onImpact(effect.u, effect.v, effect.point);
    }
    if (r.hit) {
      const p = clamp01((age - IMPACT_AT) / 0.7);
      ring.set(n, p * 0.04, p * 0.04 + 0.03 + p * 0.12, (1 - p) * 0.9);
      scratch.copy(n).multiplyScalar(R * 1.02);
      flash.set(
        scratch,
        0.5 + p * 0.5,
        (1 - clamp01((age - IMPACT_AT) / 0.35)) * 0.9
      );
    }

    // The rocks are pulled up out of the crater, then drift away and shrink.
    const rockObj = rockMesh.current;
    if (rockObj && age >= CHUNKS_AT) {
      r.chunksOn = true;
      const t = age - CHUNKS_AT;
      const life = END - CHUNKS_AT;
      rockObj.visible = true;
      (rockObj.userData.heat as { value: number }).value =
        2.2 * (1 - clamp01(t / life) * 0.85);
      chunks.forEach((c, i) => {
        const p = easeOut(t / c.rise);
        const extra = Math.max(0, t - c.rise) * 0.06;
        scratch
          .copy(n)
          .multiplyScalar(R)
          .addScaledVector(lean, (c.height - R) * p + extra)
          .addScaledVector(c.lateral, 1 + t * 1.2)
          .addScaledVector(c.drift, Math.max(0, t - c.rise * 0.5));
        const pop = clamp01(t / 0.15);
        const fade = 1 - clamp01((age - (END - 0.7)) / 0.7);
        const s = c.size * pop * fade;
        q.setFromAxisAngle(c.axis, c.tilt + c.spin * t);
        rockObj.setMatrixAt(i, m.compose(scratch, q, scratch2.set(s, s, s)));
        if (s > 0 && rand() < 0.18) {
          sys.emit({
            x: scratch.x,
            y: scratch.y,
            z: scratch.z,
            vx: rand(-0.05, 0.05),
            vy: rand(-0.05, 0.05),
            vz: rand(-0.05, 0.05),
            life: 0.4,
            size: 0.03,
            endSize: 0.005,
            color: EMBER,
            endColor: EMBER_END,
            alpha: 0.8,
          });
        }
      });
      rockObj.instanceMatrix.needsUpdate = true;
    }

    if (age > END && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <mesh
        ref={colMesh}
        geometry={column.geo}
        material={column.mat}
        renderOrder={3}
        frustumCulled={false}
      />
      <primitive ref={rockMesh} object={rocks.mesh} />
      <primitive object={ring.mesh} />
      <primitive object={flash.sprite} />
    </>
  );
}
