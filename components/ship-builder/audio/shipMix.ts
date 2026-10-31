import type { Ship } from "@/lib/ship-builder/model/types";
import type { SimPhase } from "@/lib/ship-builder/sim/types";
import type { SceneSea } from "../scene/seaState";
import type { Cue } from "./cues";
import { SILENT_BEDS, type BedLevels } from "./shipBeds";

/** What the player is doing, which decides the held sounds and the music. */
export type ShipMode = "build" | "sail" | "walk" | "trial";

const WASH_FOR_SEA: Record<SceneSea, number> = {
  calm: 0.25,
  choppy: 0.55,
  stormy: 0.95,
  wild: 1,
};
const WIND_FOR_SEA: Record<SceneSea, number> = {
  calm: 0.12,
  choppy: 0.4,
  stormy: 0.9,
  wild: 1,
};
/** Seconds after she starts sinking until the water rush is at full. */
const RUSH_FULL_AFTER_S = 18;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export interface ModeInputs {
  isTrialRunning: boolean;
  isSailing: boolean;
  isWalking: boolean;
}

/** Walking wins over a trial that keeps running behind the walker. */
export function modeFor({
  isTrialRunning,
  isSailing,
  isWalking,
}: ModeInputs): ShipMode {
  if (isWalking) return "walk";
  if (isTrialRunning) return "trial";
  if (isSailing) return "sail";
  return "build";
}

export interface WorldInputs {
  mode: ShipMode;
  seaState: SceneSea;
  /** Throttle, -0.3 (slow astern) to 1; only read while sailing. */
  throttle: number;
  /** Speed as a share of the ship's top speed (sign ignored). */
  speedShare: number;
}

/**
 * The held sounds around the ship. The sea trial has its own beds, so here a
 * trial adds nothing; building is a quiet sea and wind, and sailing adds the
 * engine's thrum (following the throttle) and the bow wave (following speed).
 */
export function worldBedsFor({
  mode,
  seaState,
  throttle,
  speedShare,
}: WorldInputs): BedLevels {
  if (mode === "trial") return SILENT_BEDS;
  const wash = WASH_FOR_SEA[seaState];
  const wind = WIND_FOR_SEA[seaState];
  if (mode === "sail") {
    const speed = clamp01(Math.abs(speedShare));
    return {
      wash: clamp01(wash * (0.7 + 0.5 * speed)),
      // Wind picks up with the ship's own speed.
      wind: clamp01(wind + 0.4 * speed),
      thrum: 0.12 + 0.88 * clamp01(Math.abs(throttle)),
      bow: speed,
      rush: 0,
    };
  }
  // Walking the deck and building: a calm bed, softer on the deck.
  const scale = mode === "walk" ? 0.8 : 0.55;
  return {
    wash: wash * scale,
    wind: wind * scale,
    thrum: 0,
    bow: 0,
    rush: 0,
  };
}

/** The water rushing in: silent until she sinks, then rising for a while. */
export function rushLevelFor(
  phase: SimPhase,
  time: number,
  sinkingAt: number | null | undefined
): number {
  if (sinkingAt === null || sinkingAt === undefined) return 0;
  if (phase === "done") return 0;
  const rising = clamp01((time - sinkingAt) / RUSH_FULL_AFTER_S);
  // Deep down it is a muffled roar, not a rush: ease it off.
  return phase === "descending" ? rising * 0.6 : rising;
}

// ---- building cues -------------------------------------------------------

export type BuildCue = Extract<
  Cue,
  { kind: "place" | "remove" | "paint" | "undo" | "redo" }
>;

/** The part of the store that decides a building sound. */
export interface BuildSnapshot {
  ship: Ship;
  historyLength: number;
  futureLength: number;
}

function paintKey(ship: Ship): string {
  const hull = JSON.stringify([
    ship.hull.paint ?? null,
    ship.funnelPaint ?? null,
  ]);
  return hull + ship.parts.map((p) => `${p.id}:${p.color ?? ""}`).join("|");
}

/**
 * The sound for a change to the ship, or null. A single new part clicks, a
 * removal pops, a colour change swishes, and undo or redo whoosh. Loading a
 * different ship (many parts at once, or another kind) is silent.
 */
export function buildCueFor(
  prev: BuildSnapshot,
  next: BuildSnapshot
): BuildCue | null {
  if (prev.ship === next.ship) return null;
  const wasUndo =
    next.historyLength === prev.historyLength - 1 &&
    next.futureLength === prev.futureLength + 1;
  if (wasUndo) return { kind: "undo" };
  const wasRedo =
    next.historyLength === prev.historyLength + 1 &&
    next.futureLength === prev.futureLength - 1;
  if (wasRedo) return { kind: "redo" };
  if (next.historyLength <= prev.historyLength) return null;
  if (prev.ship.kind !== next.ship.kind) return null;

  const before = new Set(prev.ship.parts.map((p) => p.id));
  const after = new Set(next.ship.parts.map((p) => p.id));
  let added = 0;
  let removed = 0;
  for (const id of after) if (!before.has(id)) added += 1;
  for (const id of before) if (!after.has(id)) removed += 1;

  if (added === 1 && removed === 0) return { kind: "place" };
  if (added > 1) return null;
  if (removed > 0 && added === 0) return { kind: "remove" };
  if (paintKey(prev.ship) !== paintKey(next.ship)) return { kind: "paint" };
  // A hull resize, bulkhead or rotation: a plain click.
  return { kind: "place" };
}
