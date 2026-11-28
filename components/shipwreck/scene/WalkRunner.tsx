"use client";
/* eslint-disable react-hooks/immutability -- the scene runtime and the walk input are mutated in the frame loop by design */

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { loweredBoats } from "@/lib/shipwreck/boatRide";
import type { PlaybackStore } from "@/lib/shipwreck/playback";
import type { ShipSpec } from "@/lib/shipwreck/ships/types";
import type { BodyPose, SimFrame } from "@/lib/shipwreck/sim/track";
import {
  alongDeck,
  doorExit,
  doorToEnter,
  interiorFor,
  liftAt,
  liftById,
  liftCarId,
  liftLanding,
  liftMiddle,
  liftRideZ,
  nextStop,
  roomsOpen,
  roomWaterTargets,
  seepTarget,
  type DoorPlace,
  type LiftShaft,
  type LiftStop,
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
  WALK_LIFT_MAX_DEPTH_M,
  WALK_TURN_PER_PX,
  type HullPiece,
  type SwimmerState,
  type StepContext,
  type WalkerState,
  type WalkInput,
} from "@/lib/shipwreck/walk";
import { shipToThreeInto, type V3 } from "./cameraMath";
import {
  LIFT_DOWN,
  LIFT_UP,
  type SceneRuntime,
  type WalkInfo,
  type WalkRide,
} from "./runtime";
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
 * `walkDoor`). The door and Go outside buttons (`walkInput.door`,
 * `.outside`) and the test hooks' `walkPlace` are taken here. Inside when
 * she breaks, or washed out by the water, is the same splash into the sea
 * as going in from the deck.
 *
 * Her glass lifts (1.18): in a car the ▲ ▼ buttons (`walkInput.lift`)
 * start a ride to the next dry stop that way (`nextStop`); the runner
 * writes which ways can go (`walkLiftDirs`) and, while riding, the ride
 * (`walkRide`) for Interior and the HUD. The ride lives on the walker
 * (`WalkerState.ride`), so anything that re-places them (a seek, Back on
 * deck, Go outside, the rooms closing at her 30°, `placeWalk`) ends it.
 * The rooms closing mid-ride walk them out through the lift's dark wipe
 * (`walkLift`), the stick held while it clears, not a hard cut.
 */

/** The sea's surface for the walk rules: the sea quad is flat (y = 0). */
const FLAT_SEA = () => 0;
/** No sim frame yet: every compartment dry. */
const NO_FILL: readonly number[] = [];
const NO_FRAMES: readonly SimFrame[] = [];
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
  /**
   * Her rooms by id (none for a ship you cannot go inside). A deck room
   * (her pool hall) is open deck: the sea is its water.
   */
  const rooms = useMemo(() => {
    const out = new Map<string, Room>();
    for (const r of interiorFor(spec.id)?.rooms ?? [])
      if (!r.deckRoom) out.set(r.id, r);
    return out;
  }, [spec]);
  /**
   * Her lifeboats already lowered at the shown time (a map with boat
   * blockers: the Concordia's), refilled each frame from the track's
   * events (live while the night computes; a seek back un-lowers them).
   */
  const lowered = useRef(new Set<number>());
  const interior = useMemo(() => interiorFor(spec.id), [spec]);
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
    /** Seconds the stick is still ignored after the lift (its dark wipe). */
    liftHold: 0,
  });
  // Written in place every frame (no per-frame allocations).
  const scratch = useMemo(
    () => ({
      hull: [] as HullPiece[],
      // Her superstructure too, on a map that keeps the swimmer off it
      // (the Concordia, lying over).
      pieces: [0, 1, 2].map(
        () =>
          ({
            pose: null!,
            spec,
            ...(map?.swimAroundSuperstructure
              ? { superstructure: spec.superstructure }
              : {}),
          }) as HullPiece
      ),
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
        heelDeg: 0,
        depthM: 0,
        inside: false,
        ride: null,
      } as WalkInfo,
      /** The ride as the scene sees it (`runtime.walkRide`), in place. */
      ride: { lift: "", from: 0, to: 0, s: 0, z: 0 } as WalkRide,
      ctx: {
        map: map!,
        spec,
        pose: null! as BodyPose,
        breakX: null as number | null,
        seaZ: FLAT_SEA,
        interiorsOpen: true,
        // A boat's blocker goes once that boat is lowered (her map only).
        ...(map?.blockers.some((b) => b.kind === "box" && b.boat !== undefined)
          ? {
              boatLowered: (i: number) => lowered.current.has(i),
            }
          : {}),
        // A ship with rooms: each room's water as Interior shows it
        // (eased), else its target (the sea, or its compartment's level
        // from the sim's fill); the sea on her decks.
        ...(rooms.size > 0
          ? {
              waterZ: (at: string) => {
                // A glass car at a stop holds its landing's water (hers).
                const area =
                  rooms.has(at) || !interior
                    ? at
                    : (liftLanding(interior, at) ?? at);
                const room = rooms.get(area);
                if (!room) return 0;
                const lv = runtime.interiorLevels;
                const k = lv?.slot.get(area);
                if (lv && k !== undefined && lv.drawn[k] === 1)
                  return lv.shown[k];
                // A seeping room (hers) takes the sea slowly, as the table.
                if (room.seep && interior) {
                  const ps = store.getState();
                  const sv = seepTarget(
                    interior,
                    ps.track?.frames ?? NO_FRAMES,
                    spec,
                    area,
                    ps.t
                  );
                  if (!Number.isNaN(sv)) return sv;
                }
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
      /** The input while the lift's wipe holds the stick: the look only. */
      held: { forward: 0, strafe: 0, lookDx: 0, lookDy: 0 } as WalkInput,
    }),
    [spec, map, rooms, runtime, target, interior, store]
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
  // Whether a lift stop is dry enough to ride to (its car no deeper than
  // the knee); one function for the frame loop (no per-frame closures).
  const depthRef = useRef(depthAt);
  depthRef.current = depthAt;
  const liftDry = useRef({
    lift: null as LiftShaft | null,
    dry: (stop: LiftStop): boolean => {
      const lift = liftDry.current.lift;
      if (!lift) return false;
      const [x, y] = liftMiddle(lift);
      return (
        depthRef.current(liftCarId(lift.id, stop.deck), x, y) <=
        WALK_LIFT_MAX_DEPTH_M
      );
    },
  });
  /** Which ways a ride can go from stop `at` of `lift` (LIFT_UP | LIFT_DOWN). */
  const liftDirs = (lift: LiftShaft, at: number): number => {
    const d = liftDry.current;
    d.lift = lift;
    const dirs =
      (nextStop(lift, at, 1, d.dry) !== null ? LIFT_UP : 0) |
      (nextStop(lift, at, -1, d.dry) !== null ? LIFT_DOWN : 0);
    d.lift = null;
    return dirs;
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
   * room, inside at the break, no dry way out, or her walk's end heel):
   * the same "went in" as from the deck. `side` (+1 port, −1 starboard)
   * picks the side; missing, the side they were nearer.
   */
  function goInSea(w: WalkerState, pose: BodyPose, side?: 1 | -1): void {
    const s = st.current;
    s.walker = null;
    s.easeT = null;
    s.swimmer = swimmerFrom(w, pose, spec, map!, side);
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
      walkInput.lift = undefined;
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
      s.liftHold = 0;
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
      walkInput.lift = undefined;
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
      s.liftHold = 0;
      if (store.getState().walk.phase === "water") {
        store.getState().backOnDeck();
        s.seq = store.getState().walk.seq;
      }
    }

    // Her walk ends at this list (the Concordia, 40°): too far over to
    // stand, they slide off her low side into the sea, and Back on deck
    // (placeWalker) cannot put them back until a seek to before it.
    const endsAt = map.walkEndsAtHeelDeg;
    if (s.walker && endsAt !== undefined && Math.abs(frame.listDeg) >= endsAt)
      goInSea(
        s.walker,
        poseOf(frame, s.walker.part) ?? frame.bodies[0],
        frame.listDeg > 0 ? -1 : 1
      );

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
      // Her rooms are open until she breaks, or (hers) leans to the close.
      const open = interior ? roomsOpen(interior, frame, broken) : !broken;
      ctx.interiorsOpen = open;
      if (ctx.boatLowered) {
        const events = p.track?.events;
        if (events) loweredBoats(events, p.t, lowered.current);
        else lowered.current.clear();
      }
      // The area underfoot, looked up once (again only if a door moves them).
      let inRoom = areaById(map, w.area)?.interior === true;

      // The deck door within reach, a few times a second (the HUD's button).
      s.doorT -= dt;
      if (s.doorT <= 0) {
        s.doorT = DOOR_LOOK_S;
        const near =
          !inRoom && open && w.part === "whole"
            ? doorToEnter(map, w.area, [w.x, w.y], depthAt)
            : null;
        runtime.walkDoor = near
          ? map.stairs.findIndex((st) => st.id === near.id)
          : -1;
      }

      // The door button and Go outside (read once, then cleared).
      const doorAsk = walkInput.door;
      const outAsk = walkInput.outside;
      const liftAsk = walkInput.lift;
      walkInput.door = undefined;
      walkInput.outside = undefined;
      walkInput.lift = undefined;
      let moved: DoorPlace | null = null;
      let gone = false;
      if (doorAsk && !inRoom && open && w.part === "whole") {
        moved = doorToEnter(
          map,
          w.area,
          [w.x, w.y],
          depthAt,
          typeof doorAsk === "string" ? doorAsk : undefined
        );
        if (moved) runtime.walkCameInBy = moved.id;
      } else if (inRoom && !broken && (outAsk || !open)) {
        // Go outside, or the rooms closed round them (her 30° heel):
        // walked out onto the nearest dry door's outside, not into the sea.
        moved = doorExit(map, runtime.walkCameInBy, depthAt, [w.x, w.y]);
        // Hers: a lifeboat stands just outside her recess doors, so face
        // along her deck, not square into its hull.
        if (moved && interior?.closeAtHeelDeg !== undefined)
          moved = { ...moved, yaw: alongDeck(moved.yaw) };
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
      // The rooms closing round a glass lift ride (hers, at 30°): not a hard
      // cut out of a moving car. The screen goes dark and clears (the lift
      // wipe) and the stick waits for it, while her hull groans.
      if (
        !open &&
        !broken &&
        inRoom &&
        s.walker.ride &&
        !gone &&
        w !== s.walker
      ) {
        runtime.walkLift += 1;
        s.liftHold = LIFT_HOLD_S;
      }
      if (w.area !== s.walker.area)
        inRoom = areaById(map, w.area)?.interior === true;
      // The ▲ ▼ in a glass car (hers): ride to the next dry stop that way.
      if (liftAsk && !moved && !gone && open && !broken && !w.ride) {
        const at = liftAt(map, w.area);
        if (at && (w.jumpS ?? null) === null) {
          const d = liftDry.current;
          d.lift = at.lift;
          const to = nextStop(
            at.lift,
            at.stop,
            liftAsk === "up" ? 1 : -1,
            d.dry
          );
          d.lift = null;
          if (to !== null)
            w = {
              ...w,
              moveShare: 0,
              ride: { lift: at.lift.id, from: at.stop, to, s: 0 },
            };
        }
      }

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
      // Through the lift's dark wipe the stick does nothing (the look
      // still turns): nobody walks off blind.
      let input: WalkInput = walkInput;
      if (s.liftHold > 0) {
        s.liftHold = Math.max(0, s.liftHold - dt);
        scratch.held.lookDx = walkInput.lookDx;
        input = scratch.held;
      }
      // Her lean's drift holds still under the end card, the lift's wipe
      // and a glass lift ride.
      ctx.driftOff = runtime.walkInputOff || s.liftHold > 0 || !!w.ride;
      const r = stepWalker(w, input, ctx, dt);
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
        s.liftHold = LIFT_HOLD_S;
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
        // Her glass lifts: the ride for the scene, else which ways can go.
        const ride = r.state.ride;
        const rideLift = ride ? liftById(map, ride.lift) : undefined;
        if (ride && rideLift) {
          const out = scratch.ride;
          out.lift = ride.lift;
          out.from = ride.from;
          out.to = ride.to;
          out.s = ride.s;
          out.z = liftRideZ(rideLift, spec, ride.from, ride.to, ride.s);
          runtime.walkRide = out;
          runtime.walkLiftDirs = 0;
        } else {
          runtime.walkRide = null;
          const car = map.lifts ? liftAt(map, r.state.area) : null;
          runtime.walkLiftDirs =
            car && ctx.interiorsOpen !== false && !broken
              ? liftDirs(car.lift, car.stop)
              : 0;
        }
        runtime.walkLookUnder = false;
        runtime.walkCanReboard = false;
        const info = scratch.info;
        info.phase = "deck";
        info.part = r.state.part;
        info.area = r.state.area;
        info.x = r.state.x;
        info.y = r.state.y;
        info.slopeDeg = r.slopeDeg;
        info.heelDeg = Math.abs(frame.listDeg);
        info.depthM = r.depthM;
        info.inside = inside;
        info.ride = ride ? ride.lift : null;
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
    walkInput.lift = undefined;
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
    info.heelDeg = Math.abs(frame.listDeg);
    info.depthM = 0;
    info.inside = false;
    info.ride = null;
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

/** The stick is ignored this long after the lift (its wipe runs 0.9 s). */
const LIFT_HOLD_S = 0.9;

/** How often the door in reach is looked up (s). */
const DOOR_LOOK_S = 0.25;

/** Not in a room (in the sea, a boat or not walking). */
function notInside(runtime: SceneRuntime): void {
  runtime.walkRide = null;
  runtime.walkLiftDirs = 0;
  runtime.walkDoor = -1;
  runtime.walkInside = false;
  runtime.walkRoom = null;
}
