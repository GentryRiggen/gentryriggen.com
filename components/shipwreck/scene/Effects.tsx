"use client";
/* eslint-disable react-hooks/immutability -- three.js objects and the scene runtime are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Matrix4,
  NormalBlending,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import type { TitanicHandles } from "@/components/shipwreck/model/shipModel";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { buildHull, hullHalfBreadth } from "@/lib/shipwreck/sim/geometry";
import { sampleTrack, type SimTrack } from "@/lib/shipwreck/sim/track";
import { shipToThree } from "./cameraMath";
import type { SceneRuntime } from "./runtime";
import type { SceneSettings } from "./settings";
import { torpedoHole } from "./Torpedo";

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

/**
 * Daylight particles (the afternoon): smoke, steam, spray, blended over
 * the scene (additive light cannot make dark coal smoke). One more draw.
 */
const DAY_POOL = 1800;
const dayVertex = /* glsl */ `
  attribute vec4 aColor;
  attribute float aSize;
  uniform float uScale;
  varying vec4 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 1.5, 160.0);
  }
`;
const dayFragment = /* glsl */ `
  varying vec4 vColor;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = dot(p, p) * 4.0;
    if (r > 1.0) discard;
    float a = vColor.a * (1.0 - r) * (1.0 - r * 0.4);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor.rgb, a);
  }
`;

/** The afternoon's boats: falls this long from the davit heads (m). */
const FALL_M = 2.6;
/** How far they were lowered for loading, to the Promenade deck (m). */
const LOAD_DROP_M = 2.85;

interface EffectsProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  /** The ship on the stage (her hull, for the foam). */
  spec: ShipSpec;
  /** Her scene: the afternoon has smoke, the hit and boats hanging plumb. */
  settings: SceneSettings;
}

export default function Effects({
  store,
  runtime,
  spec,
  settings,
}: EffectsProps) {
  const day = settings.timeOfDay === "afternoon";
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

  const dayPts = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(DAY_POOL * 3), 3);
    const col = new BufferAttribute(new Float32Array(DAY_POOL * 4), 4);
    const size = new BufferAttribute(new Float32Array(DAY_POOL), 1);
    g.setAttribute("position", pos);
    g.setAttribute("aColor", col);
    g.setAttribute("aSize", size);
    g.setDrawRange(0, 0);
    const mat = new ShaderMaterial({
      vertexShader: dayVertex,
      fragmentShader: dayFragment,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: { uScale: { value: 600 } },
    });
    const points = new Points(g, mat);
    points.frustumCulled = false;
    points.renderOrder = 31;
    points.name = "effects-day";
    return { g, pos, col, size, mat, points };
  }, []);
  useEffect(
    () => () => {
      dayPts.g.dispose();
      dayPts.mat.dispose();
    },
    [dayPts]
  );
  // Each funnel's smoke, eased so it never pops (afternoon).
  const smoke = useRef([1, 1, 1, 1]);
  const smokeSnap = useRef(-1);

  const hull = useMemo(() => buildHull(spec), [spec]);
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
      w: new Vector3(),
      down: new Vector3(),
      head: new Vector3(),
      fwd: new Vector3(),
      qPart: new Quaternion(),
      qInv: new Quaternion(),
      qBoat: new Quaternion(),
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

    let dn = 0;
    const DP = dayPts.pos.array as Float32Array;
    const DC = dayPts.col.array as Float32Array;
    const DS = dayPts.size.array as Float32Array;
    /** A daylight particle: colour (linear), opacity, size (m). */
    const emitDay = (
      x: number,
      y: number,
      z: number,
      r: number,
      g: number,
      b: number,
      a: number,
      size: number
    ) => {
      if (dn >= DAY_POOL || a <= 0.004) return;
      DP[dn * 3] = x;
      DP[dn * 3 + 1] = y;
      DP[dn * 3 + 2] = z;
      DC[dn * 4] = r;
      DC[dn * 4 + 1] = g;
      DC[dn * 4 + 2] = b;
      DC[dn * 4 + 3] = a;
      DS[dn] = size;
      dn += 1;
    };
    dayPts.mat.uniforms.uScale.value = pts.mat.uniforms.uScale.value;
    dayPts.points.visible = day;

    runtime.flash = 0;
    if (!track || !frame) {
      pts.g.setDrawRange(0, 0);
      dayPts.g.setDrawRange(0, 0);
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
    for (const mdl of day ? [] : models) {
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
    // The afternoon: every boat in davits swung out (the day before),
    // hanging plumb from its falls as she lists.
    if (day) {
      const hit = s.openings.length > 0;
      for (const mdl of models) hangBoats(mdl, mdl === visible, hit, lowered);
    }
    // Lanterns of boats still on the falls.
    if (visible && !day) {
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
    if (day && visible) daySmoke(visible);
    smokeSnap.current = s.snapId;
    if (visible && firesLit && !day) {
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
          if (z <= 0.3 || z >= spec.sheerZ(x) || y === 0) continue;
          const w = shipToThree(body, [x, y * 1.04, z]);
          const fl = 0.7 + 0.3 * Math.sin(wall * 2.3 + k * 1.7 + side);
          const b = day
            ? (0.06 + 0.2 * runtime.wake.amount) * fl
            : (0.035 + 0.08 * power) * fl;
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

    if (day && s.openings.length > 0) theHit();

    pts.pos.needsUpdate = true;
    pts.col.needsUpdate = true;
    pts.size.needsUpdate = true;
    pts.g.setDrawRange(0, n);
    if (day) {
      dayPts.pos.needsUpdate = true;
      dayPts.col.needsUpdate = true;
      dayPts.size.needsUpdate = true;
    }
    dayPts.g.setDrawRange(0, dn);

    /**
     * Each boat with davits hangs from its davit heads, swung out: plumb
     * (earth-down) as she lists, so the starboard boats swing far out from
     * her side and the port boats swing in against the hull. After the hit
     * the crews lowered them to the Promenade deck to load; the six that
     * got away go down to the sea and pull clear.
     */
    function hangBoats(
      mdl: TitanicHandles,
      isVisible: boolean,
      hit: boolean,
      lowered: Map<number, number>
    ) {
      if (!track) return;
      let order = 0;
      for (let i = 0; i < mdl.boats.count; i += 1) {
        const info = mdl.boats.info(i);
        if (!info.hasDavits) {
          mdl.boats.stow(i);
          continue;
        }
        const tb = lowered.get(i);
        const age = tb === undefined ? -1 : t - tb;
        if (tb !== undefined && age >= SWING_S + LOWER_S) {
          floatAway(mdl, i, tb, age, isVisible);
          continue;
        }
        const holder = mdl.boats.holderOf(i);
        holder.updateMatrixWorld();
        holder.getWorldQuaternion(tmp.qPart);
        tmp.qInv.copy(tmp.qPart).invert();
        // Earth-down and her heading in the part's own axes.
        tmp.down.set(0, -1, 0).applyQuaternion(tmp.qInv);
        tmp.fwd.set(1, 0, 0).applyQuaternion(tmp.qPart);
        const side = info.side === "port" ? 1 : -1;
        const outY = side * (Math.abs(info.edgeY) + 0.35 + info.beam / 2 + 0.7);
        tmp.head.set(info.x, info.z + FALL_M, -outY);
        // Lowered to the Promenade deck to load, from a minute after the hit.
        const k = order++ % 11;
        const load = hit
          ? LOAD_DROP_M * Math.min(1, Math.max(0, (t - 70 - k * 18) / 60))
          : 0;
        let fall = FALL_M + load;
        if (tb !== undefined && age >= 0) {
          // Down the falls to the sea.
          tmp.v.copy(tmp.head).addScaledVector(tmp.down, fall);
          tmp.w.copy(tmp.v).applyMatrix4(holder.matrixWorld);
          const toSea = Math.max(0, tmp.w.y + 0.35);
          fall += toSea * Math.max(0, (age - SWING_S) / LOWER_S);
        }
        tmp.v.copy(tmp.head).addScaledVector(tmp.down, fall);
        // Against her side, never into it (ship frame y = -three z).
        const z = tmp.v.y;
        const sheer = spec.sheerZ(info.x);
        const sideY =
          Math.max(
            Math.abs(info.edgeY) + 0.15,
            hullHalfBreadth(hull, info.x, Math.min(z, sheer))
          ) +
          info.beam / 2 +
          0.1;
        const yS = -tmp.v.z;
        let against = false;
        if (side * yS < sideY) {
          tmp.v.z = -side * sideY;
          against = true;
        }
        // Level with the sea, turned with her heading.
        const yaw = Math.atan2(-tmp.fwd.z, tmp.fwd.x);
        tmp.qBoat.setFromAxisAngle(tmp.up, yaw);
        tmp.q.copy(tmp.qInv).multiply(tmp.qBoat);
        // Pressed to her side, a boat leans with her a little.
        if (against) tmp.q.slerp(tmp.qBoat.identity(), 0.5);
        mdl.boats.hang(i, tmp.v, tmp.q);
      }
    }

    /** A boat that got away: where it touched the sea, then pulling clear. */
    function floatAway(
      mdl: TitanicHandles,
      i: number,
      tb: number,
      age: number,
      isVisible: boolean
    ) {
      if (!track) return;
      const info = mdl.boats.info(i);
      let start = launch.current.at.get(i);
      if (!start) {
        const at = sampleTrack(track, tb + SWING_S + LOWER_S).bodies[0];
        const side = info.side === "port" ? 1 : -1;
        const w = shipToThree(at, [
          info.x,
          side * (Math.abs(info.edgeY) + 4),
          info.z,
        ]);
        start = new Vector3(w[0], -0.35, w[2]);
        launch.current.at.set(i, start);
      }
      const sideZ = info.side === "port" ? -1 : 1;
      const fan = (hash(i, 3) - 0.5) * 1.2;
      const dir = tmp.w
        .set(Math.sin(fan) * 0.6 - 0.3, 0, sideZ * Math.cos(fan))
        .normalize();
      const far = 150 + hash(i, 7) * 250;
      const d = Math.min(far, (age - SWING_S - LOWER_S) * ROW_MPS);
      const bob = Math.sin(wall * 0.9 + i) * 0.05;
      tmp.q.setFromAxisAngle(tmp.up, Math.atan2(-dir.z, dir.x));
      tmp.m.compose(
        tmp.v.set(start.x + dir.x * d, -0.35 + bob, start.z + dir.z * d),
        tmp.q,
        tmp.one
      );
      mdl.boats.float(i, tmp.m);
      void isVisible;
    }

    /**
     * Coal smoke from all four funnels, trailing aft on the wind of her way
     * and thinning as her steam fails; white steam blowing off after the
     * second explosion. Stops as each funnel falls or goes under.
     */
    function daySmoke(mdl: TitanicHandles) {
      const hit = s.openings.length > 0;
      const half = spec.headway?.halfLifeS ?? 300;
      const steamFails = hit
        ? 0.18 + 0.82 * Math.exp((-t * Math.LN2) / half)
        : 1;
      const wk = runtime.wake;
      const rel = 1.5 + 9.3 * wk.amount;
      mdl.funnels.forEach((f, i) => {
        const data = spec.funnels[i];
        if (!f || !data) return;
        const fallen = fell.has(i) && t >= (fell.get(i) ?? 0);
        f.updateMatrixWorld();
        const top = tmp.w.set(-0.6, data.topZ - data.baseZ - 0.3, 0);
        f.localToWorld(top);
        const alive = !fallen && top.y > 0.5 && data.dummy !== true;
        const target = alive ? steamFails : 0;
        const cur = smoke.current[i] ?? 1;
        // Eased a little each frame (seeks snap at once).
        smoke.current[i] =
          store.getState().snapId !== smokeSnap.current
            ? target
            : cur + (target - cur) * 0.05;
        const strength = smoke.current[i];
        if (strength < 0.01) return;
        const LIFE = 22;
        for (let k = 0; k < 70; k += 1) {
          const a = (((wall / LIFE + hash(k, i + 40)) % 1) + 1) % 1;
          const age = a * LIFE;
          const spread = 1.2 + age * 0.9;
          const ang = hash(k, i + 49) * Math.PI * 2;
          const rr = Math.sqrt(hash(k, i + 57)) * spread;
          const back = rel * age;
          const x = top.x - wk.dx * back + Math.cos(ang) * rr;
          const y =
            top.y + 2.4 * Math.pow(age, 0.72) + Math.sin(ang) * rr * 0.5;
          const z = top.z - wk.dz * back + Math.sin(ang) * rr - age * 0.25;
          const fade = Math.pow(1 - a, 1.3) * Math.min(1, a * 12);
          const lit = Math.min(1, age / 14);
          emitDay(
            x,
            y,
            z,
            0.05 + 0.22 * lit,
            0.047 + 0.22 * lit,
            0.045 + 0.23 * lit,
            0.7 * fade * strength,
            3 + age * 1.5
          );
        }
        // Steam blowing off (after the second explosion), white.
        const ex = events.find((e) => e.kind === "explosion")?.t;
        if (hit && ex !== undefined && t >= ex) {
          const steam = Math.exp(-(t - ex) / 200) * (alive ? 1 : 0);
          for (let k = 0; k < 24 && steam > 0.02; k += 1) {
            const a = (((wall / 4 + hash(k, i + 70)) % 1) + 1) % 1;
            const age = a * 4;
            const x = top.x + 2.2 - wk.dx * rel * age * 0.6;
            const y = top.y + 1 + age * 9 * (1 - a * 0.3);
            const z =
              top.z - wk.dz * rel * age * 0.6 + (hash(k, i) - 0.5) * age * 2;
            emitDay(
              x,
              y,
              z,
              0.9,
              0.9,
              0.92,
              0.45 * (1 - a) * steam,
              2 + age * 2.2
            );
          }
        }
      });
    }

    /**
     * The hit, at the first moment, where the torpedo struck: a column of
     * white water and coal-black spray higher than her funnels, falling
     * back as she steams on; then, moments later, the second explosion
     * lower down inside her, a wider burst at her side and a cloud of coal
     * dust and steam out of her forward decks. (Its cause is not shown.)
     */
    function theHit() {
      if (!track) return;
      const hole = torpedoHole(s.openings);
      if (hole) {
        const pose = sampleTrack(track, 0).bodies[0];
        const h = shipToThree(pose, [hole.x, -13.6, 9.3]);
        const o = shipToThree(pose, [hole.x, -14.6, 9.3]);
        burst(h, [o[0] - h[0], o[2] - h[2]], t, {
          count: 460,
          up: [20, 15],
          out: [1.5, 5],
          dark: 0.14,
          mist: 1,
        });
      }
      const ex = events.find((e) => e.kind === "explosion");
      const inside = s.openings.find((op) => (op.t ?? 0) > 0);
      if (ex && inside && t >= ex.t) {
        const age = t - ex.t;
        const pose = sampleTrack(track, ex.t).bodies[0];
        const h = shipToThree(pose, [inside.x, -13.6, 9.3]);
        const o = shipToThree(pose, [inside.x, -14.6, 9.3]);
        burst(h, [o[0] - h[0], o[2] - h[2]], age, {
          count: 300,
          up: [9, 12],
          out: [4, 7],
          dark: 0.3,
          mist: 1.4,
        });
        // Coal dust and steam boiling up out of her forward decks.
        if (age < 40) {
          const p = shipToThree(pose, [inside.x - 4, 0, 24]);
          for (let k = 0; k < 190; k += 1) {
            const d = hash(k, 81) * 3;
            const a2 = age - d;
            if (a2 < 0) continue;
            const life = 22 + hash(k, 82) * 14;
            if (a2 > life) continue;
            const u = a2 / life;
            const ang = hash(k, 83) * Math.PI * 2;
            const r = (2 + a2 * 1.1) * Math.sqrt(hash(k, 84));
            const rise = 30 * (1 - Math.exp(-a2 / 4)) + a2 * 0.8;
            const steamy = hash(k, 85) < 0.4;
            const c = steamy ? 0.82 : 0.07 + 0.18 * u;
            emitDay(
              p[0] + Math.cos(ang) * r - a2 * 0.8,
              p[1] + rise * (0.6 + 0.8 * hash(k, 86)),
              p[2] + Math.sin(ang) * r,
              c,
              c,
              c * (steamy ? 1.03 : 0.95),
              (steamy ? 0.45 : 0.65) * (1 - u) * Math.min(1, a2 * 3),
              4 + a2 * 1.2
            );
          }
        }
        if (age < 0.5) {
          const f = 1 - age / 0.5;
          for (let k = 0; k < 20; k += 1)
            emit(
              h[0] + (hash(k, 91) - 0.5) * 8,
              1 + hash(k, 92) * 6,
              h[2] + hash(k, 93) * 4,
              9 * f,
              5 * f,
              2 * f,
              4
            );
        }
      }
    }

    /** A column of water thrown up at `h` (three), `age` s ago. */
    function burst(
      h: readonly number[],
      outXZ: [number, number],
      age: number,
      o: {
        count: number;
        up: [number, number];
        out: [number, number];
        dark: number;
        mist: number;
      }
    ) {
      if (age < 0 || age > 20) return;
      const ol = Math.hypot(outXZ[0], outXZ[1]) || 1;
      const ox = outXZ[0] / ol;
      const oz = outXZ[1] / ol;
      for (let k = 0; k < o.count; k += 1) {
        const a = age - hash(k, 11) * 0.35;
        if (a < 0) continue;
        const vy = o.up[0] + o.up[1] * hash(k, 12);
        const vo = o.out[0] + o.out[1] * hash(k, 13);
        const va = (hash(k, 14) - 0.5) * 6;
        const drag = (1 - Math.exp(-a * 0.8)) / 0.8;
        const y = vy * drag - 0.5 * G * a * a * 0.85;
        if (y < -0.5) continue;
        const dark = hash(k, 15) < o.dark;
        const c = dark ? 0.12 : 0.9;
        const fade = Math.min(1, 6 - a) * 0.85;
        emitDay(
          h[0] + ox * vo * drag + va * drag * 0.4,
          Math.max(0.2, y),
          h[2] + oz * vo * drag + va * drag * 0.4,
          c,
          c,
          c * 1.02,
          fade,
          (dark ? 1.4 : 2.2 + 2.5 * hash(k, 16)) * (1 + a * 0.35)
        );
      }
      // The spray hanging and drifting after the column falls.
      for (let k = 0; k < 110; k += 1) {
        const a = age - 0.8 - hash(k, 17) * 1.5;
        if (a < 0) continue;
        const u = a / 18;
        if (u > 1) continue;
        const ang = hash(k, 18) * Math.PI * 2;
        const r = (4 + a * 1.6) * Math.sqrt(hash(k, 19));
        const y = (o.up[0] + o.up[1] * 0.5) * 1.3 * hash(k, 20) * (1 - u * 0.5);
        emitDay(
          h[0] + Math.cos(ang) * r + ox * a * 0.8,
          Math.max(1, y),
          h[2] + Math.sin(ang) * r + oz * a * 0.8,
          0.88,
          0.9,
          0.92,
          0.32 * o.mist * (1 - u) * Math.min(1, a * 2),
          8 + a * 2.2
        );
      }
    }
  }, -1.5);

  return <primitive object={pts.points} />;
}
