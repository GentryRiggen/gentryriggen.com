"use client";
/* eslint-disable react-hooks/immutability -- the scene runtime and the walk input are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose, SimFrame } from "@/lib/shipwreck/sim/track";
import {
  floorZ,
  partFor,
  placeWalker,
  shipToEarth,
  stepSwimmer,
  stepWalker,
  swimmerFrom,
  walkInput,
  walkMapFor,
  WALK_PUSH_FROM_DEG,
  WALK_SLIDE_FROM_DEG,
  WALK_TURN_PER_PX,
  type HullPiece,
  type SwimmerState,
  type WalkerState,
} from "@/lib/shipwreck/walk";
import { shipToThreeInto, type V3 } from "./cameraMath";
import type { SceneRuntime } from "./runtime";
import {
  deckEyes,
  followShipPitch,
  WALK_PITCH_LIMIT,
  waterEyes,
} from "./walkCamera";

/**
 * Walking in the scene (priority −1.5: after the ship rig poses her, before
 * the camera). Each frame, while the camera is "walk": re-places the walker
 * when the store's `walk.seq` changes (start, seek, Back on deck), steps
 * the walker on her deck (real time, any playback speed) or the swimmer in
 * the sea, and writes the eyes to `runtime.walker` for CameraRig. Reads the
 * sim, never writes it. The keys (WASD / arrows) write `walkInput` while
 * walking; the on-screen joystick (Task 6) writes the same.
 */

/** The sea's surface for the walk rules: the sea quad is flat (y = 0). */
const FLAT_SEA = () => 0;
/** Look under follows her down while she is nearer than this (m). */
const LOOK_UNDER_SIGHT_M = 600;
/** How quickly Look under's tilt follows her (1/s). */
const FOLLOW_RATE = 2;
/** Paddling harder than this comes back up from Look under. */
const PADDLE_UP = 0.3;

interface WalkRunnerProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
}

export default function WalkRunner({ store, runtime, spec }: WalkRunnerProps) {
  const map = useMemo(() => walkMapFor(spec.id), [spec]);
  const walking = useStore(store, (s) => s.camera === "walk");
  useWalkKeys(walking);
  const st = useRef({
    seq: null as number | null,
    walker: null as WalkerState | null,
    swimmer: null as SwimmerState | null,
    pitch: 0,
  });
  const scratch = useMemo(
    () => ({
      hull: [] as HullPiece[],
      eye: [0, 0, 0] as V3,
      centre: [0, 0, 0] as V3,
      p: [0, 0, 0] as [number, number, number],
    }),
    []
  );
  const stemX = spec.stations[spec.stations.length - 1].x;
  const sternX = spec.stations[0].x;

  // Leaving walk forgets the walker; the next start places a fresh one.
  useEffect(() => {
    if (walking) return;
    const s = st.current;
    s.seq = null;
    s.walker = null;
    s.swimmer = null;
    s.pitch = 0;
    runtime.walker = null;
    runtime.walkLookUnder = false;
    runtime.walkSlide = 0;
    runtime.walkInfo = null;
  }, [walking, runtime]);
  useEffect(
    () => () => {
      runtime.walker = null;
      runtime.walkLookUnder = false;
      runtime.walkSlide = 0;
      runtime.walkInfo = null;
    },
    [runtime]
  );

  function poseOf(frame: SimFrame, part: string): BodyPose | undefined {
    return frame.bodies.find((b) => b.part === part);
  }

  /** The swimmer's obstacles: each piece of her, cut at the break. */
  function hullOf(frame: SimFrame, breakX: number | null): HullPiece[] {
    const hull = scratch.hull;
    hull.length = 0;
    for (const b of frame.bodies) {
      if (b.part === "bow" && breakX !== null)
        hull.push({ pose: b, spec, fromX: breakX });
      else if (b.part === "stern" && breakX !== null)
        hull.push({ pose: b, spec, toX: breakX });
      else hull.push({ pose: b, spec });
    }
    return hull;
  }

  /** Her nearest piece's middle (three.js), for Look under to follow. */
  function nearestCentre(
    frame: SimFrame,
    breakX: number | null,
    eye: V3
  ): V3 | null {
    let best: V3 | null = null;
    let bestD = Infinity;
    for (const b of frame.bodies) {
      const lo = b.part === "bow" && breakX !== null ? breakX : sternX;
      const hi = b.part === "stern" && breakX !== null ? breakX : stemX;
      scratch.p[0] = (lo + hi) / 2;
      scratch.p[1] = 0;
      scratch.p[2] = spec.depth / 2;
      const c: V3 = [0, 0, 0];
      shipToThreeInto(b, scratch.p, c);
      const d = Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (!best || bestD > LOOK_UNDER_SIGHT_M) return null;
    scratch.centre[0] = best[0];
    scratch.centre[1] = best[1];
    scratch.centre[2] = best[2];
    return scratch.centre;
  }

  useFrame((state, dt) => {
    const p = store.getState();
    const frame = runtime.frame;
    if (p.camera !== "walk" || p.walk.phase === "off" || !map || !frame) {
      if (p.camera !== "walk") runtime.walker = null;
      return;
    }
    const s = st.current;
    const breakX = p.track?.breakX ?? null;
    const broken = frame.bodies.some((b) => b.part !== "whole");

    // Start, seek or Back on deck: on the boat deck, or in the sea.
    if (p.walk.seq !== s.seq) {
      s.seq = p.walk.seq;
      s.pitch = 0;
      const w = placeWalker(map, spec, frame, breakX, FLAT_SEA);
      if (w) {
        s.walker = w;
        s.swimmer = null;
        if (p.walk.phase === "water") {
          store.getState().backOnDeck();
          s.seq = store.getState().walk.seq;
        }
      } else {
        // Nowhere to stand: float where the spawn is (pushed clear of her).
        const [x, y] = map.spawn.at;
        const pose =
          poseOf(frame, partFor(x, breakX, broken)) ?? frame.bodies[0];
        const e = shipToEarth(pose, [
          x,
          y,
          floorZ(map, map.spawn.area, x, spec),
        ]);
        s.walker = null;
        // Facing her nearest piece, so she is in view.
        let yaw = pose.yaw + map.spawn.yaw;
        let near = Infinity;
        for (const b of frame.bodies) {
          const d = Math.hypot(b.x - e[0], b.y - e[1]);
          if (d > 1 && d < near) {
            near = d;
            yaw = Math.atan2(b.y - e[1], b.x - e[0]);
          }
        }
        s.swimmer = { x: e[0], y: e[1], yaw };
        if (p.walk.phase !== "water") store.getState().wentInWater();
      }
    }

    // The look: drag up and down tilts (the drag left and right turns in
    // the step itself).
    s.pitch = Math.max(
      -WALK_PITCH_LIMIT,
      Math.min(WALK_PITCH_LIMIT, s.pitch - walkInput.lookDy * WALK_TURN_PER_PX)
    );
    walkInput.lookDy = 0;

    if (s.walker) {
      let w = s.walker;
      let pose = poseOf(frame, w.part);
      if (!pose) {
        // She broke (or a seek went back before it): the piece underfoot.
        w = { ...w, part: partFor(w.x, breakX, broken) };
        pose = poseOf(frame, w.part) ?? frame.bodies[0];
      }
      const r = stepWalker(
        w,
        walkInput,
        { map, spec, pose, breakX, seaZ: FLAT_SEA },
        dt
      );
      walkInput.lookDx = 0;
      if (r.inWater) {
        s.walker = null;
        s.swimmer = swimmerFrom(r.state, pose, spec, map);
        runtime.walkSplash += 1;
        store.getState().wentInWater();
      } else {
        s.walker = r.state;
        runtime.walker = deckEyes(r.state, pose, spec, map, s.pitch);
        runtime.walkLookUnder = false;
        runtime.walkSlide = r.state.sliding
          ? 1
          : Math.max(
              0,
              Math.min(
                1,
                (r.slopeDeg - WALK_PUSH_FROM_DEG) /
                  (WALK_SLIDE_FROM_DEG - WALK_PUSH_FROM_DEG)
              )
            );
        runtime.walkInfo = {
          phase: "deck",
          part: r.state.part,
          area: r.state.area,
          x: r.state.x,
          y: r.state.y,
          slopeDeg: r.slopeDeg,
          depthM: r.depthM,
        };
        return;
      }
    }

    const sw = s.swimmer;
    if (!sw) return;
    const lookUnder = store.getState().walk.lookUnder;
    if (
      lookUnder &&
      Math.hypot(walkInput.forward, walkInput.strafe) > PADDLE_UP
    )
      // Paddling comes back up.
      store.getState().setLookUnder(false);
    const next = stepSwimmer(sw, walkInput, dt, hullOf(frame, breakX));
    walkInput.lookDx = 0;
    s.swimmer = next;
    const under = store.getState().walk.lookUnder;
    if (under) {
      // Tilt down to keep her in frame while she is in sight.
      const eye = scratch.eye;
      eye[0] = next.x;
      eye[1] = -1;
      eye[2] = -next.y;
      const c = nearestCentre(frame, breakX, eye);
      if (c) {
        const want = followShipPitch(eye, c, -WALK_PITCH_LIMIT);
        s.pitch +=
          (want - s.pitch) * (1 - Math.exp(-Math.min(dt, 0.1) * FOLLOW_RATE));
      }
    }
    runtime.walker = waterEyes(next, state.clock.elapsedTime, s.pitch, under);
    runtime.walkLookUnder = under;
    runtime.walkSlide = 0;
    runtime.walkInfo = {
      phase: "water",
      part: null,
      area: null,
      x: next.x,
      y: next.y,
      slopeDeg: 0,
      depthM: 0,
    };
  }, -1.5);

  return null;
}

const KEYS: Record<string, [axis: "forward" | "strafe", dir: 1 | -1]> = {
  w: ["forward", 1],
  arrowup: ["forward", 1],
  s: ["forward", -1],
  arrowdown: ["forward", -1],
  d: ["strafe", 1],
  arrowright: ["strafe", 1],
  a: ["strafe", -1],
  arrowleft: ["strafe", -1],
};

/** WASD and the arrows walk while walking (they write `walkInput`). */
function useWalkKeys(walking: boolean) {
  useEffect(() => {
    if (!walking) return;
    const held = new Set<string>();
    const write = () => {
      let forward = 0;
      let strafe = 0;
      for (const k of held) {
        const [axis, dir] = KEYS[k];
        if (axis === "forward") forward += dir;
        else strafe += dir;
      }
      walkInput.forward = Math.max(-1, Math.min(1, forward));
      walkInput.strafe = Math.max(-1, Math.min(1, strafe));
    };
    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (!(k in KEYS)) return;
      const el = e.target as HTMLElement | null;
      if (el?.closest?.("input, textarea, [role=slider]")) return;
      e.preventDefault();
      if (held.has(k)) return;
      held.add(k);
      write();
    };
    const onUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!held.delete(k)) return;
      write();
    };
    const clear = () => {
      if (held.size === 0) return;
      held.clear();
      write();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", clear);
      clear();
    };
  }, [walking]);
}
