/**
 * A frozen scene clock for visual tests. An e2e test sets
 * `window.__SHIP_BUILDER_TEST__ = { freezeTime: 3 }` before the page loads and
 * every animation then shows the scene exactly as it looks at that moment:
 * the sea, bob, clouds, smoke and spinners read the fixed time, while pop-ins
 * and look changes finish at once. Without the flag nothing changes, and
 * production builds never read it.
 */

import { sectorKey, SECTOR_SIZE } from "@/lib/ship-builder/sail/field";
import type { Obstacle, ObstacleKind } from "@/lib/ship-builder/sail/types";
import { TEST_HOOKS_ENABLED } from "@/lib/ship-builder/testHooks";
import type { WalkState } from "@/lib/ship-builder/walk";

/** An obstacle a test plants in the drive field (x ahead, z to starboard). */
export interface TestDriveObstacle {
  kind: ObstacleKind;
  x: number;
  z: number;
  radius: number;
}

export interface ShipBuilderTestConfig {
  /** Seconds of scene time every animation should show. */
  freezeTime?: number;
  /**
   * Sea trial: jump the simulation to this many seconds and hold there (the
   * trial stays "running" so a screenshot can catch a mid-capsize pose). A
   * trial that finishes sooner still ends normally.
   */
  trialSeconds?: number;
  /** Sea trial: play this many times faster, so a whole trial takes moments. */
  trialSpeed?: number;
  /**
   * Ambient occlusion: true forces it on, false off, and either also stops
   * the performance monitor from switching it off. Unset leaves it to the
   * device.
   */
  ao?: boolean;
  /** Drive: obstacles placed in the field at the start of every sail. */
  driveObstacles?: TestDriveObstacle[];
  /**
   * Walk: where (model cells), which way (yaw) and on which level the walker
   * starts, instead of the usual spawn.
   */
  walkSpawn?: Pick<WalkState, "x" | "z" | "yaw" | "level">;
}

declare global {
  interface Window {
    __SHIP_BUILDER_TEST__?: ShipBuilderTestConfig;
  }
}

/** A frame step long enough to finish any fade or ease in one frame. */
export const FROZEN_STEP = 10;

/** The fixed scene time, or null when the clock runs normally. */
export function frozenTime(): number | null {
  if (!TEST_HOOKS_ENABLED) return null;
  if (typeof window === "undefined") return null;
  const time = window.__SHIP_BUILDER_TEST__?.freezeTime;
  return typeof time === "number" && Number.isFinite(time) ? time : null;
}

/** The time animations should show: the frozen time, else the live clock. */
export function sceneTime(liveSeconds: number): number {
  return frozenTime() ?? liveSeconds;
}

function finiteTestNumber(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Seconds the test wants the sea trial held at, or null. */
export function testTrialSeconds(): number | null {
  if (!TEST_HOOKS_ENABLED) return null;
  if (typeof window === "undefined") return null;
  const seconds = finiteTestNumber(window.__SHIP_BUILDER_TEST__?.trialSeconds);
  return seconds !== null && seconds >= 0 ? seconds : null;
}

/** The sea trial playback speed multiplier; 1 when no test sets it. */
export function testTrialSpeed(): number {
  if (!TEST_HOOKS_ENABLED) return 1;
  if (typeof window === "undefined") return 1;
  const speed = finiteTestNumber(window.__SHIP_BUILDER_TEST__?.trialSpeed);
  return speed !== null && speed > 0 ? speed : 1;
}

/**
 * Whether the test wants ambient occlusion forced on (true) or off (false);
 * null leaves it to the device's performance, as in production.
 */
export function testAoOverride(): boolean | null {
  if (!TEST_HOOKS_ENABLED) return null;
  if (typeof window === "undefined") return null;
  const ao = window.__SHIP_BUILDER_TEST__?.ao;
  return typeof ao === "boolean" ? ao : null;
}

/**
 * Obstacles a test wants planted at the start of a drive, or an empty list.
 * They carry the sector they sit in, so the field keeps them like any other.
 */
export function testDriveObstacles(): Obstacle[] {
  if (!TEST_HOOKS_ENABLED) return [];
  if (typeof window === "undefined") return [];
  const planted = window.__SHIP_BUILDER_TEST__?.driveObstacles;
  if (!Array.isArray(planted)) return [];
  return planted.flatMap(({ kind, x, z, radius }, index) =>
    [x, z, radius].every(Number.isFinite)
      ? [
          {
            id: `test:${index}`,
            kind,
            x,
            z,
            radius,
            sector: sectorKey(
              Math.floor(x / SECTOR_SIZE),
              Math.floor(z / SECTOR_SIZE)
            ),
          },
        ]
      : []
  );
}

/** Where a test wants the walker to start, or null for the usual spawn. */
export function testWalkSpawn(): Pick<
  WalkState,
  "x" | "z" | "yaw" | "level"
> | null {
  if (!TEST_HOOKS_ENABLED) return null;
  if (typeof window === "undefined") return null;
  const spawn = window.__SHIP_BUILDER_TEST__?.walkSpawn;
  if (!spawn) return null;
  const { x, z, yaw, level } = spawn;
  return [x, z, yaw, level].every(Number.isFinite)
    ? { x, z, yaw, level }
    : null;
}
