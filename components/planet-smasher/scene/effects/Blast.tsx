"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Color,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import {
  FlashSprite,
  stepDt,
  SurfaceRing,
  clamp01,
  debris,
  easeOut,
  lerp,
  rand,
  shake,
  toVec,
  useDispose,
  useLatest,
  useSharedParticles,
} from "./particles";
import type { EffectProps } from "./effectQueue";

const C0: readonly [number, number, number] = [1, 0.95, 0.85];
const C1: readonly [number, number, number] = [1, 0.4, 0.1];
const C2: readonly [number, number, number] = [1, 0.5, 0.2];
const C3: readonly [number, number, number] = [0.6, 0.1, 0.05];
const C4: readonly [number, number, number] = [1, 0.85, 0.4];
const C5: readonly [number, number, number] = [0.6, 0.1, 0.02];
const C6: readonly [number, number, number] = [1, 0.55, 0.15];
const C7: readonly [number, number, number] = [0.5, 0.1, 0.02];

interface Spec {
  fall: number;
  flash: number;
  ring: number;
  fire: number;
  debris: number;
  shake: number;
  end: number;
}

const SPECS: Record<"megaBomb" | "nuke", Spec> = {
  megaBomb: {
    fall: 0.5,
    flash: 1.0,
    ring: 0.28,
    fire: 45,
    debris: 45,
    shake: 0.012,
    end: 1.9,
  },
  nuke: {
    fall: 0.7,
    flash: 2.0,
    ring: 0.45,
    fire: 110,
    debris: 90,
    shake: 0.02,
    end: 3.2,
  },
};

const MUSHROOM_SECONDS = 2;
const ORANGE = new Color("#ff8a2a");
const GREY = new Color("#34343a");
const Y = new Vector3(0, 1, 0);
const tmpV = new Vector3();

export interface WarheadProps {
  /** The unit direction it lands on. Keep it stable between renders. */
  n: Vector3;
  planetRadius: number;
  kind: "megaBomb" | "nuke";
  /** Seconds to wait before it starts falling. */
  delay?: number;
  /** Sizes the flash, fireball, ring and mushroom (1 = a full nuke). */
  scale?: number;
  /** How far it starts to the right of straight above, in world units. */
  side?: number;
  /** Replaces the spec's camera shake at impact. */
  shakeAmount?: number;
  onImpact(): void;
  onDone(): void;
}

/** One falling warhead: the flash, fireball, ring and (nuke) mushroom. */
export function Warhead({
  n,
  planetRadius,
  kind,
  delay = 0,
  scale = 1,
  side = 0,
  shakeAmount,
  onImpact,
  onDone,
}: WarheadProps) {
  const spec = SPECS[kind];
  const nuke = kind === "nuke";
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const run = useRef({ age: -delay, hit: false, done: false });
  const mush = useRef<Group>(null);
  const stem = useRef<Mesh>(null);
  const cap = useRef<Mesh>(null);
  const mats = useRef<(MeshStandardMaterial | null)[]>([]);

  const target = useMemo(
    () => n.clone().multiplyScalar(planetRadius),
    [n, planetRadius]
  );
  const start = useMemo(() => {
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    return target
      .clone()
      .addScaledVector(up, 3)
      .addScaledVector(right, side)
      .addScaledVector(n, 1.2);
  }, [camera, n, target, side]);
  const quat = useMemo(() => new Quaternion().setFromUnitVectors(Y, n), [n]);
  const ring = useMemo(
    () => new SurfaceRing(nuke ? 0xffe0a0 : 0xffc890),
    [nuke]
  );
  const flash = useMemo(() => new FlashSprite(0xfff4dc), []);
  const sys = useSharedParticles(true, 0.5);
  useDispose(ring, flash);
  const pos = useMemo(() => new Vector3(), []);
  const lifted = useMemo(() => target.clone().multiplyScalar(1.03), [target]);

  useFrame((_, rawDt) => {
    const dt = stepDt(rawDt);
    const r = run.current;
    r.age += dt;
    if (r.age < 0) return;
    if (!r.hit) {
      const t = clamp01(r.age / spec.fall);
      pos.copy(start).lerp(target, t * t);
      sys.emit({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        life: 0.07,
        size: nuke ? 0.2 : 0.14,
        color: C0,
        endColor: C1,
      });
      sys.emit({
        x: pos.x,
        y: pos.y,
        z: pos.z,
        life: 0.35,
        size: 0.06,
        endSize: 0.01,
        color: C2,
        endColor: C3,
      });
      if (r.age >= spec.fall) {
        r.hit = true;
        r.age = spec.fall;
        debris(sys, target, n, spec.debris, nuke ? 1.8 : 1.3, 0.04);
        for (let i = 0; i < spec.fire; i++) {
          sys.emit({
            x: target.x + rand(-0.05, 0.05),
            y: target.y + rand(-0.05, 0.05),
            z: target.z + rand(-0.05, 0.05),
            vx: n.x * rand(0.1, 0.6) + rand(-0.25, 0.25),
            vy: n.y * rand(0.1, 0.6) + rand(-0.25, 0.25),
            vz: n.z * rand(0.1, 0.6) + rand(-0.25, 0.25),
            life: rand(0.7, 1.5),
            size: rand(0.12, 0.25) * (nuke ? 1.4 : 1) * scale,
            endSize: 0.45 * (nuke ? 1.4 : 1) * scale,
            color: C4,
            endColor: C5,
            alpha: 0.7,
            drag: 0.8,
          });
        }
        shake(shakeAmount ?? spec.shake, 0.5);
        cb.current.onImpact();
      }
    }
    if (r.hit) {
      const since = r.age - spec.fall;
      const f = clamp01(since / 0.45);
      flash.set(
        lifted,
        spec.flash * scale * (0.5 + 0.7 * easeOut(f)),
        1 - f * f
      );
      const k = clamp01(since / 0.9);
      ring.set(
        n,
        Math.max(0, easeOut(k) * spec.ring * scale - 0.04),
        easeOut(k) * spec.ring * scale,
        0.9 * (1 - k)
      );
      if (nuke && mush.current && stem.current && cap.current) {
        const m = clamp01(since / MUSHROOM_SECONDS);
        const h = 0.6 * easeOut(m);
        // Billowing fire around the cap while it rises.
        if (m < 0.75) {
          for (let i = 0; i < 2; i++) {
            const rr = (0.06 + 0.15 * easeOut(m)) * 0.9;
            const a = rand(0, Math.PI * 2);
            tmpV
              .set(
                Math.cos(a) * rr * scale,
                h * scale,
                Math.sin(a) * rr * scale
              )
              .applyQuaternion(quat);
            sys.emit({
              x: target.x + tmpV.x,
              y: target.y + tmpV.y,
              z: target.z + tmpV.z,
              vx: n.x * 0.08,
              vy: n.y * 0.08,
              vz: n.z * 0.08,
              life: 0.6,
              size: 0.14,
              endSize: 0.25,
              color: C6,
              endColor: C7,
              alpha: 0.55,
            });
          }
        }
        mush.current.visible = true;
        stem.current.position.y = h * 0.5;
        stem.current.scale.set(
          0.05 + 0.04 * m,
          Math.max(h * 0.5, 0.001),
          0.05 + 0.04 * m
        );
        cap.current.position.y = h;
        cap.current.scale.set(
          0.06 + 0.15 * easeOut(m),
          0.04 + 0.1 * easeOut(m),
          0.06 + 0.15 * easeOut(m)
        );
        for (const mat of mats.current) {
          if (!mat) continue;
          mat.color.copy(ORANGE).lerp(GREY, easeOut(m * 1.6));
          mat.emissive.copy(ORANGE).multiplyScalar((1 - m) ** 1.5 * 0.8);
          mat.opacity = lerp(0.85, 0, clamp01((m - 0.65) / 0.35));
        }
      }
      if (since > spec.end - spec.fall && !r.done) {
        r.done = true;
        cb.current.onDone();
      }
    }
  });

  return (
    <>
      <primitive object={ring.mesh} />
      <primitive object={flash.sprite} />
      {nuke && (
        <group
          ref={mush}
          position={target}
          quaternion={quat}
          scale={scale}
          visible={false}
        >
          <mesh ref={stem}>
            <sphereGeometry args={[1, 20, 14]} />
            <meshStandardMaterial
              ref={(m) => {
                mats.current[0] = m;
              }}
              color="#ff8a2a"
              emissive="#ff8a2a"
              roughness={1}
              transparent
              opacity={0.85}
            />
          </mesh>
          <mesh ref={cap}>
            <sphereGeometry args={[1, 24, 16]} />
            <meshStandardMaterial
              ref={(m) => {
                mats.current[1] = m;
              }}
              color="#ff8a2a"
              emissive="#ff8a2a"
              roughness={1}
              transparent
              opacity={0.85}
            />
          </mesh>
        </group>
      )}
    </>
  );
}

/** The mega bomb and the nuke: a falling dot, a big flash, a fireball. */
export default function Blast({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const n = useMemo(() => toVec(effect.point), [effect.point]);
  return (
    <Warhead
      n={n}
      planetRadius={planetRadius}
      kind={effect.toolId === "nuke" ? "nuke" : "megaBomb"}
      onImpact={() => onImpact(effect.u, effect.v, effect.point)}
      onDone={onDone}
    />
  );
}
