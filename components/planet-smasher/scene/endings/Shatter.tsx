"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferGeometry,
  Float32BufferAttribute,
  LineBasicMaterial,
  LineSegments,
  Quaternion,
  Vector3,
  type Material,
  type Mesh,
} from "three";
import {
  FlashSprite,
  SurfaceRing,
  clamp01,
  rand,
  shake,
  stepDt,
  useDispose,
  useLatest,
  useParticles,
} from "../effects/particles";
import { chunkPivot, getChunkSet } from "./chunks";
import { innerMaterial } from "./chunkWarmup";
import { planetFx } from "./planetFx";

interface ShatterProps {
  /** Frost the planet first, then shatter into icy chunks. */
  frozen?: boolean;
  /** The planet's material: the chunks share it. */
  material: Material;
  onDone(): void;
}

const TOTAL = 2.5;

interface Beat {
  /** Seconds the frost takes (frozen only). */
  freeze: number;
  /** When the cracks start to glow. */
  cracks: number;
  /** When the planet bursts apart. */
  burst: number;
}
const BEATS: Record<"shatter" | "frozen", Beat> = {
  shatter: { freeze: 0, cracks: 0, burst: 0.7 },
  frozen: { freeze: 1, cracks: 1, burst: 1.4 },
};

/** Shows the crack lines at `opacity` (hidden at 0). */
function showSeams(lines: LineSegments, opacity: number) {
  lines.visible = opacity > 0;
  (lines.material as LineBasicMaterial).opacity = opacity;
}

const ease = (t: number) => 1 - (1 - clamp01(t)) ** 2;

/**
 * The planet cracks (glowing seams), then 24 pre-cut chunks fly outward with
 * spin and shrink away, with a flash, debris and a shockwave ring.
 */
export default function Shatter({
  frozen = false,
  material,
  onDone,
}: ShatterProps) {
  const beat = BEATS[frozen ? "frozen" : "shatter"];
  const cb = useLatest({ onDone });
  const camera = useThree((s) => s.camera);
  const { seeds, set } = useMemo(() => getChunkSet(), []);
  const run = useRef({ age: 0, burst: false, done: false });
  const meshes = useRef<(Mesh | null)[]>([]);

  const inner = useMemo(() => innerMaterial(frozen), [frozen]);
  const motion = useMemo(
    () =>
      seeds.map((s) => ({
        dir: new Vector3(s.x, s.y, s.z),
        speed: rand(0.6, 1.4),
        axis: new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(),
        spin: rand(1, 4),
        pivot: new Vector3(
          chunkPivot(s, 1).x,
          chunkPivot(s, 1).y,
          chunkPivot(s, 1).z
        ),
      })),
    [seeds]
  );
  const seamLines = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(set.seams, 3));
    const m = new LineBasicMaterial({
      color: frozen ? 0xbfe8ff : 0xffa030,
      transparent: true,
      opacity: 0,
      toneMapped: false,
    });
    const l = new LineSegments(g, m);
    l.scale.setScalar(1.02);
    l.visible = false;
    l.frustumCulled = false;
    return l;
  }, [set, frozen]);
  const flash = useMemo(
    () => new FlashSprite(frozen ? 0xbfe8ff : 0xffe0b0),
    [frozen]
  );
  const ring = useMemo(
    () => new SurfaceRing(frozen ? 0xbfe8ff : 0xffc080, 64, true, 1),
    [frozen]
  );
  useDispose(
    inner,
    flash,
    ring,
    seamLines.geometry,
    seamLines.material as Material
  );
  const sys = useParticles(320);
  const zero = useMemo(() => new Vector3(), []);
  const q = useMemo(() => new Quaternion(), []);
  const toCam = useMemo(() => new Vector3(), []);

  useFrame((_, rawDt) => {
    const r = run.current;
    const dt = stepDt(rawDt);
    r.age += dt;
    const age = r.age;
    if (frozen) planetFx.frozen = ease(age / beat.freeze);

    if (age < beat.burst) {
      const p = clamp01((age - beat.cracks) / (beat.burst - beat.cracks));
      // Frozen planets crack in ice-blue lines only (the pulse is orange).
      planetFx.pulse = frozen ? 0 : p * (0.75 + 0.25 * Math.sin(age * 28));
      showSeams(seamLines, p);
      if (p > 0) shake(0.004 + 0.012 * p, 0.12);
    } else if (!r.burst) {
      r.burst = true;
      planetFx.pulse = 0;
      planetFx.hidden = true;
      showSeams(seamLines, 0);
      shake(0.045, 0.9);
      for (let i = 0; i < 300; i++) {
        zero
          .set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
          .normalize()
          .multiplyScalar(rand(0.8, 2.6));
        sys.emit({
          x: 0,
          y: 0,
          z: 0,
          vx: zero.x,
          vy: zero.y,
          vz: zero.z,
          life: rand(0.9, 1.8),
          size: rand(0.02, 0.05),
          endSize: 0.008,
          color: frozen ? [0.8, 0.95, 1] : [1, rand(0.6, 0.9), rand(0.3, 0.5)],
          endColor: frozen ? [0.4, 0.7, 1] : [0.9, 0.2, 0.05],
          drag: 0.3,
        });
      }
    }

    const t = Math.max(0, age - beat.burst);
    const life = TOTAL - beat.burst;
    const k = clamp01(t / life);
    motion.forEach((m, i) => {
      const mesh = meshes.current[i];
      if (!mesh) return;
      mesh.visible = r.burst && k < 1;
      if (!mesh.visible) return;
      const dist = m.speed * life * ease(k);
      mesh.position.copy(m.pivot).addScaledVector(m.dir, dist);
      mesh.quaternion.copy(q.setFromAxisAngle(m.axis, m.spin * t));
      mesh.scale.setScalar(1 - clamp01((k - 0.7) / 0.3));
    });

    if (r.burst) {
      flash.set(zero, 5.5, 1 - clamp01(t / 0.5));
      toCam.copy(camera.position).normalize();
      const w = Math.PI / 2;
      ring.set(toCam, w - 0.06, w, 0.9 * (1 - clamp01(t / 0.9)));
      ring.mesh.scale.setScalar(1 + t * 4);
    }

    if (age >= TOTAL && !r.done) {
      r.done = true;
      cb.current.onDone();
    }
  }, -1);

  return (
    <>
      <primitive object={seamLines} />
      {set.geometries.map((geo, i) => (
        <mesh
          key={i}
          ref={(m) => {
            meshes.current[i] = m;
          }}
          geometry={geo}
          material={[material, inner]}
          visible={false}
        />
      ))}
      <primitive object={flash.sprite} />
      <primitive object={ring.mesh} />
      <primitive object={sys.points} />
    </>
  );
}
