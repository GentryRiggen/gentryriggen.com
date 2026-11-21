"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from "three";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { Opening } from "@/lib/shipwreck/ships/types";
import { sampleTrack } from "@/lib/shipwreck/sim/track";
import { shipToThree } from "./cameraMath";

/**
 * The torpedo's track: a line of white bubbles on the calm sea, running in
 * from out of frame on her starboard side, square to her course (U-20's
 * diary: "angle of intersection 90°", fired at about 700 m), to where it
 * struck. The torpedo itself (3 m down) is not shown, nor the U-boat. The
 * bubbles surface a moment behind the torpedo, so the white head is still
 * running in for a second or two after the hit; then the track spreads and
 * fades over two minutes, left behind as she steams on. One draw call.
 */

/** About 35 knots, and the range it was fired at (m). */
export const TORPEDO_MPS = 18;
export const TORPEDO_RANGE_M = 700;
/** Seconds from the torpedo passing to its bubbles breaking the surface. */
export const BUBBLE_LAG_S = 1.6;
/** Seconds the track stays on the sea. */
const TRACK_LIFE_S = 150;

/** The torpedo's own hole (the first opening at the first moment). */
export function torpedoHole(openings: readonly Opening[]): Opening | null {
  let best: Opening | null = null;
  for (const o of openings)
    if (o.side === "starboard" && (o.t ?? 0) === 0) {
      best = o;
      break;
    }
  return best;
}

const vertex = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec2 vUv;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mvPosition = viewMatrix * world;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;
const fragment = /* glsl */ `
  #include <fog_pars_fragment>
  varying vec2 vUv;
  varying vec3 vWorld;
  uniform float uT;
  uniform float uLength;
  uniform float uHalfWidth;
  uniform float uSpeed;
  uniform float uLag;
  uniform float uLife;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  void main() {
    // s: metres out from the hull along the track; across: from its line.
    float s = vUv.y * uLength;
    float across = (vUv.x - 0.5) * 2.0 * uHalfWidth;
    // When the bubbles here broke the surface.
    float age = uT + s / uSpeed - uLag;
    if (age < 0.0) discard;
    float w = 0.9 + age * 0.07;
    float churn = noise(vWorld.xz * 0.9 + vec2(age * 0.3, 0.0)) * 0.6
      + noise(vWorld.xz * 3.1) * 0.4;
    float core = exp(-pow(across / w, 2.0));
    float fade = exp(-age / (uLife * 0.35)) * smoothstep(uLife, uLife * 0.6, age);
    // The fresh head is the brightest, a white boil.
    float head = smoothstep(4.0, 0.0, age);
    float a = core * fade * (0.45 + 0.55 * churn) * (0.75 + 0.6 * head);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.88, 0.93, 0.94), clamp(a, 0.0, 0.9));
    #include <fog_fragment>
  }
`;

interface TorpedoProps {
  store: PlaybackStore;
}

export default function Torpedo({ store }: TorpedoProps) {
  const track = useMemo(() => {
    // Along +y: from the hull (v = 0) out to the firing point (v = 1).
    const geo = new PlaneGeometry(1, 1, 1, 1);
    geo.translate(0, 0.5, 0);
    const mat = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uT: { value: 0 },
          uLength: { value: TORPEDO_RANGE_M },
          uHalfWidth: { value: 14 },
          uSpeed: { value: TORPEDO_MPS },
          uLag: { value: BUBBLE_LAG_S },
          uLife: { value: TRACK_LIFE_S },
        },
      ]),
    });
    const m = new Mesh(geo, mat);
    m.name = "torpedo-track";
    m.renderOrder = 2;
    m.visible = false;
    return { m, geo, mat };
  }, []);
  useEffect(
    () => () => {
      track.geo.dispose();
      track.mat.dispose();
    },
    [track]
  );

  useFrame(() => {
    const s = store.getState();
    const hole = torpedoHole(s.openings);
    const m = track.m;
    if (
      !s.track ||
      s.track.frames.length === 0 ||
      !hole ||
      s.t > TRACK_LIFE_S
    ) {
      m.visible = false;
      return;
    }
    // Where it struck, on the sea at the moment of the hit (it stays there
    // as she steams on).
    const pose = sampleTrack(s.track, 0).bodies[0];
    const hit = shipToThree(pose, [hole.x, -13.4, 9]);
    const out = shipToThree(pose, [hole.x, -14.4, 9]);
    const dx = out[0] - hit[0];
    const dz = out[2] - hit[2];
    const len = Math.hypot(dx, dz) || 1;
    m.position.set(hit[0], 0.06, hit[2]);
    // The plane's +y (in its own frame) lies along the track, flat on the sea.
    m.rotation.set(-Math.PI / 2, 0, Math.atan2(dx / len, dz / len) + Math.PI);
    m.scale.set(28, TORPEDO_RANGE_M, 1);
    track.mat.uniforms.uT.value = s.t;
    m.visible = true;
  }, -1.4);

  return <primitive object={track.m} />;
}
