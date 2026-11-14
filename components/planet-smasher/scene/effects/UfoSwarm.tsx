"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  CircleGeometry,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameStore } from "@/lib/planet-smasher/store";
import { dirToUv, uvToDir } from "@/lib/planet-smasher/sphere";
import { pickTargets } from "@/lib/planet-smasher/targets";
import { playCue } from "../../audio/sfx";
import {
  approachDir,
  clamp01,
  easeOut,
  rand,
  stepDt,
  tangentBasisInto,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

export const UFO_COUNT = 12;
const BEAM_SECONDS = 0.9;
const FLIGHT = 0.8;
const ZIP = 0.5;
const HOVER = 1.15;
const SAUCER_SIZE = 0.15;
const SPARKLES = 6;

/**
 * When saucer `i` flies in (arrives), switches its beam on, and finishes the
 * beam and zips off (leaves). The flights start 0.15 s apart; beams run one
 * after another so about three overlap, and the last one ends at 5.3 s.
 */
export function ufoSchedule(i: number): {
  arriveAt: number;
  beamAt: number;
  leaveAt: number;
} {
  const arriveAt = FLIGHT + i * 0.15 - 0.1;
  const beamAt = 1.3 + i * 0.28;
  return { arriveAt, beamAt, leaveAt: beamAt + BEAM_SECONDS };
}

const END = ufoSchedule(UFO_COUNT - 1).leaveAt + ZIP;

const GREEN: readonly [number, number, number] = [0.5, 1, 0.65];
const GREEN_END: readonly [number, number, number] = [0.1, 0.9, 0.5];
const FLASH: readonly [number, number, number] = [0.85, 1, 0.9];

/* ------------------------------------------------------------------ */
/* Geometry and materials                                              */
/* ------------------------------------------------------------------ */

/** Adds per-vertex colour and glow (0 = lit metal, above 1 = bright lamp). */
function paint(
  g: BufferGeometry,
  color: (y: number) => [number, number, number],
  glow: number
): BufferGeometry {
  const pos = g.attributes.position as BufferAttribute;
  const colors: number[] = [];
  const glows: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    colors.push(...color(pos.getY(i)));
    glows.push(glow);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  g.setAttribute("aGlow", new Float32BufferAttribute(glows, 1));
  return g;
}

/** Hull, dome, glowing rim and a lamp underneath, as one geometry. */
function saucerGeometry(): BufferGeometry {
  const hull = new SphereGeometry(0.5, 20, 10).scale(1, 0.26, 1);
  const dome = new SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2)
    .scale(0.5, 0.52, 0.5)
    .translate(0, 0.05, 0);
  const rim = new TorusGeometry(0.46, 0.035, 6, 28)
    .rotateX(Math.PI / 2)
    .translate(0, -0.015, 0);
  const lamp = new CircleGeometry(0.17, 14)
    .rotateX(Math.PI / 2)
    .translate(0, -0.1, 0);
  const merged = mergeGeometries([
    paint(hull, (y) => (y > 0 ? [0.62, 0.7, 0.74] : [0.3, 0.34, 0.4]), 0),
    paint(dome, () => [0.55, 0.95, 0.9], 0.45),
    paint(rim, () => [1, 1, 1], 1.4),
    paint(lamp, () => [1, 1, 1], 1.7),
  ]);
  return merged ?? hull;
}

/** Lit metal whose glow follows the vertex colour times the instance colour. */
function saucerMaterial(): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({
    vertexColors: true,
    metalness: 0.75,
    roughness: 0.32,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float aGlow;\nvarying float vGlow;"
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvGlow = aGlow;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vGlow;")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow;"
      );
  };
  return mat;
}

const BEAM_VERTEX = `
attribute float aAlpha;
varying float vAlpha;
varying vec2 vUv;
void main() {
  vUv = uv;
  vAlpha = aAlpha;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const BEAM_FRAGMENT = `
uniform float uTime;
varying float vAlpha;
varying vec2 vUv;
void main() {
  // vUv.y is 1 at the saucer and 0 at the ground.
  float bands = 0.8 + 0.2 * sin(vUv.y * 26.0 - uTime * 9.0 + vUv.x * 12.566);
  float core = 0.45 + 0.55 * vUv.y;
  float ground = smoothstep(0.0, 0.18, vUv.y) * 0.5 + 0.5;
  vec3 col = mix(vec3(0.15, 0.95, 0.45), vec3(0.6, 1.0, 0.75), vUv.y * vUv.y);
  float a = vAlpha * core * bands * ground;
  gl_FragColor = vec4(col * a * 1.25, a * 0.9);
}`;

/** An open cone: narrow at y = 0 (the saucer), wide at y = -1 (the ground). */
function beamGeometry(): BufferGeometry {
  return new CylinderGeometry(0.05, 0.14, 1, 24, 1, true).translate(0, -0.5, 0);
}

/* ------------------------------------------------------------------ */
/* Per-saucer flight                                                   */
/* ------------------------------------------------------------------ */

interface Saucer {
  dir: Vector3;
  /** Where it parks: 1.15 x the direction, nudged toward screen up. */
  home: Vector3;
  /** Unit vector from the ground spot up to the saucer. */
  lift: Vector3;
  /** The saucer's own up: tipped toward screen up so we see it side-on. */
  axis: Vector3;
  u: number;
  v: number;
  from: Vector3;
  bend: Vector3;
  exit: Vector3;
  phase: number;
  hue: number;
  t: ReturnType<typeof ufoSchedule>;
  start: number;
  sparkAt: number;
  warbled: boolean;
  beamed: boolean;
  hit: boolean;
}

const scratch = new Vector3();
const scratch2 = new Vector3();
const pos = new Vector3();
const t1 = new Vector3();
const t2 = new Vector3();
const lean = new Quaternion();
const qUp = new Quaternion();
const qBeam = new Quaternion();
const Y = new Vector3(0, 1, 0);
const zero = new Vector3(0, 0, 0);
const m = new Matrix4();
const col = new Color();

/** Quadratic curve from `a` through a bend toward `b` at progress `t`. */
function curve(out: Vector3, a: Vector3, bend: Vector3, b: Vector3, t: number) {
  const k = 1 - t;
  return out
    .copy(a)
    .multiplyScalar(k * k)
    .addScaledVector(bend, 2 * k * t)
    .addScaledVector(b, t * t);
}

/**
 * The UFO swarm: twelve saucers fly in on curved paths, each parks over one of
 * the most crowded spots near the tap and beams it for 0.9 s, then zips off.
 * Two draw calls: all the saucers, and all the beams.
 */
export default function UfoSwarm({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const age = useRef(0);
  const done = useRef(false);
  const sys = useSharedParticles(true, 0);

  const saucers = useMemo<Saucer[]>(() => {
    const planet = useGameStore.getState().planet;
    const spots = planet
      ? pickTargets(planet, effect.u, effect.v, 0.35, UFO_COUNT)
      : Array.from({ length: UFO_COUNT }, (_, i) => {
          const a = (i / UFO_COUNT) * Math.PI * 2;
          return {
            u: (effect.u + Math.cos(a) * 0.02 + 1) % 1,
            v: Math.min(1, Math.max(0, effect.v + Math.sin(a) * 0.04)),
          };
        });
    return spots.map((s, i) => {
      const d = uvToDir(s.u, s.v);
      const dir = new Vector3(d.x, d.y, d.z).normalize();
      const sign = i % 2 ? 1 : -1;
      const ahead = approachDir(camera, dir, -1.1 * sign + rand(-0.3, 0.3));
      const behind = approachDir(camera, dir, 1.1 * sign + rand(-0.3, 0.3));
      // Straight above, a beam would be seen end-on, so park a little toward
      // the top of the screen; the beam then leans and reads as a beam.
      const up = scratch
        .setFromMatrixColumn(camera.matrixWorld, 1)
        .addScaledVector(
          dir,
          -dir.dot(scratch.setFromMatrixColumn(camera.matrixWorld, 1))
        )
        .normalize();
      const home = dir
        .clone()
        .multiplyScalar(planetRadius * HOVER)
        .addScaledVector(up, rand(0.1, 0.2));
      const lift = home
        .clone()
        .addScaledVector(dir, -planetRadius * 1.005)
        .normalize();
      const axis = dir
        .clone()
        .multiplyScalar(0.5)
        .addScaledVector(up, 0.85)
        .normalize();
      tangentBasisInto(dir, t1, t2);
      const sched = ufoSchedule(i);
      return {
        dir,
        home,
        lift,
        axis,
        u: s.u,
        v: s.v,
        from: home.clone().addScaledVector(ahead, 4.2),
        bend: home
          .clone()
          .addScaledVector(ahead, 1.4)
          .addScaledVector(t1, rand(-1, 1) * 1.1)
          .addScaledVector(t2, rand(-1, 1) * 1.1),
        exit: home.clone().addScaledVector(behind, 4.2),
        phase: rand(0, Math.PI * 2),
        hue: rand(0.36, 0.5),
        t: sched,
        start: i * 0.15,
        sparkAt: 0,
        warbled: false,
        beamed: false,
        hit: false,
      };
    });
  }, [effect.u, effect.v, planetRadius, camera]);

  const parts = useMemo(() => {
    const body = new InstancedMesh(
      saucerGeometry(),
      saucerMaterial(),
      UFO_COUNT
    );
    body.frustumCulled = false;
    body.renderOrder = 2;
    body.setColorAt(0, col.setRGB(1, 1, 1));
    const beamGeo = beamGeometry();
    const alpha = new InstancedBufferAttribute(new Float32Array(UFO_COUNT), 1);
    beamGeo.setAttribute("aAlpha", alpha);
    const beamMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: BEAM_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    const beams = new InstancedMesh(beamGeo, beamMat, UFO_COUNT);
    beams.frustumCulled = false;
    beams.renderOrder = 3;
    for (let i = 0; i < UFO_COUNT; i++) {
      body.setMatrixAt(i, m.compose(zero, qUp.identity(), zero));
      beams.setMatrixAt(i, m.compose(zero, qUp.identity(), zero));
    }
    return { body, beams, alpha, beamMat };
  }, []);

  useEffect(
    () => () => {
      parts.body.geometry.dispose();
      (parts.body.material as MeshStandardMaterial).dispose();
      parts.body.dispose();
      parts.beams.geometry.dispose();
      parts.beamMat.dispose();
      parts.beams.dispose();
    },
    [parts]
  );

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    age.current += dt;
    const now = age.current;
    parts.beamMat.uniforms.uTime.value = now;
    const alphaArr = parts.alpha.array as Float32Array;

    saucers.forEach((s, i) => {
      const { arriveAt, beamAt, leaveAt } = s.t;
      const home = s.home;
      let size = SAUCER_SIZE;
      let bank = 0;
      let alpha = 0;

      if (now < s.start) {
        size = 0;
        pos.copy(s.from);
      } else if (now < arriveAt) {
        if (!s.warbled) {
          s.warbled = true;
          playCue("ufoWarble");
        }
        const p = clamp01((now - s.start) / (arriveAt - s.start));
        curve(pos, s.from, s.bend, home, easeOut(p));
        bank = (1 - p) * 0.7;
      } else if (now < leaveAt + ZIP) {
        const bob = Math.sin(now * 2.4 + s.phase);
        pos.copy(home).addScaledVector(s.dir, bob * 0.012 * planetRadius);
        tangentBasisInto(s.dir, t1, t2);
        pos
          .addScaledVector(t1, Math.sin(now * 1.7 + s.phase) * 0.012)
          .addScaledVector(t2, Math.cos(now * 1.3 + s.phase) * 0.012);
        bank = Math.sin(now * 1.9 + s.phase) * 0.06;
        if (now >= beamAt && now < leaveAt) {
          if (!s.beamed) {
            s.beamed = true;
            playCue("tractorBeam");
          }
          const p = (now - beamAt) / BEAM_SECONDS;
          alpha = Math.min(1, p * 8) * Math.min(1, (1 - p) * 8);
          // Sparkles drift up the beam while it runs.
          if (now >= s.sparkAt && p < 0.85) {
            s.sparkAt = now + 0.07;
            emitSparkle(s, planetRadius, sys, 0.55);
          }
        }
        if (now >= leaveAt) {
          if (!s.hit) {
            s.hit = true;
            finish(s, planetRadius, sys, cb.current.onImpact);
          }
          const z = clamp01((now - leaveAt) / ZIP);
          pos.copy(home).lerp(s.exit, z * z * z);
          bank = -z * 0.9;
          size = SAUCER_SIZE * (1 - clamp01((z - 0.7) / 0.3));
        }
      } else {
        size = 0;
        pos.copy(s.exit);
      }

      // Saucer: upright on its direction, banking into its flight.
      qUp.setFromUnitVectors(Y, s.axis);
      tangentBasisInto(s.axis, t1, t2);
      lean.setFromAxisAngle(scratch.copy(t1), bank);
      qUp.premultiply(lean);
      parts.body.setMatrixAt(
        i,
        m.compose(pos, qUp, scratch2.set(size, size, size))
      );
      // Pulsing glow, a different colour for each saucer.
      parts.body.setColorAt(
        i,
        col.setHSL(s.hue, 0.85, 0.5 + 0.12 * Math.sin(now * 7 + s.phase))
      );

      // Beam: from under the saucer to the ground, narrower while it flickers.
      alphaArr[i] = alpha;
      if (alpha > 0) {
        const top = scratch.copy(home).addScaledVector(s.axis, -0.015);
        const ground = scratch2
          .copy(s.dir)
          .multiplyScalar(planetRadius * 0.995);
        const len = Math.max(0.02, top.distanceTo(ground));
        const w = 0.8 + 0.15 * Math.sin(now * 14 + s.phase);
        qBeam.setFromUnitVectors(Y, ground.subVectors(top, ground).normalize());
        parts.beams.setMatrixAt(
          i,
          m.compose(top, qBeam, scratch2.set(w, len, w))
        );
      } else {
        parts.beams.setMatrixAt(i, m.compose(zero, qBeam.identity(), zero));
      }
    });

    parts.body.instanceMatrix.needsUpdate = true;
    if (parts.body.instanceColor) parts.body.instanceColor.needsUpdate = true;
    parts.beams.instanceMatrix.needsUpdate = true;
    parts.alpha.needsUpdate = true;

    if (now > END && !done.current) {
      done.current = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <primitive object={parts.body} />
      <primitive object={parts.beams} />
    </>
  );
}

/** One green sparkle rising from the ground to the saucer. */
function emitSparkle(
  s: Saucer,
  radius: number,
  sys: ReturnType<typeof useSharedParticles>,
  chance: number
) {
  if (Math.random() > chance) return;
  tangentBasisInto(s.dir, t1, t2);
  const a = rand(0, Math.PI * 2);
  const r = rand(0.01, 0.045);
  scratch
    .copy(s.dir)
    .multiplyScalar(radius * 1.005)
    .addScaledVector(t1, Math.cos(a) * r)
    .addScaledVector(t2, Math.sin(a) * r);
  const rise = radius * (HOVER - 1) * 2;
  sys.emit({
    x: scratch.x,
    y: scratch.y,
    z: scratch.z,
    vx: s.lift.x * rise,
    vy: s.lift.y * rise,
    vz: s.lift.z * rise,
    life: 0.5,
    size: 0.03,
    endSize: 0.008,
    color: GREEN,
    endColor: GREEN_END,
  });
}

/** The end of a beam: a green flash, sparkles up the beam and the stamp. */
function finish(
  s: Saucer,
  radius: number,
  sys: ReturnType<typeof useSharedParticles>,
  onImpact: EffectProps["onImpact"]
) {
  const p = scratch2.copy(s.dir).multiplyScalar(radius * 1.005);
  sys.emit({
    x: p.x,
    y: p.y,
    z: p.z,
    life: 0.3,
    size: 0.2,
    endSize: 0.08,
    color: FLASH,
    endColor: GREEN_END,
  });
  for (let k = 0; k < SPARKLES; k++) emitSparkle(s, radius, sys, 1);
  const { u, v } = dirToUv(s.dir);
  onImpact(u, v, { x: s.dir.x, y: s.dir.y, z: s.dir.z });
}
