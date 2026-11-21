"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { titanic } from "@/lib/shipwreck/ships/titanic";
import { buildHull, hullHalfBreadth } from "@/lib/shipwreck/sim/geometry";
import { sampleTrack, type SimTrack } from "@/lib/shipwreck/sim/track";
import { shipToThree } from "./cameraMath";
import type { SceneRuntime } from "./runtime";

/**
 * The night's events, all worked out from the shown time `t` (so seeking
 * shows the right moment): lifeboats swung out, lowered down the falls over
 * two minutes and rowed away to a ring 200–800 m out, each with a lantern;
 * steam roaring from funnels 1–3 between `steam-start` and `steam-stop`
 * (thin smoke otherwise, while the fires burn); distress rockets rising
 * about 200 m and bursting into falling white stars (the flash lights the
 * scene); each funnel toppling on `funnel-falls`; sparks at the break; the
 * sea boiling white where each part goes under. One draw call of points.
 */

const POOL = 3000;
const G = 9.81;
/** Seconds of sim time to swing a boat out, then to lower it. */
const SWING_S = 20;
const LOWER_S = 120;
/** Rowing speed (m/s) and how far out the boats go. */
const ROW_MPS = 0.7;

function hash(a: number, b = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const vertex = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 1.5, 96.0);
  }
`;
const fragment = /* glsl */ `
  varying vec3 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = dot(p, p) * 4.0;
    if (r > 1.0) discard;
    gl_FragColor = vec4(vColor * (1.0 - r) * (1.0 - r), 1.0);
  }
`;

interface EffectsProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
}

export default function Effects({ store, runtime }: EffectsProps) {
  const pts = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(POOL * 3), 3);
    const col = new BufferAttribute(new Float32Array(POOL * 3), 3);
    const size = new BufferAttribute(new Float32Array(POOL), 1);
    g.setAttribute("position", pos);
    g.setAttribute("aColor", col);
    g.setAttribute("aSize", size);
    g.setDrawRange(0, 0);
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uScale: { value: 600 } },
    });
    const points = new Points(g, mat);
    points.frustumCulled = false;
    points.renderOrder = 30;
    points.name = "effects";
    return { g, pos, col, size, mat, points };
  }, []);
  useEffect(
    () => () => {
      pts.g.dispose();
      pts.mat.dispose();
    },
    [pts]
  );

  const hull = useMemo(() => buildHull(titanic), []);
  // Per track: where each boat touched the water (sampled once).
  const launch = useRef<{ track: SimTrack | null; at: Map<number, Vector3> }>({
    track: null,
    at: new Map(),
  });
  const tmp = useMemo(
    () => ({
      m: new Matrix4(),
      q: new Quaternion(),
      v: new Vector3(),
      up: new Vector3(0, 1, 0),
      one: new Vector3(1, 1, 1),
    }),
    []
  );

  useFrame((state) => {
    const s = store.getState();
    const track = s.track;
    const frame = runtime.frame;
    let n = 0;
    const P = pts.pos.array as Float32Array;
    const C = pts.col.array as Float32Array;
    const S = pts.size.array as Float32Array;
    const emit = (
      x: number,
      y: number,
      z: number,
      r: number,
      g: number,
      b: number,
      size: number
    ) => {
      if (n >= POOL) return;
      P[n * 3] = x;
      P[n * 3 + 1] = y;
      P[n * 3 + 2] = z;
      C[n * 3] = r;
      C[n * 3 + 1] = g;
      C[n * 3 + 2] = b;
      S[n] = size;
      n += 1;
    };
    pts.mat.uniforms.uScale.value =
      (state.size.height * state.viewport.dpr) /
      (2 *
        Math.tan(
          ((state.camera as { fov?: number }).fov ?? 42) * (Math.PI / 360)
        ));

    runtime.flash = 0;
    if (!track || !frame) {
      pts.g.setDrawRange(0, 0);
      return;
    }
    const t = s.t;
    const wall = state.clock.elapsedTime;
    if (launch.current.track !== track) {
      launch.current = { track, at: new Map() };
    }
    const events = track.events;
    const main =
      frame.bodies.find((b) => b.part === "stern") ?? frame.bodies[0];
    const models: TitanicHandles[] = [];
    if (runtime.whole) models.push(runtime.whole);
    if (runtime.split) models.push(runtime.split);
    const visible = runtime.broken ? runtime.split : runtime.whole;

    // --- Funnels topple (each model, so both agree at the break).
    const fell = new Map<number, number>();
    for (const e of events)
      if (
        e.kind === "funnel-falls" &&
        e.index !== undefined &&
        !fell.has(e.index)
      )
        fell.set(e.index, e.t);
    for (const mdl of models) {
      mdl.funnels.forEach((f, i) => {
        if (!f) return;
        const tf = fell.get(i);
        const u =
          tf === undefined ? 0 : Math.min(1, (Math.max(0, t - tf) / 4.5) ** 2);
        const side = i === 0 ? 1.25 : i % 2 === 1 ? 0.95 : 1.05;
        const fore = i === 0 ? -0.55 : 0.2;
        f.rotation.set(u * side, 0, u * fore);
        const guys = mdl.funnelGuys[i];
        if (guys) guys.visible = tf === undefined || t < tf;
      });
    }

    // --- Lifeboats.
    const lowered = new Map<number, number>();
    for (const e of events)
      if (e.kind === "boat-lowered" && e.index !== undefined)
        lowered.set(e.index, e.t);
    for (const mdl of models) {
      for (let i = 0; i < mdl.boats.count; i += 1) {
        const tb = lowered.get(i);
        if (tb === undefined || t < tb) {
          mdl.boats.stow(i);
          continue;
        }
        const age = t - tb;
        const info = mdl.boats.info(i);
        if (age < SWING_S + LOWER_S) {
          const swing = Math.min(1, age / SWING_S);
          const u = Math.max(0, (age - SWING_S) / LOWER_S);
          // Height of the boat over the sea now, from the part's pose.
          const holder = mdl.boats.holderOf(i);
          holder.updateMatrixWorld();
          tmp.v.set(info.x, info.z, -info.y);
          holder.localToWorld(tmp.v);
          const drop = Math.max(0, tmp.v.y + 0.35) * u;
          mdl.boats.lower(i, drop, swing);
          continue;
        }
        // Afloat: where it touched the water, then rowing away.
        let start = launch.current.at.get(i);
        if (!start) {
          const at = sampleTrack(track, tb + SWING_S + LOWER_S).bodies[0];
          const side = info.side === "port" ? 1 : -1;
          const w = shipToThree(at, [
            info.x,
            side * (Math.abs(info.edgeY) + 2.5),
            0,
          ]);
          start = new Vector3(w[0], -0.35, w[2]);
          launch.current.at.set(i, start);
        }
        const side = info.side === "port" ? -1 : 1; // three z: port is -z
        const fan = (hash(i, 3) - 0.5) * 1.6;
        const dir = tmp.v
          .set(Math.sin(fan) * 0.8 - 0.2, 0, side * Math.cos(fan))
          .normalize();
        const far = 200 + hash(i, 7) * 600;
        const d = Math.min(far, (age - SWING_S - LOWER_S) * ROW_MPS);
        const bob = Math.sin(wall * 0.9 + i) * 0.05;
        const px = start.x + dir.x * d;
        const pz = start.z + dir.z * d;
        tmp.q.setFromAxisAngle(tmp.up, Math.atan2(-dir.z, dir.x));
        tmp.m.compose(tmp.v.set(px, -0.35 + bob, pz), tmp.q, tmp.one);
        mdl.boats.float(i, tmp.m);
        if (mdl === visible) {
          // A lantern on each boat.
          const flick = 0.85 + 0.15 * Math.sin(wall * 7 + i * 3);
          emit(px, 1.4 + bob, pz, 6 * flick, 4.2 * flick, 1.8 * flick, 1.6);
        }
      }
    }
    // Lanterns of boats still on the falls.
    if (visible) {
      for (let i = 0; i < visible.boats.count; i += 1) {
        const tb = lowered.get(i);
        if (tb === undefined || t < tb || t - tb >= SWING_S + LOWER_S) continue;
        const info = visible.boats.info(i);
        const holder = visible.boats.holderOf(i);
        const u = Math.max(0, (t - tb - SWING_S) / LOWER_S);
        holder.updateMatrixWorld();
        const sideY = info.side === "port" ? 1 : -1;
        tmp.v.set(
          info.x,
          info.z + 1.4,
          -(sideY * (Math.abs(info.edgeY) + 1.5))
        );
        holder.localToWorld(tmp.v);
        emit(
          tmp.v.x,
          tmp.v.y - (tmp.v.y + 0.35) * u,
          tmp.v.z,
          5,
          3.5,
          1.5,
          1.6
        );
      }
    }

    // --- Steam and smoke from the funnels (wall-clock, continuous).
    const steamStart =
      events.find((e) => e.kind === "steam-start")?.t ?? Infinity;
    const steamStop =
      events.find((e) => e.kind === "steam-stop")?.t ?? -Infinity;
    const steaming = t >= steamStart && t < steamStop;
    const firesLit = track.brokeAtT === null || t < track.brokeAtT;
    if (visible && firesLit) {
      for (let i = 0; i < 3; i += 1) {
        const f = visible.funnels[i];
        if (!f || (fell.has(i) && t >= (fell.get(i) ?? 0))) continue;
        f.updateMatrixWorld();
        const top = tmp.v.set(-1.8, 24.2, 0);
        f.localToWorld(top);
        // Outside the venting only a faint haze of coal smoke rises.
        const count = steaming ? 140 : 8;
        const life = steaming ? 3.2 : 6;
        const rise = steaming ? 14 : 2;
        for (let k = 0; k < count; k += 1) {
          const a = (((wall / life + hash(k, i)) % 1) + 1) % 1;
          const age = a * life;
          const spread = (steaming ? 1.2 : 0.6) + age * (steaming ? 1.6 : 0.7);
          const ang = hash(k, i + 9) * Math.PI * 2;
          const rr = Math.sqrt(hash(k, i + 17)) * spread;
          const x = top.x + Math.cos(ang) * rr - age * (steaming ? 1.5 : 1.2);
          const y = top.y + age * rise * (1 - a * 0.35);
          const z = top.z + Math.sin(ang) * rr;
          const fade = (1 - a) * Math.min(1, a * 8);
          const b = steaming ? 0.16 * fade : 0.008 * fade;
          emit(
            x,
            y,
            z,
            b,
            b * 1.02,
            b * 1.08,
            steaming ? 3.5 + age * 1.6 : 2 + age * 0.8
          );
        }
      }
    }

    // --- Rockets: rise ~200 m in 4 s, burst, stars fall for 7 s.
    for (const e of events) {
      if (e.kind !== "rocket") continue;
      const age = t - e.t;
      if (age < 0 || age > 12) continue;
      const pose = frame.bodies[0];
      const o = shipToThree(pose, [70, -14, 31]);
      const riseT = 4;
      const h = (u: number) => 200 * (1 - (1 - u) * (1 - u));
      if (age < riseT) {
        for (let k = 0; k < 30; k += 1) {
          const u = Math.max(0, age - k * 0.04) / riseT;
          const fade = 1 - k / 30;
          emit(o[0], o[1] + h(u), o[2], 5 * fade, 4 * fade, 3 * fade, 1.2);
        }
        continue;
      }
      const ba = age - riseT;
      const top = o[1] + 200;
      const flash = Math.exp(-ba * 2.2);
      runtime.flash = Math.max(runtime.flash, flash);
      for (let k = 0; k < 70; k += 1) {
        const th = hash(k, e.index ?? 0) * Math.PI * 2;
        const ph = Math.acos(hash(k + 50, e.index ?? 0) * 2 - 1);
        const sp = 18 + hash(k + 99, 1) * 14;
        const vx = Math.sin(ph) * Math.cos(th) * sp;
        const vy = Math.cos(ph) * sp;
        const vz = Math.sin(ph) * Math.sin(th) * sp;
        const drag = 1 - Math.exp(-ba * 1.2);
        const x = o[0] + (vx / 1.2) * drag;
        const y = top + (vy / 1.2) * drag - 0.5 * G * 0.35 * ba * ba;
        const z = o[2] + (vz / 1.2) * drag;
        const life = Math.max(0, 1 - ba / 7);
        const tw = 0.7 + 0.3 * Math.sin(wall * 20 + k);
        emit(x, y, z, 7 * life * tw, 7 * life * tw, 6.5 * life * tw, 2.4);
      }
    }

    // --- Sparks at the break.
    const brokeAt = track.brokeAtT;
    if (
      brokeAt !== null &&
      track.breakX !== null &&
      t >= brokeAt &&
      t < brokeAt + 8
    ) {
      const ba = t - brokeAt;
      const stern = frame.bodies.find((b) => b.part === "stern") ?? main;
      const o = shipToThree(stern, [track.breakX, 0, 17]);
      for (let k = 0; k < 220; k += 1) {
        const start = hash(k, 5) * 5;
        const age = ba - start;
        if (age < 0 || age > 2.5) continue;
        const th = hash(k, 6) * Math.PI * 2;
        const sp = 6 + hash(k, 8) * 14;
        const x = o[0] + Math.cos(th) * sp * age * 0.6;
        const y = o[1] + (sp * 0.8 + 4) * age - 0.5 * G * age * age;
        const z = o[2] + Math.sin(th) * sp * age;
        const life = 1 - age / 2.5;
        emit(x, y, z, 9 * life, 4 * life, 1 * life, 0.9);
      }
    }

    // --- White water where each part goes under, and the boil after.
    for (const e of events) {
      if (e.kind !== "bow-under" && e.kind !== "stern-under") continue;
      const age = t - e.t;
      if (age < 0 || age > 40) continue;
      const at = sampleTrack(track, e.t);
      const body =
        at.bodies.find(
          (b) => b.part === (e.kind === "bow-under" ? "bow" : "stern")
        ) ?? at.bodies[0];
      const x0 = e.kind === "bow-under" ? 60 : -100;
      const c = shipToThree(body, [x0, 0, 10]);
      const fade = Math.min(1, age * 2) * (1 - age / 40);
      for (let k = 0; k < 160; k += 1) {
        const th = hash(k, 21) * Math.PI * 2;
        const r = Math.sqrt(hash(k, 22)) * (8 + age * 1.6);
        const pulse = 0.6 + 0.4 * Math.sin(wall * 3 + k);
        const b = 0.5 * fade * pulse;
        emit(
          c[0] + Math.cos(th) * r,
          0.2,
          c[2] + Math.sin(th) * r,
          b,
          b,
          b * 1.05,
          2.4
        );
      }
    }

    // --- A faint wash of foam where the hull meets the sea.
    const power = frame.power;
    // (Not in X-ray, where it would show through the ghost hull.)
    for (const body of s.xray ? [] : frame.bodies) {
      const lo =
        body.part === "bow" && track.breakX !== null ? track.breakX : -136;
      const hi =
        body.part === "stern" && track.breakX !== null ? track.breakX : 128;
      const sp = Math.sin(body.pitch);
      const cp = Math.cos(body.pitch);
      const sr = Math.sin(body.roll);
      const cr = Math.cos(body.roll);
      if (Math.abs(cp * cr) < 0.3) continue;
      for (let k = 0; k <= 48; k += 1) {
        const x = lo + ((hi - lo) * k) / 48;
        for (const side of [1, -1]) {
          // Solve earthZ(x, y(z), z) = 0 for the ship-frame z (two passes).
          let y = 0;
          let z = 0;
          for (let it = 0; it < 2; it += 1) {
            z = (-body.z + sp * x - cp * sr * y) / (cp * cr);
            y = side * hullHalfBreadth(hull, x, z);
          }
          if (z <= 0.3 || z >= titanic.sheerZ(x) || y === 0) continue;
          const w = shipToThree(body, [x, y * 1.04, z]);
          const fl = 0.7 + 0.3 * Math.sin(wall * 2.3 + k * 1.7 + side);
          const b = (0.035 + 0.08 * power) * fl;
          emit(w[0], 0.05, w[2], b, b * 1.05, b * 1.1, 1.3);
        }
      }
    }

    // --- Marine snow drifting past the camera under water.
    const cam = state.camera.position;
    if (cam.y < -2) {
      const box = 70;
      for (let k = 0; k < 500; k += 1) {
        const wrap = (v: number) => (((v % box) + box) % box) - box / 2;
        const x = cam.x + wrap(hash(k, 31) * box - cam.x + wall * 0.3);
        const y = cam.y + wrap(hash(k, 32) * box - cam.y - wall * 0.6);
        const z = cam.z + wrap(hash(k, 33) * box - cam.z);
        const b = 0.05 + hash(k, 34) * 0.05;
        emit(x, Math.min(-0.5, y), z, b, b * 1.1, b * 1.2, 0.25);
      }
    }

    pts.pos.needsUpdate = true;
    pts.col.needsUpdate = true;
    pts.size.needsUpdate = true;
    pts.g.setDrawRange(0, n);
  }, -1.5);

  return <primitive object={pts.points} />;
}
