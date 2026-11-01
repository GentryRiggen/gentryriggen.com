import {
  JUMP_S,
  personWorldPoint,
  type BoatLaunch,
  type BodyPose,
  type EvacuationPlan,
} from "@/lib/ship-builder/crowd/evacuation";
import { SIM_STEP_S } from "@/lib/ship-builder/sim/types";
import type { EscapeRequest } from "@/lib/ship-builder/state/escapeActions";
import type { WalkHalf, WalkInput, WalkState } from "@/lib/ship-builder/walk";
import {
  boardableBoat,
  endingOf,
  COLD_WARNING,
  pickupBoat,
  rewindEscape,
  startSwimming,
  stepSwimmer,
  SWIM_MARGIN,
  walkerRestPoint,
  type EscapePhase,
  type HullBox,
  type Swimmer,
} from "@/lib/ship-builder/walk/escape";
import type { VoiceMoment } from "@/lib/ship-builder/voice/lines";
import { MAX_FRAME_DELTA } from "./animationMath";

/** Everything one frame of the escape reads. */
export interface EscapeFrame {
  plan: Pick<EvacuationPlan, "launches" | "boatPoseAt"> | null;
  /** Sim seconds (the trial clock). */
  t: number;
  walk: WalkState | null;
  /** The half of a broken ship the walker rides, or null while whole. */
  half: WalkHalf | null;
  /** The body under the walker now (`walkerBody`). */
  body: BodyPose;
  length: number;
  beam: number;
  /** She has gone under: the hull is no longer in a swimmer's way. */
  hullGone: boolean;
  request: EscapeRequest | null;
  input: WalkInput;
  /** Frame seconds since the last frame. */
  delta: number;
  /** Frame time not yet spent on a whole swim step. */
  leftover: number;
  /** Seconds in the water from warm to frozen. */
  warmthSeconds: number;
}

export interface EscapeAdvance {
  phase: EscapePhase;
  leftover: number;
  /** The boat the walker could board now (aboard only). */
  boardable: BoatLaunch | null;
  /** The boat that could pick the swimmer up now (swimming only). */
  pickup: BoatLaunch | null;
  /** At least one swim step ran (so a kick request has been heard). */
  stepped: boolean;
  /** The heading the walk should now have, or null to leave it. */
  yaw: number | null;
}

/** Seated facing back across the boat at the ship, to watch her go down. */
function shipwardYaw(launch: BoatLaunch): number {
  return launch.outward > 0 ? -Math.PI / 2 : Math.PI / 2;
}

/** A hull that stands in no one's way. */
const NO_HULL = -Infinity;

/**
 * The ship's footprint on the water for a swimmer: her resting footprint,
 * shifted by the body's drift, with room to roam all round. Gone (no
 * footprint) once she is under.
 */
export function hullBoxOf(
  length: number,
  beam: number,
  body: BodyPose,
  gone: boolean
): HullBox {
  return {
    cx: body.driftX ?? 0,
    halfLength: gone ? NO_HULL : length / 2,
    halfBeam: gone ? NO_HULL : beam / 2,
    radius: Math.max(length, beam) / 2 + SWIM_MARGIN,
  };
}

function inert(phase: EscapePhase, leftover: number): EscapeAdvance {
  return {
    phase,
    leftover,
    boardable: null,
    pickup: null,
    stepped: false,
    yaw: null,
  };
}

/**
 * What the record should do after a frame: note a new ending, or forget one
 * the clock was scrubbed back past (so the next ending counts afresh).
 */
export function escapeLedger(
  before: EscapePhase,
  next: EscapePhase
): "record" | "clear" | null {
  const was = endingOf(before);
  const now = endingOf(next);
  if (now && !was) return "record";
  if (was && !now) return "clear";
  return null;
}

/**
 * The spoken line a phase change earns, for the moments without a card:
 * boarding a lifeboat, jumping for a raft and the cold warning. The cards
 * (saved, splash, frozen) speak as they appear (`EscapePopup`'s `onShow`).
 */
export function escapeVoiceMoment(
  before: EscapePhase,
  next: EscapePhase
): Extract<VoiceMoment, "boarded" | "jumped" | "cold"> | null {
  if (before.kind === "aboard" && next.kind === "in-boat" && !next.fromWater) {
    return "boarded";
  }
  if (before.kind === "aboard" && next.kind === "jumping") return "jumped";
  if (
    before.kind === "swimming" &&
    next.kind === "swimming" &&
    !before.warned &&
    next.warned
  ) {
    return "cold";
  }
  return null;
}

/**
 * One frame of the escape, after the walker's own step: undo anything the
 * clock was scrubbed back past, then, aboard, board a boat on request or go
 * into the water once it reaches the walker; in the water, swim on the frame
 * clock in fixed steps until a boat picks them up or the cold wins; a jump
 * into a raft lands after `JUMP_S`. With no evacuation plan (no timeline
 * trial) nothing happens at all. Pure.
 */
export function advanceEscape(
  current: EscapePhase,
  frame: EscapeFrame
): EscapeAdvance {
  const { plan, t } = frame;
  if (!plan) return inert(current, frame.leftover);
  const phase = rewindEscape(current, t);
  if (phase !== current) return inert(phase, 0);

  switch (phase.kind) {
    case "aboard":
      return aboardFrame(phase, plan, frame);
    case "jumping": {
      if (t < phase.since + JUMP_S) return inert(phase, frame.leftover);
      const launch = plan.launches.find((l) => l.boatId === phase.boatId);
      return {
        ...inert(
          {
            kind: "in-boat",
            boatId: phase.boatId,
            since: phase.since + JUMP_S,
            fromWater: false,
          },
          0
        ),
        yaw: launch ? shipwardYaw(launch) : null,
      };
    }
    case "swimming":
      return swimmingFrame(phase, plan, frame);
    case "in-boat":
    case "frozen":
      return inert(phase, frame.leftover);
  }
}

function aboardFrame(
  phase: EscapePhase,
  plan: NonNullable<EscapeFrame["plan"]>,
  frame: EscapeFrame
): EscapeAdvance {
  const { walk, t, length, beam } = frame;
  if (!walk) return inert(phase, 0);
  const boardable = boardableBoat(
    plan.launches,
    walkerRestPoint(walk, length, beam),
    t,
    frame.half
  );
  const world = personWorldPoint(
    {
      x: walk.x,
      z: walk.z,
      level: walk.level,
      yaw: walk.yaw,
      activity: "idle",
    },
    frame.body,
    length,
    beam
  );
  if (frame.request === "board" && boardable) {
    const next: EscapePhase =
      boardable.kind === "davit"
        ? {
            kind: "in-boat",
            boatId: boardable.boatId,
            since: t,
            fromWater: false,
          }
        : { kind: "jumping", boatId: boardable.boatId, since: t, from: world };
    return {
      ...inert(next, 0),
      yaw: next.kind === "in-boat" ? shipwardYaw(boardable) : null,
    };
  }
  if (world.y <= 0) {
    return inert(startSwimming({ x: world.x, z: world.z }, walk.yaw, t), 0);
  }
  return { ...inert(phase, 0), boardable };
}

function swimmingFrame(
  phase: Extract<EscapePhase, { kind: "swimming" }>,
  plan: NonNullable<EscapeFrame["plan"]>,
  frame: EscapeFrame
): EscapeAdvance {
  const { t } = frame;
  const reachable = pickupBoat(plan, phase.swimmer, t);
  if (frame.request === "climb-in" && reachable) {
    return {
      ...inert(
        {
          kind: "in-boat",
          boatId: reachable.boatId,
          since: t,
          fromWater: true,
        },
        0
      ),
      yaw: shipwardYaw(reachable),
    };
  }

  const hull = hullBoxOf(frame.length, frame.beam, frame.body, frame.hullGone);
  let leftover =
    frame.leftover + Math.min(Math.max(0, frame.delta), MAX_FRAME_DELTA);
  let swimmer: Swimmer = phase.swimmer;
  let stepped = false;
  while (leftover >= SIM_STEP_S) {
    leftover -= SIM_STEP_S;
    // A kick is one request, however many steps the frame takes.
    const input = stepped ? { ...frame.input, jump: false } : frame.input;
    const moved = stepSwimmer(swimmer, input, SIM_STEP_S, hull);
    swimmer = {
      ...moved,
      warmth: Math.max(0, swimmer.warmth - SIM_STEP_S / frame.warmthSeconds),
    };
    stepped = true;
    if (swimmer.warmth <= 0) {
      return {
        ...inert({ kind: "frozen", since: t, x: swimmer.x, z: swimmer.z }, 0),
        stepped,
        yaw: swimmer.yaw,
      };
    }
  }
  const next: EscapePhase = stepped
    ? {
        ...phase,
        swimmer,
        warned: phase.warned || swimmer.warmth <= COLD_WARNING,
      }
    : phase;
  return {
    phase: next,
    leftover,
    boardable: null,
    pickup: pickupBoat(plan, swimmer, t),
    stepped,
    yaw: swimmer.yaw,
  };
}
