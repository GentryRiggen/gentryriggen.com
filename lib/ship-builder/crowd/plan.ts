import { MAX_LEVEL, WING_REACH } from "../model/grid";
import type { Stats as ShipStats } from "../model/stats";
import type { Ship } from "../model/types";
import {
  ATTACH_BLOCK_RADIUS,
  WALKER_RADIUS,
  type WalkGrid,
} from "../walk/types";
import { between, fnv1a, mulberry32 } from "./rng";
import {
  type CrowdPlan,
  MAX_PEOPLE,
  OUTFIT_COUNT,
  PAUSE_S,
  PERSON_SPEED,
  type Person,
  type PersonPose,
  SEAT_CHANCE,
  type Seat,
  SIT_S,
  WANDER_STEPS,
} from "./types";

/** One person per this many berths or passengers. */
const PER_FIGURE = 40;
/** A block at MAX_LEVEL has its roof one level higher still. */
const SURFACE_LEVELS = MAX_LEVEL + 2;
/** People keep their centre this far from a blocker's centre. */
const BLOCKER_CLEARANCE = ATTACH_BLOCK_RADIUS + WALKER_RADIUS;
/** Random wander picks before scanning every candidate in order. */
const WANDER_TRIES = 12;
/** Start picks before giving up on spreading people out. */
const SPREAD_TRIES = 20;
const SEAT_TYPES = new Set(["deckchair", "bench"]);
const DIRS: readonly (readonly [number, number])[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** How many people a ship carries on screen. */
export function crowdSize(stats: ShipStats): {
  passengers: number;
  crew: number;
} {
  const sourceP = stats.passengers.total;
  const sourceC = stats.crewBerths;
  if (sourceP + sourceC <= 0) return { passengers: 0, crew: 0 };
  let passengers =
    sourceP > 0 ? Math.max(1, Math.round(sourceP / PER_FIGURE)) : 0;
  let crew = sourceC > 0 ? Math.max(1, Math.round(sourceC / PER_FIGURE)) : 0;
  if (passengers + crew > MAX_PEOPLE) {
    const scale = MAX_PEOPLE / (passengers + crew);
    crew = crew > 0 ? Math.max(1, Math.round(crew * scale)) : 0;
    passengers = passengers > 0 ? MAX_PEOPLE - crew : 0;
    if (passengers === 0) crew = MAX_PEOPLE;
  }
  return { passengers, crew };
}

function wrapYaw(yaw: number): number {
  const turn = 2 * Math.PI;
  return ((((yaw + Math.PI) % turn) + turn) % turn) - Math.PI;
}

/**
 * The heading of a part's rotation. Decor is drawn facing local +X and turned
 * by `facingYaw` (scene/facingYaw.ts), so rotation 0 faces model +x (stern),
 * 90 faces +z (port), 180 faces -x and 270 faces -z. A model direction
 * (dx, dz) is yaw atan2(-dz, -dx), hence rotation + PI.
 */
function rotationYaw(rotation: number): number {
  return wrapYaw((rotation * Math.PI) / 180 + Math.PI);
}

function travelYaw(dx: number, dz: number): number {
  return Math.atan2(-dz, -dx);
}

function nearBlocker(
  grid: WalkGrid,
  cx: number,
  cz: number,
  level: number
): boolean {
  return grid
    .blockersAt(level)
    .some((b) => Math.hypot(cx - b.x, cz - b.z) < BLOCKER_CLEARANCE);
}

/**
 * Seats that people can sit in: deckchair and bench parts on walkable
 * surfaces. The seat's own cell is decor, so the grid never marks it
 * walkable; it counts when it has a floor under it (the hull or a floor
 * block's roof), an open neighbour to step in from, and no blocker on it.
 */
export function seatsOf(ship: Ship, grid: WalkGrid): Seat[] {
  const seats: Seat[] = [];
  for (const part of ship.parts) {
    if (!SEAT_TYPES.has(part.type) || part.anchor.kind !== "grid") continue;
    const { x, z, level } = part.anchor;
    const floored =
      level === 0
        ? z >= 0 && z < grid.beam
        : grid.obstructionAt(x, z, level - 1)?.isFloor === true;
    if (!floored) continue;
    if (!DIRS.some(([dx, dz]) => grid.isWalkable(x + dx, z + dz, level))) {
      continue;
    }
    if (nearBlocker(grid, x + 0.5, z + 0.5, level)) continue;
    seats.push({
      partId: part.id,
      x: x + 0.5,
      z: z + 0.5,
      level,
      yaw: rotationYaw(part.rotation),
    });
  }
  return seats;
}

/** A cell column on one surface (integer cell coordinates). */
export interface Column {
  x: number;
  z: number;
  level: number;
}

/** Breadth-first distances and the way back from one column. */
export interface Reach {
  source: number;
  /** Steps from the source, -1 when out of reach. */
  dist: Int32Array;
  /** The previous node on a shortest way, -1 at the source. */
  prev: Int32Array;
  /** Reached nodes in order of distance. */
  order: readonly number[];
}

/**
 * The columns people may stand in and the steps between them: every walkable
 * column clear of blockers, plus seat cells (entered only as an end point).
 */
export interface CrowdGraph {
  readonly nodes: readonly Column[];
  /** The seat index of a node, or -1. */
  readonly seatOf: Int32Array;
  /** Node index of each seat in `seats`. */
  readonly seatNodes: readonly number[];
  readonly seats: readonly Seat[];
  nodeAt(x: number, z: number, level: number): number | undefined;
  /** Cached BFS from a node; seats are never walked through. */
  reachFrom(source: number): Reach;
}

const graphs = new WeakMap<WalkGrid, WeakMap<object, CrowdGraph>>();
/** Keep at most this many BFS results per graph. */
const REACH_CACHE = 512;

/** The crowd's walking graph, built once per grid and ship parts. */
export function crowdGraphOf(ship: Ship, grid: WalkGrid): CrowdGraph {
  let byParts = graphs.get(grid);
  if (!byParts) {
    byParts = new WeakMap();
    graphs.set(grid, byParts);
  }
  let graph = byParts.get(ship.parts);
  if (!graph) {
    graph = buildGraph(seatsOf(ship, grid), grid);
    byParts.set(ship.parts, graph);
  }
  return graph;
}

function buildGraph(seats: Seat[], grid: WalkGrid): CrowdGraph {
  const nodes: Column[] = [];
  const index = new Map<string, number>();
  const key = (x: number, z: number, level: number) => `${x},${z},${level}`;
  for (let level = 0; level < SURFACE_LEVELS; level++) {
    for (let z = -WING_REACH; z < grid.beam + WING_REACH; z++) {
      for (let x = 0; x < grid.length; x++) {
        if (!grid.isWalkable(x, z, level)) continue;
        if (nearBlocker(grid, x + 0.5, z + 0.5, level)) continue;
        index.set(key(x, z, level), nodes.length);
        nodes.push({ x, z, level });
      }
    }
  }
  const walkableCount = nodes.length;
  const seatNodes: number[] = [];
  for (const seat of seats) {
    const column = {
      x: Math.floor(seat.x),
      z: Math.floor(seat.z),
      level: seat.level,
    };
    seatNodes.push(nodes.length);
    index.set(key(column.x, column.z, column.level), nodes.length);
    nodes.push(column);
  }
  const seatOf = new Int32Array(nodes.length).fill(-1);
  seatNodes.forEach((node, s) => (seatOf[node] = s));

  const adjacent: number[][] = nodes.map(() => []);
  for (let n = 0; n < walkableCount; n++) {
    const { x, z, level } = nodes[n];
    for (const [dx, dz] of DIRS) {
      const to = grid.stepLevel(x, z, level, x + dx, z + dz);
      if (to === null) continue;
      const m = index.get(key(x + dx, z + dz, to));
      if (m !== undefined && m < walkableCount) adjacent[n].push(m);
    }
  }
  for (const s of seatNodes) {
    const { x, z, level } = nodes[s];
    for (const [dx, dz] of DIRS) {
      const m = index.get(key(x + dx, z + dz, level));
      if (m === undefined || m >= walkableCount) continue;
      adjacent[s].push(m);
      adjacent[m].push(s);
    }
  }

  const reaches = new Map<number, Reach>();
  return {
    nodes,
    seatOf,
    seatNodes,
    seats,
    nodeAt: (x, z, level) => index.get(key(x, z, level)),
    reachFrom(source) {
      const cached = reaches.get(source);
      if (cached) return cached;
      const dist = new Int32Array(nodes.length).fill(-1);
      const prev = new Int32Array(nodes.length).fill(-1);
      const order: number[] = [source];
      dist[source] = 0;
      for (let head = 0; head < order.length; head++) {
        const n = order[head];
        if (n !== source && seatOf[n] >= 0) continue;
        for (const m of adjacent[n]) {
          if (dist[m] >= 0) continue;
          dist[m] = dist[n] + 1;
          prev[m] = n;
          order.push(m);
        }
      }
      const reach = { source, dist, prev, order };
      if (reaches.size >= REACH_CACHE) reaches.clear();
      reaches.set(source, reach);
      return reach;
    },
  };
}

/** The nodes from a reach's source to `goal`, both included. */
export function pathTo(reach: Reach, goal: number): number[] {
  if (reach.dist[goal] < 0) return [];
  const path: number[] = [];
  for (let n = goal; n >= 0; n = reach.prev[n]) path.push(n);
  return path.reverse();
}

/** A cell centre on a surface. */
interface Spot {
  x: number;
  z: number;
  level: number;
}

interface Leg {
  kind: "walk" | "sit" | "idle";
  startT: number;
  endT: number;
  from: Spot;
  to: Spot;
  /** Node indices of a walk, start and end included; empty otherwise. */
  path: readonly number[];
  /** Heading while sitting or idle. */
  yaw: number;
}

interface Walker {
  legs: Leg[];
  /** The node the schedule ends on. */
  node: number;
  /** Heading at the end of the schedule. */
  yaw: number;
  /** When the schedule ends. */
  end: number;
  random: () => number;
}

function centreOf(column: Column): Spot {
  return { x: column.x + 0.5, z: column.z + 0.5, level: column.level };
}

function overlaps(list: [number, number][] | undefined, s: number, e: number) {
  return list?.some(([a, b]) => a < e && s < b) ?? false;
}

export function planCrowd(
  ship: Ship,
  grid: WalkGrid,
  stats: ShipStats
): CrowdPlan {
  const graph = crowdGraphOf(ship, grid);
  const seed = fnv1a(
    `${ship.name}|${ship.parts.length}|${ship.hull.lengthSegments}`
  );
  const main = mulberry32(seed);
  const standable: number[] = [];
  for (let n = 0; n < graph.nodes.length; n++) {
    if (graph.seatOf[n] < 0) standable.push(n);
  }
  const size = crowdSize(stats);
  const count = Math.min(size.passengers + size.crew, standable.length);
  const crewCount = Math.min(size.crew, count);

  const people: Person[] = [];
  const walkers: Walker[] = [];
  /** Who holds each node when: idle people on a cell, sitters on a seat. */
  const claims = new Map<number, [number, number][]>();
  const claim = (node: number, s: number, e: number) => {
    const list = claims.get(node);
    if (list) list.push([s, e]);
    else claims.set(node, [[s, e]]);
  };
  const isFree = (node: number, s: number, e: number) =>
    !overlaps(claims.get(node), s, e);

  const starts: number[] = [];
  const near = (a: number, b: number) => {
    const p = graph.nodes[a];
    const q = graph.nodes[b];
    return (
      p.level === q.level &&
      Math.abs(p.x - q.x) <= 1 &&
      Math.abs(p.z - q.z) <= 1
    );
  };
  for (let i = 0; i < count; i++) {
    let pick = -1;
    for (let tries = 0; tries < SPREAD_TRIES; tries++) {
      const n = standable[Math.floor(main() * standable.length)];
      if (starts.includes(n)) continue;
      pick = n;
      if (!starts.some((s) => near(s, n))) break;
    }
    if (pick < 0) pick = standable.find((n) => !starts.includes(n))!;
    starts.push(pick);
  }

  for (let i = 0; i < count; i++) {
    const kind = i < count - crewCount ? "passenger" : "crew";
    const personSeed = (seed ^ Math.imul(i, 0x9e3779b9)) >>> 0;
    people.push({
      id: `p${i}`,
      kind,
      outfit: kind === "crew" ? 0 : 1 + Math.floor(main() * (OUTFIT_COUNT - 1)),
      seed: personSeed,
    });
    const random = mulberry32(personSeed);
    const node = starts[i];
    const yaw = travelYaw(...DIRS[Math.floor(random() * DIRS.length)]);
    const pause = between(random, PAUSE_S);
    const spot = centreOf(graph.nodes[node]);
    claim(node, 0, pause);
    walkers.push({
      legs: [
        {
          kind: "idle",
          startT: 0,
          endT: pause,
          from: spot,
          to: spot,
          path: [],
          yaw,
        },
      ],
      node,
      yaw,
      end: pause,
      random,
    });
  }

  /** Plan one more trip for a walker: walk, maybe sit, then pause. */
  const advance = (walker: Walker) => {
    const now = walker.end;
    for (const list of claims.values()) {
      for (let k = list.length - 1; k >= 0; k--) {
        if (list[k][1] <= now) list.splice(k, 1);
      }
    }
    const { random } = walker;
    const reach = graph.reachFrom(walker.node);
    const arriveAt = (node: number) => now + reach.dist[node] / PERSON_SPEED;
    const sit = between(random, SIT_S);
    const pause = between(random, PAUSE_S);

    let goal = -1;
    let seated = false;
    if (graph.seatNodes.length > 0 && random() < SEAT_CHANCE) {
      const free = graph.seatNodes.filter((n) => {
        if (n === walker.node || reach.dist[n] < 0) return false;
        const arrive = arriveAt(n);
        return isFree(n, arrive, arrive + sit + pause);
      });
      if (free.length > 0) {
        goal = free[Math.floor(random() * free.length)];
        seated = true;
      }
    }
    if (goal < 0) {
      const wander = reach.order.filter(
        (n) =>
          reach.dist[n] > 0 &&
          reach.dist[n] <= WANDER_STEPS &&
          graph.seatOf[n] < 0
      );
      const fits = (n: number) => {
        const arrive = arriveAt(n);
        return isFree(n, arrive, arrive + pause);
      };
      for (let tries = 0; tries < WANDER_TRIES && wander.length > 0; tries++) {
        const n = wander[Math.floor(random() * wander.length)];
        if (fits(n)) {
          goal = n;
          break;
        }
      }
      if (goal < 0) goal = wander.find(fits) ?? walker.node;
    }

    const path = goal === walker.node ? [] : pathTo(reach, goal);
    const from = centreOf(graph.nodes[walker.node]);
    const to = centreOf(graph.nodes[goal]);
    const arrive = path.length > 1 ? arriveAt(goal) : now;
    let yaw = walker.yaw;
    if (path.length > 1) {
      const a = graph.nodes[path[path.length - 2]];
      const b = graph.nodes[goal];
      yaw = travelYaw(b.x - a.x, b.z - a.z);
      walker.legs.push({
        kind: "walk",
        startT: now,
        endT: arrive,
        from,
        to,
        path,
        yaw,
      });
    }
    let t = arrive;
    if (seated) {
      yaw = graph.seats[graph.seatOf[goal]].yaw;
      walker.legs.push({
        kind: "sit",
        startT: t,
        endT: t + sit,
        from: to,
        to,
        path: [],
        yaw,
      });
      t += sit;
    }
    walker.legs.push({
      kind: "idle",
      startT: t,
      endT: t + pause,
      from: to,
      to,
      path: [],
      yaw,
    });
    claim(goal, arrive, t + pause);
    walker.node = goal;
    walker.yaw = yaw;
    walker.end = t + pause;
  };

  /**
   * Extends every schedule past `t`, always growing the one that ends first
   * (ties to the lower index). The order of trips is then the same however
   * poses are asked for, so a plan is a pure function of the ship.
   */
  let horizon = 0;
  const extendTo = (t: number) => {
    if (t < horizon) return;
    for (;;) {
      let first = -1;
      for (let i = 0; i < walkers.length; i++) {
        if (first < 0 || walkers[i].end < walkers[first].end) first = i;
      }
      if (first < 0 || walkers[first].end > t) break;
      advance(walkers[first]);
    }
    horizon = walkers.reduce((m, w) => Math.min(m, w.end), Infinity);
  };

  const poseAt = (i: number, time: number): PersonPose => {
    const walker = walkers[i];
    if (!walker) throw new RangeError(`No person ${i}`);
    const t = Number.isFinite(time) && time > 0 ? time : 0;
    extendTo(t);
    const { legs } = walker;
    let lo = 0;
    let hi = legs.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (legs[mid].startT <= t) lo = mid;
      else hi = mid - 1;
    }
    const leg = legs[lo];
    if (leg.kind !== "walk") {
      return { ...leg.to, yaw: leg.yaw, activity: leg.kind };
    }
    const steps = leg.path.length - 1;
    const along = Math.min(steps, Math.max(0, (t - leg.startT) * PERSON_SPEED));
    const k = Math.min(steps - 1, Math.floor(along));
    const frac = along - k;
    const a = graph.nodes[leg.path[k]];
    const b = graph.nodes[leg.path[k + 1]];
    const x = a.x + 0.5 + frac * (b.x - a.x);
    const z = a.z + 0.5 + frac * (b.z - a.z);
    const inFrom = Math.floor(x) === a.x && Math.floor(z) === a.z;
    return {
      x,
      z,
      level: inFrom ? a.level : b.level,
      yaw: travelYaw(b.x - a.x, b.z - a.z),
      activity: "walk",
    };
  };

  return { people, seats: graph.seats, poseAt };
}
