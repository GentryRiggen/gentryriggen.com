"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3, type Material, type Mesh } from "three";
import { useGameStore } from "@/lib/planet-smasher/store";
import {
  FlashSprite,
  clamp01,
  rand,
  shake,
  stepDt,
  useDispose,
  useLatest,
  useSharedParticles,
} from "../effects/particles";
import { chunkPivot } from "./chunks";
import { innerMaterial } from "./chunkWarmup";
import {
  BODY_RADIUS,
  collisionBody,
  collisionState,
  getBodyChunks,
  useBodyMaterial,
} from "./collisionBody";
import Shatter from "./Shatter";

interface CollidedProps {
  /** The planet's material: its chunks share it. */
  material: Material;
  onDone(): void;
}

const TOTAL = 3;
/** The incoming body's chunks fly for this long. */
const LIFE = 2.6;
const noop = () => {};
const ease = (t: number) => 1 - (1 - clamp01(t)) ** 2;

/**
 * Both worlds burst: the planet shatters (the Shatter ending, with no cracking
 * first) and the incoming body breaks into its own 12 chunks that carry on
 * the way it was heading. A giant flash and a hard shake sell the hit.
 */
export default function Collided({ material, onDone }: CollidedProps) {
  const cb = useLatest({ onDone });
  const bodyId = useMemo(
    () =>
      collisionState.id ??
      collisionBody(useGameStore.getState().progress.planetId),
    []
  );
  const bodyMaterial = useBodyMaterial(bodyId);
  const inner = useMemo(() => innerMaterial(false), []);
  const { seeds, set } = useMemo(() => getBodyChunks(), []);
  const meshes = useRef<(Mesh | null)[]>([]);
  const run = useRef({ age: 0, started: false, done: false });
  const flash = useMemo(() => new FlashSprite(0xffffff), []);
  const glow = useMemo(() => new FlashSprite(0xffb060), []);
  useDispose(flash, glow, inner);
  const sys = useSharedParticles(true, 0);
  const hitAt = useMemo(
    () => collisionState.dir.clone().multiplyScalar(1 + BODY_RADIUS),
    []
  );
  const surface = useMemo(
    () => collisionState.dir.clone().multiplyScalar(1),
    []
  );
  const motion = useMemo(() => {
    const away = collisionState.dir.clone().negate();
    return seeds.map((s) => {
      const dir = new Vector3(s.x, s.y, s.z)
        .multiplyScalar(0.8)
        .addScaledVector(away, 0.9)
        .normalize();
      const p = chunkPivot(s, BODY_RADIUS);
      return {
        dir,
        speed: rand(0.8, 1.6),
        axis: new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
        spin: rand(1.5, 5),
        pivot: new Vector3(p.x, p.y, p.z).add(hitAt),
      };
    });
  }, [seeds, hitAt]);
  const q = useMemo(() => new Quaternion(), []);
  const tmp = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const r = run.current;
    r.age += stepDt(rawDt);
    const age = r.age;
    if (!r.started) {
      r.started = true;
      shake(0.05, 1);
      for (let i = 0; i < 160; i++) {
        tmp
          .set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
          .normalize()
          .multiplyScalar(rand(0.8, 3));
        sys.emit({
          x: surface.x,
          y: surface.y,
          z: surface.z,
          vx: tmp.x,
          vy: tmp.y,
          vz: tmp.z,
          life: rand(0.7, 1.5),
          size: rand(0.03, 0.08),
          endSize: 0.01,
          color: [1, rand(0.75, 1), rand(0.45, 0.8)],
          endColor: [0.9, 0.25, 0.05],
          drag: 0.3,
        });
      }
    }
    const k = clamp01(age / LIFE);
    motion.forEach((m, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = k < 1;
      if (!mesh.visible) return;
      mesh.position
        .copy(m.pivot)
        .addScaledVector(m.dir, m.speed * LIFE * ease(k));
      mesh.quaternion.copy(q.setFromAxisAngle(m.axis, m.spin * age));
      mesh.scale.setScalar(1 - clamp01((k - 0.7) / 0.3));
    });
    // A giant white flash, and a warm glow that lingers.
    const f = clamp01(age / 0.7);
    flash.set(surface, 5 + 8 * ease(f), (1 - f) ** 2);
    glow.set(
      surface,
      7 + 4 * clamp01(age / 1.6),
      0.5 * (1 - clamp01(age / 1.6))
    );
    if (age >= TOTAL && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  }, -1);

  return (
    <>
      <Shatter collided material={material} onDone={noop} />
      {set.geometries.map((geo, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={geo}
          material={[bodyMaterial, inner]}
          visible={false}
        />
      ))}
      <primitive object={flash.sprite} />
      <primitive object={glow.sprite} />
    </>
  );
}
