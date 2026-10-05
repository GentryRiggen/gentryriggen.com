import { SIM_STEP_S } from "../sim/types";
import { hullHit, type HullBody } from "./collide";
import {
  SOFT_OBSTACLES,
  type Handling,
  type Obstacle,
  type SailInput,
  type SailShip,
  type SailState,
} from "./types";

const MIN_THROTTLE = -0.3;
/** Slowing (brakes, water drag) is quicker than getting under way. */
const DECEL_FACTOR = 1.6;
/** What is left of her speed after bumping a buoy. */
const BUOY_SPEED_FACTOR = 0.8;
/** Gap left between the hull and a buoy that has been shoved aside. */
const BUOY_CLEARANCE = 0.25;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), hi);

/** Move `current` toward `target` by at most `increment`, snapping on arrival. */
function ease(current: number, target: number, increment: number): number {
  const gap = target - current;
  return Math.abs(gap) <= increment
    ? target
    : current + Math.sign(gap) * increment;
}

export function createSail(
  obstacles: Obstacle[] = [],
  sectors: string[] = []
): SailState {
  return {
    time: 0,
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    rudder: 0,
    obstacles,
    sectors,
    bump: null,
    impact: null,
  };
}

function moveObstacle(o: Obstacle, dt: number): Obstacle {
  if (o.heading === undefined || !o.speed) return o;
  return {
    ...o,
    x: o.x + Math.cos(o.heading) * o.speed * dt,
    z: o.z + Math.sin(o.heading) * o.speed * dt,
  };
}

/**
 * Shove a buoy out to the side of the hull, level with where it was touched,
 * so the ship does not plough it along and bump it again every step.
 */
function shoveClear(hull: HullBody, o: Obstacle): Obstacle {
  const cos = Math.cos(hull.heading);
  const sin = Math.sin(hull.heading);
  const dx = o.x - hull.x;
  const dz = o.z - hull.z;
  const u = dx * cos + dz * sin;
  const v = -dx * sin + dz * cos;
  const side = v < 0 ? -1 : 1;
  const clearV = side * (hull.beam / 2 + o.radius + BUOY_CLEARANCE);
  return {
    ...o,
    x: hull.x + u * cos - clearV * sin,
    z: hull.z + u * sin + clearV * cos,
  };
}

export function stepSail(
  state: SailState,
  input: SailInput,
  ship: SailShip,
  handling: Handling
): SailState {
  if (state.impact) return state;
  const dt = SIM_STEP_S;

  const throttle = clamp(input.throttle, MIN_THROTTLE, 1);
  const target = throttle * handling.topSpeed;
  const accel = (handling.topSpeed / handling.accelSeconds) * dt;
  const increment =
    Math.abs(target) < Math.abs(state.speed) ? accel * DECEL_FACTOR : accel;
  let speed = ease(state.speed, target, increment);

  const rudder = ease(
    state.rudder,
    clamp(input.rudder, -1, 1),
    handling.rudderRate * dt
  );
  const turn =
    rudder * handling.maxTurnRate * clamp(speed / handling.topSpeed, -1, 1);
  const heading = state.heading + turn * dt;

  const x = state.x + Math.cos(heading) * speed * dt;
  const z = state.z + Math.sin(heading) * speed * dt;
  let obstacles = state.obstacles.map((o) => moveObstacle(o, dt));

  const hull: HullBody = {
    x,
    z,
    heading,
    length: ship.length,
    beam: ship.beam,
    vx: Math.cos(heading) * speed,
    vz: Math.sin(heading) * speed,
  };

  let bump: SailState["bump"] = state.bump;
  let impact: SailState["impact"] = null;
  for (let i = 0; i < obstacles.length; i++) {
    const o = obstacles[i];
    const moving = o.heading !== undefined && o.speed !== undefined;
    const hit = hullHit(hull, {
      x: o.x,
      z: o.z,
      radius: o.radius,
      vx: moving ? Math.cos(o.heading!) * o.speed! : 0,
      vz: moving ? Math.sin(o.heading!) * o.speed! : 0,
    });
    if (!hit) continue;

    if (SOFT_OBSTACLES.includes(o.kind)) {
      speed *= BUOY_SPEED_FACTOR;
      obstacles = obstacles.map((other, j) =>
        j === i ? shoveClear(hull, other) : other
      );
      bump = { id: o.id, at: state.time };
    } else {
      impact = {
        obstacleId: o.id,
        kind: o.kind,
        impactX: hit.impactX,
        part: hit.part,
        closingSpeed: hit.closingSpeed,
        at: state.time,
      };
    }
    break;
  }

  return {
    ...state,
    time: state.time + dt,
    x,
    z,
    heading,
    speed,
    rudder,
    obstacles,
    bump,
    impact,
  };
}
