"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  Color,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Group,
  type Mesh,
} from "three";
import {
  FlashSprite,
  clamp01,
  debris,
  easeOut,
  lerp,
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
import { useGameStore } from "@/lib/planet-smasher/store";
import { stopMothershipCharge } from "../../audio/sfx";

/** Seconds: the descent, the charge, the beam, the hover, the climb away. */
const DESCEND = 1.4;
const CHARGE = 2.0;
const BEAM = 0.6;
const FIRE_AT = DESCEND + CHARGE;
const RISE_AT = FIRE_AT + BEAM + 1.0;
const RISE = 1.5;
const END = RISE_AT + RISE;

const RADIUS = 0.9;
const HEIGHT = 2.4;
const OUTER_LIGHTS = 28;
const INNER_LIGHTS = 14;
const LIGHTS = OUTER_LIGHTS + INNER_LIGHTS;

const Y = new Vector3(0, 1, 0);
const scratch = new Vector3();
const scratch2 = new Vector3();
const t1 = new Vector3();
const t2 = new Vector3();
const m = new Matrix4();
const q = new Quaternion();
const lamp = new Color();
const COOL = new Color(0.1, 0.55, 1);
const HOT = new Color(0.9, 1, 1);

const BLUE: readonly [number, number, number] = [0.5, 0.9, 1];
const WHITE: readonly [number, number, number] = [1, 1, 1];

/**
 * The mothership: a huge opaque saucer that drops in from above, charges for
 * two seconds (its lights chase faster, a glow builds under it) and fires a
 * white-cyan beam that ends the planet. It hovers over the ending, then rises
 * away.
 */
export default function Mothership({
  effect,
  planetRadius,
  onImpact,
  onDone,
}: EffectProps) {
  const cb = useLatest({ onImpact, onDone });
  const camera = useThree((s) => s.camera);
  const ship = useRef<Group>(null);
  const spinner = useRef<Group>(null);
  const cannon = useRef<Mesh>(null);
  const beam = useRef<Mesh>(null);
  const core = useRef<Mesh>(null);
  const run = useRef({
    age: 0,
    fired: false,
    done: false,
    sparks: 0,
    // The planet ended during the charge: no beam, no flash.
    muted: false,
  });
  // The whine ends with the ship (New planet, a planet switch).
  useEffect(() => stopMothershipCharge, []);

  const n = useMemo(() => toVec(effect.point), [effect.point]);
  const surface = useMemo(
    () => n.clone().multiplyScalar(planetRadius * 1.005),
    [n, planetRadius]
  );
  /** The ship's up: mostly screen up, so we see it nearly side-on. */
  const { home, up, axis } = useMemo(() => {
    const camUp = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    const side = camUp.clone().addScaledVector(n, -camUp.dot(n)).normalize();
    return {
      home: n
        .clone()
        .multiplyScalar(planetRadius * HEIGHT)
        .addScaledVector(side, 0.6),
      up: side,
      axis: n
        .clone()
        .multiplyScalar(-0.45)
        .addScaledVector(side, 0.85)
        .normalize(),
    };
  }, [camera, n, planetRadius]);
  const pos = useMemo(() => new Vector3(), []);
  const under = useMemo(() => new Vector3(), []);
  const glow = useMemo(() => new FlashSprite(0xbdf2ff), []);
  const flash = useMemo(() => new FlashSprite(0xeaffff), []);
  const sys = useSharedParticles(true, 0);
  useDispose(glow, flash);

  const parts = useMemo(() => {
    const geo = new SphereGeometry(1, 14, 10);
    const mat = new MeshBasicMaterial({ toneMapped: false });
    const mesh = new InstancedMesh(geo, mat, LIGHTS);
    mesh.frustumCulled = false;
    for (let i = 0; i < LIGHTS; i++) {
      const outer = i < OUTER_LIGHTS;
      const count = outer ? OUTER_LIGHTS : INNER_LIGHTS;
      const a = ((outer ? i : i - OUTER_LIGHTS) / count) * Math.PI * 2;
      const r = outer ? 0.74 : 0.42;
      const y = outer ? -0.1 : -0.16;
      const s = outer ? 0.022 : 0.018;
      mesh.setMatrixAt(
        i,
        m.compose(
          scratch.set(Math.cos(a) * r, y, Math.sin(a) * r),
          q.identity(),
          scratch2.set(s, s, s)
        )
      );
      mesh.setColorAt(i, lamp.setRGB(0, 0, 0));
    }
    return { lights: mesh };
  }, []);
  useEffect(
    () => () => {
      parts.lights.geometry.dispose();
      (parts.lights.material as MeshBasicMaterial).dispose();
      parts.lights.dispose();
    },
    [parts]
  );

  useFrame((_, rawDt) => {
    const r = run.current;
    if (r.done) return;
    const dt = stepDt(rawDt);
    r.age += dt;
    const now = r.age;
    const charge = clamp01((now - DESCEND) / CHARGE);

    // Position: down from above, a slow sway, then away again.
    const land = easeOut(now / DESCEND);
    const climb = clamp01((now - RISE_AT) / RISE);
    pos
      .copy(home)
      .addScaledVector(up, (1 - land) * 5 + climb * climb * climb * 6)
      .addScaledVector(n, Math.sin(now * 1.3) * 0.02);
    const g = ship.current;
    if (g) {
      g.visible = climb < 1;
      g.position.copy(pos);
      g.quaternion.setFromUnitVectors(Y, axis);
      g.rotateX(Math.sin(now * 0.9) * 0.04 + (1 - land) * 0.25);
      g.rotateZ(Math.cos(now * 0.7) * 0.03);
      g.scale.setScalar(1 + charge * 0.0);
    }
    if (spinner.current) spinner.current.rotation.y = now * 0.3;

    // Where the beam leaves: the middle of the underside.
    under.copy(pos).addScaledVector(axis, -0.19);

    // The lights chase around the rim, faster and brighter as it charges.
    const speed = 2.5 + 16 * charge * charge;
    const glowK = 0.25 + 0.75 * charge;
    for (let i = 0; i < LIGHTS; i++) {
      const outer = i < OUTER_LIGHTS;
      const count = outer ? OUTER_LIGHTS : INNER_LIGHTS;
      const a = ((outer ? i : i - OUTER_LIGHTS) / count) * Math.PI * 2;
      const wave = Math.max(
        0,
        Math.sin((outer ? 1 : -1) * (a * 3 - now * speed))
      );
      const k = 0.15 + 0.85 * wave * wave * wave;
      lamp
        .copy(COOL)
        .lerp(HOT, charge * k)
        .multiplyScalar(k * (0.6 + glowK));
      parts.lights.setColorAt(i, lamp);
    }
    const lampColors = parts.lights.instanceColor;
    // eslint-disable-next-line react-hooks/immutability -- GPU buffer flag
    if (lampColors) lampColors.needsUpdate = true;

    // The cannon and the glow building at the centre of the underside.
    const c = cannon.current;
    if (c) {
      c.position.copy(under);
      const s = 0.07 + 0.16 * charge;
      c.scale.set(s, s * 0.4, s);
      c.quaternion.setFromUnitVectors(Y, axis);
      (c.material as MeshBasicMaterial).color
        .copy(COOL)
        .lerp(HOT, charge)
        .multiplyScalar(0.7 + charge);
    }
    const beaming = !r.muted && now >= FIRE_AT && now < FIRE_AT + BEAM;
    const glowSize = 0.25 + 1.7 * charge * charge;
    const glowOpacity = now < DESCEND ? 0 : 0.15 + 0.8 * charge;
    glow.set(
      under,
      glowSize * (1 + (beaming ? 0.4 : 0)),
      climb > 0.9 ? 0 : glowOpacity * (beaming ? 1 : 1 - climb)
    );

    // Sparks stream in toward the cannon while it charges.
    if (now >= DESCEND && now < FIRE_AT) {
      shake(0.004 * charge, 0.15);
      r.sparks += dt * (30 + 90 * charge);
      while (r.sparks >= 1) {
        r.sparks -= 1;
        tangentBasisInto(axis, t1, t2);
        const a = rand(0, Math.PI * 2);
        const d = rand(0.5, 0.95);
        scratch
          .copy(under)
          .addScaledVector(t1, Math.cos(a) * d)
          .addScaledVector(t2, Math.sin(a) * d)
          .addScaledVector(axis, -rand(0.05, 0.4));
        scratch2.copy(under).sub(scratch);
        const life = rand(0.35, 0.6);
        sys.emit({
          x: scratch.x,
          y: scratch.y,
          z: scratch.z,
          vx: scratch2.x / life,
          vy: scratch2.y / life,
          vz: scratch2.z / life,
          life,
          size: rand(0.02, 0.04),
          endSize: 0.006,
          color: BLUE,
          endColor: WHITE,
        });
      }
    }

    // The shot: a thick white-cyan beam, a huge flash, the finisher.
    if (now >= FIRE_AT && !r.fired) {
      r.fired = true;
      if (useGameStore.getState().phase !== "playing") {
        // Something else ended the planet while this ship charged.
        r.muted = true;
        stopMothershipCharge();
      } else {
        shake(0.04, 1);
        debris(sys, surface, n, 160, 2.4, 0.06);
        cb.current.onImpact(effect.u, effect.v, effect.point);
      }
    }
    const bk = clamp01((now - FIRE_AT) / BEAM);
    const env =
      beaming && !r.muted
        ? Math.min(1, bk * 10) * Math.min(1, (1 - bk) * 4)
        : 0;
    const flick = 0.85 + 0.15 * Math.sin(now * 60);
    const length = under.distanceTo(surface);
    for (const [mesh, w, a] of [
      [beam.current, 1, 0.55],
      [core.current, 1, 0.95],
    ] as const) {
      if (!mesh) continue;
      mesh.visible = env > 0.01;
      if (!mesh.visible) continue;
      mesh.position.copy(under).add(surface).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(
        Y,
        scratch.copy(under).sub(surface).normalize()
      );
      const wd = w * (0.8 + 0.4 * env) * flick;
      mesh.scale.set(wd, length, wd);
      (mesh.material as MeshBasicMaterial).opacity = a * env;
    }
    if (now >= FIRE_AT && !r.muted) {
      const f = clamp01((now - FIRE_AT) / 0.9);
      flash.set(
        scratch.copy(surface).multiplyScalar(1.03),
        lerp(2.5, 7, easeOut(f)),
        (1 - f) * (1 - f)
      );
    }
    if (now >= END) {
      r.done = true;
      cb.current.onDone();
    }
  });

  return (
    <>
      <group ref={ship}>
        <group ref={spinner}>
          {/* Hull: a flattened disc with a dome and a glowing rim. */}
          <mesh scale={[RADIUS, 0.17, RADIUS]}>
            <sphereGeometry args={[1, 48, 20]} />
            <meshStandardMaterial
              color="#8f9bb0"
              metalness={0.5}
              roughness={0.4}
              emissive="#2a3550"
              emissiveIntensity={0.9}
            />
          </mesh>
          <mesh position={[0, 0.07, 0]} scale={[0.42, 0.26, 0.42]}>
            <sphereGeometry
              args={[1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial
              color="#7fe9ff"
              metalness={0.2}
              roughness={0.15}
              emissive="#2fb4e6"
              emissiveIntensity={0.9}
            />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[RADIUS * 0.985, 0.028, 8, 64]} />
            <meshBasicMaterial color="#6fd6ff" toneMapped={false} />
          </mesh>
          <primitive object={parts.lights} />
        </group>
      </group>
      <mesh ref={cannon}>
        <cylinderGeometry args={[1, 0.6, 1, 20]} />
        <meshBasicMaterial color="#6fd6ff" toneMapped={false} />
      </mesh>
      <mesh ref={beam} visible={false}>
        <cylinderGeometry args={[0.1, 0.24, 1, 20, 1, true]} />
        <meshBasicMaterial
          color="#7be8ff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={core} visible={false}>
        <cylinderGeometry args={[0.05, 0.11, 1, 16, 1, true]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <primitive object={glow.sprite} />
      <primitive object={flash.sprite} />
    </>
  );
}
