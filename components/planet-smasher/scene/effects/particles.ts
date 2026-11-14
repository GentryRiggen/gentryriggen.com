"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DynamicDrawUsage,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Camera,
  type PerspectiveCamera,
  DoubleSide,
} from "three";
import { stepDt } from "@/lib/planet-smasher/fxClock";
import { prefersReducedMotion } from "@/components/game-audio/channels";

export { stepDt };

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const easeOut = (t: number) => 1 - (1 - clamp01(t)) ** 3;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);

/** Keeps the newest callbacks without re-subscribing frame loops. */
export function useLatest<T>(value: T): MutableRefObject<T> {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/* ------------------------------------------------------------------ */
/* Camera shake                                                        */
/* ------------------------------------------------------------------ */

let shakeState = { amount: 0, start: 0, duration: 0 };

function shakeAmplitude(now: number): number {
  const { amount, start, duration } = shakeState;
  const t = (now - start) / 1000;
  if (duration <= 0 || t >= duration) return 0;
  return amount * (1 - t / duration);
}

/** Shakes the camera by up to `amount` world units, fading over `seconds`. */
export function shake(amount: number, seconds: number): void {
  if (prefersReducedMotion()) return;
  const now = performance.now();
  if (amount < shakeAmplitude(now)) return;
  shakeState = { amount, start: now, duration: seconds };
}

/**
 * Applies the shake to the camera position after OrbitControls has updated
 * (it runs at priority -1) and removes it again before the next update, so
 * the controls never see the offset.
 */
export function ShakeDriver(): null {
  const offset = useMemo(() => new Vector3(), []);
  useFrame(({ camera }) => {
    camera.position.sub(offset);
    offset.set(0, 0, 0);
  }, -2);
  useFrame(({ camera }) => {
    const a = shakeAmplitude(performance.now());
    if (a <= 0) return;
    offset
      .set(rand(-1, 1) * a, rand(-1, 1) * a, 0)
      .applyQuaternion(camera.quaternion);
    camera.position.add(offset);
  });
  return null;
}

/* ------------------------------------------------------------------ */
/* Geometry helpers                                                    */
/* ------------------------------------------------------------------ */

export function toVec(p: { x: number; y: number; z: number }): Vector3 {
  return new Vector3(p.x, p.y, p.z).normalize();
}

/** Two unit vectors that span the tangent plane at `n`. */
export function tangentBasis(n: Vector3): { t1: Vector3; t2: Vector3 } {
  const ref = Math.abs(n.y) < 0.9 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0);
  const t1 = new Vector3().crossVectors(n, ref).normalize();
  const t2 = new Vector3().crossVectors(n, t1).normalize();
  return { t1, t2 };
}

/**
 * A direction toward the viewer's upper left (mostly sideways), so streaks
 * start off-screen and never pass through the planet on the way in.
 */
export function approachDir(camera: Camera, n: Vector3, side = -0.9): Vector3 {
  const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
  const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
  return n
    .clone()
    .multiplyScalar(0.5)
    .addScaledVector(up, 1)
    .addScaledVector(right, side)
    .normalize();
}

/** A lumpy rock: an icosahedron whose vertices are pushed in and out. */
export function lumpyRock(radius: number, seed = 1): BufferGeometry {
  const g = new IcosahedronGeometry(radius, 1);
  const pos = g.attributes.position as BufferAttribute;
  const cache = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const key = `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
    let k = cache.get(key);
    if (k === undefined) {
      const h =
        Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
      k = 0.78 + (h - Math.floor(h)) * 0.5;
      cache.set(key, k);
    }
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/* ------------------------------------------------------------------ */
/* Pooled particles: one Points object per effect                      */
/* ------------------------------------------------------------------ */

const PARTICLE_VERTEX = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
uniform float uScale;
varying vec3 vColor;
varying float vAlpha;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
  vColor = aColor;
  vAlpha = aAlpha;
}`;

const PARTICLE_FRAGMENT = `
varying vec3 vColor;
varying float vAlpha;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(clamp(1.0 - d, 0.0, 1.0), 1.4);
  gl_FragColor = vec4(vColor, vAlpha * a);
}`;

type Rgb = readonly [number, number, number];

export interface EmitSpec {
  x: number;
  y: number;
  z: number;
  vx?: number;
  vy?: number;
  vz?: number;
  life: number;
  size: number;
  endSize?: number;
  color: Rgb;
  endColor?: Rgb;
  /** Peak opacity, default 1. */
  alpha?: number;
  /** Fraction of speed lost per second. */
  drag?: number;
}

export class ParticleSystem {
  readonly points: Points;
  private geo = new BufferGeometry();
  private mat: ShaderMaterial;
  private pos: Float32Array;
  private vel: Float32Array;
  private col: Float32Array;
  private sizeAttr: Float32Array;
  private alphaAttr: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private s0: Float32Array;
  private s1: Float32Array;
  private c0: Float32Array;
  private c1: Float32Array;
  private peak: Float32Array;
  private drag: Float32Array;
  private next = 0;
  private attrs: BufferAttribute[];

  constructor(
    readonly capacity: number,
    additive = true,
    /** Acceleration toward the planet's centre. */
    private centerPull = 0
  ) {
    const n = capacity;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.col = new Float32Array(n * 3);
    this.sizeAttr = new Float32Array(n);
    this.alphaAttr = new Float32Array(n);
    this.age = new Float32Array(n);
    this.life = new Float32Array(n);
    this.s0 = new Float32Array(n);
    this.s1 = new Float32Array(n);
    this.c0 = new Float32Array(n * 3);
    this.c1 = new Float32Array(n * 3);
    this.peak = new Float32Array(n);
    this.drag = new Float32Array(n);
    const mk = (a: Float32Array, size: number) => {
      const attr = new BufferAttribute(a, size);
      attr.setUsage(DynamicDrawUsage);
      return attr;
    };
    this.attrs = [
      mk(this.pos, 3),
      mk(this.sizeAttr, 1),
      mk(this.alphaAttr, 1),
      mk(this.col, 3),
    ];
    this.geo.setAttribute("position", this.attrs[0]);
    this.geo.setAttribute("aSize", this.attrs[1]);
    this.geo.setAttribute("aAlpha", this.attrs[2]);
    this.geo.setAttribute("aColor", this.attrs[3]);
    this.mat = new ShaderMaterial({
      uniforms: { uScale: { value: 800 } },
      vertexShader: PARTICLE_VERTEX,
      fragmentShader: PARTICLE_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    });
    this.points = new Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
  }

  emit(s: EmitSpec): void {
    const i = this.next;
    this.next = (this.next + 1) % this.capacity;
    const v = i * 3;
    this.pos[v] = s.x;
    this.pos[v + 1] = s.y;
    this.pos[v + 2] = s.z;
    this.vel[v] = s.vx ?? 0;
    this.vel[v + 1] = s.vy ?? 0;
    this.vel[v + 2] = s.vz ?? 0;
    const end = s.endColor ?? s.color;
    for (let k = 0; k < 3; k++) {
      this.c0[v + k] = s.color[k];
      this.c1[v + k] = end[k];
      this.col[v + k] = s.color[k];
    }
    this.age[i] = 0;
    this.life[i] = Math.max(s.life, 0.01);
    this.s0[i] = s.size;
    this.s1[i] = s.endSize ?? s.size;
    this.peak[i] = s.alpha ?? 1;
    this.drag[i] = s.drag ?? 0;
    this.sizeAttr[i] = s.size;
    this.alphaAttr[i] = 0;
  }

  /** `scale` converts world size to pixels at 1 unit of distance. */
  update(dt: number, scale: number): void {
    this.mat.uniforms.uScale.value = scale;
    const { pos, vel, age, life } = this;
    for (let i = 0; i < this.capacity; i++) {
      if (life[i] <= 0) continue;
      age[i] += dt;
      const t = age[i] / life[i];
      if (t >= 1) {
        life[i] = 0;
        this.sizeAttr[i] = 0;
        this.alphaAttr[i] = 0;
        continue;
      }
      const v = i * 3;
      if (this.centerPull > 0) {
        const len = Math.hypot(pos[v], pos[v + 1], pos[v + 2]) || 1;
        const a = (this.centerPull * dt) / len;
        vel[v] -= pos[v] * a;
        vel[v + 1] -= pos[v + 1] * a;
        vel[v + 2] -= pos[v + 2] * a;
      }
      const keep = Math.max(0, 1 - this.drag[i] * dt);
      vel[v] *= keep;
      vel[v + 1] *= keep;
      vel[v + 2] *= keep;
      pos[v] += vel[v] * dt;
      pos[v + 1] += vel[v + 1] * dt;
      pos[v + 2] += vel[v + 2] * dt;
      for (let k = 0; k < 3; k++) {
        this.col[v + k] = lerp(this.c0[v + k], this.c1[v + k], t);
      }
      this.sizeAttr[i] = lerp(this.s0[i], this.s1[i], t);
      this.alphaAttr[i] = Math.min(1, t * 10) * (1 - t) * this.peak[i];
    }
    for (const a of this.attrs) a.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/** One pooled particle system per effect, updated every frame. */
export function useParticles(
  capacity: number,
  additive = true,
  centerPull = 0
): ParticleSystem {
  const sys = useMemo(
    () => new ParticleSystem(capacity, additive, centerPull),
    [capacity, additive, centerPull]
  );
  useEffect(() => () => sys.dispose(), [sys]);
  useFrame((state, dt) => {
    const cam = state.camera as PerspectiveCamera;
    const scale =
      (state.size.height * state.viewport.dpr * 0.5) /
      Math.tan((cam.fov * Math.PI) / 360);
    sys.update(stepDt(dt), scale);
  });
  return sys;
}

const tmp = new Vector3();

/** An outward burst of sparks and chunks from a surface point. */
export function debris(
  sys: ParticleSystem,
  p: Vector3,
  n: Vector3,
  count: number,
  speed = 1,
  size = 0.035
): void {
  for (let i = 0; i < count; i++) {
    tmp
      .set(rand(-1, 1), rand(-1, 1), rand(-1, 1))
      .multiplyScalar(0.9)
      .add(n)
      .normalize()
      .multiplyScalar(speed * rand(0.3, 1));
    sys.emit({
      x: p.x,
      y: p.y,
      z: p.z,
      vx: tmp.x,
      vy: tmp.y,
      vz: tmp.z,
      life: rand(0.6, 1.4),
      size: size * rand(0.5, 1.3),
      endSize: size * 0.2,
      color: [1, rand(0.65, 0.9), rand(0.3, 0.5)],
      endColor: [0.9, 0.2, 0.05],
      drag: 0.4,
    });
  }
}

/* ------------------------------------------------------------------ */
/* A ring or disc hugging the sphere                                   */
/* ------------------------------------------------------------------ */

/**
 * A band (or filled cap when `inner` is 0) at angular radius `inner..outer`
 * around a surface direction. Built on the sphere itself, so it never sinks
 * under the surface the way a flat ring would.
 */
export class SurfaceRing {
  readonly mesh: Mesh;
  private geo = new BufferGeometry();
  private mat: MeshBasicMaterial;
  private pos: Float32Array;
  private attr: BufferAttribute;

  constructor(
    color: number,
    private segs = 64,
    additive = true,
    private lift = 1.012
  ) {
    this.pos = new Float32Array((segs + 1) * 2 * 3);
    this.attr = new BufferAttribute(this.pos, 3);
    this.attr.setUsage(DynamicDrawUsage);
    this.geo.setAttribute("position", this.attr);
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geo.setIndex(idx);
    this.mat = new MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
      blending: additive ? AdditiveBlending : NormalBlending,
      toneMapped: false,
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    this.mesh.visible = false;
  }

  set(dir: Vector3, inner: number, outer: number, opacity: number): void {
    this.mesh.visible = opacity > 0.002 && outer > 0;
    this.mat.opacity = opacity;
    if (!this.mesh.visible) return;
    const { t1, t2 } = tangentBasis(dir);
    const pos = this.pos;
    for (let i = 0; i <= this.segs; i++) {
      const th = (i / this.segs) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      for (let k = 0; k < 2; k++) {
        const a = k === 0 ? inner : outer;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const o = (i * 2 + k) * 3;
        pos[o] = (dir.x * ca + (t1.x * c + t2.x * s) * sa) * this.lift;
        pos[o + 1] = (dir.y * ca + (t1.y * c + t2.y * s) * sa) * this.lift;
        pos[o + 2] = (dir.z * ca + (t1.z * c + t2.z * s) * sa) * this.lift;
      }
    }
    this.attr.needsUpdate = true;
  }

  setColor(hex: number): void {
    this.mat.color.setHex(hex);
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* A flash sprite                                                      */
/* ------------------------------------------------------------------ */

let glowTexture: CanvasTexture | null = null;

/** A shared white radial gradient (a few KB, kept for the page's life). */
function getGlowTexture(): CanvasTexture {
  if (glowTexture) return glowTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.7)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  glowTexture = new CanvasTexture(c);
  return glowTexture;
}

export class FlashSprite {
  readonly sprite: Sprite;
  private mat: SpriteMaterial;

  constructor(color = 0xffffff) {
    this.mat = new SpriteMaterial({
      map: getGlowTexture(),
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      // A flat quad would be cut by the planet's curve, so it ignores depth.
      depthTest: false,
      blending: AdditiveBlending,
      toneMapped: false,
    });
    this.sprite = new Sprite(this.mat);
    this.sprite.renderOrder = 4;
    this.sprite.visible = false;
  }

  set(pos: Vector3, size: number, opacity: number): void {
    this.sprite.visible = opacity > 0.002;
    this.mat.opacity = opacity;
    this.sprite.position.copy(pos);
    this.sprite.scale.set(size, size, 1);
  }

  dispose(): void {
    this.mat.dispose();
  }
}

/** Disposes imperative objects when the effect unmounts. */
export function useDispose(...items: { dispose(): void }[]): void {
  useEffect(
    () => () => items.forEach((i) => i.dispose()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    items
  );
}
