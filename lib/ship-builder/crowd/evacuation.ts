import { resolveAttachPoint } from "../model/attach";
import { getPartDef } from "../model/catalog";
import { buildOccupancy, rotatedFootprint } from "../model/grid";
import type { PlacedPart, Ship } from "../model/types";
import { DECK_Y, LEVEL_HEIGHT } from "../model/worldFrame";
import { poseWorldPoint } from "../sim/funnelFall";
import { SIM_STEP_S, type SimState, type TrialInput } from "../sim/types";
import { halfWalkGrid, type WalkHalf, walkHalfOf } from "../walk/halfGrid";
import type { WalkGrid } from "../walk/types";
import { type CrowdGraph, crowdGraphOf, pathTo } from "./plan";
import { between, fnv1a, mulberry32 } from "./rng";
import {
  type CrowdPlan,
  PAUSE_S,
  PERSON_SPEED,
  type PersonPose,
  WANDER_STEPS,
} from "./types";

/**
 * The evacuation in a sinking: who heads for which lifeboat, when each boat
 * lowers away, and when everyone left aboard ends up in the water. Pure: the
 * whole plan is worked out once from the precomputed trial timeline, then
 * every lookup reads it.
 */

/** Seated figures drawn per boat. */
export const BOAT_SHOWN_MAX = 4;
/** A boat lowers this long after doom even if not full. */
export const LAUNCH_WAIT_S = 12;
/** Davit to water. */
export const LOWER_S = 6;
/** World units outboard once on the water. */
export const ROW_OUT = 3;
export const ROW_S = 5;

/** Sim seconds between checks for water reaching a person or a boat deck. */
const WATER_CHECK_S = 0.25;
/** A person in the water drifts outward this fast, world units per second… */
const FLOAT_DRIFT_SPEED = 0.2;
/** …for this long, then stays put. */
const FLOAT_DRIFT_S = 5;
/** Height and period of a launched boat's bob once it has rowed out. */
const BOAT_BOB_HEIGHT = 0.04;
const BOAT_BOB_PERIOD_S = 2.4;
/** Wander schedules after doom run this far past the timeline's end. */
const WANDER_MARGIN_S = 1;

export interface BoatLaunch {
  /** The lifeboat part id. */
  boatId: string;
  /** Sim seconds the boat starts lowering. */
  at: number;
  /** World transform of the boat at `at` (from the carrying body's pose then). */
  origin: { x: number; y: number; z: number };
  roll: number;
  pitch: number;
  /** Outboard direction in world z: +1 or -1. */
  outward: 1 | -1;
  /** People seated in it (ids), at most BOAT_SHOWN_MAX. */
  riders: readonly string[];
}

export type PersonFate =
  /** Follows `EvacuationPlan.poseAt` (the crowd plan before doom). */
  | { kind: "aboard" }
  /** Walking to a boat's boarding spot; `until` is when that walk ends. */
  | { kind: "boarding"; boatId: string; until: number }
  | { kind: "in-boat"; boatId: string; seat: number }
  /** In the water at world `at` (xz), drifting outward for a few seconds. */
  | { kind: "floating"; since: number; at: { x: number; z: number } };

export interface EvacuationPlan {
  launches: readonly BoatLaunch[];
  /** What person `i` is doing at sim time `t`. Pure. */
  fateAt(i: number, t: number): PersonFate;
  /** Model-frame pose for an aboard or boarding person at `t` (boarding walks to the boat). */
  poseAt(i: number, t: number): PersonPose;
  /** World transform of a launched boat at `t` (lowering, rowing out, then waiting and bobbing at y = 0). */
  boatPoseAt(
    launch: BoatLaunch,
    t: number
  ): {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
  };
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** The pose of a body that carries people: the whole ship or one half. */
export interface BodyPose {
  roll: number;
  pitch: number;
  sink: number;
  pivotX?: number;
  driftX?: number;
}

/** One stretch of a schedule: a straight walk, or standing still. */
interface Segment {
  t0: number;
  t1: number;
  ax: number;
  az: number;
  /** Level while in the start cell, and once in the end cell. */
  la: number;
  bx: number;
  bz: number;
  lb: number;
  yaw: number;
  activity: "walk" | "idle";
}

/** A person's motion: the crowd plan until `crowdUntil`, then `track`. */
interface Motion {
  crowdUntil: number;
  /** In time order; the last one stands still for ever. */
  track: Segment[];
}

interface Lifeboat {
  id: string;
  /** Shown seats, after the half-empty cap. */
  cap: number;
  /** Which half carries it once she breaks (by its block, as the scene draws it). */
  half: WalkHalf | null;
  /** Hang point in the resting world frame. */
  rest: Vec3;
  /** Boarding spot centre in the resting world frame (the hang point when there is none). */
  spotRest: Vec3;
  /** Boarding spot node in its half's graph, or -1. */
  spot: number;
  outward: 1 | -1;
}

/** Someone who has gone into the water: when, where, and which way they drift. */
export interface FloatStart {
  since: number;
  /** World xz where the water reached them. */
  x: number;
  z: number;
  outward: 1 | -1;
}

type Float = FloatStart;

/** The world point a person's feet are at, on the body that carries them. */
export function personWorldPoint(
  pose: PersonPose,
  body: BodyPose,
  length: number,
  beam: number
): Vec3 {
  return poseWorldPoint(body, length, {
    x: length / 2 - pose.x,
    y: DECK_Y + pose.level * LEVEL_HEIGHT,
    z: beam / 2 - pose.z,
  });
}

/**
 * When a person first finds themselves in the water (world y at or below 0),
 * checked every `step` seconds from `from` while before `to`, and at `to`
 * itself when `includeEnd` is set (and `to` is finite). `poseAt` is their
 * model-frame pose and `bodyAt` the pose of whatever carries them at that
 * spot, both at `t`. Null when they stay dry. Shared by the evacuation plan
 * and by trials with no plan (the weather trial), which check each frame.
 */
export function floatingSince(
  poseAt: (t: number) => PersonPose,
  bodyAt: (t: number, cellsFromBow: number) => BodyPose,
  from: number,
  to: number,
  frame: { length: number; beam: number },
  options: { step?: number; includeEnd?: boolean } = {}
): FloatStart | null {
  const step = options.step ?? WATER_CHECK_S;
  const at = (t: number): FloatStart | null => {
    const pose = poseAt(t);
    const world = personWorldPoint(
      pose,
      bodyAt(t, pose.x),
      frame.length,
      frame.beam
    );
    if (world.y > 0) return null;
    return { since: t, x: world.x, z: world.z, outward: world.z >= 0 ? 1 : -1 };
  };
  for (let k = 0; from + k * step < to; k++) {
    const found = at(from + k * step);
    if (found) return found;
  }
  return options.includeEnd && Number.isFinite(to) ? at(to) : null;
}

/** Where a floater is at `t`: drifting outward for a few seconds, then still. */
export function floatPositionAt(
  float: FloatStart,
  t: number
): { x: number; z: number } {
  const drift =
    FLOAT_DRIFT_SPEED * Math.min(FLOAT_DRIFT_S, Math.max(0, t - float.since));
  return { x: float.x, z: float.z + float.outward * drift };
}

interface Fate {
  float: Float | null;
  /** The boat they head for at doom, if any. */
  boatId: string | null;
  /** Boarding lasts until this time (arrival, or the boat leaving without them). */
  boardUntil: number;
  /** Set when they get a seat. */
  seat: { boatId: string; seat: number; at: number } | null;
}

function travelYaw(dx: number, dz: number): number {
  return Math.atan2(-dz, -dx);
}

function centre(graph: CrowdGraph, node: number) {
  const { x, z, level } = graph.nodes[node];
  return { x: x + 0.5, z: z + 0.5, level };
}

function lastOf<T>(list: readonly T[]): T {
  return list[list.length - 1];
}

function trackPose(track: readonly Segment[], t: number): PersonPose {
  let lo = 0;
  let hi = track.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (track[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  const s = track[lo];
  if (s.activity === "idle" || t >= s.t1) {
    return {
      x: s.bx,
      z: s.bz,
      level: s.lb,
      yaw: s.yaw,
      activity: s.activity === "walk" && t < s.t1 ? "walk" : s.activity,
    };
  }
  const frac = Math.min(1, Math.max(0, (t - s.t0) / (s.t1 - s.t0)));
  const x = s.ax + frac * (s.bx - s.ax);
  const z = s.az + frac * (s.bz - s.az);
  const inFrom =
    Math.floor(x) === Math.floor(s.ax) && Math.floor(z) === Math.floor(s.az);
  return { x, z, level: inFrom ? s.la : s.lb, yaw: s.yaw, activity: "walk" };
}

/** Appends a stand-still from `t` on to the end of `track`. */
function standFrom(track: Segment[], t: number, pose: PersonPose): void {
  track.push({
    t0: t,
    t1: Infinity,
    ax: pose.x,
    az: pose.z,
    la: pose.level,
    bx: pose.x,
    bz: pose.z,
    lb: pose.level,
    yaw: pose.yaw,
    activity: "idle",
  });
}

/**
 * Appends a walk from `pose` (at `t`) to its cell's centre, then along
 * `path`. Returns the arrival time and heading.
 */
function walkPath(
  track: Segment[],
  graph: CrowdGraph,
  t: number,
  pose: PersonPose,
  path: readonly number[]
): { t: number; yaw: number } {
  let yaw = pose.yaw;
  let now = t;
  const first = centre(graph, path[0]);
  const lead = Math.hypot(first.x - pose.x, first.z - pose.z);
  if (lead > 1e-9) {
    yaw = travelYaw(first.x - pose.x, first.z - pose.z);
    track.push({
      t0: now,
      t1: now + lead / PERSON_SPEED,
      ax: pose.x,
      az: pose.z,
      la: first.level,
      bx: first.x,
      bz: first.z,
      lb: first.level,
      yaw,
      activity: "walk",
    });
    now += lead / PERSON_SPEED;
  }
  for (let k = 1; k < path.length; k++) {
    const a = centre(graph, path[k - 1]);
    const b = centre(graph, path[k]);
    yaw = travelYaw(b.x - a.x, b.z - a.z);
    track.push({
      t0: now,
      t1: now + 1 / PERSON_SPEED,
      ax: a.x,
      az: a.z,
      la: a.level,
      bx: b.x,
      bz: b.z,
      lb: b.level,
      yaw,
      activity: "walk",
    });
    now += 1 / PERSON_SPEED;
  }
  return { t: now, yaw };
}

/** The graph node of the cell a pose stands in, if it has one. */
function nodeOf(graph: CrowdGraph, pose: PersonPose): number | undefined {
  return graph.nodeAt(Math.floor(pose.x), Math.floor(pose.z), pose.level);
}

/**
 * Wanders from `pose` at `t` until `horizon`: to the cell's centre, then to
 * random columns within WANDER_STEPS with short pauses. No seats now.
 */
function wanderFrom(
  track: Segment[],
  graph: CrowdGraph,
  t: number,
  pose: PersonPose,
  horizon: number,
  random: () => number
): void {
  let node = nodeOf(graph, pose);
  if (node === undefined) {
    standFrom(track, t, { ...pose, activity: "idle" });
    return;
  }
  let at = walkPath(track, graph, t, pose, [node]);
  while (at.t < horizon) {
    const reach = graph.reachFrom(node);
    const goals = reach.order.filter(
      (n) =>
        reach.dist[n] > 0 &&
        reach.dist[n] <= WANDER_STEPS &&
        graph.seatOf[n] < 0
    );
    if (goals.length === 0) break;
    const goal = goals[Math.floor(random() * goals.length)];
    const here = centre(graph, node);
    at = walkPath(
      track,
      graph,
      at.t,
      { ...here, yaw: at.yaw, activity: "idle" },
      pathTo(reach, goal)
    );
    node = goal;
    const pause = between(random, PAUSE_S);
    const spot = centre(graph, node);
    track.push({
      t0: at.t,
      t1: at.t + pause,
      ax: spot.x,
      az: spot.z,
      la: spot.level,
      bx: spot.x,
      bz: spot.z,
      lb: spot.level,
      yaw: at.yaw,
      activity: "idle",
    });
    at = { t: at.t + pause, yaw: at.yaw };
  }
  standFrom(track, at.t, {
    ...centre(graph, node),
    yaw: at.yaw,
    activity: "idle",
  });
}

/** Cuts `track` at `t`, keeping the motion up to then exactly. */
function cutAt(track: Segment[], t: number): PersonPose {
  const pose = trackPose(track, t);
  while (track.length > 1 && lastOf(track).t0 >= t) track.pop();
  const s = lastOf(track);
  if (s.t0 >= t) {
    track.pop();
  } else if (s.activity === "walk" && s.t1 > t) {
    // The same straight line, just stopping at `pose`.
    s.bx = pose.x;
    s.bz = pose.z;
    s.t1 = t;
  } else {
    s.t1 = Math.min(s.t1, t);
  }
  return pose;
}

/**
 * Every lifeboat hanging from a davit, with its boarding spot: the walkable
 * column nearest the davit point, its own cell or the one inboard of it, on
 * the block's roof or (for a side davit) the block's own level.
 */
function lifeboatsOf(
  ship: Ship,
  length: number,
  beam: number,
  graphOf: (half: WalkHalf | null) => CrowdGraph,
  atX: number | null
): Lifeboat[] {
  const occupancy = buildOccupancy(ship);
  const byId = new Map(ship.parts.map((part) => [part.id, part]));
  const boats: Lifeboat[] = [];
  for (const part of ship.parts) {
    const seats = getPartDef(part.type).seats ?? 0;
    if (seats <= 0 || part.anchor.kind !== "attach") continue;
    const davit = byId.get(part.anchor.parentId);
    if (
      !davit ||
      (davit.type !== "davit" && davit.type !== "davit-side") ||
      davit.anchor.kind !== "attach"
    ) {
      continue;
    }
    const block = byId.get(davit.anchor.parentId);
    const hang = resolveAttachPoint(ship, part.anchor, occupancy);
    const mount = resolveAttachPoint(ship, davit.anchor, occupancy);
    if (!block || block.anchor.kind !== "grid" || !hang || !mount) continue;

    const starboard = mount.side === "starboard";
    const half = atX === null ? null : blockHalf(block, atX);
    const graph = graphOf(half);
    const x = Math.floor(mount.position.x);
    const z = starboard ? mount.position.z : mount.position.z - 1;
    const inboard = starboard ? z + 1 : z - 1;
    const level = block.anchor.level;
    let spot = -1;
    let best = Infinity;
    for (const cz of [z, inboard]) {
      for (const cl of [level + 1, level]) {
        const node = graph.nodeAt(x, cz, cl);
        if (node === undefined || graph.seatOf[node] >= 0) continue;
        const d = Math.hypot(
          cl - mount.position.y,
          cz + 0.5 - mount.position.z
        );
        if (d < best) {
          best = d;
          spot = node;
        }
      }
    }

    const rest = {
      x: length / 2 - hang.position.x,
      y: DECK_Y + hang.position.y * LEVEL_HEIGHT,
      z: beam / 2 - hang.position.z,
    };
    const spotCell = spot >= 0 ? graph.nodes[spot] : null;
    const shown = Math.min(BOAT_SHOWN_MAX, seats);
    boats.push({
      id: part.id,
      cap: fnv1a(part.id) % 2 === 1 ? Math.ceil(shown / 2) : shown,
      half,
      rest,
      spotRest: spotCell
        ? {
            x: length / 2 - (spotCell.x + 0.5),
            y: DECK_Y + spotCell.level * LEVEL_HEIGHT,
            z: beam / 2 - (spotCell.z + 0.5),
          }
        : rest,
      spot,
      // Starboard is model -z outboard, which is world +z.
      outward: starboard ? 1 : -1,
    });
  }
  return boats;
}

/** The half a grid block goes with: by the centre of its footprint. */
function blockHalf(block: PlacedPart, atX: number): WalkHalf {
  if (block.anchor.kind !== "grid") return "stern";
  const def = getPartDef(block.type);
  const size =
    def.placement === "grid"
      ? rotatedFootprint(def.footprint, block.rotation)
      : { x: 1, z: 1 };
  return walkHalfOf(block.anchor.x + size.x / 2, atX);
}

function smooth(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

export function planEvacuation(
  ship: Ship,
  grid: WalkGrid,
  crowd: CrowdPlan,
  timeline: { input: TrialInput; stateAt(t: number): SimState; end: number }
): EvacuationPlan | null {
  const { input, end } = timeline;
  if (!input.iceberg) return null;

  // Doom is the iceberg strike (the first water in) of a trial that ends
  // with her sunk, so the whole flooding stretch is there for boarding. A
  // timeline with no flooding event falls back to the first "sank" state;
  // an outcome never changes once set, so a binary search finds that.
  const last = timeline.stateAt(end);
  if (last.outcome !== "sank") return null;
  const flooding = last.events.find((event) => event.kind === "flooding");
  let doom: number;
  if (flooding) {
    doom = flooding.at;
  } else {
    let lo = 0;
    let hi = Math.ceil(end / SIM_STEP_S);
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (timeline.stateAt(mid * SIM_STEP_S).outcome === "sank") hi = mid;
      else lo = mid + 1;
    }
    doom = timeline.stateAt(lo * SIM_STEP_S).time;
  }

  const length = input.length;
  const beam = grid.beam;
  const breakup = last.breakup;
  const atX = breakup?.atX ?? null;
  const breakAt = breakup?.at ?? Infinity;

  // She breaks at a known place, so everyone keeps to their own half from
  // doom on: nobody heads for a boat that will be torn away from them.
  const halfGraphs = new Map<WalkHalf, CrowdGraph>();
  const fullGraph = crowdGraphOf(ship, grid);
  const graphOf = (half: WalkHalf | null): CrowdGraph => {
    if (half === null || atX === null) return fullGraph;
    let graph = halfGraphs.get(half);
    if (!graph) {
      graph = crowdGraphOf(ship, halfWalkGrid(grid, half, atX));
      halfGraphs.set(half, graph);
    }
    return graph;
  };
  const halfOfX = (x: number): WalkHalf | null =>
    atX === null ? null : walkHalfOf(x, atX);

  const bodyAt = (state: SimState, half: WalkHalf | null): BodyPose => {
    if (state.halves && state.breakup && half !== null)
      return state.halves[half];
    if (state.halves && state.breakup) return state.halves.stern;
    return state.pose;
  };
  /** Sample times for water checks, from doom to the end. */
  const checks: number[] = [];
  for (let k = 0; doom + k * WATER_CHECK_S < end; k++) {
    checks.push(doom + k * WATER_CHECK_S);
  }
  checks.push(end);
  const checkStates = checks.map((t) => timeline.stateAt(t));

  const boats = lifeboatsOf(ship, length, beam, graphOf, atX);
  const people = crowd.people;
  const count = people.length;
  const horizon = end + WANDER_MARGIN_S;

  const motions: Motion[] = [];
  const fates: Fate[] = [];
  const poseOf = (i: number, t: number): PersonPose => {
    const motion = motions[i];
    return t < motion.crowdUntil
      ? crowd.poseAt(i, t)
      : trackPose(motion.track, t);
  };
  const checkStateAt = new Map(checks.map((t, k) => [t, checkStates[k]]));
  const bodyAtCheck = (t: number, cellsFromBow: number): BodyPose =>
    bodyAt(checkStateAt.get(t) ?? timeline.stateAt(t), halfOfX(cellsFromBow));
  /** The first check from doom and before `until` that finds them in the water. */
  const floatOf = (i: number, until: number): Float | null =>
    until > end
      ? floatingSince(
          (t) => poseOf(i, t),
          bodyAtCheck,
          doom,
          end,
          { length, beam },
          { includeEnd: true }
        )
      : floatingSince((t) => poseOf(i, t), bodyAtCheck, doom, until, {
          length,
          beam,
        });

  // Where everyone is at doom, and the graph they walk on from then.
  const starts = Array.from({ length: count }, (_, i) => crowd.poseAt(i, doom));
  const halves = starts.map((pose) => halfOfX(pose.x));
  const startNodes = starts.map((pose, i) => nodeOf(graphOf(halves[i]), pose));

  // Everyone, nearest first, takes the nearest boat with a shown seat free.
  const pairs: { dist: number; i: number; b: number }[] = [];
  boats.forEach((boat, b) => {
    if (boat.spot < 0 || boat.cap <= 0) return;
    const reach = graphOf(boat.half).reachFrom(boat.spot);
    for (let i = 0; i < count; i++) {
      const node = startNodes[i];
      if (node === undefined || halves[i] !== boat.half) continue;
      const dist = reach.dist[node];
      if (dist >= 0) pairs.push({ dist, i, b });
    }
  });
  pairs.sort((p, q) => p.dist - q.dist || p.i - q.i || p.b - q.b);
  const boatOf = new Int32Array(count).fill(-1);
  const filled = new Int32Array(boats.length);
  for (const { i, b } of pairs) {
    if (boatOf[i] >= 0 || filled[b] >= boats[b].cap) continue;
    boatOf[i] = b;
    filled[b]++;
  }

  // Boarders walk to their boat's spot and wait there; the rest wander on,
  // following the crowd plan until she breaks.
  const arrivals = new Float64Array(count).fill(Infinity);
  for (let i = 0; i < count; i++) {
    const b = boatOf[i];
    const graph = graphOf(halves[i]);
    if (b >= 0) {
      const boat = boats[b];
      const reach = graph.reachFrom(boat.spot);
      const path = pathTo(reach, startNodes[i]!).reverse();
      const track: Segment[] = [];
      const at = walkPath(track, graph, doom, starts[i], path);
      const spot = centre(graph, boat.spot);
      standFrom(track, at.t, { ...spot, yaw: at.yaw, activity: "idle" });
      arrivals[i] = at.t;
      motions.push({ crowdUntil: doom, track });
    } else if (atX === null) {
      motions.push({ crowdUntil: Infinity, track: [] });
    } else {
      const from = Math.max(doom, breakAt);
      const pose = crowd.poseAt(i, from);
      const track: Segment[] = [];
      wanderFrom(
        track,
        graphOf(walkHalfOf(pose.x, atX)),
        from,
        pose,
        horizon,
        mulberry32((people[i].seed ^ 0x5bd1e995) >>> 0)
      );
      motions.push({ crowdUntil: from, track });
    }
    fates.push({ float: null, boatId: null, boardUntil: doom, seat: null });
  }

  // When each boat leaves: its last rider aboard, the wait run out, or the
  // water at its boarding spot, whichever comes first.
  const launches: BoatLaunch[] = [];
  boats.forEach((boat, b) => {
    let flooded = Infinity;
    for (let k = 0; k < checks.length; k++) {
      const body = bodyAt(checkStates[k], boat.half);
      if (poseWorldPoint(body, length, boat.spotRest).y <= 0) {
        flooded = checks[k];
        break;
      }
    }
    const boarders: number[] = [];
    let lastArrival = -Infinity;
    for (let i = 0; i < count; i++) {
      if (boatOf[i] !== b) continue;
      // One who is caught by the water on the way never gets there.
      const float = floatOf(i, arrivals[i]);
      if (float) {
        fates[i].float = float;
        fates[i].boatId = boat.id;
        fates[i].boardUntil = float.since;
        continue;
      }
      boarders.push(i);
      lastArrival = Math.max(lastArrival, arrivals[i]);
    }
    const at = Math.max(
      doom,
      Math.min(
        doom + LAUNCH_WAIT_S,
        flooded,
        boarders.length > 0 ? lastArrival : Infinity
      )
    );
    const riders = boarders
      .filter((i) => arrivals[i] <= at)
      .sort((p, q) => arrivals[p] - arrivals[q] || p - q);
    riders.forEach((i, seat) => {
      fates[i].boatId = boat.id;
      fates[i].boardUntil = arrivals[i];
      fates[i].seat = { boatId: boat.id, seat, at: arrivals[i] };
    });
    // Anyone not there yet goes back to wandering when the boat leaves.
    for (const i of boarders) {
      if (arrivals[i] <= at) continue;
      fates[i].boatId = boat.id;
      fates[i].boardUntil = at;
      const track = motions[i].track;
      const pose = cutAt(track, at);
      wanderFrom(
        track,
        graphOf(halves[i]),
        at,
        pose,
        horizon,
        mulberry32((people[i].seed ^ 0x5bd1e995) >>> 0)
      );
    }
    const body = bodyAt(timeline.stateAt(at), boat.half);
    launches.push({
      boatId: boat.id,
      at,
      origin: poseWorldPoint(body, length, boat.rest),
      roll: body.roll,
      pitch: body.pitch,
      outward: boat.outward,
      riders: riders.map((i) => people[i].id),
    });
  });

  // Everyone not in a boat ends up in the water.
  for (let i = 0; i < count; i++) {
    const fate = fates[i];
    if (fate.seat || fate.float) continue;
    fate.float = floatOf(i, Infinity);
  }

  const fateAt = (i: number, t: number): PersonFate => {
    const fate = fates[i];
    if (!fate) throw new RangeError(`No person ${i}`);
    if (!(t >= doom)) return { kind: "aboard" };
    const { float, seat } = fate;
    if (float && t >= float.since) {
      return {
        kind: "floating",
        since: float.since,
        at: floatPositionAt(float, t),
      };
    }
    if (seat && t >= seat.at) {
      return { kind: "in-boat", boatId: seat.boatId, seat: seat.seat };
    }
    if (fate.boatId && t < fate.boardUntil) {
      return { kind: "boarding", boatId: fate.boatId, until: fate.boardUntil };
    }
    return { kind: "aboard" };
  };

  const poseAt = (i: number, t: number): PersonPose => {
    if (!motions[i]) throw new RangeError(`No person ${i}`);
    return poseOf(i, Number.isFinite(t) && t > 0 ? t : 0);
  };

  const boatPoseAt: EvacuationPlan["boatPoseAt"] = (launch, t) => {
    const s = Math.max(0, t - launch.at);
    const { origin, roll, pitch, outward } = launch;
    const lower = smooth(s / LOWER_S);
    const row = smooth((s - LOWER_S) / ROW_S);
    const afloat = s - LOWER_S - ROW_S;
    const bob =
      afloat > 0
        ? BOAT_BOB_HEIGHT * Math.sin((2 * Math.PI * afloat) / BOAT_BOB_PERIOD_S)
        : 0;
    return {
      position: {
        x: origin.x,
        y: origin.y * (1 - lower) + bob,
        z: origin.z + ROW_OUT * outward * row,
      },
      rotation: { x: roll * (1 - lower), y: 0, z: pitch * (1 - lower) },
    };
  };

  return { launches, fateAt, poseAt, boatPoseAt };
}
