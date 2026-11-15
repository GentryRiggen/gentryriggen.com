"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  CylinderGeometry,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  dirToUv,
  moveOnSphere,
  surfaceBasis,
  uvToDir,
  type Vec3,
} from "@/lib/planet-smasher/sphere";
import { playCue } from "../../audio/sfx";
import {
  FlashSprite,
  SurfaceRing,
  clamp01,
  easeOut,
  rand,
  shake,
  stepDt,
  tangentBasisInto,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

/* ------------------------------------------------------------------ */
/* Timeline and path                                                   */
/* ------------------------------------------------------------------ */

export const RISE_END = 1;
export const ROAR_END = 1.5;
/** The monster plants a foot at the tap (1.5 s) and then every second. */
export const STOMP_TIMES = [1.5, 2.5, 3.5, 4.5] as const;
export const WALK_END = 4.5;
const LASER_BLASTS: readonly [number, number][] = [
  [4.5, 5],
  [5, 5.5],
];
const SINK_START = 5.5;
const SINK_END = 7;
const END = 7.3;
const STEP = 0.12;
/** The monster's height in planet radii. */
const HEIGHT = 0.5;

/** Small seeded generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The four stomp points: the first is the tap, and each next one is about
 * 0.12 rad further along one random heading (a great circle, so it never
 * wanders). All u values are in [0,1).
 */
export function monsterPath(
  u: number,
  v: number,
  seed: number
): { u: number; v: number }[] {
  const rnd = seeded(seed);
  const heading = rnd() * Math.PI * 2;
  let p: Vec3 = uvToDir(u, v);
  const { east, north } = surfaceBasis(p);
  let t: Vec3 = {
    x: east.x * Math.cos(heading) + north.x * Math.sin(heading),
    y: east.y * Math.cos(heading) + north.y * Math.sin(heading),
    z: east.z * Math.cos(heading) + north.z * Math.sin(heading),
  };
  const out = [{ u, v }];
  for (let i = 1; i < 4; i++) {
    const next = moveOnSphere(p, t, STEP * (1 + (rnd() - 0.5) * 0.2));
    p = next.p;
    t = next.t;
    out.push(dirToUv(p));
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Model                                                               */
/* ------------------------------------------------------------------ */

type Rgb = [number, number, number];

/** Flat vertex colour, a little darker towards the feet (`shade` 0..1). */
function paint(g: BufferGeometry, color: Rgb, shade = 0.25): BufferGeometry {
  const pos = g.attributes.position as BufferAttribute;
  const colors: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const k = 1 - shade * (1 - clamp01(pos.getY(i) / 0.9));
    colors.push(color[0] * k, color[1] * k, color[2] * k);
  }
  g.setAttribute("color", new Float32BufferAttribute(colors, 3));
  return g.index ? g.toNonIndexed() : g;
}

const BODY: Rgb = [0.1, 0.45, 0.12];
const BELLY: Rgb = [0.75, 0.7, 0.25];
const DARK: Rgb = [0.06, 0.3, 0.1];
const HEAD: Rgb = [0.14, 0.52, 0.14];

/** Torso, belly, arms and the two-part tail, merged into one mesh. */
function torsoGeometry(): BufferGeometry {
  const torso = new CapsuleGeometry(0.19, 0.3, 6, 14).translate(0, 0.52, 0);
  const belly = new SphereGeometry(0.17, 12, 10)
    .scale(1, 1.35, 0.7)
    .translate(0, 0.5, 0.11);
  const arm = (side: number) =>
    new CapsuleGeometry(0.04, 0.1, 4, 8)
      .rotateZ(side * 0.7)
      .rotateX(-0.9)
      .translate(side * 0.2, 0.58, 0.16);
  const tail1 = new ConeGeometry(0.14, 0.5, 10)
    .translate(0, 0.25, 0)
    .rotateX(-1.98)
    .translate(0, 0.34, -0.17);
  const tail2 = new ConeGeometry(0.075, 0.28, 8)
    .translate(0, 0.14, 0)
    .rotateX(-2.7)
    .translate(0, 0.14, -0.58);
  return (
    mergeGeometries([
      paint(torso, BODY),
      paint(belly, BELLY, 0),
      paint(arm(-1), BODY, 0),
      paint(arm(1), BODY, 0),
      paint(tail1, DARK, 0),
      paint(tail2, DARK, 0),
    ]) ?? torso
  );
}

/** One leg, hinged at the hip (the origin), with a foot. */
function legGeometry(side: number): BufferGeometry {
  const leg = new CapsuleGeometry(0.085, 0.12, 5, 10).translate(0, -0.1, 0);
  const foot = new SphereGeometry(0.1, 10, 8)
    .scale(1, 0.55, 1.5)
    .translate(0, -0.2, 0.05);
  const g = mergeGeometries([paint(leg, DARK, 0), paint(foot, DARK, 0)]);
  return (g ?? leg).translate(side * 0.11, 0, 0);
}

/** Head, snout and teeth around the neck pivot. */
function headGeometry(): BufferGeometry {
  const skull = new SphereGeometry(0.15, 14, 12)
    .scale(1.05, 0.92, 1.15)
    .translate(0, 0.08, 0.05);
  const snout = new SphereGeometry(0.1, 12, 10)
    .scale(1, 0.7, 1.2)
    .translate(0, 0.03, 0.2);
  const brow = (side: number) =>
    new SphereGeometry(0.05, 8, 6)
      .scale(1.4, 0.7, 1)
      .translate(side * 0.075, 0.17, 0.12);
  const teeth: BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    teeth.push(
      paint(
        new ConeGeometry(0.014, 0.045, 5)
          .rotateX(Math.PI)
          .translate((i - 2) * 0.034, -0.02, 0.26 - Math.abs(i - 2) * 0.025),
        [1, 1, 0.92],
        0
      )
    );
  }
  return (
    mergeGeometries([
      paint(skull, HEAD, 0),
      paint(snout, HEAD, 0),
      paint(brow(-1), DARK, 0),
      paint(brow(1), DARK, 0),
      ...teeth,
    ]) ?? skull
  );
}

const EYE_X = 0.078;
const EYE_LOCAL = new Vector3(EYE_X, 0.12, 0.17);

function eyesGeometry(): BufferGeometry {
  const eye = (side: number) =>
    new SphereGeometry(0.04, 10, 8)
      .scale(1, 1.1, 0.8)
      .translate(side * EYE_X, 0, 0);
  return mergeGeometries([eye(-1), eye(1)]) ?? eye(1);
}

const SPIKE_COUNT = 9;

/** Orange spikes down the back and tail, all in one InstancedMesh. */
function spikeMesh(): InstancedMesh {
  const mesh = new InstancedMesh(
    new ConeGeometry(0.055, 0.13, 6).translate(0, 0.065, 0),
    new MeshStandardMaterial({
      color: 0xffb040,
      roughness: 0.55,
      emissive: 0x3a1c00,
    }),
    SPIKE_COUNT
  );
  const place: [Vector3, Vector3, number][] = [];
  // Over the shoulders, down the back, then along the tail.
  for (const phi of [0.25, 0.85, 1.4]) {
    place.push([
      new Vector3(0, 0.67 + 0.19 * Math.cos(phi), -0.19 * Math.sin(phi)),
      new Vector3(0, Math.cos(phi), -Math.sin(phi)),
      0.95,
    ]);
  }
  for (const y of [0.58, 0.47, 0.37]) {
    place.push([new Vector3(0, y, -0.19), new Vector3(0, 0.3, -1), 1]);
  }
  for (const k of [0.1, 0.22, 0.34]) {
    place.push([
      new Vector3(0, 0.34 - k * 0.8, -0.17 - k * 1.9).add(
        new Vector3(0, 0.1 * (1 - k * 2), 0)
      ),
      new Vector3(0, 1, -0.3),
      0.85 - k,
    ]);
  }
  const m = new Matrix4();
  const q = new Quaternion();
  const col = new Color();
  place.forEach(([pos, normal, size], i) => {
    q.setFromUnitVectors(new Vector3(0, 1, 0), normal.clone().normalize());
    mesh.setMatrixAt(i, m.compose(pos, q, new Vector3(size, size, size)));
    mesh.setColorAt(i, col.setHSL(0.09 + (i % 3) * 0.015, 1, 0.62));
  });
  mesh.frustumCulled = false;
  return mesh;
}

interface Rig {
  root: Group;
  rig: Group;
  head: Group;
  eyes: Mesh;
  legL: Mesh;
  legR: Mesh;
  disposables: { dispose(): void }[];
}

function buildMonster(): Rig {
  const body = new MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.62,
    metalness: 0,
    emissive: 0x0d3010,
  });
  const eyeMat = new MeshBasicMaterial({ color: 0xffe94a, toneMapped: false });
  const geos = [
    torsoGeometry(),
    legGeometry(-1),
    legGeometry(1),
    headGeometry(),
    eyesGeometry(),
  ];
  const mk = (
    g: BufferGeometry,
    m: MeshStandardMaterial | MeshBasicMaterial
  ) => {
    const mesh = new Mesh(g, m);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    return mesh;
  };
  const torso = mk(geos[0], body);
  const legL = mk(geos[1], body);
  const legR = mk(geos[2], body);
  legL.position.set(0, 0.24, 0);
  legR.position.set(0, 0.24, 0);
  const head = new Group();
  head.position.set(0, 0.78, 0.08);
  head.add(mk(geos[3], body));
  const eyes = mk(geos[4], eyeMat);
  // The eyes grow about their own middle, not the neck.
  eyes.position.set(0, EYE_LOCAL.y, EYE_LOCAL.z - 0.015);
  head.add(eyes);
  const spikes = spikeMesh();
  const rig = new Group();
  rig.add(torso, legL, legR, head, spikes);
  const root = new Group();
  root.add(rig);
  return {
    root,
    rig,
    head,
    eyes,
    legL,
    legR,
    disposables: [
      ...geos,
      body,
      eyeMat,
      spikes.geometry,
      spikes.material as MeshStandardMaterial,
      spikes,
    ],
  };
}

/** A red eye laser: an open glowing cylinder from y = 0 up to y = 1. */
function beamMesh(): Mesh {
  const mesh = new Mesh(
    new CylinderGeometry(0.5, 0.5, 1, 10, 1, true).translate(0, 0.5, 0),
    new MeshBasicMaterial({
      color: 0xff2a1a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
    })
  );
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  mesh.scale.set(0, 0, 0);
  return mesh;
}

/* ------------------------------------------------------------------ */
/* Scratch                                                             */
/* ------------------------------------------------------------------ */

const scratch = new Vector3();
const scratch2 = new Vector3();
const nrm = new Vector3();
const up = new Vector3();
const fwd = new Vector3();
const right = new Vector3();
const eyeW = new Vector3();
const ground = new Vector3();
const t1 = new Vector3();
const t2 = new Vector3();
const basis = new Matrix4();
const Y = new Vector3(0, 1, 0);

const SPLASH: readonly [number, number, number] = [0.8, 0.95, 1];
const SPLASH_END: readonly [number, number, number] = [0.35, 0.65, 0.9];
const DUST: readonly [number, number, number] = [0.62, 0.55, 0.45];
const DUST_END: readonly [number, number, number] = [0.45, 0.4, 0.34];
const SPARK: readonly [number, number, number] = [1, 0.6, 0.25];
const SPARK_END: readonly [number, number, number] = [0.9, 0.15, 0.05];

const smooth = (t: number) => {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
};

/** Unit direction of a path point. */
function dirOf(p: { u: number; v: number }): Vector3 {
  const d = uvToDir(p.u, p.v);
  return new Vector3(d.x, d.y, d.z).normalize();
}

/**
 * The giant monster: rises out of the ground at the tap with a splash, roars,
 * stomps four times (each stomp a crater) and fires two bursts of eye lasers
 * that carve trenches ahead of it, then sinks back. About 7 s.
 *
 * Damage: each stomp is one `onImpact` (the store applies the monster's power
 * per call, so 4 stomps plus the 2 laser trenches hit 6 times; the laser hits
 * therefore add the same power as a stomp, which is accepted).
 */
export default function Monster({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const age = useRef(0);
  const done = useRef(false);
  const glow = useSharedParticles(true, 3);
  const smoke = useSharedParticles(false, 0);

  const scene = useMemo(() => {
    const tap = dirOf(effect);
    // Seen from straight above, a standing monster is a blob. So it leans
    // towards screen up (more the nearer the tap is to the middle of the
    // view), and of eight random walks we take the one running most nearly
    // across the screen, so the face and the lasers show in profile.
    const camUp = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const camDir = camera.position.clone().normalize();
    const upT = scratch
      .copy(camUp)
      .addScaledVector(tap, -camUp.dot(tap))
      .normalize();
    let best = monsterPath(effect.u, effect.v, 0);
    let bestScore = Infinity;
    const base = Math.floor(rand(0, 1e6));
    for (let k = 0; k < 8; k++) {
      const path = monsterPath(effect.u, effect.v, base + k);
      const a = dirOf(path[0]);
      const b = dirOf(path[3]);
      const heading = scratch2
        .copy(b)
        .addScaledVector(a, -b.dot(a))
        .normalize();
      const score = Math.abs(heading.dot(upT));
      if (score < bestScore) {
        bestScore = score;
        best = path;
      }
    }
    const dirs = best.map(dirOf);
    // A point past the end of the walk: always ahead, never on top of us.
    const far = dirs[3].clone().multiplyScalar(2).sub(dirs[0]).normalize();
    return { path: best, dirs, far, camUp, camDir, rig: buildMonster() };
  }, [effect, camera]);

  const beams = useMemo(() => [beamMesh(), beamMesh()], []);
  const ring = useMemo(() => new SurfaceRing(0xd8c8a8, 64, false, 1.006), []);
  const flash = useMemo(() => new FlashSprite(0xff5a40), []);
  useDispose(ring, flash);
  useEffect(
    () => () => {
      scene.rig.disposables.forEach((d) => d.dispose());
      for (const b of beams) {
        b.geometry.dispose();
        (b.material as MeshBasicMaterial).dispose();
      }
    },
    [scene, beams]
  );

  const live = useLatest({ rig: scene.rig, beams });
  const state = useRef({
    stomped: 0,
    stompAt: -10,
    ringAt: -10,
    ringDir: new Vector3(),
    risen: false,
    roared: false,
    sunk: false,
    blast: -1,
    muted: false,
    sparkAt: 0,
    splashed: false,
    // Where the current laser blast started and which way it sweeps.
    sweepFrom: new Vector3(),
    sweepDir: new Vector3(),
  });

  /** Lays the monster on the sphere at `pos`, facing along the walk. */
  function place(pos: Vector3, lift: number) {
    const { root } = scene.rig;
    nrm.copy(pos).normalize();
    // The monster's own up: the surface normal, leaning towards screen up.
    const lean = Math.max(0, scene.camDir.dot(nrm)) * 0.7;
    up.copy(scene.camUp).addScaledVector(nrm, -scene.camUp.dot(nrm));
    up.normalize().multiplyScalar(lean).add(nrm).normalize();
    fwd.copy(scene.far).addScaledVector(up, -scene.far.dot(up)).normalize();
    right.crossVectors(up, fwd);
    basis.makeBasis(right, up, fwd);
    root.quaternion.setFromRotationMatrix(basis);
    const h = HEIGHT * planetRadius;
    root.scale.setScalar(h);
    root.position
      .copy(nrm)
      .multiplyScalar(planetRadius * 0.998)
      .addScaledVector(up, lift * h);
  }

  function dustRing(dir: Vector3, now: number) {
    state.current.ringAt = now;
    state.current.ringDir.copy(dir);
  }

  function puff(dir: Vector3, count: number, big = 1) {
    tangentBasisInto(dir, t1, t2);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(0.02, 0.06) * planetRadius;
      scratch
        .copy(dir)
        .multiplyScalar(planetRadius * 1.004)
        .addScaledVector(t1, Math.cos(a) * r)
        .addScaledVector(t2, Math.sin(a) * r);
      smoke.emit({
        x: scratch.x,
        y: scratch.y,
        z: scratch.z,
        vx: (t1.x * Math.cos(a) + t2.x * Math.sin(a)) * 0.2 + dir.x * 0.1,
        vy: (t1.y * Math.cos(a) + t2.y * Math.sin(a)) * 0.2 + dir.y * 0.1,
        vz: (t1.z * Math.cos(a) + t2.z * Math.sin(a)) * 0.2 + dir.z * 0.1,
        life: rand(0.6, 1),
        size: 0.1 * big,
        endSize: 0.2 * big,
        color: DUST,
        endColor: DUST_END,
        alpha: 0.6,
        drag: 1.2,
      });
    }
  }

  function splash(dir: Vector3, count: number) {
    tangentBasisInto(dir, t1, t2);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const r = rand(0, 0.05) * planetRadius;
      scratch
        .copy(dir)
        .multiplyScalar(planetRadius * 1.004)
        .addScaledVector(t1, Math.cos(a) * r)
        .addScaledVector(t2, Math.sin(a) * r);
      const out = rand(0.1, 0.35);
      const up = rand(0.5, 1.3);
      glow.emit({
        x: scratch.x,
        y: scratch.y,
        z: scratch.z,
        vx: dir.x * up + (t1.x * Math.cos(a) + t2.x * Math.sin(a)) * out,
        vy: dir.y * up + (t1.y * Math.cos(a) + t2.y * Math.sin(a)) * out,
        vz: dir.z * up + (t1.z * Math.cos(a) + t2.z * Math.sin(a)) * out,
        life: rand(0.7, 1.3),
        size: rand(0.03, 0.06),
        endSize: 0.012,
        color: SPLASH,
        endColor: SPLASH_END,
        alpha: 0.85,
        pull: 3,
      });
    }
  }

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    age.current += dt;
    const now = age.current;
    const s = state.current;
    const { root, rig, head, eyes, legL, legR } = live.current.rig;
    const beams = live.current.beams;
    const playing = useGameStore.getState().phase === "playing";
    if (!playing) s.muted = true;
    const cue = (c: Parameters<typeof playCue>[0]) => {
      if (!s.muted) playCue(c);
    };

    // Where it stands: on the tap, stepping 1 s apart, then still.
    const walk = clamp01((now - STOMP_TIMES[0]) / (WALK_END - STOMP_TIMES[0]));
    const seg = Math.min(2, Math.floor(walk * 3));
    const frac = walk >= 1 ? 1 : walk * 3 - seg;
    const e = smooth(frac);
    const pos = scratch.copy(scene.dirs[seg]).lerp(scene.dirs[seg + 1], e);
    pos.normalize();
    const stepping = now >= STOMP_TIMES[0] && now < WALK_END;

    // Height: up out of the ground, down into it.
    let rise = 1;
    if (now < RISE_END) rise = easeOut(now / RISE_END);
    else if (now >= SINK_START)
      rise = 1 - smooth((now - SINK_START) / (SINK_END - SINK_START));
    const lift = -(1 - rise) * 1.08;
    place(pos, lift);

    // Squash on each stomp, a bob while walking, a wobble while rising.
    const sq = Math.exp(-(now - s.stompAt) * 7);
    const swing = stepping ? Math.sin(Math.PI * frac) : 0;
    rig.scale.set(1 + sq * 0.07, 1 - sq * 0.09, 1 + sq * 0.07);
    rig.position.set(0, swing * 0.035, 0);
    rig.rotation.set(
      stepping ? 0.06 : 0,
      0,
      (stepping ? (seg % 2 ? 1 : -1) * swing * 0.09 : 0) +
        (now < RISE_END ? Math.sin(now * 28) * 0.05 * (1 - rise) : 0)
    );
    // Legs alternate: one lifts and swings forward on each step.
    for (const [leg, mine] of [
      [legL, 0],
      [legR, 1],
    ] as const) {
      const active = stepping && seg % 2 === mine;
      leg.position.set(0, 0.24 + (active ? swing * 0.13 : 0), 0);
      leg.rotation.set(active ? -swing * 0.5 : 0, 0, 0);
    }

    // Head: back for the roar, a little nod on each stomp, forward to fire.
    const roar =
      now >= RISE_END && now < ROAR_END
        ? Math.sin(((now - RISE_END) / (ROAR_END - RISE_END)) * Math.PI)
        : 0;
    head.rotation.set(-0.75 * roar + sq * 0.12 + (swing > 0 ? 0.04 : 0), 0, 0);
    const firing = LASER_BLASTS.some(([a, b]) => now >= a && now < b);
    const eyeScale = 1 + roar * 0.45 + (firing ? 0.5 : 0);
    eyes.scale.set(1, eyeScale, eyeScale);

    if (!s.risen) {
      s.risen = true;
      splash(scene.dirs[0], 26);
      puff(scene.dirs[0], 8, 1.2);
      dustRing(scene.dirs[0], now);
      shake(0.012, 0.9);
    }
    if (!s.roared && now >= RISE_END) {
      s.roared = true;
      cue("monsterRoar");
      shake(0.01, 0.6);
    }
    // Footfalls.
    if (s.stomped < STOMP_TIMES.length && now >= STOMP_TIMES[s.stomped]) {
      const i = s.stomped++;
      s.stompAt = now;
      const d = scene.dirs[i];
      puff(d, 6);
      dustRing(d, now);
      shake(0.015, 0.35);
      if (!s.muted) cb.current.onImpact(scene.path[i].u, scene.path[i].v, d);
    }

    // Eye lasers.
    root.updateMatrixWorld(true);
    const blast = LASER_BLASTS.findIndex(([a, b]) => now >= a && now < b);
    if (blast >= 0 && blast !== s.blast) {
      s.blast = blast;
      cue("launch");
      shake(0.012, 0.5);
      // Ahead of the last stomp: 0.1 rad out, sweeping to 0.32, off to the
      // side a little so the two blasts carve two trenches.
      const side = blast === 0 ? -1 : 1;
      const end = scene.dirs[3];
      const ahead = fwd
        .copy(scene.far)
        .addScaledVector(end, -scene.far.dot(end))
        .normalize();
      tangentBasisInto(end, t1, t2);
      nrm.crossVectors(end, ahead).multiplyScalar(side * 0.05);
      const startDir = moveOnSphere(end, ahead, 0.1);
      const hit = new Vector3(startDir.p.x, startDir.p.y, startDir.p.z)
        .add(nrm)
        .normalize();
      const uv = dirToUv(hit);
      // Angle of the trench on the map: along the walk, east = 0.
      const sb = surfaceBasis(hit);
      const angle = Math.atan2(
        ahead.x * sb.north.x + ahead.y * sb.north.y + ahead.z * sb.north.z,
        ahead.x * sb.east.x + ahead.y * sb.east.y + ahead.z * sb.east.z
      );
      s.sweepFrom.copy(hit);
      s.sweepDir.copy(ahead);
      if (!s.muted) {
        cb.current.onImpact(uv.u, uv.v, hit, {
          stamp: "trench",
          length: 0.25,
          angle,
        });
      }
    }
    for (let i = 0; i < 2; i++) {
      const beam = beams[i];
      const [a, b] = LASER_BLASTS[Math.max(0, s.blast)];
      const on = blast >= 0 && now >= a && now < b && !s.muted;
      if (!on) {
        // Zero width hides it (no direct writes to hook values).
        beam.scale.set(0, 0, 0);
        continue;
      }
      const k = (now - a) / (b - a);
      // The point on the ground the beam is aiming at, sweeping outward.
      const travel = 0.1 + 0.22 * smooth(k);
      const at = moveOnSphere(
        { x: s.sweepFrom.x, y: s.sweepFrom.y, z: s.sweepFrom.z },
        { x: s.sweepDir.x, y: s.sweepDir.y, z: s.sweepDir.z },
        travel - 0.1
      ).p;
      ground
        .set(at.x, at.y, at.z)
        .normalize()
        .multiplyScalar(planetRadius * 1.004);
      eyeW.copy(EYE_LOCAL);
      eyeW.x *= i === 0 ? -1 : 1;
      head.localToWorld(eyeW);
      const len = Math.max(0.02, eyeW.distanceTo(ground));
      // Thin at both ends of the blast, so it flicks on and off.
      const env = Math.min(1, k * 12) * Math.min(1, (1 - k) * 8);
      const w = (0.03 + 0.012 * Math.sin(now * 55 + i)) * planetRadius * env;
      scratch2.subVectors(ground, eyeW).normalize();
      beam.position.copy(eyeW);
      beam.quaternion.setFromUnitVectors(Y, scratch2);
      beam.scale.set(w, len, w);
      if (i === 0) {
        flash.set(
          ground,
          0.34 * planetRadius,
          0.9 * (0.8 + 0.2 * Math.sin(now * 40))
        );
        if (now >= s.sparkAt) {
          s.sparkAt = now + 0.03;
          tangentBasisInto(scratch2.copy(ground).normalize(), t1, t2);
          for (let j = 0; j < 3; j++) {
            const a2 = rand(0, Math.PI * 2);
            glow.emit({
              x: ground.x,
              y: ground.y,
              z: ground.z,
              vx:
                (t1.x * Math.cos(a2) + t2.x * Math.sin(a2)) * 0.5 +
                scratch2.x * 0.7,
              vy:
                (t1.y * Math.cos(a2) + t2.y * Math.sin(a2)) * 0.5 +
                scratch2.y * 0.7,
              vz:
                (t1.z * Math.cos(a2) + t2.z * Math.sin(a2)) * 0.5 +
                scratch2.z * 0.7,
              life: rand(0.3, 0.7),
              size: rand(0.025, 0.05),
              endSize: 0.01,
              color: SPARK,
              endColor: SPARK_END,
              pull: 2,
            });
          }
        }
      }
    }
    if (!(blast >= 0 && !s.muted)) flash.set(scratch2.set(0, 0, 0), 0, 0);

    // Dust ring from the last footfall (or the rise or sink).
    const rk = (now - s.ringAt) / 0.7;
    if (rk >= 0 && rk < 1) {
      const r = (0.02 + 0.2 * easeOut(rk)) * 1;
      ring.set(
        s.ringDir,
        Math.max(0, r - 0.025 - 0.02 * rk),
        r,
        0.55 * (1 - rk)
      );
    } else {
      ring.set(s.ringDir, 0, 0, 0);
    }

    if (now >= SINK_START && !s.sunk) {
      s.sunk = true;
      puff(scene.dirs[3], 6);
      dustRing(scene.dirs[3], now);
      shake(0.01, 0.6);
    }
    if (s.sunk && now >= SINK_END - 0.1 && !s.splashed) {
      s.splashed = true;
      splash(scene.dirs[3], 16);
    }

    if (now > END && !done.current) {
      done.current = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <primitive object={scene.rig.root} />
      <primitive object={beams[0]} />
      <primitive object={beams[1]} />
      <primitive object={ring.mesh} />
      <primitive object={flash.sprite} />
    </>
  );
}
