import { getPartDef } from "../model/catalog";
import { rotatedFootprint } from "../model/grid";
import type { PlacedPart, Ship } from "../model/types";
import { DECK_Y, LEVEL_HEIGHT } from "../model/worldFrame";
import { analyzeShip } from "../model/analysis";
import { poseWorldPoint } from "../sim/funnelFall";
import { floodOf } from "../sim/trialKind";
import { SIM_STEP_S, type SimState, type TrialInput } from "../sim/types";
import { halfWalkGrid, type WalkHalf, walkHalfOf } from "../walk/halfGrid";
import type { WalkGrid } from "../walk/types";
import { hungLifeboats, peopleAboard } from "./lifeboatCount";
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

/** Seated figures drawn per boat (Like the Titanic; Fill every seat has no cap). */
export const BOAT_SHOWN_MAX = 4;
/** Fill every seat: how long a figure with no way to its boat takes to fade out. */
export const FADE_S = 0.6;
/** A boat lowers this long after doom even if not full. */
export const LAUNCH_WAIT_S = 12;
/** Davit to water. */
export const LOWER_S = 6;
/** World units outboard once on the water. */
export const ROW_OUT = 3;
export const ROW_S = 5;
/** A raft canister falls from the deck edge to the water in this long… */
export const RAFT_DROP_S = 1;
/** …landing this far outboard, world units… */
export const RAFT_THROW = 0.5;
/** …then pops open over this long. */
export const RAFT_INFLATE_S = 1;
/** Launch to riders jumping in. */
export const RAFT_READY_S = RAFT_DROP_S + RAFT_INFLATE_S;
/** One jump from the deck edge into the raft. */
export const JUMP_S = 0.7;
/** Riders go one after another, this far apart. */
export const JUMP_GAP_S = 0.35;
/** Once everyone is in, the raft drifts this far outboard… */
export const RAFT_DRIFT = 2;
/** …over this long. */
export const RAFT_DRIFT_S = 6;

/** Sim seconds between checks for water reaching a person or a boat deck. */
const WATER_CHECK_S = 0.25;
/** A person in the water drifts outward this fast, world units per second… */
const FLOAT_DRIFT_SPEED = 0.2;
/** …for this long, then stays put. */
const FLOAT_DRIFT_S = 5;
/** Height and period of a launched boat's bob once it has rowed out. */
const BOAT_BOB_HEIGHT = 0.04;
const BOAT_BOB_PERIOD_S = 2.4;
/** Fill every seat: a figure with no way to a boat ranks behind every walker. */
const NO_WAY_COST = 1e6;
/** Wander schedules after doom run this far past the timeline's end. */
const WANDER_MARGIN_S = 1;

export interface BoatLaunch {
  /** The lifeboat (or raft canister) part id. */
  boatId: string;
  /** Lowered from a davit, or a canister thrown over to inflate. */
  kind: "davit" | "raft";
  /** Sim seconds the boat starts lowering (a raft: is thrown over). */
  at: number;
  /** A raft is afloat and open: riders start jumping in. A davit boat: `at`. */
  ready: number;
  /** A raft drifts away from here (its last rider in). A davit boat: `at`. */
  departs: number;
  /** World transform of the boat at `at` (from the carrying body's pose then). */
  origin: { x: number; y: number; z: number };
  roll: number;
  pitch: number;
  /** Outboard direction in world z: +1 or -1. */
  outward: 1 | -1;
  /** People seated in it (ids): at most BOAT_SHOWN_MAX like the Titanic. */
  riders: readonly string[];
}

export type PersonFate =
  /** Follows `EvacuationPlan.poseAt` (the crowd plan before doom). */
  | { kind: "aboard" }
  /** Walking to a boat's boarding spot; `until` is when that walk ends. */
  | { kind: "boarding"; boatId: string; until: number }
  | { kind: "in-boat"; boatId: string; seat: number }
  /**
   * Jumping from the deck edge (world `from`, where they stood as they
   * leapt) into seat `seat` of raft `boatId`, `progress` 0 to 1.
   */
  | {
      kind: "jumping";
      boatId: string;
      seat: number;
      progress: number;
      from: { x: number; y: number; z: number };
    }
  /**
   * Fill every seat only: fading out where they are (`fade` 0 to 1, then
   * gone) on the way to a seat in `boatId` they cannot walk to in time.
   */
  | { kind: "transfer"; boatId: string; fade: number }
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
  kind: "davit" | "raft";
  /** Catalog seats (real people). */
  seats: number;
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
  /** Fill every seat: when they start fading out on the way to their seat. */
  fadeFrom: number | null;
  /** A raft rider's leap: when it starts and the world point they leave. */
  jump: { at: number; from: Vec3 } | null;
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
 * Every lifeboat hanging from a davit, and every raft canister, with its
 * boarding spot: the walkable column nearest the davit (or raft) point, its
 * own cell or the one inboard of it, on the block's roof or (for a side
 * davit) the block's own level.
 */
function lifeboatsOf(
  ship: Ship,
  length: number,
  beam: number,
  graphOf: (half: WalkHalf | null) => CrowdGraph,
  atX: number | null
): Lifeboat[] {
  const boats: Lifeboat[] = [];
  for (const { part, kind, seats, block, hang, mount } of hungLifeboats(ship)) {
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
      kind,
      seats,
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
  if (!floodOf(input)) return null;
  const fill = input.lifeboats === "fill";

  // Doom is the iceberg strike or the storm's first wash aboard (the first
  // water in) of a trial that ends with her sunk, so the whole flooding stretch is there for boarding. A
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
  // Filling every seat, the way to a boat may also hop between decks
  // (`jumps`); wandering keeps to the stairs. The two graphs share nodes.
  const graphsOf = (jumps: boolean) => {
    const halfGraphs = new Map<WalkHalf, CrowdGraph>();
    const full = crowdGraphOf(ship, grid, { jumps });
    return (half: WalkHalf | null): CrowdGraph => {
      if (half === null || atX === null) return full;
      let graph = halfGraphs.get(half);
      if (!graph) {
        graph = crowdGraphOf(ship, halfWalkGrid(grid, half, atX), { jumps });
        halfGraphs.set(half, graph);
      }
      return graph;
    };
  };
  const wanderGraphOf = graphsOf(false);
  const graphOf = fill ? graphsOf(true) : wanderGraphOf;
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

  /** When the water first reaches a boat's boarding spot, or Infinity. */
  const floodedAt = (boat: Lifeboat): number => {
    for (let k = 0; k < checks.length; k++) {
      const body = bodyAt(checkStates[k], boat.half);
      if (poseWorldPoint(body, length, boat.spotRest).y <= 0) return checks[k];
    }
    return Infinity;
  };

  // The per-person setup both lifeboat modes share.
  /** A fate before any boat is decided: aboard, heading nowhere. */
  const newFate = (): Fate => ({
    float: null,
    boatId: null,
    boardUntil: doom,
    seat: null,
    fadeFrom: null,
    jump: null,
  });
  /**
   * The latest a boat can launch, in both modes: a davit boat before the
   * water reaches its spot and `LOWER_S` before the end; a raft early enough
   * before either to drop, open and take its `jumpers` in.
   */
  const latestLaunch = (boat: Lifeboat, jumpers: number): number => {
    if (boat.kind === "davit") return Math.min(floodedAt(boat), end - LOWER_S);
    const lead = RAFT_READY_S + JUMP_S + Math.max(0, jumpers - 1) * JUMP_GAP_S;
    return Math.min(floodedAt(boat), end) - lead;
  };
  /** Each person's own wander, the same every run. */
  const wanderRandom = (i: number) =>
    mulberry32((people[i].seed ^ 0x5bd1e995) >>> 0);
  /**
   * Person `i` walks from doom to `boat`'s boarding spot and waits there.
   * Returns when they get there.
   */
  const walkToBoat = (i: number, boat: Lifeboat): number => {
    const graph = graphOf(halves[i]);
    const path = pathTo(graph.reachFrom(boat.spot), startNodes[i]!).reverse();
    const track: Segment[] = [];
    const at = walkPath(track, graph, doom, starts[i], path);
    const spot = centre(graph, boat.spot);
    standFrom(track, at.t, { ...spot, yaw: at.yaw, activity: "idle" });
    motions.push({ crowdUntil: doom, track });
    return at.t;
  };
  /**
   * Person `i` has no boat: they follow the crowd plan until she breaks
   * (forever if she never does), then wander on their half.
   */
  const wanderOn = (i: number): void => {
    if (atX === null) {
      motions.push({ crowdUntil: Infinity, track: [] });
      return;
    }
    const from = Math.max(doom, breakAt);
    const pose = crowd.poseAt(i, from);
    const track: Segment[] = [];
    wanderFrom(
      track,
      wanderGraphOf(walkHalfOf(pose.x, atX)),
      from,
      pose,
      horizon,
      wanderRandom(i)
    );
    motions.push({ crowdUntil: from, track });
  };

  /**
   * A raft's riders, seated in order: each waits at the edge until the raft
   * is open, then jumps in, one after another. One the water reaches first
   * floats (Fill every seat: fades into the raft instead). A rider already
   * fading in (Fill every seat, no way there) appears once it is open.
   * Returns who made it, in seat order, and when the last one is in.
   */
  const jumpIn = (
    at: number,
    riders: readonly number[]
  ): { riders: number[]; departs: number } => {
    const ready = at + RAFT_READY_S;
    const kept: number[] = [];
    let departs = ready;
    const keep = (i: number, seatAt: number) => {
      const seat = fates[i].seat!;
      fates[i].seat = { ...seat, seat: kept.length, at: seatAt };
      kept.push(i);
      departs = Math.max(departs, seatAt);
    };
    let jumps = 0;
    for (const i of riders) {
      const fate = fates[i];
      if (fate.fadeFrom !== null) {
        keep(i, Math.max(fate.seat!.at, ready));
        continue;
      }
      const jumpAt = ready + jumps * JUMP_GAP_S;
      const pose = poseOf(i, jumpAt);
      const body = bodyAt(timeline.stateAt(jumpAt), halfOfX(pose.x));
      const from = personWorldPoint(pose, body, length, beam);
      // The checks stop short of the jump; it counts too.
      const float =
        floatOf(i, jumpAt) ??
        (from.y > 0
          ? null
          : {
              since: jumpAt,
              x: from.x,
              z: from.z,
              outward: from.z >= 0 ? 1 : -1,
            });
      if (float && fill) {
        fate.fadeFrom = Math.max(doom, float.since - FADE_S);
        fate.boardUntil = fate.fadeFrom;
        keep(i, Math.max(float.since, ready));
        continue;
      }
      if (float) {
        fate.float = float;
        fate.seat = null;
        fate.boardUntil = float.since;
        continue;
      }
      jumps++;
      fate.jump = { at: jumpAt, from };
      fate.boardUntil = jumpAt;
      keep(i, jumpAt + JUMP_S);
    }
    return { riders: kept, departs };
  };

  const launchOf = (
    boat: Lifeboat,
    at: number,
    riders: readonly number[]
  ): BoatLaunch => {
    const body = bodyAt(timeline.stateAt(at), boat.half);
    const raft =
      boat.kind === "raft"
        ? jumpIn(at, riders)
        : { riders: [...riders], departs: at };
    return {
      boatId: boat.id,
      kind: boat.kind,
      at,
      ready: boat.kind === "raft" ? at + RAFT_READY_S : at,
      departs: raft.departs,
      origin: poseWorldPoint(body, length, boat.rest),
      roll: body.roll,
      pitch: body.pitch,
      outward: boat.outward,
      riders: raft.riders.map((i) => people[i].id),
    };
  };

  // Fill every seat: as many figures as the real seats would save, nearest
  // first, spread over the boats by their seats. Each boat waits for all of
  // hers (walking there, or fading out and into the boat when there is no
  // way, or no time) unless the water reaches her boarding spot first.
  const fillBoats = (): void => {
    // The real seats: the same boats `lifeboatCount` sums (both read
    // `hungLifeboats`), against everyone aboard.
    const boatSeats = boats.reduce((n, boat) => n + boat.seats, 0);
    const aboard = peopleAboard(analyzeShip(ship).stats);
    const saved =
      boatSeats <= 0
        ? 0
        : boatSeats >= aboard
          ? count
          : Math.min(count, Math.round((count * boatSeats) / aboard));
    // Each boat's share by its seats, largest remainder.
    const share = boats.map((boat) =>
      boatSeats > 0 ? (saved * boat.seats) / boatSeats : 0
    );
    const quota = share.map(Math.floor);
    const spare = saved - quota.reduce((n, q) => n + q, 0);
    share
      .map((s, b) => ({ b, rest: s - quota[b] }))
      .sort((p, q) => q.rest - p.rest || p.b - q.b)
      .slice(0, spare)
      .forEach(({ b }) => quota[b]++);

    const straight = (i: number, boat: Lifeboat): number => {
      const pose = starts[i];
      const to = boat.spotRest;
      return Math.hypot(
        length / 2 - pose.x - to.x,
        DECK_Y + pose.level * LEVEL_HEIGHT - to.y,
        beam / 2 - pose.z - to.z
      );
    };
    // Nearest first: a walk on the graph, then (far behind) anyone with no
    // way there, by the straight distance.
    const pairs: { cost: number; i: number; b: number; walks: boolean }[] = [];
    boats.forEach((boat, b) => {
      if (quota[b] <= 0) return;
      const reach =
        boat.spot >= 0 ? graphOf(boat.half).reachFrom(boat.spot) : null;
      for (let i = 0; i < count; i++) {
        const node = startNodes[i];
        const dist =
          reach && node !== undefined && halves[i] === boat.half
            ? reach.dist[node]
            : -1;
        pairs.push({
          cost: dist >= 0 ? dist : NO_WAY_COST + straight(i, boat),
          i,
          b,
          walks: dist >= 0,
        });
      }
    });
    pairs.sort((p, q) => p.cost - q.cost || p.i - q.i || p.b - q.b);
    const boatOf = new Int32Array(count).fill(-1);
    const walks = new Uint8Array(count);
    const filled = new Int32Array(boats.length);
    for (const pair of pairs) {
      const { i, b } = pair;
      if (boatOf[i] >= 0 || filled[b] >= quota[b]) continue;
      boatOf[i] = b;
      walks[i] = pair.walks ? 1 : 0;
      filled[b]++;
    }

    // When each rider would be in their seat, and when they start to fade.
    const target = new Float64Array(count).fill(Infinity);
    const fadeFrom: (number | null)[] = new Array(count).fill(null);
    for (let i = 0; i < count; i++) {
      const b = boatOf[i];
      fates.push(newFate());
      if (b >= 0 && walks[i]) {
        target[i] = walkToBoat(i, boats[b]);
      } else if (b >= 0) {
        // No way there: they fade out where they stand, and are in the
        // boat about when a walk there would have taken.
        const track: Segment[] = [];
        standFrom(track, doom, { ...starts[i], activity: "idle" });
        target[i] =
          doom + Math.max(FADE_S, straight(i, boats[b]) / PERSON_SPEED);
        fadeFrom[i] = doom;
        motions.push({ crowdUntil: doom, track });
      } else {
        wanderOn(i);
      }
    }
    // A walker the water catches on the way fades into the boat instead.
    for (let i = 0; i < count; i++) {
      if (boatOf[i] < 0 || !walks[i]) continue;
      const float = floatOf(i, target[i]);
      if (!float) continue;
      target[i] = float.since;
      fadeFrom[i] = Math.max(doom, float.since - FADE_S);
    }

    boats.forEach((boat, b) => {
      const riders: number[] = [];
      let last = -Infinity;
      for (let i = 0; i < count; i++) {
        if (boatOf[i] !== b) continue;
        riders.push(i);
        last = Math.max(last, target[i]);
      }
      // Only walkers jump into a raft; the rest fade in.
      const jumpers = riders.filter((i) => fadeFrom[i] === null).length;
      const at = Math.max(
        doom,
        Math.min(
          riders.length > 0 ? last : doom + LAUNCH_WAIT_S,
          latestLaunch(boat, jumpers)
        )
      );
      // Anyone not there when she must go fades into her as she leaves.
      const seatAt = (i: number) => Math.min(target[i], at);
      for (const i of riders) {
        if (target[i] <= at) continue;
        fadeFrom[i] = Math.min(
          fadeFrom[i] ?? Infinity,
          Math.max(doom, at - FADE_S)
        );
      }
      riders.sort((p, q) => seatAt(p) - seatAt(q) || p - q);
      riders.forEach((i, seat) => {
        const fate = fates[i];
        fate.boatId = boat.id;
        fate.fadeFrom = fadeFrom[i];
        fate.boardUntil = fadeFrom[i] ?? seatAt(i);
        fate.seat = { boatId: boat.id, seat, at: seatAt(i) };
      });
      launches.push(launchOf(boat, at, riders));
    });
  };

  const launches: BoatLaunch[] = [];
  if (fill) {
    fillBoats();
  } else {
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
      if (b >= 0) {
        arrivals[i] = walkToBoat(i, boats[b]);
      } else {
        wanderOn(i);
      }
      fates.push(newFate());
    }

    // When each boat leaves: its last rider aboard, the wait run out, or the
    // water at its boarding spot, whichever comes first.
    boats.forEach((boat, b) => {
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
          latestLaunch(boat, boarders.length),
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
          wanderRandom(i)
        );
      }
      launches.push(launchOf(boat, at, riders));
    });
  }

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
    if (seat && fate.jump && t >= fate.jump.at) {
      return {
        kind: "jumping",
        boatId: seat.boatId,
        seat: seat.seat,
        progress: Math.min(1, (t - fate.jump.at) / JUMP_S),
        from: fate.jump.from,
      };
    }
    if (seat && fate.fadeFrom !== null && t >= fate.fadeFrom) {
      const fade = Math.min(1, (t - fate.fadeFrom) / FADE_S);
      return { kind: "transfer", boatId: seat.boatId, fade };
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
    if (launch.kind === "raft") {
      // Thrown over: it falls, speeding up, out to the water, waits there
      // while everyone jumps in, then drifts away and bobs.
      const drop = Math.min(1, s / RAFT_DROP_S);
      const drift = smooth((t - launch.departs) / RAFT_DRIFT_S);
      const afloat = s - RAFT_DROP_S;
      const bob =
        afloat > 0
          ? BOAT_BOB_HEIGHT *
            Math.sin((2 * Math.PI * afloat) / BOAT_BOB_PERIOD_S)
          : 0;
      return {
        position: {
          x: origin.x,
          y: origin.y * (1 - drop * drop) + bob,
          z: origin.z + outward * (RAFT_THROW * drop + RAFT_DRIFT * drift),
        },
        rotation: { x: roll * (1 - drop), y: 0, z: pitch * (1 - drop) },
      };
    }
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
