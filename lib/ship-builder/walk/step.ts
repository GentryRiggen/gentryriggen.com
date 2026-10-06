import { SIM_STEP_S } from "../sim/types";
import {
  GRAVITY,
  JUMP_SPEED,
  LEDGE_TOLERANCE,
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

/** What the walker stands on right now, for working out what they can enter. */
interface Footing extends Placement {
  /** Height of the feet in levels (surface plus lift). */
  foot: number;
  /** Off the ground: jumping, falling, or standing on something low. */
  airborne: boolean;
}

/**
 * The level a walker whose feet are at `foot` ends up on by entering the
 * column (`cellX`, `cellZ`) from `from`, or null when it is closed to them:
 *  - a walkable cell or a stair link: as walking always did,
 *  - a ledge (a deck, cabin, bridge or container roof) the feet have reached:
 *    one level up,
 *  - something low (a chair, a pool) the feet are above: the same level, over it,
 *  - an edge, when airborne: down to the surface below, if there is one.
 */
function entering(
  grid: WalkGrid,
  from: Footing,
  cellX: number,
  cellZ: number
): number | null {
  const { level, foot } = from;
  const originX = Math.floor(from.x);
  const originZ = Math.floor(from.z);
  if (cellX === originX && cellZ === originZ) return level;
  const isNeighbour =
    Math.abs(cellX - originX) + Math.abs(cellZ - originZ) === 1;
  const same = isNeighbour
    ? grid.stepLevel(originX, originZ, level, cellX, cellZ)
    : grid.isWalkable(cellX, cellZ, level)
      ? level
      : null;
  if (same !== null) return same;

  const here = grid.obstructionAt(cellX, cellZ, level);
  if (here) {
    if (here.isFloor) {
      const roof = grid.surfaceHeight(cellX, cellZ, level + 1);
      const reached = foot >= roof - LEDGE_TOLERANCE;
      return reached && grid.isWalkable(cellX, cellZ, level + 1)
        ? level + 1
        : null;
    }
    return foot >= here.top - LEDGE_TOLERANCE ? level : null;
  }
  return from.airborne ? grid.dropLevel(cellX, cellZ, level) : null;
}

/**
 * Moves the walker's circle from `from` toward (`toX`, `toZ`), sliding along
 * whatever is in the way: the target is pushed out of every column and blocker
 * circle it overlaps that the walker cannot enter (see `entering`), so motion
 * along a wall carries on. The level changes only when the centre crosses into
 * a column that puts them on another surface. Returns the old placement if the
 * push-out cannot find a clear spot.
 */
function move(
  grid: WalkGrid,
  from: Footing,
  toX: number,
  toZ: number
): Placement {
  const { level } = from;
  const circles = grid.blockersAt(level);

  /** Pushes the point out of one overlap; returns whether it moved. */
  const pushOut = (point: { x: number; z: number }): boolean => {
    let moved = false;
    const cellX = Math.floor(point.x);
    const cellZ = Math.floor(point.z);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cx = cellX + dx;
        const cz = cellZ + dz;
        if (entering(grid, from, cx, cz) !== null) continue;
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

  const nextLevel = entering(
    grid,
    from,
    Math.floor(point.x),
    Math.floor(point.z)
  );
  return nextLevel === null ? from : { ...point, level: nextLevel };
}

/** Height of the surface under the feet: a walkable floor, or something low. */
function supportHeight(grid: WalkGrid, at: Placement): number | null {
  const cellX = Math.floor(at.x);
  const cellZ = Math.floor(at.z);
  if (grid.isWalkable(cellX, cellZ, at.level)) {
    return grid.surfaceHeight(cellX, cellZ, at.level);
  }
  const low = grid.obstructionAt(cellX, cellZ, at.level);
  return low && !low.isFloor ? low.top : null;
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

/** Feet this close to the surface under them count as standing on it. */
const GROUND_EPSILON = 1e-6;

/**
 * Gravity, and a jump when one is asked for and the feet are on something.
 * The walker lands on the surface under them, which is the floor, or the top
 * of something low they are over (so a hop onto a deck chair stays there).
 */
function fall(
  grid: WalkGrid,
  at: Placement,
  lift: number,
  rise: number,
  jump: boolean
): { lift: number; rise: number } {
  const base = grid.surfaceHeight(Math.floor(at.x), Math.floor(at.z), at.level);
  const support = supportHeight(grid, at);
  let foot = base + lift;
  const grounded = support !== null && foot <= support + GROUND_EPSILON;
  let speed = rise;
  if (grounded) {
    foot = support;
    speed = jump ? JUMP_SPEED : 0;
    if (!jump) return { lift: foot - base, rise: 0 };
  }
  speed -= GRAVITY * SIM_STEP_S;
  foot += speed * SIM_STEP_S;
  if (support !== null && foot <= support) {
    return { lift: support - base, rise: 0 };
  }
  return { lift: foot - base, rise: speed };
}

/**
 * One fixed step (SIM_STEP_S) of the walker. Pure: returns a new state. Input
 * is relative to the walker's heading, held to -1..1 per axis with
 * non-finite values read as 0, and normalised so a diagonal is no faster.
 * Jumping and falling are worked out after the move, so the feet's height
 * decides what the move may cross (see `entering`).
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
  const lift = Math.max(0, state.lift ?? 0);
  const rise = state.rise ?? 0;

  let forward = axis(input.forward);
  let strafe = axis(input.strafe);
  const magnitude = Math.hypot(forward, strafe);
  let placed: Placement = { x: state.x, z: state.z, level: state.level };
  if (magnitude > 0) {
    if (magnitude > 1) {
      forward /= magnitude;
      strafe /= magnitude;
    }
    // Facing is (cos yaw, sin yaw) and right is (-sin yaw, cos yaw) in the
    // ship-aligned world frame; the model frame is that frame negated.
    const worldX = Math.cos(yaw) * forward - Math.sin(yaw) * strafe;
    const worldZ = Math.sin(yaw) * forward + Math.cos(yaw) * strafe;
    const reach = WALK_SPEED * dt;
    const surface = grid.surfaceHeight(
      Math.floor(state.x),
      Math.floor(state.z),
      state.level
    );
    const support = supportHeight(grid, placed);
    const foot = surface + lift;
    placed = move(
      grid,
      {
        ...placed,
        foot,
        airborne: support === null || foot > support + GROUND_EPSILON,
      },
      state.x - worldX * reach,
      state.z - worldZ * reach
    );
  }

  // A change of level keeps the feet where they are, so a ledge climbed or an
  // edge stepped off turns into a lift above (or a sink onto) the new surface.
  const oldBase = grid.surfaceHeight(
    Math.floor(state.x),
    Math.floor(state.z),
    state.level
  );
  const newBase = grid.surfaceHeight(
    Math.floor(placed.x),
    Math.floor(placed.z),
    placed.level
  );
  const viaStairs =
    placed.level !== state.level &&
    grid.stairs.some(
      ({ from, to }) =>
        from.level === state.level &&
        from.x === Math.floor(state.x) &&
        from.z === Math.floor(state.z) &&
        to.level === placed.level &&
        to.x === Math.floor(placed.x) &&
        to.z === Math.floor(placed.z)
    );
  const carried = viaStairs ? lift : Math.max(0, oldBase + lift - newBase);
  const vertical = fall(grid, placed, carried, rise, input.jump === true);
  return { ...state, ...base, ...placed, ...vertical };
}
