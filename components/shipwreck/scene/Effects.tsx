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
import {
  toThree,
  type TitanicHandles,
} from "@/components/shipwreck/model/shipModel";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import { buildHull, hullHalfBreadth } from "@/lib/shipwreck/sim/geometry";
import { sampleTrack, type SimTrack } from "@/lib/shipwreck/sim/track";
import { areaById, floorZ, walkMapFor } from "@/lib/shipwreck/walk";
import { shipToThree, shipToThreeInto, type V3 } from "./cameraMath";
import type { SceneRuntime, WalkInfo } from "./runtime";
import { isDaylit, type SceneSettings } from "./settings";
import {
  AfternoonEffects,
  DAY_PARTICLES,
  rocketFlash,
  type AfternoonFrame,
} from "./afternoonEffects";
import { STORM_MIN_PX, STORM_PARTICLES, stormLightAt } from "./storm";
import { PoseidonEffects, type PoseidonFrame } from "./poseidonEffects";
import { STAR_SEA } from "./StormSea";
import { FUNNEL_SINK_S, FUNNEL_TOPPLE_S, layFunnel } from "./funnelWreck";
import { poseForemast } from "./mastWreck";
import { StormEffects, type StormFrame } from "./stormEffects";
import { alongRoute, boatRoute, rockLodgedT, strikeSpray } from "./giglio";
import {
  BOARD_REACH_M,
  boardableBoats,
  boatSpot,
  nearestBoardable,
  rideLowered,
  type BoatSpot,
} from "@/lib/shipwreck/boatRide";

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
/** A lifeboat rider's eyes over the boat's keel (m). */
const RIDE_EYE_M = 1.3;
/** Seconds between looks for a boat beside the walker. */
const BOARD_CHECK_S = 0.25;
/** Rowing speed (m/s) and how far out the boats go. */
const ROW_MPS = 0.7;
/**
 * A harbour-bound ship's boats (the Concordia's, in to Giglio Porto): a
 * lifeboat's 6 knots, 3 m a real second. Moved by the run's real time
 * (`realT`), so they go 18 m a shown second while the aground clock runs
 * at a sixth of real time (`agroundTimeScale`), and 3 m one elsewhere
 * (blown out to sea, where shown time is real).
 */
const HARBOUR_BOAT_MPS = 3;

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
/** The blended buffer per scene (the afternoon's, or the storm's). */
const DAY_POOL = DAY_PARTICLES.high.pool;
const STORM_POOL = STORM_PARTICLES.high.pool;
const dayVertex = /* glsl */ `
  attribute vec4 aColor;
  attribute float aSize;
  uniform float uScale;
  uniform float uMaxPx;
  uniform float uMinPx;
  varying vec4 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = aColor;
    float px = aSize * uScale / max(1.0, -mv.z);
    // The storm's snow: a flake smaller than uMinPx on screen fades out
    // instead of being drawn up to a pinpoint (0: off, the afternoon).
    if (uMinPx > 0.0) vColor.a *= smoothstep(uMinPx * 0.5, uMinPx, px);
    gl_PointSize = clamp(px, 1.5, uMaxPx);
  }
`;
const dayFragment = /* glsl */ `
  varying vec4 vColor;
  uniform float uLight;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float r = dot(p, p) * 4.0;
    if (r > 1.0) discard;
    float a = vColor.a * (1.0 - r) * (1.0 - r * 0.4);
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor.rgb * uLight, a);
  }
`;

interface EffectsProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  /** The ship on the stage (her hull, for the foam). */
  spec: ShipSpec;
  /** Her scene: the afternoon has smoke, the hit and boats hanging plumb. */
  settings: SceneSettings;
  /**
   * Her day shown at night (the time button): the day's smoke and steam
   * drawn dim, as the night would show them.
   */
  dark?: boolean;
}

/** The day's smoke and steam at night (the time button): this much light. */
const NIGHT_SMOKE_LIGHT = 0.12;

export default function Effects({
  store,
  runtime,
  spec,
  settings,
  dark = false,
}: EffectsProps) {
  const day = isDaylit(settings);
  // The storm (the Fitzgerald): snow, spray and torn smoke in the blended
  // buffer; none of the liners' boats, rockets, smoke or waterline foam.
  const storm = settings.storm === true;
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

  const pool = storm ? STORM_POOL : DAY_POOL;
  const dayPts = useMemo(() => {
    const g = new BufferGeometry();
    const pos = new BufferAttribute(new Float32Array(pool * 3), 3);
    const col = new BufferAttribute(new Float32Array(pool * 4), 4);
    const size = new BufferAttribute(new Float32Array(pool), 1);
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
      uniforms: {
        uScale: { value: 600 },
        uMaxPx: { value: DAY_PARTICLES.high.maxPx },
        uMinPx: { value: storm ? STORM_MIN_PX : 0 },
        uLight: { value: 1 },
      },
    });
    const points = new Points(g, mat);
    points.frustumCulled = false;
    points.renderOrder = 31;
    points.name = "effects-day";
    return { g, pos, col, size, mat, points };
  }, [pool, storm]);
  useEffect(
    () => () => {
      dayPts.g.dispose();
      dayPts.mat.dispose();
    },
    [dayPts]
  );
  const hull = useMemo(() => buildHull(spec), [spec]);
  const walkMap = useMemo(() => walkMapFor(spec.id), [spec]);
  // The afternoon's smoke, steam, the hit and her hanging boats.
  const afternoon = useMemo(
    () =>
      new AfternoonEffects(
        spec,
        hull,
        dayPts.pos.array as Float32Array,
        dayPts.col.array as Float32Array,
        dayPts.size.array as Float32Array
      ),
    [spec, hull, dayPts]
  );
  const dayFrame = useMemo(() => ({}) as AfternoonFrame, []);
  const stormFx = useMemo(
    () =>
      storm
        ? new StormEffects(
            spec,
            hull,
            runtime,
            dayPts.pos.array as Float32Array,
            dayPts.col.array as Float32Array,
            dayPts.size.array as Float32Array,
            { snow: settings.snow === true, wave: spec.cause === "wave" }
          )
        : null,
    [storm, spec, hull, runtime, dayPts, settings]
  );
  const stormFrame = useMemo(() => ({}) as StormFrame, []);
  // The rogue wave's spray, rolled-over foam and bubbles (the Poseidon).
  const waveFx = useMemo(
    () =>
      storm && spec.cause === "wave"
        ? new PoseidonEffects(
            spec,
            hull,
            runtime,
            dayPts.pos.array as Float32Array,
            dayPts.col.array as Float32Array,
            dayPts.size.array as Float32Array
          )
        : null,
    [storm, spec, hull, runtime, dayPts]
  );
  const waveFrame = useMemo(() => ({}) as PoseidonFrame, []);
  const lastSnap = useRef(-1);
  /** The ride last seen (index −1: none): a new one is re-aimed. */
  const rideSeen = useRef({ index: -1, at: 0 });
  /** Seconds until the next look for a boat beside the walker. */
  const boardIn = useRef(0);
  /** The rider for the test hooks (earth x, y). */
  const rideInfo = useRef<WalkInfo>({
    phase: "boat",
    part: null,
    area: null,
    x: 0,
    y: 0,
    slopeDeg: 0,
    heelDeg: 0,
    depthM: 0,
    inside: false,
  });
  // Per track: where each boat touched the water (sampled once).
  const launch = useRef<{
    track: SimTrack | null;
    at: Map<number, Vector3>;
    /** A harbour-bound ship's boats: each one's way in (earth x, y). */
    routes: Map<number, [number, number][]>;
    /** ...and the run's real time when each touched the water (s). */
    afloatRealT: Map<number, number>;
    /** A rocks ship: her earth x at the collision (null: not yet looked). */
    strikeX: number | null;
    /** When the rock lodged in her side (`rockLodgedT`; undefined: not yet). */
    lodgedT: number | null | undefined;
  }>({
    track: null,
    at: new Map(),
    routes: new Map(),
    afloatRealT: new Map(),
    strikeX: null,
    lodgedT: undefined,
  });
  const tmp = useMemo(
    () => ({
      m: new Matrix4(),
      q: new Quaternion(),
      v: new Vector3(),
      up: new Vector3(0, 1, 0),
      one: new Vector3(1, 1, 1),
      // The strike's droplets and a boat's place on its way in.
      sp: [0, 0, 0] as [number, number, number],
      sw: [0, 0, 0] as V3,
      along: [0, 0, 0] as [number, number, number],
    }),
    []
  );

  useFrame((state, dt) => {
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

    dayPts.mat.uniforms.uScale.value = pts.mat.uniforms.uScale.value;
    dayPts.points.visible = day || storm;
    dayPts.mat.uniforms.uLight.value = dark ? NIGHT_SMOKE_LIGHT : 1;

    runtime.flash = 0;
    if (!track || !frame) {
      pts.g.setDrawRange(0, 0);
      dayPts.g.setDrawRange(0, 0);
      return;
    }
    const t = s.t;
    const wall = state.clock.elapsedTime;
    if (launch.current.track !== track) {
      launch.current = {
        track,
        at: new Map(),
        routes: new Map(),
        afloatRealT: new Map(),
        strikeX: null,
        lodgedT: undefined,
      };
    }
    const events = track.events;
    const sternX = spec.stations[0]?.x ?? -138.5;
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
    // Her wreck's pose (the track's last frame), for the Britannic's funnels.
    const wreckPose =
      spec.id === "britannic"
        ? (track.frames[track.frames.length - 1]?.bodies[0] ?? null)
        : null;
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
        // The Britannic's: once toppled, each sinks to its place beside
        // her wreck [WP] (funnelWreck.ts).
        const rf = mdl.recipe.funnels[i];
        if (wreckPose && rf) {
          toThree([rf.x, 0, rf.baseZ], f.position);
          f.scale.set(1, 1, 1);
          const age = tf === undefined ? -1 : t - tf - FUNNEL_TOPPLE_S;
          if (age > 0) {
            const k = Math.min(1, age / FUNNEL_SINK_S);
            layFunnel(
              f,
              rf.topZ - rf.baseZ,
              spec,
              wreckPose,
              i,
              k * k * (3 - 2 * k)
            );
          }
        }
      });
      // The Britannic's foremast: down on the floor by her bow once she
      // lies there on her side [WP] (mastWreck.ts); else standing on her.
      poseForemast(mdl, spec, track, t);
    }

    // --- The strike (a rocks ship): a rush of white water along her side
    // at the rock as she runs on past it, until it lodges at frame 52
    // (giglio.ts). (Where she was at the collision, and when the rock
    // lodged: worked out once a track.)
    const c =
      spec.cause === "rocks"
        ? events.find((e) => e.kind === "collision")
        : undefined;
    if (spec.cause === "rocks" && launch.current.strikeX === null) {
      launch.current.strikeX = c
        ? sampleTrack(track, c.t).bodies[0].x
        : Number.NaN;
    }
    if (spec.cause === "rocks" && launch.current.lodgedT === undefined) {
      const rockX = spec.heel?.rock?.x;
      launch.current.lodgedT =
        rockX === undefined ? null : rockLodgedT(track, rockX);
    }
    const lodgedT = launch.current.lodgedT;
    const strike =
      spec.cause === "rocks"
        ? strikeSpray(
            spec,
            events,
            t,
            frame.bodies[0].x - (launch.current.strikeX ?? 0),
            c && typeof lodgedT === "number" ? lodgedT - c.t : undefined
          )
        : null;
    if (strike) {
      const whole0 = frame.bodies[0];
      const sp = tmp.sp;
      const w = tmp.sw;
      const N = 220;
      for (let k = 0; k < N; k += 1) {
        // Each droplet lives 0.6 s, thrown up and out from the rock's
        // place, trailing aft along her side (she runs on past it).
        const life = 0.6 + 0.5 * hash(k, 2);
        const a = (((wall / life + hash(k, 1)) % 1) + 1) % 1;
        const back = hash(k, 3) * 26 * a + hash(k, 4) * 6;
        const up = (2 + 7 * hash(k, 5)) * a * (1.2 - a);
        const out = 0.4 + 3 * hash(k, 6) * a;
        sp[0] = strike.x - back;
        sp[1] = strike.y + Math.sign(strike.y) * out;
        sp[2] = spec.draught - 0.3 + up;
        shipToThreeInto(whole0, sp, w);
        const b = strike.amount * (1 - a) * (0.9 + 0.6 * hash(k, 7));
        emit(w[0], w[1], w[2], b, b * 1.02, b * 1.05, 0.9 + 1.2 * hash(k, 8));
      }
    }

    // --- Lifeboats.
    const harbourBound = spec.cause === "rocks";
    const lowered = new Map<number, number>();
    for (const e of events)
      if (e.kind === "boat-lowered" && e.index !== undefined)
        lowered.set(e.index, e.t);
    // Riding a lifeboat: that one is lowered when they got in.
    const ride = s.walk.phase === "boat" ? (s.walk.boat ?? null) : null;
    const seen = rideSeen.current;
    if ((ride?.index ?? -1) !== seen.index || (ride?.at ?? 0) !== seen.at) {
      // A ride starts or ends: the boats whose lowering time moves (the
      // old ride's back to its real one, the new one's to now) forget
      // where they touched the sea.
      for (const i of [seen.index, ride?.index ?? -1])
        if (i >= 0) {
          launch.current.at.delete(i);
          launch.current.routes.delete(i);
          launch.current.afloatRealT.delete(i);
          afternoon.forgetBoat(i);
        }
      seen.index = ride?.index ?? -1;
      seen.at = ride?.at ?? 0;
      runtime.ride.aimed = false;
    }
    rideLowered(lowered, ride);
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
        const bob = Math.sin(wall * 0.9 + i) * 0.05;
        let px: number;
        let pz: number;
        if (harbourBound) {
          // The Concordia's boats motor in to Giglio Porto (giglio.ts),
          // round her bow from her seaward side.
          let route = launch.current.routes.get(i);
          if (!route) {
            const afloat = sampleTrack(track, tb + SWING_S + LOWER_S);
            launch.current.afloatRealT.set(i, afloat.realT);
            const at = afloat.bodies[0];
            route = boatRoute(
              [start.x, -start.z],
              info.side === "port" ? "port" : "starboard",
              at.x,
              at.y,
              at.yaw,
              i
            );
            launch.current.routes.set(i, route);
          }
          const since =
            frame.realT - (launch.current.afloatRealT.get(i) ?? frame.realT);
          const at = alongRoute(
            route,
            Math.max(0, since) * HARBOUR_BOAT_MPS,
            tmp.along
          );
          px = at[0];
          pz = -at[1];
          tmp.q.setFromAxisAngle(tmp.up, at[2]);
        } else {
          const side = info.side === "port" ? -1 : 1; // three z: port is -z
          const fan = (hash(i, 3) - 0.5) * 1.6;
          const dir = tmp.v
            .set(Math.sin(fan) * 0.8 - 0.2, 0, side * Math.cos(fan))
            .normalize();
          const far = 200 + hash(i, 7) * 600;
          const d = Math.min(far, (age - SWING_S - LOWER_S) * ROW_MPS);
          px = start.x + dir.x * d;
          pz = start.z + dir.z * d;
          tmp.q.setFromAxisAngle(tmp.up, Math.atan2(-dir.z, dir.x));
        }
        tmp.m.compose(tmp.v.set(px, -0.35 + bob, pz), tmp.q, tmp.one);
        mdl.boats.float(i, tmp.m);
        // (Not the ridden boat's light: it would sit in the rider's eyes.)
        if (mdl === visible && i !== ride?.index) {
          if (harbourBound) {
            // Her boats' small white lamps (a modern lifeboat's light).
            emit(px, 2.6 + bob, pz, 4.5, 4.6, 4.2, 1.1);
          } else {
            // A lantern on each boat.
            const flick = 0.85 + 0.15 * Math.sin(wall * 7 + i * 3);
            emit(px, 1.4 + bob, pz, 6 * flick, 4.2 * flick, 1.8 * flick, 1.6);
          }
        }
      }
    }
    // The afternoon: every boat in davits swung out (the day before),
    // hanging plumb from its falls as she lists.
    let dn = 0;
    if (day) {
      const f = dayFrame;
      f.track = track;
      f.frame = frame;
      f.openings = s.openings;
      f.torpedoes = s.torpedoes;
      f.hits = s.hits;
      f.t = t;
      f.wall = wall;
      f.dt = Math.min(0.1, dt);
      f.snapped = s.snapId !== lastSnap.current;
      f.models = models;
      f.visible = visible;
      f.fell = fell;
      f.lowered = lowered;
      f.rideIndex = ride?.index ?? -1;
      f.wakeDx = runtime.wake.dx;
      f.wakeDz = runtime.wake.dz;
      f.wakeAmount = runtime.wake.amount;
      f.quality = s.quality;
      // Point size capped per tier (framebuffer pixels, as the night's 96).
      dayPts.mat.uniforms.uMaxPx.value = DAY_PARTICLES[s.quality].maxPx;
      dn = afternoon.update(f);
    }

    // --- Riding a lifeboat: the eyes sit in the boat (WalkRunner turns
    // the look); on her deck, the boat beside the walker they can get in.
    if (ride && visible && visible.boats.worldPosition(ride.index, tmp.v)) {
      const r = runtime.ride;
      if (!r.aimed) {
        // A new ride: the look starts straight at her.
        r.yaw = 0;
        r.pitch = 0;
        r.aimed = true;
      }
      // The look keeps facing her as the boat rows away (her stern piece
      // after the break, the last to go), turned by the player's drag.
      // Earth y is three −z.
      const view = runtime.rideView;
      view.pos[0] = tmp.v.x;
      view.pos[1] = tmp.v.y + RIDE_EYE_M;
      view.pos[2] = tmp.v.z;
      view.yaw = Math.atan2(main.y + tmp.v.z, main.x - tmp.v.x) + r.yaw;
      view.pitch = r.pitch;
      runtime.walker = view;
      const info = rideInfo.current;
      info.x = tmp.v.x;
      info.y = -tmp.v.z;
      runtime.walkInfo = info;
    }
    // No lifeboat to get into from a room inside her.
    if (
      s.walk.phase === "deck" &&
      runtime.walkInfo?.phase === "deck" &&
      !runtime.walkInfo.inside
    ) {
      boardIn.current -= dt;
      if (boardIn.current <= 0 && visible) {
        boardIn.current = BOARD_CHECK_S;
        const spots: BoatSpot[] = [];
        for (const i of boardableBoats(events, t)) {
          if (i >= visible.boats.count) continue;
          const b = visible.boats.info(i);
          if (b.side === "centre") continue;
          spots.push(boatSpot(b));
        }
        const w = runtime.walkInfo;
        // The walker's floor: a recess boat (the Concordia's) is reached
        // only from its own deck, not the decks over it; a walker on her
        // map with no area under them reaches none of those (−∞ is no
        // deck's height), the other boats as before.
        const floor =
          walkMap && w.area && areaById(walkMap, w.area)
            ? floorZ(walkMap, w.area, w.x, spec, w.y)
            : walkMap
              ? -Infinity
              : undefined;
        runtime.boardable =
          nearestBoardable(w.x, w.y, spots, BOARD_REACH_M, floor) ?? -1;
      }
    } else {
      boardIn.current = 0;
      runtime.boardable = -1;
    }
    if (stormFx) {
      const f = stormFrame;
      const cam = state.camera.position;
      f.frame = frame;
      f.t = t;
      f.wall = wall;
      f.dt = Math.min(0.1, dt);
      f.quality = s.quality;
      f.funnel = visible?.funnels[0] ?? null;
      f.camX = cam.x;
      f.camY = cam.y;
      f.camZ = cam.z;
      f.under = runtime.underwater;
      // (A wave ship's diesels stop at her blackout.)
      const firesOutAt = spec.cause === "wave" ? "lights-out" : "bow-under";
      let out = false;
      for (const e of events)
        if (e.kind === firesOutAt && e.t <= t) {
          out = true;
          break;
        }
      f.firesOut = out;
      f.track = track;
      dayPts.mat.uniforms.uMaxPx.value = STORM_PARTICLES[s.quality].maxPx;
      dn = stormFx.update(f);
    }
    if (waveFx) {
      const f = waveFrame;
      const cam = state.camera.position;
      f.track = track;
      f.frame = frame;
      f.openings = s.openings;
      f.t = t;
      f.wall = wall;
      f.quality = s.quality;
      f.camX = cam.x;
      f.camY = cam.y;
      f.camZ = cam.z;
      f.under = runtime.underwater;
      f.white = Math.max(
        0.03 + 0.97 * stormLightAt(runtime, t),
        STAR_SEA.white
      );
      f.lamps = runtime.lampPower;
      dn = waveFx.update(f, dn);
    } else runtime.foamPatch[3] = 0;
    lastSnap.current = s.snapId;
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
    if (visible && firesLit && !day && !storm) {
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

    // --- Rockets: rise ~200 m in 4 s, burst, stars fall for 7 s. By day
    // the afternoon draws their smoke (no stars, no flash); only the pop
    // at the top is light, here.
    if (day) {
      const P2 = afternoon.pops;
      for (let k = 0; k < afternoon.popN; k += 1) {
        const b = P2[k * 5 + 3];
        emit(
          P2[k * 5],
          P2[k * 5 + 1],
          P2[k * 5 + 2],
          b,
          b * 0.92,
          b * 0.8,
          P2[k * 5 + 4]
        );
      }
    }
    for (const e of events) {
      if (e.kind !== "rocket" || day) continue;
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
      runtime.flash = Math.max(runtime.flash, rocketFlash(age, day));
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
      !storm &&
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
      // (Near her stern: no further aft than 10 m in from it.)
      const x0 = e.kind === "bow-under" ? 60 : Math.max(-100, sternX + 10);
      const c = shipToThree(body, [x0, 0, 10]);
      const fade = Math.min(1, age * 2) * (1 - age / 40);
      // On the storm's sea, where it is now.
      const seaAt = storm ? runtime.seaY(c[0], c[2]) : 0;
      for (let k = 0; k < 160; k += 1) {
        const th = hash(k, 21) * Math.PI * 2;
        const r = Math.sqrt(hash(k, 22)) * (8 + age * 1.6);
        const pulse = 0.6 + 0.4 * Math.sin(wall * 3 + k);
        const b = 0.5 * fade * pulse;
        emit(
          c[0] + Math.cos(th) * r,
          seaAt + 0.2,
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
    // (Nor in the storm: its sea is not at z = 0, and spray marks it.)
    for (const body of s.xray || storm ? [] : frame.bodies) {
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
    if (cam.y < (storm ? runtime.sea.atCamera : 0) - 2) {
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
    if (day || storm) {
      dayPts.pos.needsUpdate = true;
      dayPts.col.needsUpdate = true;
      dayPts.size.needsUpdate = true;
    }
    dayPts.g.setDrawRange(0, dn);
  }, -1.5);

  return (
    <>
      <primitive object={pts.points} />
      <primitive object={dayPts.points} />
    </>
  );
}
