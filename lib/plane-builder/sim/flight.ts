// lib/plane-builder/sim/flight.ts
import { RUNOUT } from "../levels/generate";
import { terrainHeight } from "../levels/terrain";
import type { LevelDef, Obstacle, ObstacleKind } from "../levels/types";
import type { PlaneStats } from "../plane/stats";
import {
  BANK_RATE,
  BOOST_BURN,
  BOOST_THRUST,
  CEILING,
  CEILING_DIVE,
  CEILING_FADE,
  COIN_RADIUS,
  COMBO_WINDOW,
  CORRIDOR_PUSH,
  CORRIDOR_TURN,
  FUEL_CAN_RADIUS,
  FUEL_CAN_SECONDS,
  G,
  LAND_ANGLE,
  LAND_SPEED,
  LAUNCH_HEIGHT,
  LAUNCH_HOLD,
  LIFT_HEADROOM,
  MAX_AIM_PITCH,
  MAX_AIM_YAW,
  MAX_BANK,
  MAX_COMBO_MULTIPLIER,
  MAX_FLIGHT_TIME,
  MAX_HEADING,
  MAX_PITCH,
  MAX_SPEED,
  MILESTONES,
  MIN_PITCH,
  MIN_SPEED,
  NEAR_MISS_COIN_CAP,
  NEAR_MISS_COINS,
  NEAR_MISS_MARGIN,
  PITCH_GAIN,
  PLANE_RADIUS,
  RING_BOOST,
  RING_COINS,
  SHIELD_GRACE,
  SHIELD_SLOW,
  SLIDE_DECEL,
  SOFT_SLOW,
  STALL_PROGRESS,
  STALL_WINDOW,
  STEP,
  SWOOP_DRAG,
  SWOOP_LIFT,
  SWOOP_STICK,
  TURN_RATE,
} from "./constants";

export interface LaunchAim {
  /** Up from level, rad, clamped to 0..MAX_AIM_PITCH. */
  pitch: number;
  /** Sideways, rad, clamped to ±MAX_AIM_YAW. */
  yaw: number;
  /** How far the band was pulled, 0..1. */
  power: number;
  /** Launch timing multiplier (see minigame/gauge); 1 when absent. */
  boost?: number;
}

export interface StickInput {
  /** -1 (dive) .. 1 (climb); 0 = level out. */
  pitch: number;
  /** -1 (left, -z) .. 1 (right, +z). */
  bank: number;
  boost: boolean;
}

/**
 * Changes to the rules of one flight (the daily challenge's twist). Neither
 * can push the plane past MAX_SPEED, so a finish time is never faster than the
 * physical minimum that the leaderboard rules check.
 */
export interface FlightMods {
  /** Extra acceleration along the path, m/s² (negative for a headwind). */
  accel?: number;
  /** Boost does nothing. */
  noBoost?: boolean;
}

export type EndReason = "landed" | "crash" | "stalled" | "runout" | "timeout";

export type FlightEvent =
  | { type: "coin"; index: number }
  | { type: "ring"; index: number }
  | { type: "fuel"; index: number }
  | { type: "milestone"; share: number }
  | { type: "bump"; kind: ObstacleKind }
  | { type: "shield" }
  | { type: "nearMiss"; combo: number; multiplier: number; coins: number }
  | { type: "crash" }
  | { type: "landed" }
  | { type: "finish" }
  | { type: "stalled" };

/** Mutable flight state. `step` updates it in place (60 steps a second). */
export interface FlightState {
  time: number;
  x: number;
  y: number;
  z: number;
  speed: number;
  pitch: number;
  heading: number;
  bank: number;
  fuel: number;
  shields: number;
  coins: number;
  rings: number;
  /** Near misses this flight. */
  nearMisses: number;
  /** Coins earned from near misses (kept apart from `coins`). */
  nearMissCoins: number;
  /** Near misses in the running combo; 0 when there is none. */
  combo: number;
  /** Most near misses in one combo this flight. */
  bestCombo: number;
  /** Sim time of the latest near miss; the combo lapses COMBO_WINDOW later. */
  lastNearMiss: number;
  maxX: number;
  /** Milestones crossed this flight, 0..MILESTONES.length. */
  milestonesHit: number;
  launchPitch: number;
  phase: "flying" | "sliding" | "done";
  finished: boolean;
  /** Sim time when `finished` first became true; null until then. */
  finishTime: number | null;
  endReason: EndReason | null;
  grace: number;
  progressMark: number;
  progressTimer: number;
  coinTaken: Uint8Array;
  ringTaken: Uint8Array;
  canTaken: Uint8Array;
  softHit: Uint8Array;
  /**
   * Per obstacle: the smallest clear gap (m) to its box while the plane was
   * alongside it, Infinity before that, or -1 once it was hit (no near miss).
   */
  closest: Float32Array;
}

export interface FlightResult {
  /** Progress toward the finish, m, capped at the finish. */
  distance: number;
  coins: number;
  rings: number;
  /** Near-miss figures; absent in results saved or built before they existed. */
  nearMisses?: number;
  nearMissCoins?: number;
  bestCombo?: number;
  finished: boolean;
  /** Sim seconds from launch to crossing the finish; null if never reached. */
  finishTime: number | null;
  endReason: EndReason;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Non-finite numbers (NaN, Infinity) become 0 so they can't poison the sim. */
const finiteOrZero = (v: number) => (Number.isFinite(v) ? v : 0);

export function launch(
  level: LevelDef,
  stats: PlaneStats,
  aim: LaunchAim
): FlightState {
  const pitch = clamp(finiteOrZero(aim.pitch), 0, MAX_AIM_PITCH);
  const power = clamp(finiteOrZero(aim.power), 0, 1);
  const boost = clamp(Number.isFinite(aim.boost) ? aim.boost! : 1, 0.5, 1.5);
  return {
    time: 0,
    x: 0,
    y: LAUNCH_HEIGHT,
    z: 0,
    speed: Math.max(
      MIN_SPEED,
      Math.min(MAX_SPEED, stats.launchSpeed * power * boost)
    ),
    pitch,
    heading: clamp(finiteOrZero(aim.yaw), -MAX_AIM_YAW, MAX_AIM_YAW),
    bank: 0,
    fuel: stats.fuel,
    shields: stats.shields,
    coins: 0,
    rings: 0,
    nearMisses: 0,
    nearMissCoins: 0,
    combo: 0,
    bestCombo: 0,
    lastNearMiss: 0,
    maxX: 0,
    milestonesHit: 0,
    launchPitch: pitch,
    phase: "flying",
    finished: false,
    finishTime: null,
    endReason: null,
    grace: 0,
    progressMark: 0,
    progressTimer: 0,
    coinTaken: new Uint8Array(level.coins.length),
    ringTaken: new Uint8Array(level.rings.length),
    canTaken: new Uint8Array(level.fuelCans.length),
    softHit: new Uint8Array(level.obstacles.length),
    closest: new Float32Array(level.obstacles.length).fill(Infinity),
  };
}

/** A function call, so TypeScript does not narrow `phase` across `end()`. */
function isDone(s: FlightState): boolean {
  return s.phase === "done";
}

function end(s: FlightState, reason: EndReason, events: FlightEvent[]) {
  s.phase = "done";
  s.endReason = reason;
  if (reason === "crash") events.push({ type: "crash" });
  if (reason === "landed") events.push({ type: "landed" });
  if (reason === "stalled") events.push({ type: "stalled" });
}

/**
 * Spends a shield (bounce on) or crashes. Against an obstacle the plane is
 * lifted clear over the box, so one shield never gets burnt twice on the same
 * wide peak or wall.
 */
function hardHit(
  s: FlightState,
  events: FlightEvent[],
  ground: number,
  obstacle?: Obstacle
) {
  if (s.grace > 0) return;
  s.combo = 0;
  if (s.shields > 0) {
    s.shields -= 1;
    s.grace = SHIELD_GRACE;
    s.speed *= SHIELD_SLOW;
    s.pitch = 0.25;
    s.heading *= -0.5;
    s.phase = "flying";
    s.y = obstacle
      ? Math.max(
          s.y,
          obstacle.center.y + obstacle.half.y + PLANE_RADIUS + 1,
          ground + 2
        )
      : Math.max(s.y, ground + 2);
    events.push({ type: "shield" });
  } else {
    end(s, "crash", events);
  }
}

/** Whether (x, z) is above a hard obstacle's footprint. */
function overHardObstacle(level: LevelDef, x: number, z: number): boolean {
  return level.obstacles.some(
    (o) =>
      o.hard &&
      Math.abs(x - o.center.x) <= o.half.x + PLANE_RADIUS &&
      Math.abs(z - o.center.z) <= o.half.z + PLANE_RADIUS
  );
}

function move(s: FlightState, dt: number) {
  const flat = s.speed * Math.cos(s.pitch);
  s.x += flat * Math.cos(s.heading) * dt;
  s.z += flat * Math.sin(s.heading) * dt;
  s.y += s.speed * Math.sin(s.pitch) * dt;
}

function trackProgress(s: FlightState, level: LevelDef, events: FlightEvent[]) {
  if (s.x > s.maxX) s.maxX = s.x;
  while (
    s.milestonesHit < MILESTONES.length &&
    s.maxX >= level.finishDistance * MILESTONES[s.milestonesHit]
  ) {
    events.push({ type: "milestone", share: MILESTONES[s.milestonesHit] });
    s.milestonesHit += 1;
  }
  if (!s.finished && s.maxX >= level.finishDistance) {
    s.finished = true;
    s.finishTime = s.time;
    events.push({ type: "finish" });
  }
  if (s.maxX >= level.finishDistance + RUNOUT) {
    end(s, "runout", events);
    return;
  }
  if (s.maxX - s.progressMark >= STALL_PROGRESS) {
    s.progressMark = s.maxX;
    s.progressTimer = 0;
  } else {
    s.progressTimer += STEP;
    if (s.progressTimer > STALL_WINDOW) end(s, "stalled", events);
  }
  if (s.phase !== "done" && s.time > MAX_FLIGHT_TIME) end(s, "timeout", events);
}

/** Hard obstacles spend a shield or crash; soft ones slow the plane once. */
function collideObstacles(
  s: FlightState,
  level: LevelDef,
  events: FlightEvent[],
  ground: number
) {
  for (let i = 0; i < level.obstacles.length && !isDone(s); i += 1) {
    const o = level.obstacles[i];
    if (Math.abs(s.x - o.center.x) > o.half.x + PLANE_RADIUS) continue;
    if (Math.abs(s.z - o.center.z) > o.half.z + PLANE_RADIUS) continue;
    if (Math.abs(s.y - o.center.y) > o.half.y + PLANE_RADIUS) continue;
    s.closest[i] = -1;
    s.combo = 0;
    if (o.hard) {
      hardHit(s, events, ground, o);
    } else if (!s.softHit[i]) {
      s.softHit[i] = 1;
      s.speed = Math.max(MIN_SPEED, s.speed * SOFT_SLOW);
      events.push({ type: "bump", kind: o.kind });
    }
  }
}

/** The combo multiplier for the nth near miss in a row. */
export function comboMultiplier(combo: number): number {
  return Math.min(MAX_COMBO_MULTIPLIER, Math.max(1, combo));
}

/**
 * Near misses. While the plane is alongside a hard obstacle (inside its
 * collision box's x range) the smallest clear gap to the box is kept. When it
 * flies past without ever touching it, a gap under NEAR_MISS_MARGIN is a near
 * miss. Each obstacle counts once; one that was hit never counts.
 */
function trackNearMisses(
  s: FlightState,
  level: LevelDef,
  events: FlightEvent[]
) {
  if (s.combo > 0 && s.time - s.lastNearMiss > COMBO_WINDOW) s.combo = 0;
  for (let i = 0; i < level.obstacles.length; i += 1) {
    const o = level.obstacles[i];
    if (!o.hard || s.closest[i] < 0) continue;
    const reach = o.half.x + PLANE_RADIUS;
    const dx = s.x - o.center.x;
    if (dx < -reach) continue;
    if (dx <= reach) {
      const gap = Math.max(
        Math.abs(s.z - o.center.z) - (o.half.z + PLANE_RADIUS),
        Math.abs(s.y - o.center.y) - (o.half.y + PLANE_RADIUS)
      );
      if (gap < s.closest[i]) s.closest[i] = gap;
      continue;
    }
    // Past the obstacle: settle it once.
    const gap = s.closest[i];
    s.closest[i] = -1;
    if (gap > NEAR_MISS_MARGIN) continue;
    const isChained = s.combo > 0 && s.time - s.lastNearMiss <= COMBO_WINDOW;
    s.combo = isChained ? s.combo + 1 : 1;
    s.lastNearMiss = s.time;
    s.bestCombo = Math.max(s.bestCombo, s.combo);
    s.nearMisses += 1;
    const multiplier = comboMultiplier(s.combo);
    const coins = Math.min(
      NEAR_MISS_COINS * multiplier,
      NEAR_MISS_COIN_CAP - s.nearMissCoins
    );
    s.nearMissCoins += coins;
    events.push({ type: "nearMiss", combo: s.combo, multiplier, coins });
  }
}

/** Advances one STEP. Mutates `s`; returns what happened. */
export function step(
  s: FlightState,
  level: LevelDef,
  stats: PlaneStats,
  input: StickInput,
  mods: FlightMods = {}
): FlightEvent[] {
  const events: FlightEvent[] = [];
  if (s.phase === "done") return events;
  const dt = STEP;
  s.time += dt;
  s.grace = Math.max(0, s.grace - dt);

  if (s.phase === "sliding") {
    s.speed = Math.max(0, s.speed - SLIDE_DECEL * dt);
    s.pitch = 0;
    move(s, dt);
    const slideGround = terrainHeight(level.terrain, s.x, s.z);
    s.y = slideGround;
    collideObstacles(s, level, events, slideGround);
    if (isDone(s)) return events;
    trackProgress(s, level, events);
    if (!isDone(s) && s.phase === "sliding" && s.speed < 0.5)
      end(s, "landed", events);
    return events;
  }

  // Steering: bank eases to the stick, banking turns the heading.
  const stickBank = finiteOrZero(input.bank);
  const stickPitch = finiteOrZero(input.pitch);
  const bankTarget = clamp(stickBank, -1, 1) * MAX_BANK;
  s.bank += clamp(bankTarget - s.bank, -BANK_RATE * dt, BANK_RATE * dt);
  s.heading += TURN_RATE * Math.sin(s.bank) * dt;

  // Corridor: past the edge, the crosswind turns and pushes you back.
  const over = Math.abs(s.z) - level.corridorHalfWidth;
  if (over > 0) {
    const side = Math.sign(s.z);
    s.heading -=
      side * CORRIDOR_TURN * Math.min(1, over / level.corridorHalfWidth) * dt;
    s.z -= side * over * CORRIDOR_PUSH * dt;
  }
  s.heading = clamp(s.heading, -MAX_HEADING, MAX_HEADING);

  // Pitch: the elevator asks for lift to chase the target angle, but can't
  // make more than the wings give at this speed, so slow planes sink.
  const hold = stickPitch === 0 && s.time < LAUNCH_HOLD;
  const asked = hold ? s.launchPitch : clamp(stickPitch, -1, 1) * MAX_PITCH;
  // Thin air: climbing fades out near the ceiling, and above it the plane
  // glides back down, unless that would drop it onto a hard obstacle.
  const height = s.y - terrainHeight(level.terrain, s.x, s.z);
  const floor = overHardObstacle(level, s.x, s.z) ? 0 : -CEILING_DIVE;
  const roof = MAX_PITCH * clamp((CEILING - height) / CEILING_FADE, floor, 1);
  const target = Math.min(asked, roof);
  // Swoop: out of fuel, a hard dive tucks the wings (less drag) and a hard
  // pull-up bites harder (more lift), so a dive and pull-up buys back a little
  // distance. Gentle steering and hands-off gliding are unchanged.
  const isUnpowered = s.fuel <= 0;
  const isDiving = isUnpowered && stickPitch <= -SWOOP_STICK;
  const isPulling = isUnpowered && stickPitch >= SWOOP_STICK;
  const v = Math.max(s.speed, 1);
  const weight = G * Math.cos(s.pitch);
  const wanted = weight + v * PITCH_GAIN * (target - s.pitch);
  const maxLift =
    stats.lift * v * v * LIFT_HEADROOM * (isPulling ? SWOOP_LIFT : 1);
  const lift = clamp(wanted, -maxLift, maxLift);
  s.pitch = clamp(s.pitch + ((lift - weight) / v) * dt, MIN_PITCH, MAX_PITCH);

  // Speed: drag, gravity along the path, and thrust while there's fuel.
  const drag = stats.drag * (isDiving ? SWOOP_DRAG : 1);
  let accel =
    -drag * s.speed * s.speed - G * Math.sin(s.pitch) + (mods.accel ?? 0);
  if (s.fuel > 0 && stats.thrust > 0) {
    const isBoosting = input.boost && !mods.noBoost;
    accel += stats.thrust * (isBoosting ? BOOST_THRUST : 1);
    s.fuel = Math.max(0, s.fuel - dt * (isBoosting ? BOOST_BURN : 1));
  }
  s.speed = clamp(s.speed + accel * dt, MIN_SPEED, MAX_SPEED);

  const prevX = s.x;
  move(s, dt);
  for (const w of level.winds) {
    if (s.x >= w.fromX && s.x < w.toX) {
      s.y += w.lift * dt;
      s.z += w.push * dt;
    }
  }

  // Pickups.
  level.coins.forEach((c, i) => {
    if (s.coinTaken[i]) return;
    const dx = c.x - s.x;
    if (Math.abs(dx) > COIN_RADIUS) return;
    const dy = c.y - s.y;
    const dz = c.z - s.z;
    if (dx * dx + dy * dy + dz * dz < COIN_RADIUS * COIN_RADIUS) {
      s.coinTaken[i] = 1;
      s.coins += 1;
      events.push({ type: "coin", index: i });
    }
  });
  level.rings.forEach((r, i) => {
    if (s.ringTaken[i] || prevX >= r.center.x || s.x < r.center.x) return;
    const dy = s.y - r.center.y;
    const dz = s.z - r.center.z;
    if (dy * dy + dz * dz < r.radius * r.radius) {
      s.ringTaken[i] = 1;
      s.rings += 1;
      s.coins += RING_COINS;
      s.speed = Math.min(MAX_SPEED, s.speed + RING_BOOST);
      events.push({ type: "ring", index: i });
    }
  });
  if (stats.thrust > 0) {
    level.fuelCans.forEach((c, i) => {
      if (s.canTaken[i]) return;
      const dx = c.x - s.x;
      if (Math.abs(dx) > FUEL_CAN_RADIUS) return;
      const dy = c.y - s.y;
      const dz = c.z - s.z;
      if (dx * dx + dy * dy + dz * dz < FUEL_CAN_RADIUS * FUEL_CAN_RADIUS) {
        s.canTaken[i] = 1;
        s.fuel = Math.min(stats.fuel, s.fuel + FUEL_CAN_SECONDS);
        events.push({ type: "fuel", index: i });
      }
    });
  }

  // Obstacles.
  const ground = terrainHeight(level.terrain, s.x, s.z);
  collideObstacles(s, level, events, ground);
  if (isDone(s)) return events;
  trackNearMisses(s, level, events);

  // Ground.
  if (s.y <= ground) {
    if (s.pitch >= LAND_ANGLE && s.speed <= LAND_SPEED) {
      s.phase = "sliding";
      s.y = ground;
      s.pitch = 0;
      s.bank = 0;
    } else {
      hardHit(s, events, ground);
      if (isDone(s)) return events;
      // Even in grace, never end up below the ground.
      s.y = Math.max(s.y, ground);
    }
  }

  trackProgress(s, level, events);
  return events;
}

export function flightResult(s: FlightState, level: LevelDef): FlightResult {
  return {
    distance: Math.max(0, Math.min(s.maxX, level.finishDistance)),
    coins: s.coins,
    rings: s.rings,
    nearMisses: s.nearMisses,
    nearMissCoins: s.nearMissCoins,
    bestCombo: s.bestCombo,
    finished: s.finished,
    finishTime: s.finishTime,
    endReason: s.endReason ?? "timeout",
  };
}

/** Runs a whole flight (for tests and the balance pilot). */
export function runFlight(
  level: LevelDef,
  stats: PlaneStats,
  aim: LaunchAim,
  pilot: (s: FlightState) => StickInput
): { state: FlightState; events: FlightEvent[] } {
  const state = launch(level, stats, aim);
  const events: FlightEvent[] = [];
  while (state.phase !== "done") {
    events.push(...step(state, level, stats, pilot(state)));
  }
  return { state, events };
}
