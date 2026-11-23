"use client";
/* eslint-disable react-hooks/immutability -- three.js objects are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Group,
  Mesh,
  PlaneGeometry,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
} from "three";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import { getShip } from "@/lib/shipwreck/ships";
import type { Opening, ShipSpec } from "@/lib/shipwreck/ships/types";
import TrackPoses from "./torpedoPose";

/**
 * The torpedoes' tracks: a line of white bubbles on the calm sea for each
 * hit, running in from out of frame on the side it struck (the Lusitania's
 * starboard, the Carpathia's port), square to her course (U-20's diary:
 * "angle of intersection 90°", fired at about 700 m), to where it struck.
 * Each lands at its own time (`PlaybackState.torpedoes`): the Lusitania's
 * What-if hits a few seconds apart (`hitTimeS`, when the sim opens them),
 * the Carpathia's 8 s apart and her third at 10:50 AM, its wake running in
 * for the 40 s before it; each where her side was then. The
 * torpedo itself (3 m down) is not shown, nor the U-boat. The bubbles
 * surface a moment behind the torpedo, so the white head is still running
 * in for a second or two after the hit; then the track spreads and fades
 * over two minutes, left behind as she steams on. One draw call a hit.
 */

/** About 35 knots, and the range it was fired at (m). */
export const TORPEDO_MPS = 18;
export const TORPEDO_RANGE_M = 700;
/** Seconds from the torpedo passing to its bubbles breaking the surface. */
export const BUBBLE_LAG_S = 1.6;
/** Seconds the track stays on the sea. */
const TRACK_LIFE_S = 150;
/** Seconds before its hit that a track's far end first breaks the surface. */
export const RUN_IN_S = TORPEDO_RANGE_M / TORPEDO_MPS + BUBBLE_LAG_S;

/**
 * Whether a track struck at `at` (shown s) is on the sea at `t`: from its
 * far end first breaking the surface (`RUN_IN_S` before the hit) until it
 * has faded (`TRACK_LIFE_S` after).
 */
export function trackShows(at: number, t: number): boolean {
  return t >= at - RUN_IN_S && t - at <= TRACK_LIFE_S;
}

/**
 * Where a torpedo meets her side across her (ship-frame y, + to port): a
 * little outside her half-breadth, on its side (the Lusitania's 1.1 13.4 m
 * to starboard).
 */
export function trackSideY(
  spec: Pick<ShipSpec, "beam">,
  side: "port" | "starboard"
): number {
  const half = // The epsilon keeps a half-way beam from rounding the other way.
    Math.round((spec.beam / 2 + 0.05) * 10 + 1e-9) / 10;
  return side === "port" ? half : -half;
}

/** The torpedo's own hole (the first opening at the first moment). */
/**
 * Whether a ship's scene draws a torpedo's track: a torpedo ship only (a
 * mine has no run-in streak; its column is drawn by the day effects).
 */
export function hasTorpedoTrack(spec: Pick<ShipSpec, "cause">): boolean {
  return spec.cause === "torpedo";
}

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
    // A few metres of white froth, wider at the fresh head, spreading.
    float head = smoothstep(4.0, 0.0, age);
    float w = 3.0 + age * 0.12 + head * 2.5;
    float churn = noise(vWorld.xz * 0.9 + vec2(age * 0.3, 0.0)) * 0.6
      + noise(vWorld.xz * 3.1) * 0.4;
    float core = exp(-pow(across / w, 2.0));
    float fade = exp(-age / (uLife * 0.35)) * smoothstep(uLife, uLife * 0.6, age);
    // The fresh head is the brightest, a white boil.
    float a = core * fade * (0.45 + 0.55 * churn) * (0.75 + 0.6 * head);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vec3(0.88, 0.93, 0.94), clamp(a, 0.0, 0.9));
    #include <fog_fragment>
  }
`;

interface TorpedoProps {
  store: PlaybackStore;
}

type TrackMesh = Mesh<PlaneGeometry, ShaderMaterial>;

export default function Torpedo({ store }: TorpedoProps) {
  const rig = useMemo(() => {
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
    const group = new Group();
    group.name = "torpedo-tracks";
    // One mesh a hit, made as the hits need them (the first is the
    // 1.1 track), each with its own clock.
    const tracks: TrackMesh[] = [];
    const trackFor = (k: number): TrackMesh => {
      while (tracks.length <= k) {
        const m: TrackMesh = new Mesh(
          geo,
          tracks.length === 0 ? mat : mat.clone()
        );
        m.name =
          tracks.length === 0
            ? "torpedo-track"
            : `torpedo-track-${tracks.length}`;
        m.renderOrder = 2;
        m.visible = false;
        group.add(m);
        tracks.push(m);
      }
      return tracks[k];
    };
    return { geo, mat, group, tracks, trackFor, poses: new TrackPoses() };
  }, []);
  useEffect(
    () => () => {
      rig.geo.dispose();
      for (const m of rig.tracks) m.material.dispose();
      rig.mat.dispose();
    },
    [rig]
  );

  useFrame(() => {
    const s = store.getState();
    const torpedoes = s.torpedoes;
    const hole = torpedoes.length > 0 ? null : torpedoHole(s.openings);
    const n = torpedoes.length > 0 ? torpedoes.length : hole ? 1 : 0;
    const ready = s.track !== null && s.track.frames.length > 0;
    const spec = getShip(s.ship);
    // Where they struck, on the sea at the moment of each hit (they stay
    // there as she steams on).
    for (let k = 0; k < Math.max(n, rig.tracks.length); k += 1) {
      const m = k < n ? rig.trackFor(k) : rig.tracks[k];
      const hit = torpedoes.length > 0 ? torpedoes[k] : null;
      const at = hit ? hit.t : 0;
      if (!ready || k >= n || !trackShows(at, s.t)) {
        m.visible = false;
        continue;
      }
      const x = hit ? hit.x : hole!.x;
      const y = trackSideY(spec, hit ? hit.side : "starboard");
      const pose = rig.poses.poseOf(s.track!, k, at, x, y);
      m.position.set(pose.x, 0.06, pose.z);
      // The plane's +y (in its own frame) lies along the track, flat on the sea.
      m.rotation.set(-Math.PI / 2, 0, pose.rotZ);
      m.scale.set(28, TORPEDO_RANGE_M, 1);
      m.material.uniforms.uT.value = s.t - at;
      m.visible = true;
    }
  }, -1.4);

  return <primitive object={rig.group} />;
}
