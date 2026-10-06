import { SIM_STEP_S } from "../sim/types";
import {
  TURN_RATE,
  WALK_SPEED,
  WALKER_RADIUS,
  type WalkGrid,
  type WalkInput,
  type WalkState,
} from "./types";

/** How many times a step re-pushes the walker out of overlapping obstacles. */
const PUSH_OUT_PASSES = 4;
/** Overlap left after pushing out that still counts as clear. */
const OVERLAP_EPSILON = 1e-6;
const TWO_PI = Math.PI * 2;

/** Non-finite becomes 0; everything else is held to -1..1. */
function axis(value: number): number {
  return Number.isFinite(value) ? Math.min(1, Math.max(-1, value)) : 0;
}

function wrapYaw(yaw: number): number {
  const wrapped = (((yaw + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI;
  return wrapped - Math.PI;
}

interface Placement {
  x: number;
  z: number;
  level: number;
}

/**
 * Moves the walker's circle from `from` toward (`toX`, `toZ`), sliding along
 * whatever is in the way: the target is pushed out of every blocked cell and
 * blocker circle it overlaps, so motion along a wall carries on. The level
 * changes only when the centre crosses into a cell through a stair link.
 * Returns the old placement if the push-out cannot find a clear spot.
 */
function move(
  grid: WalkGrid,
  from: Placement,
  toX: number,
  toZ: number
): Placement {
  const { level } = from;
  const originX = Math.floor(from.x);
  const originZ = Math.floor(from.z);
  const circles = grid.blockersAt(level);

  /** Can the walker's circle overlap this cell? (Stairs open the faced cell.) */
  const isPassable = (cellX: number, cellZ: number): boolean => {
    if (cellX === originX && cellZ === originZ) return true;
    const isNeighbour =
      Math.abs(cellX - originX) + Math.abs(cellZ - originZ) === 1;
    return isNeighbour
      ? grid.stepLevel(originX, originZ, level, cellX, cellZ) !== null
      : grid.isWalkable(cellX, cellZ, level);
  };

  /** Pushes the point out of one overlap; returns whether it moved. */
  const pushOut = (point: { x: number; z: number }): boolean => {
    let moved = false;
    const cellX = Math.floor(point.x);
    const cellZ = Math.floor(point.z);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (isPassable(cx, cz)) continue;
        const nearestX = Math.min(Math.max(point.x, cx), cx + 1);
        const nearestZ = Math.min(Math.max(point.z, cz), cz + 1);
        moved = repel(point, nearestX, nearestZ, WALKER_RADIUS) || moved;
      }
    }
    for (const circle of circles) {
      moved =
        repel(point, circle.x, circle.z, WALKER_RADIUS + circle.radius) ||
        moved;
    }
    return moved;
  };

  const point = { x: toX, z: toZ };
  for (let pass = 0; pass < PUSH_OUT_PASSES; pass++) {
    if (!pushOut(point)) break;
  }
  // A squeeze the passes could not resolve: stay where we were.
  if (pushOut({ ...point })) return from;

  const cellX = Math.floor(point.x);
  const cellZ = Math.floor(point.z);
  if (cellX === originX && cellZ === originZ) return { ...point, level };
  const isNeighbour =
    Math.abs(cellX - originX) + Math.abs(cellZ - originZ) === 1;
  const nextLevel = isNeighbour
    ? grid.stepLevel(originX, originZ, level, cellX, cellZ)
    : grid.isWalkable(cellX, cellZ, level)
      ? level
      : null;
  return nextLevel === null ? from : { ...point, level: nextLevel };
}

/**
 * Pushes `point` out of a circle-or-point obstacle at (`ox`, `oz`) so that it
 * is at least `clearance` away. Returns whether it overlapped.
 */
function repel(
  point: { x: number; z: number },
  ox: number,
  oz: number,
  clearance: number
): boolean {
  const dx = point.x - ox;
  const dz = point.z - oz;
  const distance = Math.hypot(dx, dz);
  if (distance >= clearance - OVERLAP_EPSILON) return false;
  if (distance < 1e-9) {
    // Dead centre: nudge out along x so the next pass has a direction.
    point.x += clearance;
    return true;
  }
  const push = (clearance - distance) / distance;
  point.x += dx * push;
  point.z += dz * push;
  return true;
}

/**
 * One fixed step (SIM_STEP_S) of the walker. Pure: returns a new state. Input
 * is relative to the walker's heading, held to -1..1 per axis with
 * non-finite values read as 0, and normalised so a diagonal is no faster.
 */
export function stepWalker(
  state: WalkState,
  input: WalkInput,
  grid: WalkGrid
): WalkState {
  const dt = SIM_STEP_S;
  const turn = axis(input.turn);
  const yaw =
    turn === 0 ? state.yaw : wrapYaw(state.yaw + turn * TURN_RATE * dt);
  const base = { yaw, time: state.time + dt };

  let forward = axis(input.forward);
  let strafe = axis(input.strafe);
  const magnitude = Math.hypot(forward, strafe);
  if (magnitude === 0) return { ...state, ...base };
  if (magnitude > 1) {
    forward /= magnitude;
    strafe /= magnitude;
  }

  // Facing is (cos yaw, sin yaw) and right is (-sin yaw, cos yaw) in the
  // ship-aligned world frame; the model frame is that frame negated.
  const worldX = Math.cos(yaw) * forward - Math.sin(yaw) * strafe;
  const worldZ = Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
  const reach = WALK_SPEED * dt;
  const placed = move(
    grid,
    { x: state.x, z: state.z, level: state.level },
    state.x - worldX * reach,
    state.z - worldZ * reach
  );
  return { ...state, ...base, ...placed };
}
