"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Color,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from "three";
import { seeded } from "@/lib/planet-smasher/rng";
import { useGameStore, type DebrisIntent } from "@/lib/planet-smasher/store";
import { stepDt, useLatest } from "./effects/particles";

const MAX_ROCKS = 60;
const RING_TILT = new Euler(0.45, 0, 0.25);
const ROCK = new Color(0x7a6a5a);
const ICE = new Color(0xa6d4ee);

interface Rock {
  radius: number;
  angle: number;
  speed: number;
  y: number;
  size: number;
  spin: Vector3;
  phase: Vector3;
}

/** Where the rocks start and how each one moves (all from the seed). */
export function makeRocks(count: number, seed: number): Rock[] {
  const rnd = seeded(seed);
  const n = Math.min(MAX_ROCKS, Math.max(0, count));
  const rocks: Rock[] = [];
  for (let i = 0; i < n; i++) {
    rocks.push({
      radius: 1.6 + rnd() * 0.7,
      angle: rnd() * Math.PI * 2,
      speed: 0.08 + rnd() * 0.22,
      y: (rnd() - 0.5) * 0.12,
      size: 0.018 + rnd() * 0.04,
      spin: new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(
        3
      ),
      phase: new Vector3(rnd() * 6, rnd() * 6, rnd() * 6),
    });
  }
  return rocks;
}

const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const pos = new Vector3();
const scl = new Vector3();
const tint = new Color();

/** Tells three.js the instance matrices changed this frame. */
function markDirty(im: InstancedMesh) {
  im.instanceMatrix.needsUpdate = true;
}

function Ring({ intent }: { intent: DebrisIntent }) {
  const rocks = useMemo(
    () => makeRocks(intent.count, intent.seed),
    [intent.count, intent.seed]
  );
  const geometry = useMemo(() => {
    // Jitter the corners so every rock is lumpy, not a perfect gem.
    const g = new IcosahedronGeometry(1, 0);
    const rnd = seeded(intent.seed ^ 0x9e3779b9);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.7 + rnd() * 0.5;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    return g;
  }, [intent.seed]);
  const material = useMemo(
    () => new MeshStandardMaterial({ flatShading: true, roughness: 0.95 }),
    []
  );
  const mesh = useMemo(() => {
    const im = new InstancedMesh(geometry, material, rocks.length);
    const base = intent.icy ? ICE : ROCK;
    rocks.forEach((r, i) => {
      im.setColorAt(i, tint.copy(base).multiplyScalar(0.75 + r.size * 6));
    });
    im.frustumCulled = false;
    im.rotation.copy(RING_TILT);
    return im;
  }, [geometry, material, rocks, intent.icy]);
  const time = useRef(0);
  const live = useLatest({ mesh, rocks });

  useEffect(
    () => () => {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
    [mesh, geometry, material]
  );

  useFrame((_, rawDt) => {
    time.current += stepDt(rawDt);
    const t = time.current;
    const { mesh: im, rocks: list } = live.current;
    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      const a = r.angle + r.speed * t;
      pos.set(Math.cos(a) * r.radius, r.y, Math.sin(a) * r.radius);
      e.set(
        r.phase.x + r.spin.x * t,
        r.phase.y + r.spin.y * t,
        r.phase.z + r.spin.z * t
      );
      q.setFromEuler(e);
      m.compose(pos, q, scl.setScalar(r.size));
      im.setMatrixAt(i, m);
    }
    markDirty(im);
  });

  return <primitive object={mesh} />;
}

/**
 * The rocks a shattered planet leaves: one tilted ring of up to 60 around the
 * next planet, until its own ending replaces (or clears) it.
 */
export default function DebrisRing() {
  const intent = useGameStore((s) => s.debris);
  const playing = useGameStore((s) => s.phase === "playing");
  if (!intent || !playing) return null;
  return <Ring key={intent.seed} intent={intent} />;
}
