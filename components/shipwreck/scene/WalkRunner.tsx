"use client";
/* eslint-disable react-hooks/immutability -- the scene runtime and the walk input are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose, SimFrame } from "@/lib/shipwreck/sim/track";
import {
  doorArrow,
  doorExit,
  doorToEnter,
  interiorFor,
  roomWaterTargets,
  type DoorPlace,
  type Room,
} from "@/lib/shipwreck/interior";
import {
  areaById,
  canReboard,
  floorZ,
  partFor,
  placeWalker,
  resetWalkInput,
  shipToEarth,
  stepSwimmer,
  stepWalker,
  swimmerFrom,
  walkInput,
  walkMapFor,
  WALK_TURN_PER_PX,
  type HullPiece,
  type SwimmerState,
  type StepContext,
  type WalkerState,
} from "@/lib/shipwreck/walk";
import { shipToThreeInto, type V3 } from "./cameraMath";
import type { SceneRuntime, WalkInfo } from "./runtime";
import {
  deckEyes,
  easeEyes,
  EYE_EASE_S,
  FLOAT_EYE_M,
  followShipPitch,
  LOOK_UNDER_EYE_Y,
  newView,
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
 *
 * Inside her (1.15, a ship with rooms): the rooms' water is passed to the
 * walker (the level Interior shows, eased, or the room's target while it
 * is not drawn), deck doors open while she is whole, and the runner writes
 * `walkInside`, `walkRoom`, `walkCameInBy` and `walkLift` (and, on deck,
 * `walkDoor` and the way-in arrow's `walkArrow`). The door and Go
 * outside buttons (`walkInput.door`, `.outside`) and the test hooks'
 * `walkPlace` are taken here. Inside when she breaks, or washed out by
 * the water, is the same splash into the sea as going in from the deck.
 */

/** The sea's surface for the walk rules: the sea quad is flat (y = 0). */
const FLAT_SEA = () => 0;
/** No sim frame yet: every compartment dry. */
const NO_FILL: readonly number[] = [];
/** Look under follows her down while she is nearer than this (m). */
const LOOK_UNDER_SIGHT_M = 600;
/** How quickly Look under's tilt follows her (1/s). */
const FOLLOW_RATE = 2;
/** Paddling harder than this comes back up from Look under. */
const PADDLE_UP = 0.3;
/** Seconds between the checks whether Back on deck can put them on her. */
const REBOARD_EVERY_S = 0.25;
/** How quickly the look levels out after coming up from Look under (1/s). */
const SURFACE_RATE = 3;

interface WalkRunnerProps {
  store: PlaybackStore;
  runtime: SceneRuntime;
  spec: ShipSpec;
}

export default function WalkRunner({ store, runtime, spec }: WalkRunnerProps) {
  const map = useMemo(() => walkMapFor(spec.id), [spec]);
  /** Her rooms by id (none for a ship you cannot go inside). */
  const rooms = useMemo(() => {
    const out = new Map<string, Room>();
    for (const r of interiorFor(spec.id)?.rooms ?? []) out.set(r.id, r);
    return out;
  }, [spec]);
  /** Each room's water target (compartment samples cached). */
  const target = useMemo(() => roomWaterTargets(spec), [spec]);
  const walking = useStore(store, (s) => s.camera === "walk");
  useWalkKeys(walking, runtime, store);
  const st = useRef({
    seq: null as number | null,
    walker: null as WalkerState | null,
    swimmer: null as SwimmerState | null,
    pitch: 0,
    /** Just came up from Look under: the look levels out. */
    surfacing: false,
    wasUnder: false,
    /** Seconds until the next Back-on-deck check. */
    reboardIn: 0,
    /**
     * Over the rail: the fall from her deck to the sea (three.js eyes from
     * and to, seconds in and how long), then the splash. Null: not falling.
     */
    fall: null as null | {
      from: V3;
      to: V3;
      t: number;
      dur: number;
    },
    /** Seconds since a door was walked through (null: no easing). */
    easeT: null as number | null,
    /** Seconds until the door in reach is looked up again. */
    doorT: 0,
    /** The eyes just before that door (three.js). */
    eyeFrom: [0, 0, 0] as V3,
  });
  // Written in place every frame (no per-frame allocations).
  const scratch = useMemo(
    () => ({
      hull: [] as HullPiece[],
      pieces: [0, 1, 2].map(() => ({ pose: null!, spec }) as HullPiece),
      eye: [0, 0, 0] as V3,
      centre: [0, 0, 0] as V3,
      c: [0, 0, 0] as V3,
      p: [0, 0, 0] as [number, number, number],
      view: newView(),
      info: {
        phase: "deck",
        part: null,
        area: null,
        x: 0,
        y: 0,
        slopeDeg: 0,
        depthM: 0,
        inside: false,
      } as WalkInfo,
      ctx: {
        map: map!,
        spec,
        pose: null! as BodyPose,
        breakX: null as number | null,
        seaZ: FLAT_SEA,
        interiorsOpen: true,
        // A ship with rooms: each room's water as Interior shows it
        // (eased), else its target (the sea, or its compartment's level
        // from the sim's fill); the sea on her decks.
        ...(rooms.size > 0
          ? {
              waterZ: (area: string) => {
                const room = rooms.get(area);
                if (!room) return 0;
                const lv = runtime.interiorLevels;
                const k = lv?.slot.get(area);
                if (lv && k !== undefined && lv.drawn[k] === 1)
                  return lv.shown[k];
                return target(
                  room,
                  scratch.ctx.pose,
                  runtime.frame?.water ?? NO_FILL
                );
              },
            }
          : {}),
      } as StepContext,
      feet: [0, 0, 0] as V3,
      at: [0, 0] as [number, number],
    }),
    [spec, map, rooms, runtime, target]
  );
  /** Water over the floor at a point (m), on the walker's piece. */
  const depthAt = (area: string, x: number, y: number): number => {
    const ctx = scratch.ctx;
    const feet = scratch.feet;
    scratch.p[0] = x;
    scratch.p[1] = y;
    scratch.p[2] = floorZ(map!, area, x, spec, y);
    shipToEarth(ctx.pose, scratch.p, feet);
    const water = ctx.waterZ ? ctx.waterZ(area, x, y) : FLAT_SEA();
    return water - feet[2];
  };
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
    s.surfacing = false;
    s.wasUnder = false;
    s.fall = null;
    s.easeT = null;
    runtime.walker = null;
    runtime.walkLookUnder = false;
    runtime.walkCanReboard = false;
    runtime.walkInfo = null;
    notInside(runtime);
    runtime.walkCameInBy = null;
    runtime.walkPlace = null;
  }, [walking, runtime]);
  useEffect(
    () => () => {
      runtime.walker = null;
      runtime.walkLookUnder = false;
      runtime.walkCanReboard = false;
      runtime.walkInfo = null;
      notInside(runtime);
      runtime.walkCameInBy = null;
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
    for (let i = 0; i < frame.bodies.length && i < 3; i += 1) {
      const b = frame.bodies[i];
      const h = scratch.pieces[i];
      h.pose = b;
      h.fromX = b.part === "bow" && breakX !== null ? breakX : undefined;
      h.toX = b.part === "stern" && breakX !== null ? breakX : undefined;
      hull.push(h);
    }
    return hull;
  }

  /** Her nearest piece's middle (three.js), for Look under to follow. */
  function nearestCentre(
    frame: SimFrame,
    breakX: number | null,
    eye: V3
  ): V3 | null {
    let found = false;
    let bestD = Infinity;
    for (const b of frame.bodies) {
      const lo = b.part === "bow" && breakX !== null ? breakX : sternX;
      const hi = b.part === "stern" && breakX !== null ? breakX : stemX;
      scratch.p[0] = (lo + hi) / 2;
      scratch.p[1] = 0;
      scratch.p[2] = spec.depth / 2;
      const c = shipToThreeInto(b, scratch.p, scratch.c);
      const d = Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]);
      if (d < bestD) {
        bestD = d;
        found = true;
        scratch.centre[0] = c[0];
        scratch.centre[1] = c[1];
        scratch.centre[2] = c[2];
      }
    }
    if (!found || bestD > LOOK_UNDER_SIGHT_M) return null;
    return scratch.centre;
  }

  /**
   * Off her and into the sea beside her with a splash (washed out of a
   * room, inside at the break, or no dry way out): the same "went in" as
   * from the deck.
   */
  function goInSea(w: WalkerState, pose: BodyPose): void {
    const s = st.current;
    s.walker = null;
    s.easeT = null;
    s.swimmer = swimmerFrom(w, pose, spec, map!);
    notInside(runtime);
    runtime.walkSplash += 1;
    store.getState().wentInWater();
  }

  useFrame((state, dt) => {
    const p = store.getState();
    const frame = runtime.frame;
    // Riding a lifeboat: Effects stands the eyes in the boat; the drag
    // turns the look (not under the end card).
    if (p.camera === "walk" && p.walk.phase === "boat") {
      const s = st.current;
      if (p.walk.seq !== s.seq) {
        s.seq = p.walk.seq;
        s.walker = null;
        s.swimmer = null;
        s.pitch = 0;
        s.fall = null;
      }
      walkInput.jump = false;
      walkInput.door = undefined;
      walkInput.outside = undefined;
      runtime.walkPlace = null;
      notInside(runtime);
      const r = runtime.ride;
      if (!runtime.walkInputOff) {
        r.yaw -= walkInput.lookDx * WALK_TURN_PER_PX;
        r.pitch = Math.max(
          -WALK_PITCH_LIMIT,
          Math.min(
            WALK_PITCH_LIMIT,
            r.pitch - walkInput.lookDy * WALK_TURN_PER_PX
          )
        );
      }
      walkInput.lookDx = 0;
      walkInput.lookDy = 0;
      runtime.walkLookUnder = false;
      runtime.walkCanReboard = false;
      return;
    }
    if (p.camera !== "walk" || p.walk.phase === "off" || !map || !frame) {
      if (p.camera !== "walk") runtime.walker = null;
      return;
    }
    const s = st.current;
    // Under the end card: nothing the player holds moves the walker.
    if (runtime.walkInputOff) resetWalkInput();
    const breakX = p.track?.breakX ?? null;
    const broken = frame.bodies.some((b) => b.part !== "whole");

    // Start, seek or Back on deck: on the boat deck, or in the sea.
    if (p.walk.seq !== s.seq) {
      s.seq = p.walk.seq;
      s.reboardIn = 0;
      s.pitch = 0;
      s.fall = null;
      s.easeT = null;
      runtime.walkCameInBy = null;
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
          floorZ(map, map.spawn.area, x, spec, y),
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
        // Re-placed, not stepped in: no speed change.
        if (p.walk.phase !== "water") store.getState().wentInWater(false);
      }
    }

    // The look: drag up and down tilts (the drag left and right turns in
    // the step itself).
    s.pitch = Math.max(
      -WALK_PITCH_LIMIT,
      Math.min(WALK_PITCH_LIMIT, s.pitch - walkInput.lookDy * WALK_TURN_PER_PX)
    );
    const tilted = walkInput.lookDy !== 0;
    walkInput.lookDy = 0;

    // Falling to the sea after a jump over the rail: across and down
    // (faster and faster), then the splash.
    const fall = s.fall;
    if (fall) {
      walkInput.jump = false;
      walkInput.door = undefined;
      walkInput.outside = undefined;
      walkInput.lookDx = 0;
      fall.t += Math.min(dt, 0.1);
      const u = Math.min(1, fall.t / fall.dur);
      const across = 1 - (1 - u) * (1 - u);
      const view = scratch.view;
      view.pos[0] = fall.from[0] + (fall.to[0] - fall.from[0]) * across;
      view.pos[1] = fall.from[1] + (fall.to[1] - fall.from[1]) * u * u;
      view.pos[2] = fall.from[2] + (fall.to[2] - fall.from[2]) * across;
      view.pitch = s.pitch;
      runtime.walker = view;
      if (u >= 1) {
        s.fall = null;
        runtime.walkSplash += 1;
        store.getState().wentInWater();
      }
      return;
    }

    // A test hook stands the walker somewhere (a deck or a room).
    const place = runtime.walkPlace;
    runtime.walkPlace = null;
    if (place && areaById(map, place.area) && p.walk.phase !== "boat") {
      s.walker = {
        part: partFor(place.x, breakX, broken),
        area: place.area,
        x: place.x,
        y: place.y,
        yaw: place.yaw,
      };
      s.swimmer = null;
      s.easeT = null;
      if (store.getState().walk.phase === "water") {
        store.getState().backOnDeck();
        s.seq = store.getState().walk.seq;
      }
    }

    if (s.walker) {
      let w = s.walker;
      let pose = poseOf(frame, w.part);
      if (!pose) {
        // She broke (or a seek went back before it): the piece underfoot.
        w = { ...w, part: partFor(w.x, breakX, broken) };
        pose = poseOf(frame, w.part) ?? frame.bodies[0];
      }
      const ctx = scratch.ctx;
      ctx.pose = pose;
      ctx.breakX = breakX;
      ctx.interiorsOpen = !broken;
      // The area underfoot, looked up once (again only if a door moves them).
      let inRoom = areaById(map, w.area)?.interior === true;

      // The deck door within reach, a few times a second (the HUD's button).
      s.doorT -= dt;
      if (s.doorT <= 0) {
        s.doorT = DOOR_LOOK_S;
        const near =
          !inRoom && !broken && w.part === "whole"
            ? doorToEnter(map, w.area, [w.x, w.y], depthAt)
            : null;
        runtime.walkDoor = near
          ? map.stairs.findIndex((st) => st.id === near.id)
          : -1;
        // The arrow over the nearest open deck door (1.16).
        const at = scratch.at;
        at[0] = w.x;
        at[1] = w.y;
        runtime.walkArrow =
          w.part === "whole" ? doorArrow(map, w.area, at, depthAt, broken) : -1;
      }

      // The door button and Go outside (read once, then cleared).
      const doorAsk = walkInput.door;
      const outAsk = walkInput.outside;
      walkInput.door = undefined;
      walkInput.outside = undefined;
      let moved: DoorPlace | null = null;
      let gone = false;
      if (doorAsk && !inRoom && !broken && w.part === "whole") {
        moved = doorToEnter(
          map,
          w.area,
          [w.x, w.y],
          depthAt,
          typeof doorAsk === "string" ? doorAsk : undefined
        );
        if (moved) runtime.walkCameInBy = moved.id;
      } else if (outAsk && inRoom && !broken) {
        moved = doorExit(map, runtime.walkCameInBy, depthAt, [w.x, w.y]);
        if (!moved) {
          // No dry door: the spawn, else the sea (as Back on deck).
          const spawn = placeWalker(map, spec, frame, breakX, FLAT_SEA);
          if (spawn) w = spawn;
          else gone = true;
        }
      }
      if (moved) {
        w = {
          part: w.part,
          area: moved.area,
          x: moved.at[0],
          y: moved.at[1],
          yaw: moved.yaw,
        };
        s.easeT = null;
      }
      if (w.area !== s.walker.area)
        inRoom = areaById(map, w.area)?.interior === true;

      // Inside when she breaks: interiors close, into the sea beside her.
      if (broken && inRoom) gone = true;
      // Into the sea: the swimmer below takes over this frame.
      if (gone) goInSea(w, pose);
      else s.walker = w;
    }

    if (s.walker) {
      const w = s.walker;
      const pose = scratch.ctx.pose;
      const ctx = scratch.ctx;
      const before = s.eyeFrom;
      const lastEyes = runtime.walker;
      const r = stepWalker(w, walkInput, ctx, dt);
      walkInput.lookDx = 0;
      walkInput.jump = false;
      // The area after the step, looked up once.
      const inside = areaById(map, r.state.area)?.interior === true;
      if (r.via?.kind === "door") {
        // Through a deck door: remember it going in; the eyes ease.
        if (inside) runtime.walkCameInBy = r.via.id;
        if (lastEyes) {
          before[0] = lastEyes.pos[0];
          before[1] = lastEyes.pos[1];
          before[2] = lastEyes.pos[2];
          s.easeT = 0;
        }
      } else if (r.via?.kind === "lift") {
        runtime.walkLift += 1;
        s.easeT = null;
      }
      if (r.inWater && r.overboard) {
        // Over the rail: fall from where the eyes are to the sea.
        s.walker = null;
        const sw = swimmerFrom(r.state, pose, spec, map);
        s.swimmer = sw;
        const eyes = deckEyes(r.state, pose, spec, map, s.pitch, scratch.view);
        const from: V3 = [eyes.pos[0], eyes.pos[1], eyes.pos[2]];
        const to: V3 = [sw.x, FLOAT_EYE_M, -sw.y];
        const drop = Math.max(0, from[1] - to[1]);
        s.fall = {
          from,
          to,
          t: 0,
          dur: Math.max(0.5, Math.min(2.5, Math.sqrt((2 * drop) / 9.81))),
        };
        // Facing out to sea as they go.
        scratch.view.yaw = Math.atan2(-(to[2] - from[2]), to[0] - from[0]);
        sw.yaw = scratch.view.yaw;
        runtime.walker = scratch.view;
        // Off her deck now: no lifeboat to get into on the way down.
        runtime.walkInfo = null;
        return;
      }
      if (r.inWater) {
        goInSea(r.state, pose);
      } else {
        s.walker = r.state;
        const view = deckEyes(r.state, pose, spec, map, s.pitch, scratch.view);
        if (s.easeT !== null) {
          s.easeT += Math.min(dt, 0.1);
          easeEyes(view, before, s.easeT);
          if (s.easeT >= EYE_EASE_S) s.easeT = null;
        }
        runtime.walker = view;
        runtime.walkInside = inside;
        runtime.walkRoom = r.state.area;
        runtime.walkLookUnder = false;
        runtime.walkCanReboard = false;
        const info = scratch.info;
        info.phase = "deck";
        info.part = r.state.part;
        info.area = r.state.area;
        info.x = r.state.x;
        info.y = r.state.y;
        info.slopeDeg = r.slopeDeg;
        info.depthM = r.depthM;
        info.inside = inside;
        runtime.walkInfo = info;
        return;
      }
    }
    notInside(runtime);

    const sw = s.swimmer;
    if (!sw) return;
    // No jumping in the sea (nor saved for the next time on deck), nor doors.
    walkInput.jump = false;
    walkInput.door = undefined;
    walkInput.outside = undefined;
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
    // Came up (the button or paddling): the look levels out again, unless
    // the player tilts it themselves.
    if (s.wasUnder && !under) s.surfacing = true;
    s.wasUnder = under;
    if (under || tilted) s.surfacing = false;
    if (s.surfacing) {
      s.pitch *= Math.exp(-Math.min(dt, 0.1) * SURFACE_RATE);
      if (Math.abs(s.pitch) < 0.01) {
        s.pitch = 0;
        s.surfacing = false;
      }
    }
    if (under) {
      // Tilt down to keep her in frame while she is in sight.
      const eye = scratch.eye;
      eye[0] = next.x;
      eye[1] = LOOK_UNDER_EYE_Y;
      eye[2] = -next.y;
      const c = nearestCentre(frame, breakX, eye);
      if (c) {
        const want = followShipPitch(eye, c, -WALK_PITCH_LIMIT);
        s.pitch +=
          (want - s.pitch) * (1 - Math.exp(-Math.min(dt, 0.1) * FOLLOW_RATE));
      }
    }
    runtime.walker = waterEyes(
      next,
      state.clock.elapsedTime,
      s.pitch,
      under,
      scratch.view
    );
    runtime.walkLookUnder = under;
    // Back on deck: only while her boat deck is above water (a few times a
    // second; placing is cheap maths, but not needed every frame).
    s.reboardIn -= dt;
    if (s.reboardIn <= 0) {
      s.reboardIn = REBOARD_EVERY_S;
      runtime.walkCanReboard = canReboard(map, spec, frame, breakX, FLAT_SEA);
    }
    const info = scratch.info;
    info.phase = "water";
    info.part = null;
    info.area = null;
    info.x = next.x;
    info.y = next.y;
    info.slopeDeg = 0;
    info.depthM = 0;
    info.inside = false;
    runtime.walkInfo = info;
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

/** WASD and the arrows walk, Space jumps, while walking (`walkInput`). */
function useWalkKeys(
  walking: boolean,
  runtime: SceneRuntime,
  store: PlaybackStore
) {
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
      // Space jumps (on her deck; Hud leaves it to us then).
      if (k === " ") {
        // Only on her deck (in the sea or a boat, Hud's play/pause).
        if (store.getState().walk.phase !== "deck") return;
        if (runtime.walkInputOff || e.repeat) return;
        const el = e.target as HTMLElement | null;
        if (
          el?.closest?.("button, input, textarea, [role=slider], [role=dialog]")
        )
          return;
        e.preventDefault();
        walkInput.jump = true;
        return;
      }
      if (!(k in KEYS)) return;
      // Not under the end card.
      if (runtime.walkInputOff) return;
      const el = e.target as HTMLElement | null;
      // As Hud's keys: not while a button, a field or a card has focus.
      if (
        el?.closest?.("button, input, textarea, [role=slider], [role=dialog]")
      )
        return;
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
  }, [walking, runtime, store]);
}

/** How often the door in reach is looked up (s). */
const DOOR_LOOK_S = 0.25;

/** Not in a room (in the sea, a boat or not walking). */
function notInside(runtime: SceneRuntime): void {
  runtime.walkDoor = -1;
  runtime.walkArrow = -1;
  runtime.walkInside = false;
  runtime.walkRoom = null;
}
